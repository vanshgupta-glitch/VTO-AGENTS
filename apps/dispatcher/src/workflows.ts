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
 * doc-loop — the DOCUMENT-DRIVEN engineering loop (the operator's 2026-08-24 structure):
 *   ADMIN (plan) → TASKS → SUBTASKS → RESEARCH → CRITIC (PASS/BLOCK) → CODE → BUILD → CODE_TEST
 *   → DEPLOY (dev store, D-033 — the harness tests the LIVE storefront, so every lap ships first)
 *   → VIDEO_UI_TEST (fake-camera playback of the reference + test clips, 60s each, frame-removal
 *   verdicts) → RESULTS (accuracy score) → ANALYSIS (Opus via OpenClaw: CONTINUE/DONE) → DOCS
 *   (docsmanager updates the documents after EVERY lap) → back to ADMIN — lap after lap until the
 *   analyst says DONE, an error halts it, or the lap cap trips.
 * Every agent stage is handed the SAME shared .md by path (run.carry.taskDoc); it reads the doc, does
 * its part, and updates its section so the next agent picks it up. Operation stages (build/test/
 * video/accuracy) get their results appended to the doc by the daemon. All stages are hard-pinned to
 * the origin machine, so they share one local file. Every stage's start + result also posts to that
 * role's department Slack channel (the daemon's start/work reports), so the whole lap runs in front
 * of the operator's eyes.
 */
const docLoop: WorkflowDef = {
  name: 'doc-loop',
  entry: 'ADMIN',
  docDriven: true,
  stages: {
    ADMIN: {
      id: 'ADMIN',
      executor: agent('admin'),
      produces: 'plan',
      // The daemon materialises the .md skeleton; admin fills Goal/Context/success-criteria + plan.
      transitions: { on_success: 'TASKS', on_empty: 'halt' },
    },
    TASKS: {
      id: 'TASKS',
      executor: agent('admin'),
      produces: 'task_breakdown',
      transitions: { on_success: 'SUBTASKS', on_empty: 'halt' },
    },
    SUBTASKS: {
      id: 'SUBTASKS',
      executor: agent('admin'),
      produces: 'subtask_list',
      transitions: { on_success: 'RESEARCH', on_empty: 'halt' },
    },
    RESEARCH: {
      id: 'RESEARCH',
      executor: agent('researcher'),
      produces: 'research_findings',
      transitions: { on_success: 'CRITIC', on_empty: 'CRITIC' },
    },
    CRITIC: {
      id: 'CRITIC',
      executor: agent('critic'),
      produces: 'critique_verdict',
      // BLOCK sends the lap back to SUBTASKS (capped at 2 blocks per lap by the dispatcher).
      transitions: { on_success: 'CODE', on_empty: 'CODE', on_decision: { PASS: 'CODE', BLOCK: 'SUBTASKS' } },
    },
    CODE: {
      id: 'CODE',
      executor: agent('coder'),
      produces: 'code_changes',
      transitions: { on_success: 'BUILD', on_fail: 'SUBTASKS', on_empty: 'SUBTASKS' },
    },
    BUILD: {
      id: 'BUILD',
      executor: op('build'),
      produces: 'build_result',
      transitions: { on_success: 'CODE_TEST', on_fail: 'route:coder' },
    },
    CODE_TEST: {
      id: 'CODE_TEST',
      executor: op('test'),
      produces: 'test_result',
      transitions: { on_success: 'DEPLOY', on_fail: 'route:coder' },
    },
    DEPLOY: {
      id: 'DEPLOY',
      // Dev-store deploy (D-033, auto) — REQUIRED before the video test: the harness drives the
      // LIVE storefront, so without this the videotester would exercise the previous lap's code.
      executor: op('deploy'),
      produces: 'deploy_version',
      transitions: { on_success: 'VIDEO_UI_TEST', on_fail: 'route:coder' },
    },
    VIDEO_UI_TEST: {
      id: 'VIDEO_UI_TEST',
      executor: op('video'),
      produces: 'video_verdicts',
      transitions: { on_success: 'RESULTS', on_fail: 'route:coder' },
    },
    RESULTS: {
      id: 'RESULTS',
      executor: op('accuracy'),
      produces: 'accuracy_score',
      transitions: { on_success: 'ANALYSIS', on_fail: 'route:coder' },
    },
    ANALYSIS: {
      id: 'ANALYSIS',
      executor: agent('analyst'),
      produces: 'lap_analysis',
      // Opus (via OpenClaw) judges the lap's evidence. Default (no parseable decision) = keep looping.
      // on_fail routes back to the analyst itself (retry with the 3-strike rework cap) — without it
      // a single runtime timeout escalate-halts the whole run.
      transitions: { on_success: 'DOCS', on_empty: 'DOCS', on_fail: 'route:analyst', on_decision: { CONTINUE: 'DOCS', DONE: 'DOCS_FINAL' } },
    },
    DOCS: {
      id: 'DOCS',
      executor: agent('docsmanager'),
      produces: 'document_updates',
      // End of a lap: docsmanager updates the task doc + vault docs, then the next lap begins.
      transitions: { on_success: 'ADMIN', on_empty: 'ADMIN', on_fail: 'route:docsmanager' },
    },
    DOCS_FINAL: {
      id: 'DOCS_FINAL',
      executor: agent('docsmanager'),
      produces: 'document_updates',
      transitions: { on_success: 'REPORT', on_empty: 'REPORT', on_fail: 'route:docsmanager' },
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
