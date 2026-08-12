import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

/**
 * The task header every swarm message carries.
 *
 * The separator is U+00B7 MIDDLE DOT. config/bridge.config.yaml declared this
 * pattern as '\\[T(\\d+) \\· loop ...' -- but YAML single quotes do not process
 * backslash escapes, so the regex engine received an escaped literal backslash
 * followed by an open character class. It could never match, and
 * task_header.required was true, so a faithful implementation would have
 * rejected every message.
 */
export const HEADER_RE = /\[T(\d+) · loop (\d+) · stage=(\w+)\]/;

export function formatHeader(task: string, loop: number, stage: string): string {
  return `[${task} · loop ${loop} · stage=${stage}]`;
}

export function parseHeader(s: string): { task: string; loop: number; stage: string } | null {
  const m = HEADER_RE.exec(s);
  if (!m) return null;
  return { task: `T${m[1]}`, loop: Number(m[2]), stage: m[3]! };
}

/**
 * Monotonic task counter.
 *
 * An interim home for what becomes `data/runs.db` under the cost-minimal-memory
 * spec. One field, chosen so this does not take a dependency on unbuilt work.
 * A corrupt file restarts the counter rather than throwing: a daemon that
 * cannot allocate a task id is a daemon that cannot serve any request, and
 * duplicate ids are a smaller problem than an outage.
 */
export function nextTaskId(stateFile: string): string {
  let n = 0;
  try {
    if (existsSync(stateFile)) {
      const parsed = JSON.parse(readFileSync(stateFile, 'utf8')) as { lastTask?: number };
      n = typeof parsed.lastTask === 'number' ? parsed.lastTask : 0;
    }
  } catch {
    n = 0;
  }
  n += 1;
  try {
    mkdirSync(dirname(stateFile), { recursive: true });
    writeFileSync(stateFile, JSON.stringify({ lastTask: n }), 'utf8');
  } catch (err) {
    process.stderr.write(`[header] could not persist task counter: ${String(err)}\n`);
  }
  return `T${String(n).padStart(3, '0')}`;
}
