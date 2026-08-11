// Critic-specific handlers
import type { AgentHandlers } from './_template/handlers.js';

export const handlers: AgentHandlers = {
  /**
   * Critic reviews both work orders AND coding plans.
   * Work-order critique asks different questions than code critique.
   */
  critique: async (plan) => {
    const risks = [];

    // Work-order level checks
    if (!plan.intent || plan.intent.length < 20) {
      risks.push({
        risk: 'Work order intent is vague or missing',
        alternative: 'Write a one-sentence goal that names the specific gap being closed',
      });
    }

    if (!plan.scope || plan.scope.length === 0) {
      risks.push({
        risk: 'No scope declared — executor will not know boundaries',
        alternative: 'List exact file paths or globs the task may touch',
      });
    }

    const hasCheckableDone = Array.isArray(plan.definitionOfDone) &&
      plan.definitionOfDone.every(d => d.includes('run') || d.includes('test') || d.includes('build') || d.includes('verify'));
    if (!hasCheckableDone) {
      risks.push({
        risk: 'Definition of done is not mechanically checkable',
        alternative: 'Each line must be verifiable by running a command (e.g., "pnpm test passes", "accuracy >= 0.98")',
      });
    }

    // Check for stale evidence
    if (plan.evidence && plan.evidence.includes('trajectory.md')) {
      // Would check trajectory.md last_enriched_loop vs current loop
      risks.push({
        risk: 'Evidence cites trajectory.md — verify it was enriched this loop',
        alternative: 'Re-run ENRICH before planning, or cite specific llm.md sections',
      });
    }

    // Coding plan specific checks
    if (plan.approach) {
      if (plan.approach.includes('refactor') && !plan.approach.includes('FooV2')) {
        risks.push({
          risk: 'Refactor plan edits existing files — corruption risk',
          alternative: 'Create new files (FooV2.ts) and swap after approval. Old file retired only after new one passes all gates.',
        });
      }
      if (plan.approach.includes('add test') && !plan.approach.includes('existing test')) {
        risks.push({
          risk: 'Adding tests without checking existing coverage',
          alternative: 'Check solutions store for existing test patterns. Reuse rather than duplicate.',
        });
      }
    }

    return {
      willItWork: risks.length === 0,
      regressionSurface: risks.map(r => r.risk),
      fullyKittedPass: risks.length === 0,
      risks,
    };
  },
};

export default handlers;