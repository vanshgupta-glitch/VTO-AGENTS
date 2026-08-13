-- 0002_orchestration.sql — workflow dispatcher schema (extends 0001).
-- Idempotent (IF NOT EXISTS). See doc/WORKFLOWS.md (stage grammar) + apps/dispatcher.

-- One row per workflow execution (a goal in, stages advancing toward done/halt).
create table if not exists workflow_runs (
  id             bigint generated always as identity primary key,
  workflow       text not null,                    -- 'improvement-loop' | 'research-loop' | 'recovery-loop'
  goal           text,                             -- the human goal (from Slack / CLI)
  channel        text,                             -- originating Slack channel
  status         text not null default 'running',  -- running|done|halted|failed
  current_stage  text,                             -- stage id the dispatcher is on
  carry          jsonb not null default '{}'::jsonb,-- evidence carried between stages (quoted, not summarised)
  error          text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index if not exists workflow_runs_status_idx on workflow_runs(status, created_at);

-- Link stage tasks to their workflow run + stage.
alter table tasks add column if not exists workflow_run_id bigint references workflow_runs(id) on delete set null;
alter table tasks add column if not exists stage text;
create index if not exists tasks_workflow_idx on tasks(workflow_run_id, stage);

-- Human gate ↔ Slack post mapping (gateway reaction handler resolves approval by ts).
alter table human_gates add column if not exists post_ts text;
alter table human_gates add column if not exists channel text;
alter table human_gates add column if not exists workflow_run_id bigint references workflow_runs(id) on delete set null;
create index if not exists human_gates_post_ts_idx on human_gates(post_ts);

-- Poster back-links a sent post to the gate it renders (to capture the post ts).
alter table post_queue add column if not exists link_gate_id bigint references human_gates(id) on delete set null;
