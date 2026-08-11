// VideoTester agent handler — parses structured video test output
import type { AgentHandlers, AgentResult } from './_template/handlers.js';

export const handlers: AgentHandlers = {
  /**
   * VideoTester outputs structured per-clip verdicts — parse for accuracy harness.
   */
  parseResult: async (stdout: string): Promise<AgentResult> => {
    const lines = stdout.trim().split('\n');
    const verdicts: Record<string, { status: string; segPx?: number; peakP?: number; blockPct?: number }> = {};

    for (const line of lines) {
      // Parse: "clear:      applied  seg=10983px peakP=0.98"
      const match = line.match(/(\w+):\s+(applied|none|FAIL|blocked)\s*(?:seg=([\d.]+)px)?\s*(?:peakP=([\d.]+))?\s*(?:block=(\d+)%)?/);
      if (match) {
        const [, clip, status, seg, peakP, block] = match;
        verdicts[clip] = {
          status,
          segPx: seg ? parseFloat(seg) : undefined,
          peakP: peakP ? parseFloat(peakP) : undefined,
          blockPct: block ? parseInt(block) : undefined,
        };
      }
    }

    if (Object.keys(verdicts).length === 0) {
      return {
        success: false,
        summary: 'Video test output not parsed — no structured verdicts found',
        artifacts: [],
        nextAction: 'escalate',
      };
    }

    const failed = Object.values(verdicts).some(v => v.status === 'FAIL' || v.status === 'blocked');
    const summary = Object.entries(verdicts).map(([clip, v]) =>
      `${clip}: ${v.status}${v.segPx ? ` seg=${v.segPx}px` : ''}${v.peakP ? ` peakP=${v.peakP}` : ''}${v.blockPct ? ` block=${v.blockPct}%` : ''}`
    ).join('; ');

    return {
      success: !failed,
      summary,
      artifacts: [],
      metrics: { verdicts },
      nextAction: failed ? 'retry' : 'done', // on_fail routes to Coder
    };
  },
};

export default handlers;