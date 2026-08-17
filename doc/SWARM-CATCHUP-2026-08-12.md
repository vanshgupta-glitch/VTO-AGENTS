# Swarm catch-up — pgmq queue + dual peer gateways (2026-08-12)

Read this to get the swarm code in sync. Two changes landed (branch **`pgmq-dual-gateway`**), plus a
prior orchestration layer (dispatcher/workflows/human-gates/recovery) that was uncommitted until now.
All paths below are **relative to the vault root** (`C:\Users\ankur.singh\Obsidian Vault` on Rohit's
box; your vault root on yours). Design of record: [[DISTRIBUTED-ARCHITECTURE]] (D-036, D-037) +
[[ORCHESTRATION-DIAGRAM]].

## What changed (and why)

1. **Task queue → pgmq / Supabase Queues (D-037).** The hand-rolled `FOR UPDATE SKIP LOCKED` claim is
   replaced by pgmq. A claimed message is invisible for a **visibility timeout** (`SWARM_CLAIM_VT`,
   default **900s**) and **auto-reappears if the worker crashes** — fixing tasks stranded forever in
   `running`. `recoverStale` no longer requeues tasks (pgmq's timeout is the *sole* claim-recovery
   owner; requeuing there too would double-run).
2. **Dual peer gateways (D-036).** BOTH machines now run a gateway. Slack load-balances events across
   the two Socket-Mode connections and **both write to the one Postgres** (dedup catches retries), so
   nothing is lost and there's no special "host." `claimNextPost` gained per-channel guards so two
   posters never double-post or exceed Slack's ~1/sec/channel.

**Transport note:** still the `pg` transaction pooler (`:6543`), not full HTTP — user chose pgmq-only,
so no `service_role` key is needed.

## Migrations — ALREADY APPLIED to the shared DB (do NOT re-run)

`0002` + `0003` were applied to project `eebswtqvbhzowvuxklpl` on 2026-08-12. They're idempotent, so
re-running is harmless, but it's unnecessary — the shared DB already has `workflow_runs`, the pgmq
extension, the `vto_*` functions, and `runs.msg_id`. You only need to **pull the code**.

## Cutover runbook (order matters)

1. `git fetch && git checkout pgmq-dual-gateway && git pull`
2. **Kill every old daemon/gateway process first** — an old-code daemon claims via `status='queued'`
   SKIP-LOCKED while a new one claims via pgmq → the SAME task double-runs. And a running process holds
   the OLD `packages/db` code in memory even after a rebuild, so you must kill, not just rebuild.
   - Find them: `Get-CimInstance Win32_Process -Filter "Name='node.exe'" | ? { $_.CommandLine -like '*daemon*' -or $_.CommandLine -like '*gateway*' } | Select ProcessId, CommandLine`
   - `taskkill /F /T /PID <each>`
3. Rebuild the shared lib so the compiled `dist` matches: from the vault root
   `npx tsc -p packages/db/tsconfig.json` (daemon/gateway import `@vto-swarm/db` from its `dist`).
4. Confirm your `config/.secrets.env` `SWARM_DATABASE_URL` uses **`:6543`** (transaction pooler), not
   `:5432` (session pooler is capped at 15 clients).
5. Start ONE daemon: `npx tsx apps/daemon/src/daemon.ts`
6. Start your gateway too (dual-peer): `npx tsx apps/bridge/src/gateway.ts` — it's now safe to run on
   both machines. (Ping Rohit to make sure exactly one gateway per machine, two total.)

## OpenClaw — OPT-IN complex-coding path (workspace-synced)

