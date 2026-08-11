// Admin handler — manages queue, decomposition, routing
import type { AgentHandlers, RecoveryContext, Diagnosis } from './_template/handlers.js';

export const handlers: AgentHandlers = {
  /**
   * Admin diagnoses decomposition failures and routes to correct capability.
   */
  diagnose: async (ctx: RecoveryContext): Promise<Diagnosis> => {
    const { stuckEvent, task } = ctx;
    const { whatAttempted, errorText, hypothesis } = stuckEvent;

    // If the task itself is the problem (wrong capability, missing dep, dead assumption)
    if (hypothesis.includes('capability') || hypothesis.includes('scope') || hypothesis.includes('dependency')) {
      return {
        rootCause: `Decomposition error: ${hypothesis}`,
        unstickDirective: 'Re-split the work order. Check: 1) Required capability matches an enabled agent. 2) All dependencies are done. 3) Scope does not overlap with other tasks. 4) Assumptions in definition of done are still valid.',
        escalate: false,
      };
    }

    // If executor is circling on a task Admin created
    if (errorText.includes('circling') || hypothesis.includes('circling')) {
      return {
        rootCause: 'Task decomposition too large or wrong discipline',
        unstickDirective: 'Split task smaller. If wrong discipline, change required_capability. If dead assumption, escalate to Claude with evidence.',
        escalate: true,
      };
    }

    return {
      rootCause: 'Unknown decomposition issue',
      unstickDirective: 'Review task definition of done and scope. Verify required_capability resolves to an enabled agent. Check dependency chain.',
      escalate: true,
    };
  },

  /**
   * Admin compiles capped synthesis reports for Claude.
   */
  parseResult: async (stdout: string): Promise<{ success: boolean; summary: string; artifacts: string[]; nextAction: string }> => {
    // Admin's "result" is a report document — success = report written
    return {
      success: true,
      summary: 'Report compiled and posted to swarm-admin',
      artifacts: [],
      nextAction: 'done',
    };
  },
};

export default handlers;