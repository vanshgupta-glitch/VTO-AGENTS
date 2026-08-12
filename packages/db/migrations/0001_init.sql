-- 0001_init.sql — VTO distributed swarm coordination schema (Postgres 17).
-- Applied to the dedicated Supabase project (eebswtqvbhzowvuxklpl).
-- Idempotent (IF NOT EXISTS). See doc/DISTRIBUTED-ARCHITECTURE.md (D-029..D-035).

-- ── Machines & workers: the presence registry that powers cross-machine overflow ──
create table if not exists machines (
  id             text primary key,               -- stable machine id (hostname+platform)
  operator       text not null,                  -- 'rohit' | 'vansh'
  role           text not null default 'worker', -- 'gateway' | 'worker' | 'both'
  status         text not null default 'online', -- 'online' | 'offline'
  last_heartbeat timestamptz not null default now(),
  created_at     timestamptz not null default now()
);

create table if not exists workers (
  id             text primary key,               -- machine_id + ':' + role
  machine_id     text not null references machines(id) on delete cascade,
  role           text not null,                  -- admin|researcher|critic|coder|opencode|openclaw|claude|<persona>
  runtime        text not null,                  -- hermes|openclaw|opencode|claude|operation
  max_concurrent int  not null default 1,
  active         int  not null default 0,        -- current in-flight claims (< max_concurrent to claim)
  status         text not null default 'idle',   -- idle|busy|draining|offline
  last_heartbeat timestamptz not null default now(),
  created_at     timestamptz not null default now()
);
create index if not exists workers_role_idx    on workers(role, status);
create index if not exists workers_machine_idx on workers(machine_id);

-- ── Tasks (the ONE shared queue) & runs ──────────────────────────────────────
create table if not exists tasks (
  id              bigint generated always as identity primary key,
  role            text not null,                 -- pool key: which agent-role must handle it
  kind            text not null,                 -- research|code|critique|test|accuracy|video|build|...
  status          text not null default 'queued',-- queued|claimed|running|done|failed|blocked
  priority        int  not null default 100,     -- lower = sooner
  payload         jsonb not null default '{}'::jsonb,
  parent_id       bigint references tasks(id) on delete set null,
  channel         text,                          -- originating Slack channel
  requested_by    text,                          -- operator / agent / slack user
  needs_critique  boolean not null default false,-- true for code kinds (D-005)
  critique_passed boolean not null default false,-- claim of a code task blocks until this is true
  attempts        int  not null default 0,
  last_error      text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
-- the claim query: queued + role + (critique satisfied), highest priority / oldest first
create index if not exists tasks_claim_idx on tasks(role, status, priority, created_at);

create table if not exists runs (
  id                bigint generated always as identity primary key,
  task_id           bigint not null references tasks(id) on delete cascade,
  machine_id        text references machines(id),
  worker_id         text references workers(id),
  executor_agent_id text,                        -- e.g. 'coder' via 'openclaw'
  status            text not null default 'running', -- running|done|failed|timeout
  started_at        timestamptz not null default now(),
  ended_at          timestamptz,
  output            jsonb,
  error             text
);
create index if not exists runs_task_idx   on runs(task_id);
create index if not exists runs_worker_idx on runs(worker_id, status);

-- ── Slack transport: inbound dedup + outbound serialized posting ─────────────
create table if not exists slack_events (
  id          text primary key,                  -- Slack event_id / client_msg_id (dedup)
  channel     text,
  ts          text,
  received_at timestamptz not null default now()
);

create table if not exists post_queue (
  id         bigint generated always as identity primary key,
  channel    text not null,
  agent      text not null,                      -- which bot identity posts (token key)
  text       text not null,
  thread_ts  text,
  status     text not null default 'pending',    -- pending|sent|failed
  attempts   int  not null default 0,
  created_at timestamptz not null default now(),
  sent_at    timestamptz
);
create index if not exists post_queue_pending_idx on post_queue(status, channel, created_at);

-- ── Gates, critiques, escalations, solutions, stuck events ───────────────────
create table if not exists human_gates (
  id          bigint generated always as identity primary key,
  task_id     bigint references tasks(id) on delete cascade,
  kind        text not null default 'commit',    -- 'commit' — the only human gate (D-008/D-034)
  status      text not null default 'pending',   -- pending|approved|rejected
  detail      jsonb,
  approved_by text,                              -- 'rohit' | 'vansh' (EITHER may approve, D-034)
  approved_at timestamptz,
  created_at  timestamptz not null default now()
);
create index if not exists human_gates_pending_idx on human_gates(status);

create table if not exists critiques (
  id         bigint generated always as identity primary key,
  task_id    bigint not null references tasks(id) on delete cascade,
  verdict    text not null,                      -- 'pass' | 'block' (D-005 pre-code gate)
  notes      text,
  critic     text,
  created_at timestamptz not null default now()
);
create index if not exists critiques_task_idx on critiques(task_id, verdict);

create table if not exists escalations (
  id         bigint generated always as identity primary key,
  task_id    bigint references tasks(id) on delete cascade,
  reason     text,
  to_agent   text,
  status     text not null default 'open',       -- open|resolved
  created_at timestamptz not null default now()
);

create table if not exists solutions (
  id             bigint generated always as identity primary key,
  problem_key    text not null,
  solution       text not null,
  source_task_id bigint references tasks(id) on delete set null,
  created_at     timestamptz not null default now()
);
create index if not exists solutions_key_idx on solutions(problem_key);

create table if not exists stuck_events (
  id          bigint generated always as identity primary key,
  task_id     bigint references tasks(id) on delete cascade,
  run_id      bigint references runs(id) on delete set null,
  reason      text,
  detected_at timestamptz not null default now()
);
