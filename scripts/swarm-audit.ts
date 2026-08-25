/**
 * swarm-audit — one-shot health/state report of the coordination DB, for loop verification.
 * Read-only. Usage (from the vault root): npx tsx scripts/swarm-audit.ts
 * Loads SWARM_DATABASE_URL from config/.secrets.env when not already in the environment.
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

async function main(): Promise<void> {
  loadSecretsEnv();
  const { getPool, closePool } = await import('../packages/db/src/index.js');
  const pool = getPool();
  const q = async (sql: string): Promise<Record<string, unknown>[]> => (await pool.query(sql)).rows;

  console.log('== machines ==');
  for (const r of await q(`select id, operator, role, status, round(extract(epoch from now()-last_heartbeat)) as hb_age_s from machines order by id`)) console.log(JSON.stringify(r));

  console.log('== workers (this fleet) ==');
  for (const r of await q(`select id, role, runtime, active, status, round(extract(epoch from now()-last_heartbeat)) as hb_age_s from workers order by machine_id, role`)) console.log(JSON.stringify(r));

  console.log('== tasks by status ==');
  for (const r of await q(`select status, count(*)::int as n, min(created_at)::text as oldest from tasks group by status order by status`)) console.log(JSON.stringify(r));

  console.log('== stuck-looking tasks (queued/claimed/running > 30 min) ==');
  for (const r of await q(`select id, role, kind, status, channel, created_at::text from tasks where status in ('queued','claimed','running') and created_at < now() - interval '30 minutes' order by id desc limit 15`)) console.log(JSON.stringify(r));

  console.log('== workflow_runs (non-terminal + last 5 terminal) ==');
  for (const r of await q(`select id, workflow, status, current_stage, channel, error, created_at::text from workflow_runs where status in ('active','running','pending') order by id desc limit 10`)) console.log(JSON.stringify(r));
  for (const r of await q(`select id, workflow, status, current_stage, error from workflow_runs where status not in ('active','running','pending') order by id desc limit 5`)) console.log(JSON.stringify(r));

  console.log('== post_queue by status ==');
  for (const r of await q(`select status, count(*)::int as n, min(created_at)::text as oldest from post_queue group by status order by status`)) console.log(JSON.stringify(r));

  console.log('== post_queue stuck (queued/sending > 5 min) ==');
  for (const r of await q(`select id, channel, agent, status, created_at::text, left(text, 80) as text from post_queue where status in ('queued','sending') and created_at < now() - interval '5 minutes' order by id desc limit 10`)) console.log(JSON.stringify(r));

  console.log('== leases ==');
  for (const r of await q(`select name, holder, expires_at::text, (expires_at > now()) as live from leases`)) console.log(JSON.stringify(r));

  console.log('== pgmq queue depths ==');
  try {
    for (const r of await q(`select queue_name, queue_length, total_messages from pgmq.metrics_all() order by queue_name`)) console.log(JSON.stringify(r));
  } catch (e) {
    console.log('pgmq.metrics_all unavailable:', (e as Error).message.slice(0, 120));
  }

  console.log('== human_gates (open) ==');
  for (const r of await q(`select id, workflow_run_id, status, channel, created_at::text from human_gates where status = 'pending' order by id desc limit 10`)) console.log(JSON.stringify(r));

  await closePool();
  process.exit(0);
}

main().catch((e: Error) => {
  console.error('audit failed:', e.message);
  process.exit(1);
});
