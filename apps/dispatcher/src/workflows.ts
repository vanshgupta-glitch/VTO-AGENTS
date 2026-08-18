/**
 * Workflow definitions — the stage grammar from doc/WORKFLOWS.md, executable by the dispatcher.
 *
 * A stage declares its executor (agent:<role> → an LLM worker the daemons run, operation:<name> →
 * a typed allowlist op, or `human` → halts at a Slack gate) plus transitions. Gates are enforced
 * here: `critique` stages are invisible to coders until a passing critic verdict lands (D-005);
 * `human` stages halt for an operator reaction. `below_target` is the ACCURACY stopping rule.
 */

export type Executor = { kind: 'agent'; role: string } | { kind: 'operation'; op: string } | { kind: 'human' };

export interface Stage {
  id: string;
  executor: Executor;
  /** gate enforced before the executor's task is claimable */
  gate?: 'critique' | 'human';
  produces?: string;
  transitions: {
    on_success: string; // stage id | 'end' | 'halt' | 'escalate'
    on_fail?: string; // stage id | 'end' | 'halt' | 'escalate' | 'route:<role>'
    on_stuck?: string;
    on_empty?: string;
    below_target?: { target: string; carry?: string[] };
    // Doc-driven routing: the agent ends its reply with "DECISION: <KEY>"; the dispatcher routes to
    // on_decision[KEY] (falls back to on_success). Lets hermes choose research-more vs execute.
    on_decision?: Record<string, string>;
  };
}

export interface WorkflowDef {
  name: string;
  entry: string;
  stages: Record<string, Stage>;
  /** doc-driven: agents coordinate through a shared per-run .md task file (passed by path), not by
   *  stuffing each prior artifact into the next prompt. Keeps prompts tiny + lets agents read/edit. */
  docDriven?: boolean;
}

const agent = (role: string) => ({ kind: 'agent', role } as const);
const op = (name: string) => ({ kind: 'operation', op: name } as const);

/** improvement-loop — the main engineering loop (WORKFLOWS §5, mapped to actual roles/ops). */
const improvementLoop: WorkflowDef = {
  name: 'improvement-loop',
  entry: 'ANALYSE',
  stages: {
    ANALYSE: {
      id: 'ANALYSE',
      executor: agent('admin'),
      produces: 'analysis',
      transitions: { on_success: 'NARRATIVE', on_empty: 'halt' },
    },
    NARRATIVE: {
      id: 'NARRATIVE',
      executor: agent('admin'),
      produces: 'narrative_document',
      transitions: { on_success: 'PLAN', on_empty: 'halt' },
    },
    PLAN: {
      id: 'PLAN',
      executor: agent('admin'),
      gate: 'critique',
      produces: 'work_order',
      transitions: { on_success: 'DECOMPOSE', on_fail: 'ANALYSE' },
    },
    DECOMPOSE: {
      id: 'DECOMPOSE',
      executor: agent('admin'),
      produces: 'issue_documents',
      transitions: { on_success: 'PRE_CODE', on_fail: 'escalate' },
    },
    PRE_CODE: {
      id: 'PRE_CODE',
      executor: agent('critic'),
      produces: 'critique',
      transitions: { on_success: 'CODE', on_fail: 'route:admin' },
    },
    CODE: {
      id: 'CODE',
      executor: agent('coder'),
      gate: 'critique',
      produces: 'pull_request',
      transitions: { on_success: 'TEST', on_fail: 'DECOMPOSE' },
    },
    TEST: {
      id: 'TEST',
      executor: op('test'),
      produces: 'test_result',
      transitions: { on_success: 'VIDEO', on_fail: 'route:coder' },
    },
    VIDEO: {
      id: 'VIDEO',
      executor: op('video'),
      produces: 'video_verdicts',
      transitions: { on_success: 'ACCURACY', on_fail: 'route:coder' },
    },
    ACCURACY: {
      id: 'ACCURACY',
      executor: op('accuracy'),
      produces: 'accuracy_score',
      transitions: {
        on_success: 'REPORT',
        below_target: { target: 'ANALYSE', carry: ['accuracy_report'] },
      },
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

/**
 * doc-loop — the DOCUMENT-DRIVEN engineering loop (the requested flow):
 *   SEED (admin creates the task .md) → ROUTE (hermes reads it, analyses code via mem0, and DECIDES
 *   research-more vs execute) → RESEARCH (updates the doc, back to ROUTE) or CODE (executes from the
 *   doc's plan) → BUILD → TEST → REPORT → HUMAN_GATE.
 * Every agent stage is handed the SAME shared .md by path (run.carry.taskDoc); it reads the doc, does
 * its part, and updates its section so the next agent picks up. All stages are hard-pinned to the
 * origin machine, so they share one local file (accessed locally, executed through the gateway).
 */
const docLoop: WorkflowDef = {
  name: 'doc-loop',
  entry: 'SEED',
  docDriven: true,
  stages: {
    SEED: {
      id: 'SEED',
      executor: agent('admin'),
      produces: 'task_document',
      // The daemon materialises the .md skeleton; admin fills Goal/Context/success-criteria.
      transitions: { on_success: 'ROUTE', on_empty: 'ROUTE' },
    },
    ROUTE: {
      id: 'ROUTE',
      executor: agent('admin'),
      produces: 'decision',
      // hermes decides; the dispatcher caps research at 2 rounds then forces EXECUTE.
      transitions: { on_success: 'CODE', on_empty: 'CODE', on_decision: { RESEARCH: 'RESEARCH', EXECUTE: 'CODE' } },
    },
    RESEARCH: {
      id: 'RESEARCH',
      executor: agent('researcher'),
      produces: 'research_findings',
      transitions: { on_success: 'ROUTE', on_empty: 'ROUTE' },
    },
    CODE: {
      id: 'CODE',
      executor: agent('coder'),
      produces: 'code_changes',
      transitions: { on_success: 'BUILD', on_fail: 'ROUTE', on_empty: 'ROUTE' },
    },
    BUILD: {
      id: 'BUILD',
      executor: op('build'),
      produces: 'build_result',
      transitions: { on_success: 'TEST', on_fail: 'route:coder' },
    },
    TEST: {
      id: 'TEST',
      executor: op('test'),
      produces: 'test_result',
      transitions: { on_success: 'REPORT', on_fail: 'route:coder' },
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

export const WORKFLOWS: Record<string, WorkflowDef> = {
  'doc-loop': docLoop,
  'improvement-loop': improvementLoop,
  'research-loop': researchLoop,
  'recovery-loop': recoveryLoop,
};

export const isWorkflowName = (n: unknown): n is string => typeof n === 'string' && n in WORKFLOWS;
