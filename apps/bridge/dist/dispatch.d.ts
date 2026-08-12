import type { BridgeConfig } from './config.js';
import type { Runner } from './runtimes.js';
import type { Logger, Outcome } from './log.js';
export interface DispatchRequest {
    agent: string;
    text: string;
    origin: 'slack' | 'cli';
    channel?: string;
}
export interface DispatchResult {
    ok: boolean;
    taskId: string;
    reply: string;
    outcome: Outcome;
    error?: string;
}
export interface Dispatcher {
    dispatch(req: DispatchRequest): Promise<DispatchResult>;
}
/**
 * The core. Deliberately transport-blind: it knows nothing about Slack or HTTP.
 *
 * Adding Critic and Coder in Phase 1b is a change to what this calls, not to
 * how requests arrive -- which is the whole reason the boundary is here.
 */
export declare function createDispatcher(deps: {
    config: BridgeConfig;
    runner: Runner;
    logger: Logger;
}): Dispatcher;
