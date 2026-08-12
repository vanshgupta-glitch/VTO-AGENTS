/**
 * @vto-swarm/db — coordination data layer for the distributed swarm (Postgres).
 *
 * The gateway (Rohit's machine) and both machines' executor daemons all go through
 * these functions. The one that matters most is {@link claimTask}: a `FOR UPDATE
 * SKIP LOCKED` claim, which is the entire cross-machine overflow mechanism — two
 * daemons on either machine can never grab the same task row, and whichever has a
 * free worker first wins. See doc/DISTRIBUTED-ARCHITECTURE.md.
 */
import pg from 'pg';

const { Pool } = pg;

let pool: pg.Pool | null = null;

/** Lazily-created singleton pool from SWARM_DATABASE_URL (use the IPv4 Session pooler string). */
export function getPool(): pg.Pool {
  if (!pool) {
    const url = process.env.SWARM_DATABASE_URL;
    if (!url) throw new Error('SWARM_DATABASE_URL is not set');
    pool = new Pool({ connectionString: url, max: 10, idleTimeoutMillis: 30_000 });
  }
  return pool;
}

export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}

// ── Types ────────────────────────────────────────────────────────────────────
export interface Task {
  id: number;
  role: string;
  kind: string;
  status: string;
  priority: number;
  payload: Record<string, unknown>;
  parent_id: number | null;
  channel: string | null;
  requested_by: string | null;
  needs_critique: boolean;
  critique_passed: boolean;
  attempts: number;
  last_error: string | null;
  created_at: string;
  updated_at: string;
}

export interface QueuedPost {
  id: number;
  channel: string;
  agent: string;
  text: string;
  thread_ts: string | null;
}

// ── Machines & workers (the presence registry that powers overflow) ──────────
export async function registerMachine(id: string, operator: string, role = 'worker'): Promise<void> {
  await getPool().query(
    `insert into machines (id, operator, role, status, last_heartbeat)
     values ($1, $2, $3, 'online', now())
     on conflict (id) do update set operator = excluded.operator, role = excluded.role,
       status = 'online', last_heartbeat = now()`,
    [id, operator, role],
  );
}

export async function registerWorker(w: {
  id: string;
  machineId: string;
  role: string;
  runtime: string;
  maxConcurrent: number;
}): Promise<void> {
  await getPool().query(
    `insert into workers (id, machine_id, role, runtime, max_concurrent, active, status, last_heartbeat)
     values ($1, $2, $3, $4, $5, 0, 'idle', now())
     on conflict (id) do update set role = excluded.role, runtime = excluded.runtime,
       max_concurrent = excluded.max_concurrent, status = 'idle', last_heartbeat = now()`,
    [w.id, w.machineId, w.role, w.runtime, w.maxConcurrent],
  );
}

export async function heartbeatWorker(id: string): Promise<void> {
  await getPool().query(`update workers set last_heartbeat = now() where id = $1`, [id]);
}

export async function heartbeatMachine(id: string): Promise<void> {
  await getPool().query(
    `update machines set last_heartbeat = now(), status = 'online' where id = $1`,
    [id],
  );
}

// ── Tasks: enqueue + the SKIP LOCKED claim (the overflow point) ──────────────
export async function enqueueTask(t: {
  role: string;
  kind: string;
  payload?: Record<string, unknown>;
  priority?: number;
  parentId?: number | null;
  channel?: string | null;
  requestedBy?: string | null;
  needsCritique?: boolean;
}): Promise<number> {
  const r = await getPool().query<{ id: number }>(
    `insert into tasks (role, kind, payload, priority, parent_id, channel, requested_by, needs_critique)
     values ($1, $2, $3, $4, $5, $6, $7, $8)
     returning id`,
    [
      t.role,
      t.kind,
      t.payload ?? {},
      t.priority ?? 100,
      t.parentId ?? null,
      t.channel ?? null,
      t.requestedBy ?? null,
      t.needsCritique ?? false,
    ],
  );
  return r.rows[0]!.id;
}

/**
 * Atomically claim the next queued task for a role — the cross-machine overflow point.
 * `FOR UPDATE SKIP LOCKED` guarantees two daemons (either machine) never grab the same
 * row. Code tasks (`needs_critique`) stay invisible until a passing critique lands (D-005).
 * The caller must ensure the worker has a free slot (active < max_concurrent) before calling.
 */
