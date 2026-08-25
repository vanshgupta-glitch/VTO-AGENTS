/**
 * swarm-seed-task — enqueue one direct task for a role (loop verification / ops testing).
 * Mirrors the gateway's task shape (channel = Slack channel ID, hard-pinned to a machine key).
 * Usage (from the vault root):
 *   npx tsx scripts/swarm-seed-task.ts --role researcher --text "ping" [--kind researcher]
 *     [--channel C0BP7106UF4] [--pin win32-NMG-D-82]
 */
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function arg(name: string, dflt?: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && i + 1 < process.argv.length ? process.argv[i + 1] : dflt;
}

function loadSecretsEnv(): void {
  if (process.env.SWARM_DATABASE_URL) return;
  const raw = readFileSync(resolve(ROOT, 'config', '.secrets.env'), 'utf8');
  for (const line of raw.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m && m[1] && !process.env[m[1]]) process.env[m[1]] = m[2]!.replace(/^["']|["']$/g, '');
  }
}

async function main(): Promise<void> {
  const role = arg('role');
  const text = arg('text');
  if (!role || !text) {
    console.error('usage: tsx scripts/swarm-seed-task.ts --role <role> --text "..." [--kind k] [--channel C..] [--pin machine-key]');
    process.exit(1);
  }
  const kind = arg('kind', role)!;
  const channel = arg('channel', 'C0BP7106UF4')!; // #swarm-command
  const pin = arg('pin', 'win32-NMG-D-82')!;
  loadSecretsEnv();
  const { enqueueTask } = await import('../packages/db/src/index.js');
  const id = await enqueueTask({
    role,
    kind,
    channel,
    requestedBy: 'loop-verification',
    payload: { text, channel, pinnedMachine: pin },
  });
  console.log(`seeded task ${id} role=${role} kind=${kind} channel=${channel} pin=${pin}`);
  process.exit(0);
}

main().catch((e: Error) => {
  console.error('seed failed:', e.message);
  process.exit(1);
});
