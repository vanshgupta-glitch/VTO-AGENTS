-- 0003_pgmq.sql — replace the hand-rolled SKIP-LOCKED claim with pgmq (Supabase Queues).
-- Idempotent. Apply AFTER 0002_orchestration.sql. See [[swarm-code-state]] + doc/ORCHESTRATION-DIAGRAM.md.
--
-- Why: the visibility timeout makes a crashed/killed worker's task auto-reappear after `vt` seconds
-- (no more tasks orphaned forever in `running`), and pgmq gives retries + archive for free. pgmq's vt
-- becomes the SINGLE owner of claim-recovery, so recoverStale() must NOT also requeue tasks.
--
-- The tasks/runs/workers tables stay as the metadata + history store; pgmq only holds {task_id} for the
-- "ready to claim" set. One queue per role: `vto_<role>`. Access stays on the pg transaction pooler for
-- now (these are plain functions, callable via `select vto_*(...)`); no service_role key required.

create extension if not exists pgmq;

-- runs carries the pgmq msg_id so finishTask can ack the exact message it claimed (keeps finishTask's
-- signature unchanged — the daemon does not need to thread msg_id through).
alter table runs add column if not exists msg_id bigint;

-- Ensure a role's queue exists (idempotent; safe to call on every send/read).
create or replace function vto_ensure_queue(p_role text) returns void language plpgsql as $$
begin
  if not exists (select 1 from pgmq.list_queues() where queue_name = 'vto_' || p_role) then
    perform pgmq.create('vto_' || p_role);
  end if;
end;
$$;

-- Put a task id onto its role queue (called by enqueueTask, and by setCritiquePassed once a gate opens).
create or replace function vto_send(p_role text, p_task_id bigint) returns bigint language plpgsql as $$
begin
  perform vto_ensure_queue(p_role);
  return pgmq.send('vto_' || p_role, jsonb_build_object('task_id', p_task_id));
end;
$$;

-- Read the next ready message for a role, made invisible for p_vt seconds (the claim).
create or replace function vto_read(p_role text, p_vt int)
  returns table(msg_id bigint, task_id bigint) language plpgsql as $$
begin
  perform vto_ensure_queue(p_role);
  return query
    select m.msg_id, (m.message->>'task_id')::bigint
    from pgmq.read('vto_' || p_role, p_vt, 1) m;
end;
$$;

-- Acknowledge (remove) a handled message — success OR handled-failure. A crash never reaches here, so
-- the message reappears after p_vt and another worker reclaims it.
create or replace function vto_ack(p_role text, p_msg_id bigint) returns boolean language plpgsql as $$
begin
  if p_msg_id is null then return false; end if;
  return pgmq.delete('vto_' || p_role, p_msg_id);
end;
$$;

-- Backfill: enqueue any tasks currently sitting 'queued' in the table (from the pre-pgmq era) so nothing
-- is stranded when the daemons switch to reading the queue. Only claimable ones (critique gate honored).
do $$
declare r record;
begin
  for r in
    select id, role from tasks
    where status = 'queued' and kind <> 'workflow'
      and (needs_critique = false or critique_passed = true)
  loop
    perform vto_send(r.role, r.id);
  end loop;
end;
$$;
