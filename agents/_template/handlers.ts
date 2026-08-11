// Optional custom handlers for <agent-id>
// Only implement what you need — most agents use defaults

export interface RecoveryContext {
  taskId: string;
  runId: string;
  stuckEvent: {
    whatAttempted: string;
    errorText: string;
    resourcesTouched: string[];
    hypothesis: string;
    detectionSource: string;
    themeHash: string;
  };
  runHistory: Array<{
    attempt: number;
    status: string;
    summary: string;
    stdoutPath: string;
  }>;
  task: {
    requiredCapability: string;
    scope: string[];
    definitionOfDone: string[];
  };
  codebase: {
    llmMd: string;
    claudeMd: string;
  };
}

export interface Diagnosis {
  rootCause: string;
  unstickDirective: string;
  escalate: boolean;
  newRequiredCapability?: string;
}

export interface AgentResult {
  success: boolean;
  summary: string;
  artifacts: string[];
  metrics?: Record<string, number>;
  nextAction?: 'continue' | 'retry' | 'escalate' | 'done';
}

export interface RecoveryContext {
  taskId: string;
  runId: string;
  stuckEvent: {
    whatAttempted: string;
    errorText: string;
    resourcesTouched: string[];
    hypothesis: string;
    detectionSource: string;
    themeHash: string;
  };
  runHistory: Array<{
    attempt: number;
    status: string;
    summary: string;
    stdoutPath: string;
  }>;
  task: {
    requiredCapability: string;
    scope: string[];
    definitionOfDone: string[];
  };
  codebase: {
    llmMd: string;
    claudeMd: string;
  };
}

export interface AgentHandlers {
  /**
   * Override default diagnosis for stuck events.
   * Return { rootCause, unstickDirective, escalate }
   * If escalate=true, goes up the ladder without applying directive.
   */
  diagnose?: (ctx: RecoveryContext) => Promise<Diagnosis>;

  /**
   * Parse executor stdout into structured result.
   * Default: treats exit code 0 as success, non-zero as failure.
   * Accuracy uses this to parse JSON score output.
   */
  parseResult?: (stdout: string, stderr: string) => Promise<AgentResult>;

  /**
   * Inject extra context before dispatching to executor.
   * Useful for adding codebase-specific hints or prior art references.
   */
  preDispatch?: (task: { id: string; scope: string[]; definitionOfDone: string[] }) => Promise<{ extraContext: string }>;

  /**
   * Domain-specific pre-code checks beyond the standard critique.
   * Coder uses this for Shopify theme extension rules, etc.
   */
  critique?: (plan: { intent: string; scope: string[]; approach: string }) => Promise<{
    willItWork: boolean;
    regressionSurface: string[];
    fullyKittedPass: boolean;
    risks: Array<{ risk: string; alternative: string }>;
    knownSolutionId?: number;
  }>;
}

// Default exports — most agents just use these
export const handlers: AgentHandlers = {
  // diagnose: async (ctx) => { ... },
  // parseResult: async (stdout, stderr) => { ... },
  // preDispatch: async (task) => { ... },
  // critique: async (plan) => { ... },
};

export default handlers;