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
    // Keep per-process connections small: the Supabase session pooler caps total clients (15),
    // and several processes (both machines' daemons + the gateway) share that one pooler.
    // Override per process with SWARM_DB_POOL_MAX if a machine genuinely needs more.
    const max = Number(process.env.SWARM_DB_POOL_MAX) || 4;
    pool = new Pool({ connectionString: url, max, idleTimeoutMillis: 30_000 });
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
  link_gate_id: number | null;
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

// ── Tasks: enqueue + the pgmq claim (the cross-machine overflow point) ───────
/**
 * Visibility timeout for a claimed pgmq message (seconds). Must exceed the longest task a worker
 * runs, else pgmq redelivers a still-running task and it double-runs. Slowest ops are video (~600s)
 * and deploy (~400s); 900s is a safe default. (Priority ordering is lost — pgmq is FIFO per queue.)
 */
const CLAIM_VT = Number(process.env.SWARM_CLAIM_VT) || 900;

/** Put a task's id onto its role queue so a worker (either machine) can claim it via pgmq. */
async function sendToQueue(role: string, taskId: number): Promise<void> {
  await getPool().query(`select vto_send($1, $2)`, [role, taskId]);
}

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
  const id = r.rows[0]!.id;
  // Only claimable tasks go on the queue: workflow triggers are the dispatcher's own intake
  // (claimWorkflowTrigger), and a critique-gated task waits until setCritiquePassed() opens it.
  if (t.kind !== 'workflow' && !(t.needsCritique ?? false)) await sendToQueue(t.role, id);
  return id;
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
    // Read one ready message off the role's pgmq queue; it becomes invisible for CLAIM_VT s (the claim).
    // This runs in autocommit (before `begin`), so the visibility timeout is committed immediately.
    const m = await client.query<{ msg_id: string; task_id: string }>(
      `select msg_id, task_id from vto_read($1, $2)`,
      [role, CLAIM_VT],
    );
    const row = m.rows[0];
    if (!row) return null;
    const { msg_id: msgId, task_id: taskId } = row;

    await client.query('begin');
    const tr = await client.query<Task>(`select * from tasks where id = $1 for update`, [taskId]);
    const task = tr.rows[0] ?? null;
    // Stale/duplicate message — the task is gone or already terminal: ack and skip (don't re-run).
    if (!task || task.status === 'done' || task.status === 'blocked' || task.status === 'cancelled') {
      await client.query('commit');
      await getPool().query(`select vto_ack($1, $2)`, [role, msgId]);
      return null;
    }
    // A redelivered message (task still 'claimed'/'running' from a dead worker) is re-claimable — that
    // IS the crash recovery. Record the msg_id on the run so finishTask can ack this exact message.
    await client.query(`update tasks set status = 'claimed', updated_at = now() where id = $1`, [taskId]);
    await client.query(
      `insert into runs (task_id, machine_id, worker_id, status, msg_id) values ($1, $2, $3, 'running', $4)`,
      [taskId, machineId, workerId, msgId],
    );
    await client.query(`update workers set active = active + 1, status = 'busy' where id = $1`, [workerId]);
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
    // Grab the pgmq msg_id + role for this claim BEFORE closing the run, so we can ack the exact
    // message after committing (a crash before this point leaves the message for pgmq to redeliver).
    const info = await client.query<{ msg_id: string | null; role: string }>(
      `select r.msg_id, t.role from runs r join tasks t on t.id = r.task_id
       where r.task_id = $1 and r.status = 'running' order by r.id desc limit 1`,
      [taskId],
    );
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
    // Terminal outcome → remove the message from the queue. A crash never reaches here, so the message
    // stays invisible only until CLAIM_VT elapses, then pgmq redelivers it (the automatic recovery).
    const done = info.rows[0];
    if (done?.msg_id) await getPool().query(`select vto_ack($1, $2)`, [done.role, done.msg_id]);
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
  linkGateId?: number | null;
}): Promise<number> {
  const r = await getPool().query<{ id: number }>(
    `insert into post_queue (channel, agent, text, thread_ts, link_gate_id) values ($1, $2, $3, $4, $5) returning id`,
    [p.channel, p.agent, p.text, p.threadTs ?? null, p.linkGateId ?? null],
  );
  return r.rows[0]!.id;
}

