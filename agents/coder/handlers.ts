// Coder-specific handlers
import type { RecoveryContext, Diagnosis, AgentHandlers, AgentResult } from './_template/handlers.js';

export const handlers: AgentHandlers = {
  /**
   * Coder diagnoses its own executor stalls — it holds the diff, intent, and plan.
   * This is why Coder is an orchestrator (tier 2), not an executor.
   */
  diagnose: async (ctx: RecoveryContext): Promise<Diagnosis> => {
    const { stuckEvent, runHistory, task, codebase } = ctx;
    const { whatAttempted, errorText, hypothesis } = stuckEvent;

    // Check for common patterns
    if (errorText.includes('Cannot find module') || errorText.includes('Module not found')) {
      return {
        rootCause: 'Missing dependency or wrong import path',
        unstickDirective: 'Run `pnpm install` in the package root. Verify import paths in llm.md match actual file structure. If a module was moved, update imports across the affected scope.',
        escalate: false,
      };
    }

    if (errorText.includes('TypeError') || errorText.includes('type')) {
      return {
        rootCause: 'TypeScript type mismatch — likely a refactor changed a signature',
        unstickDirective: 'Run `pnpm tsc -b` to see all type errors. Fix the specific mismatch at the error location. Check if the change requires updating dependent files (see llm.md module dependencies).',
        escalate: false,
      };
    }

    if (errorText.includes('test') && errorText.includes('fail')) {
      return {
        rootCause: 'Test failure — triage needed',
        unstickDirective: 'Run the failing test in isolation. Classify: Regression (fix it), Pre-existing (report, do not fix), Flake (needs 3 consistent passes), Environment (fix env). Report verdict with evidence.',
        escalate: false,
      };
    }

    // Circling detection: same file, same error, multiple attempts
    const recentRuns = runHistory.slice(-3);
    const sameFile = recentRuns.every(r => r.stdoutPath === recentRuns[0].stdoutPath);
    const sameError = recentRuns.every(r => r.summary.includes(hypothesis.split(' ')[0] || ''));

    if (sameFile && sameError && recentRuns.length >= 2) {
      return {
        rootCause: 'Circling — same fix attempted repeatedly without progress',
        unstickDirective: 'STOP. The approach is wrong. Re-read llm.md for this module. Check solutions store for this theme_hash. Consider: wrong abstraction level, missing dependency, or dead assumption. Escalate to Admin with diagnosis.',
        escalate: true,
      };
    }

    // Default: escalate with context
    return {
      rootCause: hypothesis || 'Unknown — executor hypothesis not actionable',
      unstickDirective: `Executor hypothesis: ${hypothesis}. Re-read llm.md module definitions. Check if scope needs adjustment. If blocked on external dependency, report as capability gap.`,
      escalate: true,
    };
  },

  /**
   * Coder triages test failures — it holds the diff and intent.
   */
  parseResult: async (stdout: string, stderr: string): Promise<AgentResult> => {
    const exitCode = stderr.includes('error') || stdout.includes('FAIL') ? 1 : 0;
    if (exitCode === 0) {
      return {
        success: true,
        summary: 'All verification commands passed',
        artifacts: [],
        nextAction: 'done',
      };
    }

    // Parse test output for triage hints
    const isTypeError = stdout.includes('ts(') || stderr.includes('TS');
    const isLintError = stdout.includes('eslint') || stderr.includes('ESLint');
    const isTestFailure = stdout.includes('vitest') || stdout.includes('FAIL') || stdout.includes('● ');

    let triageHint = '';
    if (isTypeError) triageHint = 'TypeScript errors — check imports and type definitions';
    else if (isLintError) triageHint = 'Lint errors — run `pnpm lint --fix` first';
    else if (isTestFailure) triageHint = 'Test failures — run failing test in isolation and classify';

    return {
      success: false,
      summary: `Verification failed: ${triageHint}`,
      artifacts: [],
      nextAction: 'escalate', // goes to Admin for triage routing
    };
  },

  /**
   * Shopify-specific pre-dispatch context injection.
   */
  preDispatch: async (task) => {
    const extra = [];
    if (task.scope.some(p => p.includes('theme-extension'))) {
      extra.push('SHOPIFY THEME EXTENSION RULES:');
      extra.push('- All changes in extensions/ directory only');
      extra.push('- No modifications to core theme files');
      extra.push('- Use `shopify theme dev` for local testing');
      extra.push('- Build output goes to dist/ — do not commit dist/');
    }
    if (task.scope.some(p => p.includes('app/'))) {
      extra.push('SHOPIFY APP RULES:');
      extra.push('- Follow remix conventions in apps/');
      extra.push('- API routes in app/routes/api.*');
      extra.push('- Webhook handlers in app/routes/webhooks.*');
    }
    return { extraContext: extra.join('\n') };
  },

  /**
   * Shopify-specific critique checks.
   */
  critique: async (plan) => {
    const risks = [];
    if (plan.scope.some(p => p.includes('theme-extension') && !p.includes('extensions/'))) {
      risks.push({
        risk: 'Plan modifies core theme files instead of theme extension',
        alternative: 'Move changes to extensions/ directory; use theme app extension pattern',
      });
    }
    if (plan.approach.includes('direct DOM manipulation')) {
      risks.push({
        risk: 'Direct DOM manipulation breaks Shopify theme editor preview',
        alternative: 'Use Shopify section/block schema + Liquid; or app block for React components',
      });
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