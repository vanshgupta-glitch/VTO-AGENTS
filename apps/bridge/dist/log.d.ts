import type { SwarmPaths } from './config.js';
export type Outcome = 'success' | 'stuck' | 'timeout' | 'error';
export interface LogEvent {
    task: string;
    agent: string;
    origin: 'slack' | 'cli';
    stage: string;
    level: 'info' | 'warn' | 'err';
    channel?: string;
    durationMs?: number;
    outcome?: Outcome;
    message: string;
}
export declare function redact(s: string): string;
export interface Logger {
    logEvent(e: LogEvent): void;
}
export declare function createLogger(paths: SwarmPaths): Logger;
