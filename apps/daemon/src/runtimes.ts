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
  op?: 'build' | 'lint' | 'test' | 'deploy' | 'video' | 'accuracy'; // runtime === 'operation'
  maxConcurrent: number;
}

export type RuntimePaths = Partial<Record<RuntimeName, string>>;

const TIMEOUT_MS = 300_000;
const MAX_BUFFER = 20 * 1024 * 1024;

/** Run the task's prompt on the worker's runtime; returns trimmed stdout. Throws on failure. */
export async function runRuntime(w: WorkerDef, prompt: string, paths: RuntimePaths, cwd?: string): Promise<string> {
  // cwd lets agentic runtimes (openclaw/opencode) actually edit files in the repo under test.
  const opts = { timeout: TIMEOUT_MS, maxBuffer: MAX_BUFFER, cwd };
  if (w.runtime === 'hermes') {
    const bin = paths.hermes;
    if (!bin) throw new Error('hermes path not configured');
    // `--ignore-rules` makes each task hermetic. hermes' one-shot mode documents that "tools,
    // memory, rules, and AGENTS.md in the CWD are loaded as normal", and its built-in memory is
    // "always active" — so a reply could persist a claim ("saved as a durable routing rule") and the
    // NEXT unrelated task recalled it, answering the previous question instead of the new one.
    // It also stops AGENTS.md/SOUL.md being picked up from cwd, which is the product repo here and
    // therefore the wrong context entirely. Trade-off: preloaded skills are not injected either —
    // every task must carry what it needs in the prompt the daemon builds, which is what we want.
    const { stdout } = await execFileP(
      bin,
      ['-p', w.profile ?? w.role, '--ignore-rules', '-z', prompt],
      opts,
    );
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
    const dir = mkdtempSync(join(tmpdir(), 'swarm-'));
    const pf = join(dir, 'prompt.txt');
    writeFileSync(pf, prompt, 'utf8');
    // `agent` is a SUBCOMMAND, and the flag is `--message-file`. Without the subcommand the CLI
    // reads `--agent coder` as a command and dies with "Unknown command: openclaw coder"; there is
    // no `--prompt-file` flag at all. Verified against OpenClaw 2026.7.1-2 (`openclaw agent --help`).
    const { stdout } = await execFileP(
      'powershell.exe',
      ['-NoProfile', '-File', bin, 'agent', '--agent', w.agent ?? w.role, '--message-file', pf],
      opts,
    );
    return cleanReply(stdout, w.role);
  }
  throw new Error(`unknown runtime ${String(w.runtime)}`);
}
