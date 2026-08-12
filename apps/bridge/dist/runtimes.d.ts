import type { AgentSpec } from './config.js';
export interface RunResult {
    ok: boolean;
    stdout: string;
    stderr: string;
    code: number | null;
    durationMs: number;
    timedOut: boolean;
}
export interface Runner {
    /** Run an agent with its declared cmd_template. */
    run(agent: AgentSpec, prompt: string): Promise<RunResult>;
    /** Run explicit args against a runtime's binary. Used by tests and harnesses. */
    runRaw(agent: AgentSpec, args: string[], prompt?: string): Promise<RunResult>;
}
export declare function stripAnsi(s: string): string;
export declare function isStuck(s: string): boolean;
export declare function createRunner(root: string, timeoutSeconds: number): Runner;
