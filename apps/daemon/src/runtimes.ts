/**
 * Runtime adapters — spawn a local CLI for a task and return its text.
 * Paths come from the per-machine config (config/machine.local.json), never committed,
 * so each operator's machine points at its own binaries (D-035 / per-machine paths).
 */
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const execFileP = promisify(execFile);
// eslint-disable-next-line no-control-regex
const stripAnsi = (s: string): string => s.replace(/\x1b\[[0-9;]*m/g, '');

export type RuntimeName = 'hermes' | 'claude' | 'opencode' | 'openclaw' | 'operation';

export interface WorkerDef {
  role: string;
  runtime: RuntimeName;
  profile?: string; // hermes
  model?: string; // claude / opencode
  agent?: string; // openclaw
  op?: 'build' | 'lint' | 'test' | 'deploy' | 'video' | 'accuracy'; // runtime === 'operation'
  maxConcurrent: number;
}

export type RuntimePaths = Partial<Record<RuntimeName, string>>;

const TIMEOUT_MS = 300_000;
const MAX_BUFFER = 20 * 1024 * 1024;

/** Run the task's prompt on the worker's runtime; returns trimmed stdout. Throws on failure. */
export async function runRuntime(w: WorkerDef, prompt: string, paths: RuntimePaths): Promise<string> {
  const opts = { timeout: TIMEOUT_MS, maxBuffer: MAX_BUFFER } as const;
  if (w.runtime === 'hermes') {
    const bin = paths.hermes;
    if (!bin) throw new Error('hermes path not configured');
    const { stdout } = await execFileP(bin, ['-p', w.profile ?? w.role, '-z', prompt], opts);
    return stripAnsi(stdout).trim();
  }
  if (w.runtime === 'claude') {
    const bin = paths.claude;
    if (!bin) throw new Error('claude path not configured');
    // Authenticated Claude Code subscription (no OpenRouter): omit `--model` so the CLI uses the
    // best model the subscription allows; pass it only when the worker explicitly pins one.
    // The kit prompt can begin with `---` (soul frontmatter); a leading `-` is parsed as an option,
    // so prepend a newline to force it to be treated as the positional prompt.
    const args = w.model ? ['-p', `\n${prompt}`, '--model', w.model] : ['-p', `\n${prompt}`];
    const { stdout } = await execFileP(bin, args, opts);
    return stripAnsi(stdout).trim();
  }
  if (w.runtime === 'opencode') {
    const bin = paths.opencode;
    if (!bin) throw new Error('opencode path not configured');
    const { stdout } = await execFileP(
      'powershell.exe',
      ['-NoProfile', '-File', bin, 'run', prompt, '-m', w.model ?? 'opencode/big-pickle'],
      opts,
    );
    return stripAnsi(stdout).trim();
  }
  if (w.runtime === 'openclaw') {
    const bin = paths.openclaw;
    if (!bin) throw new Error('openclaw path not configured');
    const dir = mkdtempSync(join(tmpdir(), 'swarm-'));
    const pf = join(dir, 'prompt.txt');
    writeFileSync(pf, prompt, 'utf8');
    const { stdout } = await execFileP(
      'powershell.exe',
      ['-NoProfile', '-File', bin, '--agent', w.agent ?? w.role, '--prompt-file', pf],
      opts,
    );
    return stripAnsi(stdout).trim();
  }
  throw new Error(`unknown runtime ${String(w.runtime)}`);
}
