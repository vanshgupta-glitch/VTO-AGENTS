# VTO Agentic Orchestration — Current Structure (built + running)

Snapshot of what actually exists and runs today (2026-08-12). Design rationale + decisions live in
[[DISTRIBUTED-ARCHITECTURE]] (D-029..D-035) and [[TECHNICAL-ARCHITECTURE]] (TAD v3.0).

**In one line:** two machines share one Supabase Postgres; a single Slack **gateway** (Rohit's box)
turns messages into task rows; **executor daemons** on both machines pull role-matched tasks with
`FOR UPDATE SKIP LOCKED` (that's the cross-machine overflow), run a local **runtime** (LLM) or a
named **operation** (build/deploy/test), and post results back through the gateway.

## Topology

```mermaid
flowchart TB
  subgraph SLACK["Slack workspace — shared bot identities"]
    CH["#swarm-command · #swarm-code · #swarm-research<br/>#swarm-accuracy · #swarm-human-gate · …"]
  end

  DB[("Supabase Postgres — SHARED (the only coupling)<br/>tasks · runs · workers · machines<br/>post_queue · slack_events · human_gates<br/>critiques · escalations · solutions · stuck_events")]

  subgraph ROHIT["Rohit's machine — GATEWAY HOST + worker"]
    GW["apps/bridge — GATEWAY<br/>the ONE Socket-Mode listener<br/>+ serialized poster (≤1/sec/chan)"]
    DR["apps/daemon — executor<br/>workers: admin, researcher, critic, coder,<br/>opencode, build, deploy, video, accuracy"]
    OPS["packages/operations (allowlist)<br/>build · lint · deploy · video · accuracy"]
    RTR["local runtimes (Rohit's keys)<br/>hermes · opencode · claude"]
  end

  subgraph VANSH["Vansh's machine — worker only"]
    DV["apps/daemon — executor<br/>workers: researcher, coder, opencode"]
    RTV["local runtimes (Vansh's keys)"]
  end

  CH -- "events IN (xapp Socket Mode)" --> GW
  GW -- "dedup + INSERT task" --> DB
  DR -- "claim (SKIP LOCKED)" --> DB
  DV -- "claim (SKIP LOCKED)" --> DB
  DR --> OPS
  DR --> RTR
  DV --> RTV
  DR -- "finish + enqueue post" --> DB
  DV -- "finish + enqueue post" --> DB
  GW -- "drain post_queue → post as agent bot" --> CH

  classDef store fill:#1f6feb22,stroke:#1f6feb;
  class DB store;
```

Only the gateway machine opens a Slack Socket-Mode connection (Slack load-balances events across an
app's connections, so two listeners would split them). Workers never touch Slack — they coordinate
through Postgres, and all outgoing posts are serialized by the gateway's poster.

## The loop (task lifecycle)

```mermaid
sequenceDiagram
  actor U as Operator (Slack)
  participant G as Gateway (Rohit)
  participant Q as Postgres queue
  participant W as Worker (either machine)
  participant X as Runtime / Operation
  U->>G: @VTO-&lt;agent&gt; … (or a seeded task)
  G->>Q: dedup (slack_events) + INSERT task
  loop every ~2s, per worker, capacity-gated
    W->>Q: claimTask — FOR UPDATE SKIP LOCKED
  end
  Q-->>W: next queued task of that role (code tasks gated on a passed critique — D-005)
  alt LLM agent (admin/researcher/critic/coder/opencode)
    W->>X: run local runtime → reply text
  else operation (build/deploy/video/accuracy)
    W->>X: execute(op) → structured result
  end
  X-->>W: result
  W->>Q: finishTask (runs) + enqueue post
  W->>Q: chainNext — improve→build→deploy→(video+accuracy)
  G->>Q: claim next pending post
  G->>U: post as the agent's bot identity
  Note over U,Q: commit → human_gates row → EITHER operator approves (never automated — D-008/D-034)
```

## Components

| Component | Where | What it does |
|---|---|---|
| `packages/db` | shared lib | Pg data layer: the `SKIP LOCKED` claim, enqueue, worker/machine registry + heartbeats, serialized post queue, human-gate, stale recovery. |
| `apps/bridge` (gateway) | Rohit only | One Slack Socket-Mode listener → dedup → `tasks`; poster drains `post_queue` (≤1/sec/channel). |
| `apps/daemon` (executor) | both machines | Registers workers per role, claims tasks (capacity-gated), runs runtime or operation, writes the run, enqueues the reply, chains the loop. |
| `packages/operations` | shared lib | The allowlist — `build · lint · deploy · video · accuracy`. No arbitrary shell (D-006); git commit/push NOT here (D-008); prod deploy out (D-028). |
| Supabase Postgres | cloud (shared) | The single coordination store — 11 tables. |
| `config/machine.local.json` | per machine (git-ignored) | This machine's runtime binary paths, worker capacities, repo path, store creds. |

## Roles → runtime / operation

| Role | Kind | Backed by |
|---|---|---|
| admin, researcher | LLM | hermes · `deepseek/deepseek-v4-flash` |
| critic, coder | LLM | hermes · `qwen/qwen3-coder-flash` |
| opencode | LLM | opencode · `big-pickle` (free; falls back to OpenClaw/haiku when exhausted) |
| claude | LLM | claude · `opus-4-8` (judgment/review) |
| build, lint, deploy, video, accuracy | operation | `packages/operations` (shell, no LLM) |

## Autonomy & gates

- **Auto:** code → build → test → accuracy → **deploy to the DEV store** (D-033).
- **Human-gated:** git commit/push — halts at a `human_gates` row; **either** operator approves (D-034); the system records the approval, never performs the commit (D-008).
- **Pre-code critique gate (D-005):** a code task can't be claimed until a passing critique row exists.
- **Overflow (D-032):** one pool per role; a worker claims only with a free slot; first free worker on either machine wins — implicit, no hand-off messages.

## Status (2026-08-12)

- ✅ Live + verified end-to-end: mention/seed → claim (with real cross-machine overflow) → runtime/op
  → Slack post → Supabase state → chain. A full run did `build → deploy (vto-phase1-80) → video + accuracy`.
- ⚠️ Known defects from the shakedown: (1) daemon **version skew** across machines breaks chaining until
  both re-pull; (2) op-persona bots (testrunner/videotester/accuracy) aren't in the channels yet — op
  results currently post as `admin`; (3) `deploy→video+accuracy` fan-out is parallel, so accuracy can
  score stale logs (should chain accuracy **after** video).
- 🔜 Next: commit/push the operations + chaining code (closes the version-skew gap), invite op bots,
  order accuracy after video, then wire the dispatcher's task decomposition + full recovery.
```
