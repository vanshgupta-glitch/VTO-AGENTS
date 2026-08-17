-- 0004_soft_overflow.sql — local-first scheduling ("own agents priority, not first-come").
-- Idempotent. Adds an optional delay to vto_send so a SOFT-pinned task can be posted to the shared
-- queue AFTER a grace period (its origin machine's pinned copy gets first dibs during the grace), and
-- records which queue a run was claimed from so finishTask acks the exact message.

-- 3-arg overload of vto_send with a delay (seconds). The 2-arg form (0003) still exists for old callers.
create or replace function vto_send(p_role text, p_task_id bigint, p_delay int default 0)
  returns bigint language plpgsql as $$
begin
  perform vto_ensure_queue(p_role);
  return pgmq.send('vto_' || p_role, jsonb_build_object('task_id', p_task_id), p_delay);
end;
$$;

-- The queue a run was claimed from (pinned `<role>__<key>` or shared `<role>`), so finishTask acks the
-- exact message even for soft-pinned tasks (which have copies in two queues).
alter table runs add column if not exists queue text;
