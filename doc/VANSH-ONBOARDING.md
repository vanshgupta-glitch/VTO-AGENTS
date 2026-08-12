# Prompt for Vansh's Claude Code — join the VTO distributed swarm

*(Vansh: paste everything below into Claude Code on your machine. It sets this machine up as a
worker node in the two-machine VTO swarm. It will ask you only for the secrets Rohit shares with
you directly.)*

---

You are Claude Code on **Vansh's** Windows machine. Rohit's Claude and you are building a
**two-machine agent swarm** for the VTO (eyewear virtual try-on) project. Your job right now:
set THIS machine up as a **worker node** integrated with the shared infrastructure, load full
context, and get ready to build/run alongside Rohit's machine. Be precise about what exists.

## Current state — do NOT chase what isn't built
- **LIVE:** a shared **Supabase Postgres** (a dedicated project, ref `eebswtqvbhzowvuxklpl`) with
  the full coordination schema — **11 tables** applied. This is the ONLY shared runtime coupling.
- **DESIGNED, NOT BUILT YET:** the **gateway** (Slack listener), the **executor daemon**, the
  **operations layer**. These are Phases 2–4. There is no daemon to run yet — your setup gets this
  machine READY + connected; building the runtime is the next joint step with Rohit's Claude.

## Repos + branches — pull these first
1. **Code:** `https://github.com/NMGDigital/nmg-vto.git` → branch **`distributed-swarm`**. The VTO
   product code lives in `rkumar-vto/`. (Read `nmg-vto/CLAUDE.md` — the build/verify rules.)
2. **Swarm / design / shared memory:** `https://github.com/vanshgupta-glitch/VTO-AGENTS.git` →
   branch **`distributed-swarm`**. Read, in order:
   - `doc/DISTRIBUTED-ARCHITECTURE.md` — **READ FIRST.** The full multi-machine design + decisions
     D-029..D-035.
   - `doc/TECHNICAL-ARCHITECTURE.md` (TAD v3.0) and `Projects/VTO/decision.md` — the single-machine
     design + all strategic decisions this builds on.
   - `packages/db/migrations/0001_init.sql` — the applied schema.
   - this file.
   `git fetch` both, `git checkout distributed-swarm` in each, and read the design doc end to end
   before doing anything.

## The architecture in one paragraph
Rohit's machine runs the **single Slack gateway** (the only Socket-Mode listener + the only poster)
→ it writes tasks into the shared Postgres → **both machines** run executor daemons that pull
role-matched tasks with `FOR UPDATE SKIP LOCKED` (that IS the overflow: one pool per role, whichever
machine has a free worker grabs the next task) → each runs its **local** OpenCode/OpenClaw/hermes
with **its own API keys** → results + posts flow back through Postgres, and the gateway serializes
posting. **You never open a Slack Socket-Mode connection** — only Rohit's gateway does (Slack
load-balances events across an app's connections, so two listeners break it). Autonomy runs through
code→build→test→accuracy→**dev deploy**; **git commit is human-gated** (either Rohit or Vansh may
approve).

## GET FROM ROHIT (secrets — shared directly, out of band; put in `config/.secrets.env` in the vault, which is git-ignored — NEVER commit them)
- The Slack bot tokens (`xoxb-*` per agent) + the app token (`xapp-*`).
- `SWARM_DATABASE_URL` — the Supabase **Session pooler** connection string (the shared DB).
- `SUPABASE_ACCESS_TOKEN` + `SUPABASE_PROJECT_REF=eebswtqvbhzowvuxklpl` (for admin SQL).
- The dev-store password (for the video harness).
After writing `config/.secrets.env`, confirm it's ignored: `git check-ignore config/.secrets.env`.

## SET UP THIS MACHINE (your own resources — D-035: your machine uses YOUR keys)
1. **Runtimes:** install/verify the CLIs — `hermes`, `openclaw` (claude-haiku-4-5 via claude-cli),
   `opencode` (opencode/big-pickle), `claude` — each with **Vansh's own** OpenRouter/Anthropic
   keys. Your install paths differ from Rohit's (`ankur.singh`); `config/runtimes.yaml` is stale —
   resolve CLI paths **per-machine** (env/local file, not committed).
2. **Per-machine config:** your `machine_id` (hostname+platform), your worker capacities (e.g.
   researcher×2, coder×2, opencode×3, openclaw×2), your CLI paths.
3. **Verify shared-DB connectivity** (via the Management API — needs `SUPABASE_ACCESS_TOKEN`):
   ```powershell
   $pat=$env:SUPABASE_ACCESS_TOKEN; $ref="eebswtqvbhzowvuxklpl"
   Invoke-RestMethod -Method Post -Uri "https://api.supabase.com/v1/projects/$ref/database/query" `
     -Headers @{Authorization="Bearer $pat"} -ContentType "application/json" `
     -Body (@{query="select table_name from information_schema.tables where table_schema='public' order by 1;"}|ConvertTo-Json)
   ```
   You should see all 11 tables: `critiques, escalations, human_gates, machines, post_queue, runs,
   slack_events, solutions, stuck_events, tasks, workers`.

## Working rules (adopt these — identical to Rohit's Claude)
- ALL VTO **product** code lives ONLY in `nmg-vto/rkumar-vto`. **Swarm/orchestration** code lives
  in the VTO-AGENTS vault repo.
- **Terminal tasks EXECUTE on OpenCode/OpenClaw**; you (Claude) only ASSIGN + VALIDATE their method
  and result — don't burn premium tokens on mechanical volume.
- **Git commit/push is human-gated** (either operator approves). Autonomy is allowed up to and
  including **dev-store deploy**; STOP before git commit.
- Agents coordinate through **Postgres + Slack channels**, never directly.
- Verify code with `tsc -b` + `eslint` + the widget build before claiming anything works.

## What's next (build jointly with Rohit's Claude, against this schema)
Phase 2 gateway (Rohit) → Phase 3 executor daemon (both) → Phase 4 operations allowlist → Phase 5
dispatcher/critique/recovery → Phase 6 human-gate flow → Phase 7 end-to-end dry run.

## Your first actions, in order
1. Pull both `distributed-swarm` branches; read `doc/DISTRIBUTED-ARCHITECTURE.md`.
2. Ask Vansh for the secrets Rohit shared; write `config/.secrets.env` (verify git-ignored).
3. Run the DB verification above — confirm the 11 tables.
4. Inventory the local runtimes + keys; report what's present vs missing.
5. Save the key context + working rules to your memory.
6. Report readiness to Rohit (Slack `#swarm-command` once the gateway is up, or a commit note),
   and stand by to build the Phase-3 executor daemon against the schema.
