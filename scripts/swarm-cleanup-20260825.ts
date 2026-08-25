/**
 * swarm-cleanup-20260825 — one-shot board cleanup for loop verification (OPS-LOG 2026-08-25):
 *  1. Cancel orphan tasks from retired code paths / offline machines (ids listed below).
 *  2. Reset stale workers.active counters on the ONLINE machine (daemon was killed mid-task
 *     during the restart; in-flight bookkeeping died with it).
 *  3. Un-freeze doc-loop run #16: tombstone the failed VIDEO_UI_TEST rework (task 1686) so the
 *     dispatcher spawns a FRESH video attempt under the new 25-min op timeout.
 */
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

// Orphans: 94 (claimed since 08-14, old workflow trigger), 276/280 (role=claude — no claude
// worker exists on the online machine), 312 (role=queue — retired role), 1659-1662
// (admin_decompose — retired kind, pinned to Vansh's offline machine).
const ORPHANS = [94, 276, 280, 312, 1659, 1660, 1661, 1662];

async function main(): Promise<void> {
  loadSecretsEnv();
  const { getPool, closePool } = await import('../packages/db/src/index.js');
  const pool = getPool();

  const c = await pool.query(
    `update tasks set status='cancelled' where id = any($1) and status in ('queued','claimed') returning id`,
    [ORPHANS],
  );
  console.log('cancelled orphan tasks:', c.rows.map((r: { id: number }) => r.id).join(', ') || '(none)');

  const w = await pool.query(
    `update workers set active = 0
     where machine_id = 'worker-win32-NMG-D-82' and active > 0
       and not exists (select 1 from runs r join tasks t on t.id = r.task_id
                       where r.worker_id = workers.id and r.status = 'running')
     returning id, role`,
  );
  console.log('reset stale worker active:', w.rows.map((r: { id: string }) => r.id).join(', ') || '(none)');

  const t = await pool.query(`update tasks set status='blocked' where id = 1686 and status = 'failed' returning id`);
  console.log('tombstoned failed rework 1686:', t.rows.length ? 'yes' : 'already consumed');

  await closePool();
  process.exit(0);
}

main().catch((e: Error) => { console.error('cleanup failed:', e.message); process.exit(1); });
