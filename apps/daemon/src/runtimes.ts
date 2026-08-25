/**
 * Runtime adapters — spawn a local CLI for a task and return its text.
 * Paths come from the per-machine config (config/machine.local.json), never committed,
 * so each operator's machine points at its own binaries (D-035 / per-machine paths).
 */
import { execFile, spawn } from 'node:child_process';
import { writeFileSync, mkdtempSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// eslint-disable-next-line no-control-regex
const stripAnsi = (s: string): string => s.replace(/\x1b\[[0-9;]*m/g, '');

interface RunError extends Error {
  stdout?: string;
  killed?: boolean;
}

/**
 * Promisified spawn with stdin IGNORED. execFile's default gives the child an open stdin pipe,
 * and openclaw/opencode (and the claude-cli sessions under them) BLOCK FOREVER waiting on it —
 * proven 2026-08-25: stdin=pipe hung until the timeout on a trivial ping; stdin=ignore answered
 * in 27s. Error shape mirrors execFile (.stdout, .killed) because the hermes branch salvages
 * stdout from dirty exits.
 */
function execNoStdin(
  bin: string,
  args: string[],
  opts: { timeout: number; maxBuffer: number; cwd?: string },
): Promise<{ stdout: string }> {
  return new Promise((resolveP, rejectP) => {
    const child = spawn(bin, args, { cwd: opts.cwd, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    let killed = false;
    const cap = (cur: string, b: Buffer): string => {
      const s = cur + b.toString('utf8');
      return s.length > opts.maxBuffer ? s.slice(-opts.maxBuffer) : s;
    };
    child.stdout.on('data', (b: Buffer) => { stdout = cap(stdout, b); });
    child.stderr.on('data', (b: Buffer) => { stderr = cap(stderr, b); });
    // taskkill /T: child.kill() only hits the direct powershell — the openclaw/opencode grandchild
    // keeps the stdio pipes open and 'close' never fires, so a timeout must reap the whole tree.
    const timer = setTimeout(() => {
      killed = true;
      if (child.pid) spawn('taskkill', ['/PID', String(child.pid), '/T', '/F'], { windowsHide: true });
      else child.kill();
    }, opts.timeout);
    child.on('error', (e) => { clearTimeout(timer); rejectP(e); });
    child.on('close', (code) => {
      clearTimeout(timer);
      if (code === 0 && !killed) return resolveP({ stdout });
      const err = new Error(
        `Command failed${killed ? ' (timeout)' : ''}: ${bin} ${args.join(' ').slice(0, 300)}\n${stderr.slice(-400)}`,
      ) as RunError;
      err.stdout = stdout;
      err.killed = killed;
      rejectP(err);
    });
  });
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

// Source dirs the OpenClaw workspace mirrors to/from the build repo (code only — not build
// artifacts). `.swarm-tasks` rides along so the doc-driven coder can read + update the shared
// per-run task .md from inside its workspace (the doc path in the prompt is repo-relative).
const SYNC_DIRS = ['packages', 'extensions', 'app', '.swarm-tasks'];

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
    // EXCEPT the coder: its whole job is editing files — with --ignore-rules it only DESCRIBES the
    // change and the stage "succeeds" with no diff (caught live on flow-test run #15, 2026-08-22).
    try {
      const args = ['-p', w.profile ?? w.role, '-z', prompt];
      if (w.role !== 'coder') args.push('--ignore-rules');
      const { stdout } = await execNoStdin(bin, args, opts);
      return stripAnsi(stdout).trim();
    } catch (e) {
      // hermes prints the FULL answer to stdout, then sometimes crashes on teardown (exit
      // 0xC0000005 / access violation, empty stderr — an intermittent native shutdown race). The
      // work is DONE, so salvage stdout on a non-timeout dirty exit instead of failing the stage.
      const err = e as NodeJS.ErrnoException & { stdout?: string; killed?: boolean };
      const out = stripAnsi(String(err.stdout ?? '')).trim();
      if (out && !err.killed) return out;
      throw e;
    }
  }
  if (w.runtime === 'claude') {
    const bin = paths.claude;
    if (!bin) throw new Error('claude path not configured');
    const { stdout } = await execNoStdin(bin, ['-p', prompt, '--model', w.model ?? 'claude-opus-4-8'], opts);
    return stripAnsi(stdout).trim();
  }
  if (w.runtime === 'opencode') {
    const bin = paths.opencode;
    if (!bin) throw new Error('opencode path not configured');
    const { stdout } = await execNoStdin(
      'powershell.exe',
      ['-NoProfile', '-File', bin, 'run', prompt, '-m', w.model ?? 'opencode/big-pickle'],
      opts,
    );
    return stripAnsi(stdout).trim();
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
    const args = ['-NoProfile', '-File', bin, 'agent', '--local', '--agent', w.agent ?? w.role,
      '--message-file', pf, '--timeout', '580'];
    if (w.model) args.push('--model', w.model);
    const { stdout } = await execNoStdin('powershell.exe', args, ws ? { ...opts, cwd: ws } : opts);
    // Sync OpenClaw's edits back OUT of the workspace into the build repo so `build` compiles them.
    if (ws && cwd) await mirrorDirs(ws, cwd, SYNC_DIRS);
    // Drop openclaw's diagnostic preamble ([agents/tool-policy], [agent/cli-backend], …) — only the
    // answer should reach Slack / the dispatcher's DECISION parser.
    return stripAnsi(stdout)
      .split(/\r?\n/)
      .filter((l) => !/^\[agents?\//.test(l.trim()))
      .join('\n')
      .trim();
  }
  throw new Error(`unknown runtime ${String(w.runtime)}`);
}
