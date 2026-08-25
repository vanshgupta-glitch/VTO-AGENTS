/** One-shot: drop the double-prefixed queue created by the buggy first requeue (2026-08-25). */
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
  try {
    await pool.query(`select pgmq.drop_queue('vto_vto_analyst__win32_NMG_D_82')`);
    console.log('bogus queue dropped');
  } catch (e) {
    console.log('drop:', (e as Error).message.slice(0, 100));
  }
  await closePool();
  process.exit(0);
}
main().catch((e: Error) => { console.error(e.message); process.exit(1); });
