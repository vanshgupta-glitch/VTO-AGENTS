-- 0004_workflow_threads.sql — keep all agent replies in the originating command's thread.
-- 1. `post_queue.claimed_at` — the missing column behind the claimNextPost fix: claim time, not
--    created time, is what recoverStale ages 'sending' rows on (see claimNextPost in packages/db).
-- 2. `workflow_runs.thread_ts` — the Slack ts of the command that triggered a workflow run, carried
--    into every stage task so the daemon posts each reply into the same thread (chat stays readable).
-- Idempotent. Apply AFTER 0003_pgmq.sql.
alter table post_queue add column if not exists claimed_at timestamptz;
alter table workflow_runs add column if not exists thread_ts text;
