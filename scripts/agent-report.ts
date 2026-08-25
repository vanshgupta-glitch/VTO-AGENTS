/**
 * agent-report — post a work report to an agent's DEPARTMENT channel via the shared post_queue.
 * The gateway drains the queue and posts under the agent's own bot identity, so reports appear
 * in Slack exactly like any other agent message (AGENT-PROFILES §1 maps role → channel).
 *
 * Used by loops that run OUTSIDE the executor daemon (the vto-research heartbeat skill,
 * Hermes/OpenClaw vault missions) — the daemon posts its own reports via postWorkReport.
 *
 * Usage (from the vault root):
 *   npx tsx scripts/agent-report.ts --agent researcher --channel swarm-research --file report.md
 *   npx tsx scripts/agent-report.ts --agent researcher --channel swarm-research --text "T037 done — F016"
 *
 * Loads SWARM_DATABASE_URL from config/.secrets.env when not already in the environment.
 */
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && i + 1 < process.argv.length ? process.argv[i + 1] : undefined;
}

function loadSecretsEnv(): void {
  if (process.env.SWARM_DATABASE_URL) return;
  try {
    const raw = readFileSync(resolve(ROOT, 'config', '.secrets.env'), 'utf8');
    for (const line of raw.split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*?)\s*$/);
      if (m && m[1] && !process.env[m[1]]) process.env[m[1]] = m[2]!.replace(/^["']|["']$/g, '');
    }
  } catch {
    // fall through — enqueuePost throws a clear error if SWARM_DATABASE_URL is still unset
  }
}

async function main(): Promise<void> {
  const agent = arg('agent');
  const channel = arg('channel');
  const file = arg('file');
  const text = file ? readFileSync(resolve(file), 'utf8') : arg('text');
  if (!agent || !channel || !text) {
    console.error('usage: tsx scripts/agent-report.ts --agent <role> --channel <swarm-*> (--text "..." | --file <path>)');
    process.exit(1);
  }
  loadSecretsEnv();
  const { enqueuePost } = await import('../packages/db/src/index.js');
  const id = await enqueuePost({ channel, agent, text: text.slice(0, 2800) });
  console.log(`enqueued post ${id} -> #${channel} as ${agent}`);
  process.exit(0); // the pg pool would otherwise keep the process alive
}

main().catch((e: Error) => {
  console.error(`agent-report failed: ${e.message}`);
  process.exit(1);
});
