// Accuracy agent handler — parses JSON score output
import type { AgentHandlers, AgentResult } from './_template/handlers.js';

export const handlers: AgentHandlers = {
  /**
   * Accuracy outputs JSON — parse it instead of treating prose as result.
   */
  parseResult: async (stdout: string): Promise<AgentResult> => {
    let data: any;
    try {
      // Find JSON in output (may have log lines before)
      const jsonMatch = stdout.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('No JSON found in output');
      data = JSON.parse(jsonMatch[0]);
    } catch (e) {
      return {
        success: false,
        summary: `Accuracy output not valid JSON: ${e}`,
        artifacts: [],
        nextAction: 'escalate',
      };
    }

    const { score, target, passed, term_verdict, term_fit, term_perceptual, term_stability, active_terms, notes } = data;

    if (typeof score !== 'number' || typeof target !== 'number') {
      return {
        success: false,
        summary: 'Accuracy JSON missing required fields (score, target)',
        artifacts: [],
        nextAction: 'escalate',
      };
    }

    const activeTermsList = active_terms?.join(', ') || 'none';
    const summary = `Accuracy: ${(score * 100).toFixed(1)}% (target ${(target * 100).toFixed(0)}%) — ${passed ? 'PASS' : 'BELOW TARGET'} — active terms: ${activeTermsList}`;

    return {
      success: passed,
      summary,
      artifacts: data.artifacts || [],
      metrics: { score, target, term_verdict, term_fit, term_perceptual, term_stability },
      nextAction: passed ? 'done' : 'retry', // below_target routes back to ANALYSE
    };
  },
};

export default handlers;