export async function claimTask(role: string, workerId: string, machineId: string): Promise<Task | null> {
  const client = await getPool().connect();
  try {
    await client.query('begin');
    const r = await client.query<Task>(
      `update tasks set status = 'claimed', updated_at = now()
       where id = (
         select id from tasks
         where role = $1 and status = 'queued'
           and (needs_critique = false or critique_passed = true)
         order by priority, created_at
         for update skip locked
         limit 1
       )
       returning *`,
      [role],
    );
    const task = r.rows[0] ?? null;
    if (task) {
      await client.query(
        `insert into runs (task_id, machine_id, worker_id, status) values ($1, $2, $3, 'running')`,
        [task.id, machineId, workerId],
      );
      await client.query(`update workers set active = active + 1, status = 'busy' where id = $1`, [workerId]);
    }
    await client.query('commit');
    return task;
  } catch (e) {
    await client.query('rollback');
    throw e;
  } finally {
    client.release();
  }
}

/** Mark a claimed task finished, close its run, and free the worker slot. */
export async function finishTask(
  taskId: number,
  workerId: string,
  status: 'done' | 'failed' | 'blocked',
  output?: unknown,
  error?: string,
): Promise<void> {
  const client = await getPool().connect();
  try {
    await client.query('begin');
    await client.query(
      `update runs set status = $2, ended_at = now(), output = $3, error = $4
       where task_id = $1 and status = 'running'`,
      [taskId, status === 'done' ? 'done' : 'failed', output ? JSON.stringify(output) : null, error ?? null],
    );
    await client.query(
      `update tasks set status = $2, updated_at = now(), last_error = $3 where id = $1`,
      [taskId, status, error ?? null],
    );
    await client.query(
      `update workers set active = greatest(active - 1, 0),
         status = case when active - 1 <= 0 then 'idle' else 'busy' end
       where id = $1`,
      [workerId],
    );
    await client.query('commit');
  } catch (e) {
    await client.query('rollback');
    throw e;
  } finally {
    client.release();
  }
}

// ── Slack transport: inbound dedup + outbound serialized post queue ──────────
/** Returns true if this is a NEW event (inserted), false if a duplicate Slack retry. */
export async function dedupSlackEvent(id: string, channel: string | null, ts: string | null): Promise<boolean> {
  const r = await getPool().query(
    `insert into slack_events (id, channel, ts) values ($1, $2, $3) on conflict (id) do nothing`,
    [id, channel, ts],
  );
  return (r.rowCount ?? 0) > 0;
}

export async function enqueuePost(p: {
  channel: string;
  agent: string;
  text: string;
  threadTs?: string | null;
}): Promise<number> {
  const r = await getPool().query<{ id: number }>(
    `insert into post_queue (channel, agent, text, thread_ts) values ($1, $2, $3, $4) returning id`,
    [p.channel, p.agent, p.text, p.threadTs ?? null],
  );
  return r.rows[0]!.id;
}

/** Claim the next pending post (poster drains this serially, ≤1/sec/channel upstream). */
export async function claimNextPost(): Promise<QueuedPost | null> {
  const client = await getPool().connect();
  try {
    await client.query('begin');
    const r = await client.query<QueuedPost>(
      `update post_queue set status = 'sending'
       where id = (
         select id from post_queue where status = 'pending'
         order by created_at
         for update skip locked
         limit 1
       )
       returning id, channel, agent, text, thread_ts`,
    );
    await client.query('commit');
    return r.rows[0] ?? null;
  } catch (e) {
    await client.query('rollback');
    throw e;
  } finally {
    client.release();
  }
}

export async function markPost(id: number, status: 'sent' | 'failed'): Promise<void> {
  await getPool().query(
    `update post_queue set status = $2,
       sent_at = case when $2 = 'sent' then now() else sent_at end,
       attempts = attempts + case when $2 = 'failed' then 1 else 0 end
     where id = $1`,
    [id, status],
  );
}

// ── Human gate (commit only; either operator may approve — D-034) ────────────
export async function createHumanGate(taskId: number | null, kind = 'commit', detail?: unknown): Promise<number> {
  const r = await getPool().query<{ id: number }>(
    `insert into human_gates (task_id, kind, detail) values ($1, $2, $3) returning id`,
    [taskId, kind, detail ? JSON.stringify(detail) : null],
  );
  return r.rows[0]!.id;
}

export async function approveHumanGate(id: number, approvedBy: string): Promise<void> {
  await getPool().query(
    `update human_gates set status = 'approved', approved_by = $2, approved_at = now() where id = $1`,
    [id, approvedBy],
  );
}

// ── Recovery: requeue tasks whose worker heartbeat went stale ────────────────
export async function reclaimStale(staleSeconds: number): Promise<number> {
  const r = await getPool().query(
    `update tasks set status = 'queued', updated_at = now()
     where status in ('claimed', 'running')
       and id in (
         select r.task_id from runs r join workers w on w.id = r.worker_id
         where r.status = 'running'
           and w.last_heartbeat < now() - ($1 || ' seconds')::interval
       )`,
    [String(staleSeconds)],
  );
  return r.rowCount ?? 0;
}
