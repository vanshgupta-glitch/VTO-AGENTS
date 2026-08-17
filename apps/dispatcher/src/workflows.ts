/**
 * Workflow definitions — the stage grammar from doc/WORKFLOWS.md, executable by the dispatcher.
 *
 * A stage declares its executor (agent:<role> → an LLM worker the daemons run, operation:<name> →
 * a typed allowlist op, or `human` → halts at a Slack gate) plus transitions. Gates are enforced
 * here: `critique` stages are invisible to coders until a passing critic verdict lands (D-005);
 * `human` stages halt for an operator reaction. `below_target` is the ACCURACY stopping rule.
 */

export type Executor =
  | { kind: 'agent'; role: string }
  | { kind: 'operation'; op: string }
  | { kind: 'human' }
  | { kind: 'fanout'; roles?: string[] };

export interface Stage {
  id: string;
  executor: Executor;
  /** gate enforced before the executor's task is claimable */
  gate?: 'critique' | 'human';
  produces?: string;
  /** literal prompt for the executor (overrides the generic produces-based prompt); {role} → fanout role */
  prompt?: string;
  transitions: {
    on_success: string; // stage id | 'end' | 'halt' | 'escalate'
    on_fail?: string; // stage id | 'end' | 'halt' | 'escalate' | 'route:<role>'
    on_stuck?: string; // stage id — executed after this stage fails (top-tier review, e.g. CLAUDE_REVIEW)
    on_empty?: string;
    below_target?: { target: string; carry?: string[] };
  };
}

export interface WorkflowDef {
  name: string;
  entry: string;
  stages: Record<string, Stage>;
}

const agent = (role: string) => ({ kind: 'agent', role } as const);
const op = (name: string) => ({ kind: 'operation', op: name } as const);
const fanout = (roles?: string[]) => ({ kind: 'fanout', roles } as const);

/**
 * improvement-loop — the main engineering loop (WORKFLOWS §5, mapped to actual roles/ops).
 * Claude (tier-1 strategist, A4) owns analysis/narrative/work-order; it hands a proper command
 * to Admin, who decomposes. Any executor stage that fails routes to CLAUDE_REVIEW — Claude's stuck
 * analysis becomes the Admin rework directive (dispatcher.ts).
 */
const improvementLoop: WorkflowDef = {
  name: 'improvement-loop',
  entry: 'ANALYSE',
  stages: {
    ANALYSE: {
      id: 'ANALYSE',
      executor: agent('claude'),
      produces: 'analysis',
      transitions: { on_success: 'NARRATIVE', on_empty: 'halt' },
    },
    NARRATIVE: {
      id: 'NARRATIVE',
      executor: agent('claude'),
      produces: 'narrative_document',
      transitions: { on_success: 'PLAN', on_empty: 'halt' },
    },
    PLAN: {
      id: 'PLAN',
      executor: agent('claude'),
      gate: 'critique',
      produces: 'work_order',
      transitions: { on_success: 'DECOMPOSE', on_fail: 'ANALYSE' },
    },
    DECOMPOSE: {
      id: 'DECOMPOSE',
      executor: agent('admin'),
      produces: 'issue_documents',
      transitions: { on_success: 'PRE_CODE', on_fail: 'escalate', on_stuck: 'CLAUDE_REVIEW' },
    },
    PRE_CODE: {
      id: 'PRE_CODE',
      executor: agent('critic'),
      produces: 'critique',
      transitions: { on_success: 'CODE', on_fail: 'route:admin', on_stuck: 'CLAUDE_REVIEW' },
    },
    CODE: {
      id: 'CODE',
      executor: agent('coder'),
      gate: 'critique',
      produces: 'pull_request',
      transitions: { on_success: 'TEST', on_fail: 'DECOMPOSE', on_stuck: 'CLAUDE_REVIEW' },
    },
    TEST: {
      id: 'TEST',
      executor: op('test'),
      produces: 'test_result',
      transitions: { on_success: 'VIDEO', on_fail: 'route:coder', on_stuck: 'CLAUDE_REVIEW' },
    },
    VIDEO: {
      id: 'VIDEO',
      executor: op('video'),
      produces: 'video_verdicts',
      transitions: { on_success: 'ACCURACY', on_fail: 'route:coder', on_stuck: 'CLAUDE_REVIEW' },
    },
    ACCURACY: {
      id: 'ACCURACY',
      executor: op('accuracy'),
      produces: 'accuracy_score',
      transitions: {
        on_success: 'REPORT',
        below_target: { target: 'ANALYSE', carry: ['accuracy_report'] },
        on_stuck: 'CLAUDE_REVIEW',
      },
    },
    /** Claude reviews a stuck/failed stage and hands Admin the rework directive. */
    CLAUDE_REVIEW: {
      id: 'CLAUDE_REVIEW',
      executor: agent('claude'),
      produces: 'stuck_analysis',
      transitions: { on_success: 'end', on_fail: 'escalate' },
    },
    REPORT: {
      id: 'REPORT',
      executor: agent('admin'),
      produces: 'report',
      transitions: { on_success: 'HUMAN_GATE' },
    },
    HUMAN_GATE: {
      id: 'HUMAN_GATE',
      executor: { kind: 'human' },
      transitions: { on_success: 'end', on_fail: 'halt' },
    },
  },
};