**The default loop no longer uses OpenClaw.** The `improve` step is a hermes agent in the repo cwd — it
**edits the files directly** (proven on a live run 2026-08-17; hermes has write tools and, unlike
OpenClaw, doesn't scaffold), and `fix-on-failure` routes to a hermes `coder` in-repo. OpenClaw is now
**opt-in for genuinely complex changes** — seed an `implement` task (role=openclaw). When used it runs
via `openclaw agent --local --agent <id> --message-file <f>` with the workspace-sync below. **Critical:**
an OpenClaw agent treats its
`--workspace` as its OWN home — on first run it **scaffolds `SOUL.md`/`IDENTITY.md`/`AGENTS.md`/… and
`git init`s that directory**. Pointing it at the live repo destroys it (learned live 2026-08-17: it
polluted `rkumar-vto` + nested-`.git`-shadowed the real repo — recovered because `rkumar-vto` is a subdir
of the `nmg-vto` repo whose `.git` was intact).

**So the agent's workspace is a DEDICATED dir, and `runtimes.ts` mirrors code around each run:**
1. `mirrorDirs(repo → workspace, SYNC_DIRS)` — robocopy `packages/`+`extensions/`+`app/` INTO the
   workspace (excludes `node_modules`/`dist`/`build`/`.git`) so OpenClaw sees current code.
2. run `openclaw agent --local --agent <id> …` with `cwd = workspace` (it edits there, scaffolds there).
3. `mirrorDirs(workspace → repo, SYNC_DIRS)` — copy OpenClaw's edits BACK into the build repo so `build`
   compiles them, and the human reviews the diff. Scaffolding stays in the workspace (SYNC_DIRS excludes root).

**Per-machine setup:**
- Create a dedicated-workspace agent (workspace **NOT** your repo): `openclaw agents add vto-coder-<you>
  --workspace "C:/.../openclaw-ws/vto-coder-<you>" --model anthropic/claude-haiku-4-5 --non-interactive`.
- Add the worker with the matching `workspace` field (git-ignored `machine.local.json`):
  ```json
  { "role": "openclaw", "runtime": "openclaw", "agent": "vto-coder-<you>", "workspace": "C:/.../openclaw-ws/vto-coder-<you>", "maxConcurrent": 1 }
  ```
- Confirm `openclaw models status` shows the claude-cli/Anthropic provider authed (`--local` needs it).
- **⚠️ Vansh:** your existing `vto-coder` agent points at your LIVE `rkumar_vto`. Repoint its `workspace`
  in `~/.openclaw/openclaw.json` to a throwaway dir BEFORE running it, or it will scaffold + `git init`
  your repo. Never `openclaw agents delete` while a workspace is a real dir — it *prunes* (deletes) it.

*(Caveat: the mirror is additive (robocopy `/E`, no delete), so a file OpenClaw DELETES won't propagate —
fine for the edit/add changes the loop makes. Rohit's agent = `vto-coder-rohit`, workspace `~/openclaw-ws/`.)*

Confirm `runtimes.openclaw` points at your `openclaw.ps1`, and `openclaw models status` shows the
claude-cli/Anthropic provider authed (`--local` needs it). Rohit's agent = `vto-coder-rohit`; the shared
`vto-coder` points at Vansh's OneDrive path — don't reuse it cross-machine.

## File manifest (vault-root-relative)

| Path | Change |
|---|---|
| `packages/db/src/index.ts` | pgmq claim/finish/enqueue + `claimNextPost` per-channel guards + `recoverStale` no-requeue (see code below) |
| `packages/db/migrations/0002_orchestration.sql` | `workflow_runs` + orchestration columns (APPLIED) |
| `packages/db/migrations/0003_pgmq.sql` | pgmq extension + `runs.msg_id` + `vto_*` functions + backfill (APPLIED) |
| `apps/bridge/src/gateway.ts` | real @-mention resolution + typed handles; workflow triggers; reaction human-gate |
| `apps/daemon/src/daemon.ts` | op wiring + loop chaining |
| `apps/dispatcher/` (new) | workflow engine — improvement-loop / research-loop / recovery-loop |
| `apps/dispatcher/src/workflows.ts` | stage grammar (executors, gates, transitions) |
| `packages/operations/src/index.ts` | allowlist ops (build/lint/deploy/video/accuracy) |
| `doc/DISTRIBUTED-ARCHITECTURE.md`, `doc/ORCHESTRATION-DIAGRAM.md` | D-036/D-037 + diagrams |

## Key code — `packages/db/src/index.ts`

```ts
// Visibility timeout for a claimed pgmq message (seconds). Must exceed the longest task, else pgmq
// redelivers a still-running task and it double-runs. Slowest: video ~600s, deploy ~400s.
const CLAIM_VT = Number(process.env.SWARM_CLAIM_VT) || 900;

/** Put a task's id onto its role queue so a worker (either machine) can claim it via pgmq. */
async function sendToQueue(role: string, taskId: number): Promise<void> {
  await getPool().query(`select vto_send($1, $2)`, [role, taskId]);
}

// enqueueTask: after inserting the task row, if claimable → sendToQueue:
//   if (t.kind !== 'workflow' && !(t.needsCritique ?? false)) await sendToQueue(t.role, id);
// createStageTask: same, minus the workflow check.
// setCritiquePassed: on opening the gate, `returning role, kind` then sendToQueue(role, id) if kind != 'workflow'.

export async function claimTask(role: string, workerId: string, machineId: string): Promise<Task | null> {
  const client = await getPool().connect();
  try {
    const m = await client.query<{ msg_id: string; task_id: string }>(
      `select msg_id, task_id from vto_read($1, $2)`, [role, CLAIM_VT]);
    const row = m.rows[0];
    if (!row) return null;
    const { msg_id: msgId, task_id: taskId } = row;
    await client.query('begin');
    const tr = await client.query<Task>(`select * from tasks where id = $1 for update`, [taskId]);
    const task = tr.rows[0] ?? null;
    if (!task || task.status === 'done' || task.status === 'blocked' || task.status === 'cancelled') {
      await client.query('commit');
      await getPool().query(`select vto_ack($1, $2)`, [role, msgId]);
      return null;
    }
    await client.query(`update tasks set status = 'claimed', updated_at = now() where id = $1`, [taskId]);
    await client.query(
      `insert into runs (task_id, machine_id, worker_id, status, msg_id) values ($1, $2, $3, 'running', $4)`,
      [taskId, machineId, workerId, msgId]);
    await client.query(`update workers set active = active + 1, status = 'busy' where id = $1`, [workerId]);
    await client.query('commit');
    return task;
  } catch (e) { await client.query('rollback'); throw e; } finally { client.release(); }
}

// finishTask: before closing the run, read its msg_id + task role, then after commit:
//   if (row?.msg_id) await getPool().query(`select vto_ack($1, $2)`, [row.role, row.msg_id]);
// A crash before the ack means pgmq redelivers after CLAIM_VT (the recovery).

// recoverStale: closes orphaned runs as 'timeout' but NO LONGER requeues tasks
//   (tasksRequeued is hard-0; pgmq's visibility timeout owns requeue).

export async function claimNextPost(): Promise<QueuedPost | null> {
  // per-channel guards make concurrent posters safe (dual peer gateways):
  //   skip a channel with a post already 'sending', and one 'sent' within ~1.1s.
  // ... update post_queue set status='sending' where id = (
  //   select p.id from post_queue p where p.status='pending'
  //     and not exists (select 1 from post_queue s where s.channel=p.channel and s.status='sending')
  //     and not exists (select 1 from post_queue s where s.channel=p.channel and s.status='sent'
  //                     and s.sent_at > now() - interval '1100 milliseconds')
  //   order by p.created_at for update skip locked limit 1) returning ...
}
```

## `packages/db/migrations/0003_pgmq.sql` (full — already applied)

```sql
create extension if not exists pgmq;
alter table runs add column if not exists msg_id bigint;

create or replace function vto_ensure_queue(p_role text) returns void language plpgsql as $$
begin
  if not exists (select 1 from pgmq.list_queues() where queue_name = 'vto_' || p_role) then
    perform pgmq.create('vto_' || p_role);
  end if;
end; $$;

create or replace function vto_send(p_role text, p_task_id bigint) returns bigint language plpgsql as $$
begin
  perform vto_ensure_queue(p_role);
  return pgmq.send('vto_' || p_role, jsonb_build_object('task_id', p_task_id));
end; $$;

create or replace function vto_read(p_role text, p_vt int)
  returns table(msg_id bigint, task_id bigint) language plpgsql as $$
begin
  perform vto_ensure_queue(p_role);
  return query select m.msg_id, (m.message->>'task_id')::bigint
               from pgmq.read('vto_' || p_role, p_vt, 1) m;
end; $$;

create or replace function vto_ack(p_role text, p_msg_id bigint) returns boolean language plpgsql as $$
begin
  if p_msg_id is null then return false; end if;
  return pgmq.delete('vto_' || p_role, p_msg_id);
end; $$;
-- (plus a backfill DO block that vto_send's any currently-'queued' tasks)
```
