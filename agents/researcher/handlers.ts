// Researcher handler — synthesizes findings, surfaces contradictions
import type { AgentHandlers } from './_template/handlers.js';

export const handlers: AgentHandlers = {
  /**
   * Researcher directs fetching but does not fetch itself.
   * On blocked source, decides workaround vs report.
   */
  // No custom handlers needed for base researcher — uses defaults
  // Custom diagnose would be for research-specific stalls (paywall, auth, etc.)
};

export default handlers;