/** research-loop — harvest → synthesise → refute → publish (WORKFLOWS §8). */
const researchLoop: WorkflowDef = {
  name: 'research-loop',
  entry: 'RESEARCH_PLAN',
  stages: {
    RESEARCH_PLAN: {
      id: 'RESEARCH_PLAN',
      executor: agent('researcher'),
      produces: 'research_plan',
      transitions: { on_success: 'SYNTHESISE', on_empty: 'halt' },
    },
    SYNTHESISE: {
      id: 'SYNTHESISE',
      executor: agent('researcher'),
      produces: 'finding',
      transitions: { on_success: 'REFUTE', on_empty: 'halt' },
    },
    REFUTE: {
      id: 'REFUTE',
      executor: agent('critic'),
      produces: 'refutation_check',
      transitions: { on_success: 'PUBLISH', on_fail: 'SYNTHESISE' },
    },
    PUBLISH: {
      id: 'PUBLISH',
      executor: agent('admin'),
      produces: 'published_finding',
      transitions: { on_success: 'end' },
    },
  },
};

/** recovery-loop — diagnose a stuck/failing run, then return to the parent (WORKFLOWS §6). */
const recoveryLoop: WorkflowDef = {
  name: 'recovery-loop',
  entry: 'DIAGNOSE',
  stages: {
    DIAGNOSE: {
      id: 'DIAGNOSE',
      executor: agent('admin'),
      produces: 'diagnosis',
      transitions: { on_success: 'RECORD', on_fail: 'escalate' },
    },
    RECORD: {
      id: 'RECORD',
      executor: agent('admin'),
      produces: 'solutions_entry',
      transitions: { on_success: 'end' },
    },
  },
};

/** health-loop — one-shot swarm health check: Claude confirms, then EVERY alive worker replies "OK WORKING". */
const healthLoop: WorkflowDef = {
  name: 'health-loop',
  entry: 'ANALYSE',
  stages: {
    ANALYSE: {
      id: 'ANALYSE',
      executor: agent('claude'),
      prompt: 'Swarm health check. Reply with exactly: "OK WORKING from claude".',
      transitions: { on_success: 'FANOUT', on_empty: 'halt' },
    },
    FANOUT: {
      id: 'FANOUT',
      executor: fanout(),
      prompt: 'Swarm health check. Reply with exactly: "OK WORKING from {role}".',
      transitions: { on_success: 'end', on_fail: 'end' },
    },
  },
};

export const WORKFLOWS: Record<string, WorkflowDef> = {
  'improvement-loop': improvementLoop,
  'research-loop': researchLoop,
  'recovery-loop': recoveryLoop,
  'health-loop': healthLoop,
};

export const isWorkflowName = (n: unknown): n is string => typeof n === 'string' && n in WORKFLOWS;
