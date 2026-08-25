/**
 * swarm-requeue-task — reset a claimed/failed task to queued and re-send its pgmq message, for
 * recovery when a daemon died mid-claim and waiting out the visibility timeout is too slow.
 * The stale original message redelivers later and is ack-skipped (task no longer 'queued').
 * Usage: npx tsx scripts/swarm-requeue-task.ts --task 1703 [--queue vto_analyst]
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
  const raw = readFileSync(resolve(ROOT, 'config', '.secrets.env'), 'utf8');
  for (const line of raw.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m && m[1] && !process.env[m[1]]) process.env[m[1]] = m[2]!.replace(/^["']|["']$/g, '');
  }
}

async function main(): Promise<void> {
  const taskId = Number(arg('task'));
  if (!taskId) { console.error('usage: --task <id> [--queue vto_<role>]'); process.exit(1); }
  loadSecretsEnv();
  const { getPool, closePool } = await import('../packages/db/src/index.js');
  const pool = getPool();
  const t = (await pool.query('select id, role, status, payload from tasks where id=$1', [taskId])).rows[0];
  if (!t) { console.error(`task ${taskId} not found`); process.exit(1); }
  const pin = (t.payload as Record<string, unknown> | null)?.['pinnedMachine'] as string | undefined;
  // vto_send's first arg is the ROLE (it adds the vto_ queue prefix itself) — do NOT pre-prefix.
  const roleQueue = arg('queue') ?? (pin ? `${t.role}__${pin.replace(/[^A-Za-z0-9]/g, '_')}` : `${t.role}`);
  await pool.query(`update tasks set status='queued' where id=$1`, [taskId]);
  // 3-arg call: the 2-arg form is ambiguous since 0004 added the delay overload with a default.
  await pool.query(`select vto_send($1::text, $2::bigint, 0)`, [roleQueue, taskId]);
  console.log(`task ${taskId} (${t.role}, was ${t.status}) requeued via role-queue ${roleQueue}`);
  await closePool();
  process.exit(0);
}

main().catch((e: Error) => { console.error('requeue failed:', e.message); process.exit(1); });
