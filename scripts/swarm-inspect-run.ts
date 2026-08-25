/**
 * swarm-inspect-run — dump one workflow run's full state: carry, stage tasks, runs, recent posts.
 * Read-only. Usage: npx tsx scripts/swarm-inspect-run.ts --run 16
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
  const runId = Number(arg('run'));
  if (!runId) { console.error('usage: --run <id>'); process.exit(1); }
  loadSecretsEnv();
  const { getPool, closePool } = await import('../packages/db/src/index.js');
  const pool = getPool();

  const wr = (await pool.query('select * from workflow_runs where id=$1', [runId])).rows[0];
  console.log('== workflow_run ==');
  console.log(JSON.stringify({ ...wr, carry: undefined }, null, 0));
  console.log('carry:', JSON.stringify(wr?.carry ?? {}));

  console.log('== stage tasks (newest 30) ==');
  const tasks = (await pool.query(
    `select id, stage, role, kind, status, critique_passed, needs_critique, last_error, created_at::text
     from tasks where workflow_run_id=$1 order by id desc limit 30`, [runId])).rows;
  for (const t of tasks) console.log(JSON.stringify(t));

  console.log('== runs for those tasks (newest 15) ==');
  const runs = (await pool.query(
    `select r.id, r.task_id, r.status, r.started_at::text, r.ended_at::text,
            round(extract(epoch from coalesce(r.ended_at, now()) - r.started_at)) as secs,
            left(coalesce(r.output->>'text',''), 160) as out
     from runs r join tasks t on t.id = r.task_id
     where t.workflow_run_id=$1 order by r.id desc limit 15`, [runId])).rows;
  for (const r of runs) console.log(JSON.stringify(r));

  await closePool();
  process.exit(0);
}

main().catch((e: Error) => { console.error('inspect failed:', e.message); process.exit(1); });