/**
 * Claim the next pending post — safe for MULTIPLE concurrent posters (dual peer gateways, D-036).
 * Two per-channel guards make posting from both machines correct without any leader:
 *   1. skip a channel that already has a post 'sending' (never two concurrent posts to one channel);
 *   2. skip a channel posted to within the last ~1.1s ('sent'), enforcing Slack's ~1/sec/channel.
 * FOR UPDATE SKIP LOCKED stops the two posters grabbing the same row; different channels still post
 * in parallel across machines. (A crashed poster's stuck 'sending' row is freed by recoverStale,
 * which ages it out on `claimed_at` — stamped below — so a slow post is never reaped mid-flight.)
 */
export async function claimNextPost(): Promise<QueuedPost | null> {
  const client = await getPool().connect();
  try {
    await client.query('begin');
    const r = await client.query<QueuedPost>(
      // `claimed_at` stamps WHEN a poster took the row, which is what the reaper in
      // recoverStale must age out on. Reaping on `created_at` instead would return a row to
      // 'pending' while this gateway is still inside chat.postMessage — a double post to
      // Slack — because a post can legitimately sit 'pending' longer than the stale window
      // (the per-channel guards serialize a channel to ~1/sec, and a busy channel queues).
      `update post_queue set status = 'sending', claimed_at = now()
       where id = (
         select p.id from post_queue p
         where p.status = 'pending'
           and not exists (
             select 1 from post_queue s where s.channel = p.channel and s.status = 'sending'
           )
           and not exists (
             select 1 from post_queue s
             where s.channel = p.channel and s.status = 'sent'
               and s.sent_at > now() - interval '1100 milliseconds'
           )
         order by p.created_at
         for update skip locked
         limit 1
       )
       returning id, channel, agent, text, thread_ts, link_gate_id`,
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

// ── Recovery sweep: heal the fleet from daemon crashes / stale state ──────────
export interface RecoveryReport {
  machinesOffline: number;
  workersReset: number;
  runsClosed: number;
  tasksRequeued: number;
  postsUnstuck: number;
}

/**
 * Full recovery sweep — call periodically from every daemon (and optionally the gateway).
 * Idempotent and safe to run concurrently from both machines; each statement only touches
 * rows whose heartbeats/ages prove they are stale.
 *
 * Heals four failure modes:
 *   1. Machines whose daemon died → marked `offline`.
 *   2. Workers whose daemon died → `active` reset to 0, status `offline` (else their stuck
 *      `active` count permanently drains that role's capacity fleet-wide).
 *   3. Orphaned runs → a run still `running` either because the worker heartbeat went stale
 *      (daemon died mid-run) OR because the run itself is simply too old (a daemon restarted,
 *      re-registered the worker fresh, and lost track of the run). Both are closed as `timeout`
 *      and their task requeued so another machine can claim it.
 *   4. `post_queue` rows left `sending` by a crashed poster → back to `pending`, aged on
 *      `claimed_at` (NOT `created_at`, which would double-post a slow but healthy send).
 */
export async function recoverStale(opts: {
  staleSeconds?: number;
  runMaxSeconds?: number;
}): Promise<RecoveryReport> {
  const stale = String(opts.staleSeconds ?? 90);
  const runMax = String(opts.runMaxSeconds ?? 1_800);
  const client = await getPool().connect();
  try {
    await client.query('begin');

    const machines = await client.query(
      `update machines set status = 'offline'
       where status = 'online' and last_heartbeat < now() - ($1 || ' seconds')::interval`,
      [stale],
    );

    const workers = await client.query(
      `update workers set active = 0, status = 'offline'
       where active > 0 and last_heartbeat < now() - ($1 || ' seconds')::interval`,
      [stale],
    );

    // Orphaned runs: a run still 'running' whose worker heartbeat went stale (daemon died) or that is
    // simply too old. Close them for history + capacity accounting. We do NOT requeue the task here —
    // pgmq owns claim-recovery now: the claimed message was never acked, so it reappears after CLAIM_VT
    // and another worker re-claims it. Requeuing here as well would double-run the task.
    const orphaned = await client.query<{ id: number }>(
      `select r.id
       from runs r join workers w on w.id = r.worker_id
       where r.status = 'running'
         and (w.last_heartbeat < now() - ($1 || ' seconds')::interval
              or r.started_at < now() - ($2 || ' seconds')::interval)`,
      [stale, runMax],
    );
    let runsClosed = 0;
    const tasksRequeued = 0; // pgmq handles requeue via visibility timeout (see note above)
    if (orphaned.rows.length > 0) {
      const ids = orphaned.rows.map((r) => r.id);
      const closed = await client.query(
        `update runs set status = 'timeout', ended_at = now(), error = 'reclaimed-stale'
         where id = any($1::bigint[])`,
        [ids],
      );
      runsClosed = closed.rowCount ?? 0;
    }

    // Age out on when the row was CLAIMED, not created — see the note in claimNextPost.
    // COALESCE covers the rolling-deploy window: a peer still running pre-fix code leaves
    // `claimed_at` null, and those rows must stay reapable (a stuck 'sending' row blocks its
    // whole channel via claimNextPost's per-channel guard). They fall back to the old
    // created_at behaviour — no worse than before — and self-correct once that peer updates.
    const posts = await client.query(
      `update post_queue set status = 'pending'
       where status = 'sending'
         and coalesce(claimed_at, created_at) < now() - ($1 || ' seconds')::interval`,
      [stale],
    );

    await client.query('commit');
    return {
      machinesOffline: machines.rowCount ?? 0,
      workersReset: workers.rowCount ?? 0,
      runsClosed,
      tasksRequeued,
      postsUnstuck: posts.rowCount ?? 0,
    };
  } catch (e) {
    await client.query('rollback');
    throw e;
  } finally {
    client.release();
  }
}

// ── Workflow orchestration (the dispatcher's data layer) ─────────────────────
export interface WorkflowRun {
  id: number;
  workflow: string;
  goal: string | null;
  channel: string | null;
  thread_ts: string | null;
  status: string;
  current_stage: string | null;
  carry: Record<string, unknown>;
  error: string | null;
  created_at: string;
  updated_at: string;
}

export async function createWorkflowRun(w: {
  workflow: string;
  goal?: string | null;
  channel?: string | null;
  threadTs?: string | null;
}): Promise<WorkflowRun> {
  const r = await getPool().query<WorkflowRun>(
    `insert into workflow_runs (workflow, goal, channel, thread_ts) values ($1, $2, $3, $4) returning *`,
    [w.workflow, w.goal ?? null, w.channel ?? null, w.threadTs ?? null],
  );
  return r.rows[0]!;
}

export async function listActiveWorkflowRuns(): Promise<WorkflowRun[]> {
  const r = await getPool().query<WorkflowRun>(
    `select * from workflow_runs where status = 'running' order by created_at`,
  );
  return r.rows;
}

export async function getWorkflowRun(id: number): Promise<WorkflowRun | null> {
  const r = await getPool().query<WorkflowRun>(`select * from workflow_runs where id = $1`, [id]);
  return r.rows[0] ?? null;
}

export async function updateWorkflowRun(
  id: number,
  patch: {
    status?: string;
    currentStage?: string | null;
    carry?: Record<string, unknown>;
    error?: string | null;
  },
): Promise<void> {
  await getPool().query(
    `update workflow_runs set
       status = coalesce($2, status),
       current_stage = coalesce($3, current_stage),
       carry = coalesce($4::jsonb, carry),
       error = coalesce($5, error),
       updated_at = now()
     where id = $1`,
    [id, patch.status ?? null, patch.currentStage ?? null, patch.carry ? JSON.stringify(patch.carry) : null, patch.error ?? null],
  );
}

export interface WorkflowTask {
  id: number;
  role: string;
  kind: string;
  status: string;
  priority: number;
  payload: Record<string, unknown>;
  needs_critique: boolean;
  critique_passed: boolean;
  attempts: number;
  last_error: string | null;
  stage: string | null;
}

/** Create a task owned by a workflow run + stage. Returns the task id. */
export async function createStageTask(t: {
  runId: number;
  stage: string;
  role: string;
  kind: string;
  payload?: Record<string, unknown>;
  needsCritique?: boolean;
  channel?: string | null;
  priority?: number;
}): Promise<number> {
  const r = await getPool().query<{ id: number }>(
    `insert into tasks (role, kind, payload, workflow_run_id, stage, needs_critique, channel, priority, requested_by)
     values ($1, $2, $3, $4, $5, $6, $7, $8, 'dispatcher')
     returning id`,
    [
      t.role,
      t.kind,
      JSON.stringify(t.payload ?? {}),
      t.runId,
      t.stage,
      t.needsCritique ?? false,
      t.channel ?? null,
      t.priority ?? 100,
    ],
  );
  const id = r.rows[0]!.id;
  // Stage tasks are claimable immediately unless critique-gated (then setCritiquePassed opens them).
  if (!(t.needsCritique ?? false)) await sendToQueue(t.role, id);
  return id;
}

/** Latest task for a (run, stage). */
export async function getStageTask(runId: number, stage: string): Promise<WorkflowTask | null> {
  const r = await getPool().query<WorkflowTask>(
    `select * from tasks where workflow_run_id = $1 and stage = $2 order by id desc limit 1`,
    [runId, stage],
  );
  return r.rows[0] ?? null;
}

/** All tasks for a (run, stage) — fan-out stages create one task per role under the same stage id. */
export async function listStageTasks(runId: number, stage: string): Promise<WorkflowTask[]> {
  const r = await getPool().query<WorkflowTask>(
    `select * from tasks where workflow_run_id = $1 and stage = $2 order by id`,
    [runId, stage],
  );
  return r.rows;
}

/** Distinct worker roles that have heartbeated recently — the health-loop fans out to exactly these. */
export async function listAliveWorkers(withinSeconds = 90): Promise<string[]> {
  const r = await getPool().query<{ role: string }>(
    `select distinct role from workers where last_heartbeat > now() - make_interval(secs => $1)`,
    [withinSeconds],
  );
  return r.rows.map((x) => x.role);
}

/** Claim the next queued workflow trigger (kind='workflow', SKIP LOCKED) — the dispatcher's intake. */
export async function claimWorkflowTrigger(): Promise<Task | null> {
  const client = await getPool().connect();
  try {
    await client.query('begin');
    const r = await client.query<Task>(
      `update tasks set status = 'claimed', updated_at = now()
       where id = (
         select id from tasks where kind = 'workflow' and status = 'queued'
         order by priority, created_at
         for update skip locked
         limit 1
       )
       returning *`,
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

/** Mark a trigger task done (workflow started). */
export async function finishTrigger(taskId: number, runId: number): Promise<void> {
  await getPool().query(
    `update tasks set status = 'done', updated_at = now(),
       payload = payload || jsonb_build_object('workflow_run_id', $2)
     where id = $1`,
    [taskId, runId],
  );
}

/** Read the text output a worker wrote for a task (used by gates to parse PASS/BLOCK/accuracy). */
export async function getRunOutputText(taskId: number): Promise<string> {
  const r = await getPool().query<{ output: unknown }>(
    `select output from runs where task_id = $1 and status = 'done' order by id desc limit 1`,
    [taskId],
  );
  const out = r.rows[0]?.output as { text?: string; summary?: string } | null | undefined;
  return (out?.text ?? out?.summary ?? '').toString();
}

// ── Critique gate (D-005): record a verdict + unlock the gated task ──────────
export async function recordCritique(c: {
  taskId: number;
  verdict: 'pass' | 'block';
  notes?: string | null;
  critic?: string | null;
}): Promise<void> {
  await getPool().query(
    `insert into critiques (task_id, verdict, notes, critic) values ($1, $2, $3, $4)`,
    [c.taskId, c.verdict, c.notes ?? null, c.critic ?? null],
  );
}

export async function setCritiquePassed(taskId: number): Promise<void> {
  const r = await getPool().query<{ role: string; kind: string }>(
    `update tasks set critique_passed = true, updated_at = now() where id = $1 returning role, kind`,
    [taskId],
  );
  // Gate is now open → make the task claimable by putting it on its role queue.
  const row = r.rows[0];
  if (row && row.kind !== 'workflow') await sendToQueue(row.role, taskId);
}

/** Tombstone a task (e.g. a consumed rework marker) so it never re-fires. */
export async function markTaskBlocked(taskId: number): Promise<void> {
  await getPool().query(`update tasks set status = 'blocked', updated_at = now() where id = $1`, [taskId]);
}

export async function getCritiques(taskId: number): Promise<{ verdict: string; notes: string | null }[]> {
  const r = await getPool().query<{ verdict: string; notes: string | null }>(
    `select verdict, notes from critiques where task_id = $1 order by id`,
    [taskId],
  );
  return r.rows;
}

// ── Human gate (D-034): gate row ↔ Slack post ↔ reaction approval ────────────
export async function createGateForRun(runId: number, channel: string | null, detail?: unknown): Promise<number> {
  const r = await getPool().query<{ id: number }>(
    `insert into human_gates (task_id, workflow_run_id, channel, detail) values (null, $1, $2, $3) returning id`,
    [runId, channel, detail ? JSON.stringify(detail) : null],
  );
  return r.rows[0]!.id;
}

export async function getGateForRun(runId: number): Promise<{ id: number; status: string } | null> {
  const r = await getPool().query<{ id: number; status: string }>(
    `select id, status from human_gates where workflow_run_id = $1 order by id desc limit 1`,
    [runId],
  );
  return r.rows[0] ?? null;
}

/** The poster calls this after a successful Slack post to link the message ts → gate. */
export async function linkGatePost(gateId: number, postTs: string): Promise<void> {
  await getPool().query(`update human_gates set post_ts = $2 where id = $1`, [gateId, postTs]);
}

export async function getGateByPostTs(postTs: string): Promise<{ id: number; status: string } | null> {
  const r = await getPool().query<{ id: number; status: string }>(
    `select id, status from human_gates where post_ts = $1`,
    [postTs],
  );
  return r.rows[0] ?? null;
}

export async function rejectHumanGate(id: number, rejectedBy: string): Promise<void> {
  await getPool().query(
    `update human_gates set status = 'rejected', approved_by = $2, approved_at = now() where id = $1`,
    [id, rejectedBy],
  );
}

// ── Escalations & stuck events (recovery loop writes) ────────────────────────
export async function createEscalation(e: {
  taskId: number | null;
  reason?: string | null;
  toAgent?: string | null;
}): Promise<number> {
  const r = await getPool().query<{ id: number }>(
    `insert into escalations (task_id, reason, to_agent) values ($1, $2, $3) returning id`,
    [e.taskId, e.reason ?? null, e.toAgent ?? null],
  );
  return r.rows[0]!.id;
}

export async function listOpenEscalations(): Promise<{ id: number; task_id: number | null; reason: string | null }[]> {
  const r = await getPool().query<{ id: number; task_id: number | null; reason: string | null }>(
    `select id, task_id, reason from escalations where status = 'open' order by id`,
  );
  return r.rows;
}

export async function resolveEscalation(id: number): Promise<void> {
  await getPool().query(`update escalations set status = 'resolved' where id = $1`, [id]);
}

export async function createStuckEvent(s: { taskId: number | null; reason?: string | null }): Promise<void> {
  await getPool().query(`insert into stuck_events (task_id, reason) values ($1, $2)`, [
    s.taskId,
    s.reason ?? null,
  ]);
}
