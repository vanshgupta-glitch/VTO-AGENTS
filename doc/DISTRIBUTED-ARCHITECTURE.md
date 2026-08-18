# DISTRIBUTED-ARCHITECTURE.md — Multi-Machine VTO Swarm (v0.1, draft for review)

Extends `TECHNICAL-ARCHITECTURE.md` (TAD v3.0). Where they conflict on the single-machine
assumption, THIS doc governs the multi-machine deployment; everything else in the TAD stands.
Status: **design only, awaiting Rohit's review — no code yet.**

## 0. Why this exists
Two operators (Rohit, Vansh) run the SAME agent roster with the SAME Slack bot identities on
their own Windows machines. Work pools by role and overflows between machines: a task waits in
ONE shared queue until a free worker of that role appears on EITHER machine. This is the
"parallel processing / agents on a requirements basis" behaviour requested 2026-08-12.

This deliberately changes three prior positions:
- **Overrides constraint C5** ("one operator, one machine; no broker"). Now two machines + one
  shared DB. Still no Redis/K8s — the shared DB is the ONLY added service.
- **Triggers D-013's named migration** ("a second machine runs executors" → Postgres + `SKIP
  LOCKED`). SQLite is retired for swarm state.
- **Amends D-008** — commit authority extends to BOTH named operators. Git commit stays
  human-gated and is NEVER automated.

## 1. Confirmed decisions (2026-08-12)
| ID | Decision |
|---|---|
| D-029 | Coordination store = a DEDICATED Supabase Postgres project (isolated PAT in `.secrets.env`). The MCP-connected Supabase account is OFF LIMITS — never touched. |
| D-030 | ~~Slack = single-gateway. ONE Socket Mode listener system-wide.~~ **SUPERSEDED by D-036** (dual peer gateways). |
| D-031 | ~~Gateway host = Rohit's machine (single, no failover).~~ **SUPERSEDED by D-036** (no special host; both machines ingest). |
| D-032 | Overflow = implicit. One per-role queue; a worker claims only when it has a free slot; tasks wait until any machine's worker frees up (first-available wins, `SKIP LOCKED`). No hand-off messages. |
| D-033 | Autonomy = auto through code→build→test→accuracy→**deploy to DEV store**; HALT + human-gate before git commit. Prod deploy still out of scope (D-028). |
| D-034 | Commit gate = EITHER operator may approve (amends D-008's single-committer). Still human, still never automated. |
| D-035 | Keys = each machine's agents use THAT machine's own API keys. Borrower's compute, borrower's keys. |
| D-036 | Slack = **dual peer gateways** (supersedes D-030/D-031). BOTH machines run a gateway; Slack load-balances events across the two Socket-Mode connections and **both write to the one Postgres** (`slack_events` dedup catches retries), so the halves reunite with no loss and no special "host." Outbound: both drain `post_queue` via `SKIP LOCKED` + per-channel guards in `claimNextPost` (skip a channel mid-`sending` or `sent` within ~1.1s) → no double-post, no rate-limit breach, no leader/lease. |
| D-037 | Task queue = **pgmq / Supabase Queues** (supersedes the raw SKIP-LOCKED claim of D-032; overflow semantics unchanged). One queue per role (`vto_<role>`); claim = `pgmq.read` with a visibility timeout (`SWARM_CLAIM_VT`, default 900s) so a crashed worker's task auto-reappears; finish = `vto_ack`. `recoverStale` no longer requeues tasks (pgmq's timeout is the sole claim-recovery owner). Migrations `0002_orchestration.sql` + `0003_pgmq.sql`. |
| D-038 | Human operators chat with the swarm from a **private** admin channel `#vto-admin` (`C0BQQDQN0V9`, Vto-Agentic workspace), created 2026-08-17. Members: Ankur `U0BNAE1V7TM`, Vansh `U0BNLCTBB7W`, admin bot `U0BP6MRHJ2W` (admin-only by choice — other agent bots are NOT members, so full-workflow stage posts from non-admin agents won't render here; add them if workflows should run in-channel). Ingest is via the existing dual gateways' Socket-Mode `app_mention`; replies post back in-channel through `post_queue`. Created with the admin bot's `channels:manage`/`groups:write` scopes. |

