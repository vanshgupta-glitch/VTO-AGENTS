/** List recent slack_events dedup rows (arrival proof for inbound Slack messages). Read-only. */
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function loadSecretsEnv(): void {
  if (process.env.SWARM_DATABASE_URL) return;
  const raw = readFileSync(resolve(ROOT, 'config', '.secrets.env'), 'utf8');
  for (const line of raw.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m && m[1] && !process.env[m[1]]) process.env[m[1]] = m[2]!.replace(/^["']|["']$/g, '');
  }
}

async function main(): Promise<void> {
  loadSecretsEnv();
  const { getPool, closePool } = await import('../packages/db/src/index.js');
  const pool = getPool();
  for (const r of (await pool.query(
    `select id, channel, ts, received_at::text from slack_events
     where received_at > now() - interval '30 minutes' order by received_at desc limit 15`)).rows) {
    console.log(JSON.stringify(r));
  }
  await closePool();
  process.exit(0);
}
main().catch((e: Error) => { console.error(e.message); process.exit(1); });
