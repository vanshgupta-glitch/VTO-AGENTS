import { appendFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
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

/**
 * Enforcement lives here, not in the agent's prompt.
 *
 * tools/setup.py tells the model "Never print a secret at any log level", but
 * the bridge captures that model's raw stdout and writes it to two files and a
 * Slack channel. An instruction the agent may ignore becomes a leak the moment
 * a logger sits behind it, so the guarantee has to be mechanical at the sink.
 */
const SECRET_PATTERNS = [
  /xox[baprs]-[A-Za-z0-9-]{10,}/g,
  /xapp-[A-Za-z0-9-]{10,}/g,
  /\bsk-[A-Za-z0-9_-]{16,}/g,
];

export function redact(s: string): string {
  let out = s;
  for (const re of SECRET_PATTERNS) out = out.replace(re, '[REDACTED]');
  return out;
}

export interface Logger {
  logEvent(e: LogEvent): void;
}

export function createLogger(paths: SwarmPaths): Logger {
  return {
    logEvent(e: LogEvent): void {
      // Spec section 3.4: no failure in the log tier may change the outcome of
      // a task. Everything below is best-effort.
      try {
        mkdirSync(paths.agentsDir, { recursive: true });
        const ts = new Date().toISOString();

        // Newlines are collapsed so one event is always one line: the Agent OS
        // activity feed treats every line as a separate entry, and a multi-line
        // agent reply would otherwise flood it.
        const msg = redact(e.message).replace(/\r?\n/g, ' ').slice(0, 2000);

        const line =
          `${ts} [${e.level.toUpperCase()}] ${e.task} ${e.agent} ` +
          `stage=${e.stage} origin=${e.origin}` +
          (e.outcome ? ` outcome=${e.outcome}` : '') +
          (e.durationMs !== undefined ? ` ${e.durationMs}ms` : '') +
          ` :: ${msg}\n`;
        appendFileSync(join(paths.logDir, 'swarm.log'), line, 'utf8');

        // Field names match the `runs` table in the cost-minimal-memory spec so
        // that work can ingest this archive rather than re-instrument.
        const row =
          JSON.stringify({
            ts,
            task: e.task,
            agent: e.agent,
            origin: e.origin,
            stage: e.stage,
            level: e.level,
            channel: e.channel,
            duration_ms: e.durationMs,
            outcome: e.outcome,
            message: msg,
          }) + '\n';
        appendFileSync(join(paths.agentsDir, `${e.agent}.jsonl`), row, 'utf8');
      } catch (err) {
        process.stderr.write(`[log] sink write failed (continuing): ${String(err)}\n`);
      }
    },
  };
}