## 2. Topology
```
                 ┌─────────────── Slack workspace (shared bot identities) ───────────────┐
                 │  #swarm-command #swarm-research #swarm-code … #swarm-human-gate        │
                 └───────────────▲───────────────────────────────────────┬───────────────┘
             Socket Mode (xapp)  │ events IN                 posts OUT    │ (≤1/sec/chan)
                                 │                                        │
                        ┌────────┴────────────────────────────────────────┴────────┐
                        │   GATEWAY  (Rohit's machine ONLY)                          │
                        │   • Slack listener → dedup → INSERT task rows              │
                        │   • serialized poster → drains post_queue                  │
                        └───────────────────────────┬───────────────────────────────┘
                                                     │ read/write
                                   ┌─────────────────▼─────────────────┐
                                   │   Supabase Postgres (shared)       │
                                   │   tasks · runs · workers · gates   │
                                   │   post_queue · critiques · …       │
                                   └───────▲───────────────────▲────────┘
                        claim (SKIP LOCKED)│                   │claim (SKIP LOCKED)
                     ┌─────────────────────┴───┐        ┌──────┴────────────────────┐
                     │ EXECUTOR daemon (Rohit)  │        │ EXECUTOR daemon (Vansh)   │
                     │ local CLIs + local keys  │        │ local CLIs + local keys   │
                     │ hermes/openclaw/opencode │        │ hermes/openclaw/opencode  │
                     └──────────────────────────┘        └───────────────────────────┘
```
- **Gateway (Rohit only):** the sole Slack Socket Mode connection + the sole poster.
- **Executor daemon (both machines):** detects local runtimes, registers a worker row per role
  with a capacity, polls the queue (`SKIP LOCKED`, capacity-gated), runs the local runtime with
  the assembled context, writes the run result, enqueues any Slack posts.
- **Shared store:** the only cross-machine coupling.

## 3. Coordination store — Postgres (was SQLite)
Single-writer SQLite can't be shared across machines → D-013 migration. Claim changes from
`BEGIN IMMEDIATE` to `SELECT … FOR UPDATE SKIP LOCKED LIMIT 1` inside a transaction, then
`UPDATE`. Schema = the TAD's ~20 tables, adapted, plus:
- `machines(id, hostname, operator, status, last_heartbeat)`
- `workers(id, machine_id, role, runtime, max_concurrent, active, last_heartbeat)` — the presence
  registry that powers overflow.
- `tasks(…, role, status[queued|claimed|running|done|failed|blocked], priority, critique_passed,
  payload, created_at)`
- `runs(…, machine_id, worker_id, executor_agent_id, started_at, ended_at, output_ref)`
- `post_queue(id, channel, agent, text, thread_ts, status, created_at)` — serialized posting.
- `slack_events(event_id, client_msg_id, ts)` — gateway dedup (Slack retries events).
- `human_gates(…, approved_by, approved_at)` — either operator.
- carry over from the TAD: `critiques, escalations, solutions, stuck_events`.
Time is `now()` from the DB server (never machine clocks) so heartbeats/stale-locks agree across
machines. Use a connection pool; `statement_timeout` + retry replaces the SQLite busy_timeout.

## 4. Slack transport — the gateway model (why shared tokens are safe THIS way)
Two token types fail differently on two machines:
- **`xapp-` (Socket Mode, events IN):** Slack load-balances events across an app's open
  connections — each event goes to only ONE connection. Two listeners ⇒ each machine sees a
  random subset (or, if broadcast, both double-act). So we run **exactly one listener** (the
  gateway); workers never open a socket. Reconnects handled by the single gateway.
- **`xoxb-` (posting OUT):** usable anywhere, but `chat.postMessage` is ~1/sec/channel and same
  identity from two machines ⇒ 429s + out-of-order + double posts. So **all** posts go into
  `post_queue`; the gateway's poster drains it per-channel at ≤1/sec with the right bot token.
Net: same bot identities are shared, but only the gateway process ever touches Slack; machines
coordinate through Postgres.

## 5. Overflow / scheduling
- One logical queue; `role` is a column (no per-machine queues).
- A worker claims only if `active < max_concurrent` for its role, else the task stays `queued`.
- First free worker on EITHER machine wins the claim (`SKIP LOCKED`). That IS the overflow —
  implicit, no request/offer messaging.
