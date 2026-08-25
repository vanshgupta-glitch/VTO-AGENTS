/**
 * swarm-check-tasks — report status + run output + related posts for a task id range.
 * Read-only. Usage: npx tsx scripts/swarm-check-tasks.ts --from 1688 --to 1696 [--post 11188]
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
  const from = Number(arg('from'));
  const to = Number(arg('to'));
  const post = arg('post');
  loadSecretsEnv();
  const { getPool, closePool } = await import('../packages/db/src/index.js');
  const pool = getPool();

  console.log('== tasks ==');
  for (const r of (await pool.query(
    `select t.id, t.role, t.status, t.last_error is not null as has_err,
            round(extract(epoch from coalesce(r.ended_at, now()) - r.started_at)) as secs,
            left(coalesce(r.output->>'text',''), 200) as out
     from tasks t left join runs r on r.task_id = t.id
     where t.id between $1 and $2 order by t.id`, [from, to])).rows) console.log(JSON.stringify(r));

  console.log('== posts for those tasks (channel replies + department reports, newest 40) ==');
  for (const r of (await pool.query(
    `select id, channel, agent, status, left(text, 110) as text
     from post_queue where created_at > now() - interval '30 minutes' order by id desc limit 40`)).rows) console.log(JSON.stringify(r));

  if (post) {
    console.log('== test-A post ==');
    for (const r of (await pool.query(`select id, channel, agent, status from post_queue where id = $1`, [post])).rows) console.log(JSON.stringify(r));
  }
  await closePool();
  process.exit(0);
}

main().catch((e: Error) => { console.error('check failed:', e.message); process.exit(1); });
