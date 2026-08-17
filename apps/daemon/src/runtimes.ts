/**
 * Runtime adapters — spawn a local CLI for a task and return its text.
 * Paths come from the per-machine config (config/machine.local.json), never committed,
 * so each operator's machine points at its own binaries (D-035 / per-machine paths).
 */
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { writeFileSync, mkdtempSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const execFileP = promisify(execFile);
// eslint-disable-next-line no-control-regex
const stripAnsi = (s: string): string => s.replace(/\x1b\[[0-9;]*m/g, '');

/**
 * Runtime CLIs interleave progress chatter with the answer on the same stdout, and the daemon posts
 * whatever comes back to Slack verbatim. Two things leaked into #swarm-command:
 *   - hermes progress lines, e.g. `[tool] (｡•́︿•̀｡) musing...`
 *   - the model restating its own display name, e.g. `VTO Admin: Understood…`
 * Neither is part of the reply, so strip both here rather than in every caller.
 */
function cleanReply(raw: string, role: string): string {
  const escapedRole = role.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return stripAnsi(raw)
    .split(/\r?\n/)
    // bracketed runtime channels: [tool] / [thinking] / [debug] …
    .filter((l) => !/^\s*\[(?:tool|tools|thinking|debug|info|warn|trace)\b/i.test(l))
    // a bare spinner line: an optional kaomoji/emoji then just "musing"/"thinking"/"working"
    .filter((l) => !/^\s*\S{0,14}\s*(?:musing|thinking|working|pondering)\s*\.{0,3}\s*$/i.test(l))
    .join('\n')
    .replace(new RegExp(`^\\s*(?:VTO[\\s-]*)?${escapedRole}\\s*:\\s*`, 'i'), '')
    .trim();
}

export type RuntimeName = 'hermes' | 'claude' | 'opencode' | 'openclaw' | 'operation';

export interface WorkerDef {
  role: string;
  runtime: RuntimeName;
  profile?: string; // hermes
  model?: string; // claude / opencode
  agent?: string; // openclaw
  workspace?: string; // openclaw: dedicated workspace dir (NEVER the live repo) — synced to/from repo
  op?: 'build' | 'lint' | 'test' | 'deploy' | 'video' | 'accuracy'; // runtime === 'operation'
  maxConcurrent: number;
}

export type RuntimePaths = Partial<Record<RuntimeName, string>>;

const TIMEOUT_MS = 600_000; // agentic runtimes (hermes profiles, openclaw) need room on complex tasks
const MAX_BUFFER = 20 * 1024 * 1024;

// Source dirs the OpenClaw workspace mirrors to/from the build repo (code only — not build artifacts).
const SYNC_DIRS = ['packages', 'extensions', 'app'];

/**
 * Mirror source subdirs from `src` into `dst` with robocopy, excluding build artifacts + git. Used to
 * sync the build repo <-> the OpenClaw agent's DEDICATED workspace around a run — OpenClaw scaffolds +
 * git-inits its workspace, so it must NEVER be the live repo (see doc/SWARM-CATCHUP). robocopy exit
 * codes 0-7 mean success (copied / nothing to do); >=8 is a real error.
 */
async function mirrorDirs(src: string, dst: string, dirs: string[]): Promise<void> {
  const bs = (p: string): string => p.replace(/\//g, '\\');
  for (const d of dirs) {
    if (!existsSync(join(src, d))) continue;
    await new Promise<void>((resolve, reject) => {
      execFile(
        'robocopy',
        [bs(join(src, d)), bs(join(dst, d)), '/E', '/XD', 'node_modules', 'dist', 'build', '.git',
          '/NFL', '/NDL', '/NJH', '/NJS', '/NP', '/R:1', '/W:1'],
        { timeout: 180_000, windowsHide: true, maxBuffer: MAX_BUFFER },
        (err) => {
          if (!err) return resolve();
          const code = (err as NodeJS.ErrnoException & { code?: number | string }).code;
          if (typeof code === 'number' && code < 8) return resolve(); // robocopy 0-7 = success
          reject(new Error(`robocopy ${d} failed (code ${String(code)})`));
        },
      );
    });
  }
}

/** Run the task's prompt on the worker's runtime; returns trimmed stdout. Throws on failure. */
export async function runRuntime(w: WorkerDef, prompt: string, paths: RuntimePaths, cwd?: string): Promise<string> {
  // cwd lets agentic runtimes (openclaw/opencode) actually edit files in the repo under test.
  const opts = { timeout: TIMEOUT_MS, maxBuffer: MAX_BUFFER, cwd };
  if (w.runtime === 'hermes') {
    const bin = paths.hermes;
    if (!bin) throw new Error('hermes path not configured');
    // --ignore-rules: skip AGENTS.md/SOUL/memory/skills injection so the loop's LLM steps answer
    // directly instead of doing multi-minute agentic file exploration (11s vs >5min, measured).
    // It also fixes cross-task bleed: hermes' built-in memory is "always active", so a reply that
    // claimed to "save a durable routing rule" was recalled by the NEXT unrelated task.
    const { stdout } = await execFileP(bin, ['-p', w.profile ?? w.role, '-z', prompt, '--ignore-rules'], opts);
    return cleanReply(stdout, w.role);
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
    return cleanReply(stdout, w.role);
  }
  if (w.runtime === 'opencode') {
    const bin = paths.opencode;
    if (!bin) throw new Error('opencode path not configured');
    const { stdout } = await execFileP(
      'powershell.exe',
      ['-NoProfile', '-File', bin, 'run', prompt, '-m', w.model ?? 'opencode/big-pickle'],
      opts,
    );
    return cleanReply(stdout, w.role);
  }
  if (w.runtime === 'openclaw') {
    const bin = paths.openclaw;
    if (!bin) throw new Error('openclaw path not configured');
    const ws = w.workspace; // the agent's DEDICATED workspace (matches openclaw.json), never the repo
    // Sync the build repo's source INTO the workspace so OpenClaw edits the current code.
    if (ws && cwd) await mirrorDirs(cwd, ws, SYNC_DIRS);
    const dir = mkdtempSync(join(tmpdir(), 'swarm-'));
    const pf = join(dir, 'prompt.txt');
    writeFileSync(pf, prompt, 'utf8');
    // OpenClaw CLI: the `agent` subcommand, embedded (--local), targeting an agent id. (The old
    // `--agent <name> --prompt-file` form was invalid — openclaw read the name as a command.)
    // `--local` matters beyond correctness: without it the turn is routed through the OpenClaw
    // Gateway, which is where a daemon-spawned run hung to the timeout while the same command
    // succeeded in 10-17s by hand.
    const args = ['-NoProfile', '-File', bin, 'agent', '--local', '--agent', w.agent ?? w.role,
      '--message-file', pf, '--timeout', '580'];
    if (w.model) args.push('--model', w.model);
    const { stdout } = await execFileP('powershell.exe', args, ws ? { ...opts, cwd: ws } : opts);
    // Sync OpenClaw's edits back OUT of the workspace into the build repo so `build` compiles them.
    if (ws && cwd) await mirrorDirs(ws, cwd, SYNC_DIRS);
    return cleanReply(stdout, w.role);
  }
  throw new Error(`unknown runtime ${String(w.runtime)}`);
}