- Per-machine capacity (tunable, env not committed), e.g. researcher×2, coder×2, critic×1,
  admin×1, opencode×3, openclaw×2. Fleet total = sum across machines.
- `ORDER BY priority, created_at` for fairness; optional fleet-wide per-role cap later if one role
  starves others.

## 6. Operations layer + allowlist
- `packages/operations`: `execute(op)` over a FIXED union — `build, test, lint, video, accuracy,
  fetch, repo(read), deploy(DEV)` (TAD §401-405). No shell composition (D-006); each op is a
  named, typed invocation.
- `deploy` = `shopify app deploy --config vto-phase1 --allow-updates` (DEV store) — AUTO (D-033).
- `git commit/push` is NOT in the allowlist. A commit-ready state creates a `human_gate` row +
  posts to `#swarm-human-gate`; either operator approves (D-034). The system records the approval,
  never performs the commit (D-008).
- Terminal ops execute on **OpenCode/OpenClaw** (their own keys); the Claude tier only assigns +
  validates method & result ([[delegate-testing-to-opencode]]).

## 7. Gates (carried from the TAD, machine-agnostic)
- **D-005** blocking pre-code critique — enforced in the claim query (a code task can't be claimed
  until a passed critique row exists).
- **D-007** agents talk only via Slack channels (through `post_queue`).
- Human gate = commit only. Everything up to & including dev deploy is autonomous.

## 8. Per-machine config
- `config/runtimes.yaml` hard-codes one person's absolute paths (`vansh.gupta`, stale). Move CLI
  paths + capacities + keys to a per-machine, git-ignored local file / env — nothing
  machine-specific is committed. Each machine supplies: its own OpenRouter/Anthropic keys, its own
  CLI paths, its own worker capacities, and the shared Supabase connection string.

## 9. Build plan (phased — review gate between each)
- **Phase 0 — Provision.** Create the dedicated Supabase project (via the PAT or the dashboard);
  apply schema; put the connection string in each machine's `.secrets.env`.
- **Phase 1 — Data layer** (`packages/db`): Postgres schema + migrations + claim/heartbeat/enqueue
  queries (`SKIP LOCKED`).
- **Phase 2 — Gateway** (`apps/bridge`, Rohit): Slack listener (Admin `xapp`) → dedup → task
  ingest; serialized poster draining `post_queue`.
- **Phase 3 — Executor daemon** (both machines): flesh out `swarmctl executor:daemon` — detect
  CLIs, register worker, capacity-gated claim loop, run runtime, write run + enqueue posts.
- **Phase 4 — Operations allowlist** (`packages/operations`): build/test/lint/video/accuracy/
  fetch/repo/deploy-dev; commit → `human_gate`.
- **Phase 5 — Dispatcher/orchestration:** Admin decomposition, pre-code critique gate, recovery
  (heartbeat/stale-lock reclaim), circularity guard.
- **Phase 6 — Human-gate flow:** `#swarm-human-gate`; either operator approves; dev deploy auto.
- **Phase 7 — E2E dry run:** seed a trivial VTO task → research→code→(critique)→build→test→
  accuracy→deploy-dev→awaiting-commit; prove overflow by saturating one machine's role.

## 10. Open risks / to resolve
- **Two repo copies (D-017) — RESOLVED 2026-08-12.** There ARE shared git remotes for both
  `rkumar-vto` and the Obsidian vault; each machine clones the same remotes, so a code fix pushed by
  one is pulled by the other, and both machines' config/memory stay in sync via the vault repo.
  Concurrency: the shared queue serializes code work (one coder task per area at a time) and commits
  stay human-gated, so the two machines don't stomp each other. NOTE: per-machine `.secrets.env` is
  git-ignored (correctly) and does NOT sync — shared secrets (DB connection string, Slack tokens)
  must be placed on EACH machine's local `.secrets.env` separately.
- **Gateway single point** — if Rohit's machine is off, no NEW Slack ingest (queued work still
  runs on Vansh's machine). Accepted for v0.1 (D-031); add a Postgres "gateway lease" failover only
  if it bites.
- **Supabase free-tier limits** (connections/storage) at queue volume — verify.
- **Slack** — only one listener by design, so multi-connection semantics are avoided; still verify
  clean reconnect handling on the single gateway.
