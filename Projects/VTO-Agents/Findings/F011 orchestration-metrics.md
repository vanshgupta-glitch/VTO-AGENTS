---
okf: 1
id: F011-metrics
type: finding
project: VTO
status: done
created: 2026-08-04
updated: 2026-08-04
tags: [finding, orchestration, metrics, logging, performance, observability]
source_agent: Orchestration-Researcher
source_task: T011 Swarm-Orchestration-Automation
---

# F011 — Swarm Performance Metrics & Logging Schema

## Question

What should the swarm log per task (duration, tokens, rework rate) and where, so the swarm's own performance is reviewable?

## Answer

### Logging architecture overview

The swarm's performance data lives in **two places** that already exist:

1. **Task notes** (`Projects/VTO/Tasks/T<NNN>.md`) — carry human-readable metrics in the Result section (what the worker reports) and the Review section (what Hermes judges)
2. **Paperclip / Agent OS dashboard** (`localhost:3100`) — already tracks agent- and org-level token spend

We add a **third** — a structured metrics log — but keep it simple: one JSONL file, one line per completed task. The task note remains the human-readable source of truth; the JSONL is for queries.

### Metrics schema (what to log per task)

Every task that reaches `status: done` or `status: rework` gets ONE line in:

**`C:\Users\ankur.singh\Obsidian Vault\Projects\VTO-Agents\metrics\swarm-metrics.jsonl`**

```jsonl
{"ts":"2026-08-04T14:30:00Z","task_id":"T011","type":"research","agent":"Orchestration-Researcher","worker_profile":"OpenClaw","status":"done","duration_s":1847,"attempt":1,"tokens_estimate":{"worker":125000,"sub_sessions":340000,"refuter":0,"hermes_review":28000,"validate_ps1":0},"rework":false,"rework_parent":null,"finding_count":5,"finding_total_kb":41,"verdict":"done","verdict_file":null,"failures":[],"context_budget_used_kb":0}
```

**Schema fields:**

| Field | Type | Required | Description |
|---|---|---|---|
| `ts` | ISO 8601 | Yes | When the task reached terminal state (`done` or `rework`) |
| `task_id` | string | Yes | `T<NNN>` — the task identifier |
| `type` | enum | Yes | `research` \| `build` \| `compile` \| `validate` \| `rework` |
| `agent` | string | Yes | Research agent brief ID (if research) or "build"/"compile" |
| `worker_profile` | string | Yes | "OpenClaw" or "Hermes" — which profile executed |
| `status` | enum | Yes | `done` \| `rework` — terminal status |
| `duration_s` | int | Yes | Wall-clock seconds from `assigned_on` to terminal status (from task note frontmatter timestamps) |
| `attempt` | int | Yes | 1 for first attempt; increments on rework re-loop |
| `tokens_estimate` | object | Yes | Token usage estimates, broken down by consumer (see below) |
| `rework` | bool | Yes | `true` if this task was a rework of a prior task |
| `rework_parent` | string \| null | If rework | The `task_id` of the original task this reworks |
| `finding_count` | int | Yes | Number of finding files produced (0 for build tasks) |
| `finding_total_kb` | int | Yes | Sum of file sizes of produced findings in KB |
| `verdict` | enum | Yes | `done` \| `rework` — Hermes's review verdict |
| `verdict_file` | string \| null | If validated | Path to `validation-reports/*.verdict.md` |
| `failures` | array | Yes | List of failure mode IDs encountered (e.g., `["FM-3"]`) |
| `context_budget_used_kb` | int | If reported | Worker's self-reported context budget (from task note frontmatter `context_budget_used`) |

**`tokens_estimate` sub-fields:**

| Field | Type | Description | Source |
|---|---|---|---|
| `worker` | int | Tokens used by the main worker session (OpenClaw or Hermes) | Paperclip (agent spend API) or self-reported |
| `sub_sessions` | int | Sum of tokens used by all `sessions_spawn` children | Paperclip or session metadata |
| `refuter` | int | Tokens used by adversarial refutation pass (if Tier 1/3 was run) | Paperclip or self-reported |
| `hermes_review` | int | Tokens used by Hermes when reviewing this task | Paperclip |
| `validate_ps1` | int | Tokens used by `validate.ps1` (Haiku review + Opus verdict) — only if candidate was gated | Estimate: ~5k + ~8k = ~13k for standard depth |

**Token sourcing priority:** If Paperclip API is reachable, pull token counts from there (authoritative). If not, use worker self-reports from the task note's Result section. If neither: mark as `-1` (unknown).

### Who writes the metrics

| Metric writer | When | What they write |
|---|---|---|
| OpenClaw | On `status: done` (in the task note's Result section) | Self-reported: `worker` tokens, `sub_sessions` tokens (from session metadata), `finding_count`, `finding_total_kb`, `context_budget_used_kb` |
| Hermes | On `vto-review-done` when writing verdict | `verdict`, `verdict_file`, `hermes_review` tokens (its own spend on this review), `failures` list, `rework` + `rework_parent` if applicable |
| Metrics aggregator (cron or Hermes) | On `vto-review-done`, after verdict written | Reads the task note, computes `duration_s` from `assigned_on` to `ts`, reads Paperclip for authoritative token counts if available, appends the JSONL line |

**Single-writer rule:** Only ONE agent appends to `swarm-metrics.jsonl` — Hermes on `vto-review-done`, after the verdict is written. This prevents write conflicts (per FM-4 write-partitioning discipline from [[F011 orchestration-failure-modes]]).

### Dashboard queries (what the metrics enable)

The JSONL file enables these queries (via simple grep/jq or a dashboard panel):

```bash
# Average task duration by type
grep '"type":"research"' swarm-metrics.jsonl | jq -s 'map(.duration_s) | add/length'

# Total tokens spent across all tasks
grep '' swarm-metrics.jsonl | jq -s '[.[].tokens_estimate | (.worker + .sub_sessions + .refuter + .hermes_review + .validate_ps1)] | add'

# Rework rate (% of tasks that were rework of a prior task)
grep '"rework":true' swarm-metrics.jsonl | wc -l  # vs total lines

# Most expensive tasks (by total tokens)
grep '' swarm-metrics.jsonl | jq -s 'sort_by(.tokens_estimate.worker + .tokens_estimate.sub_sessions) | reverse | .[0:10] | .[] | {task_id, tokens: (.tokens_estimate.worker + .tokens_estimate.sub_sessions)}'

# Finding output rate (KB per task, by agent)
grep '' swarm-metrics.jsonl | jq -s 'group_by(.agent) | .[] | {agent: .[0].agent, tasks: length, total_kb: (map(.finding_total_kb) | add)}'

# Failure mode frequency
grep '' swarm-metrics.jsonl | jq -s '[.[].failures[]] | group_by(.) | .[] | {failure: .[0], count: length}'
```

### What NOT to log (privacy / noise boundaries)

| Don't log | Why |
|---|---|
| Full prompt text | Token-heavy, not actionable, privacy risk |
| Per-tool-call breakdown | Too granular; task-level aggregation is the right resolution |
| Chat transcript contents | Disposable by design (task notes are the durable record) |
| Intermediate token counts (per sub-session child) | Aggregate into `sub_sessions` total; individual child detail is noise |
| Rohit's specific commands / messages | Privacy boundary — the task note captures the assigned work, not who asked |

### Metrics retention

- `swarm-metrics.jsonl` is append-only (like findings). Never delete lines.
- If the file exceeds 10,000 lines (~1 MB), Hermes on `vto-review-done` compresses it to `swarm-metrics-archive-YYYY-MM-DD.jsonl.gz` and starts a fresh file. The archive stays in `metrics/`.
- The `vto-staleness-monitor` cron reports if the metrics file hasn't grown in 7+ days (another swarm-silence signal).

### Integration with existing Paperclip dashboard

The Agent OS Paperclip tab at `localhost:3100` already tracks:
- Agent list (all profiles: Hermes, OpenClaw, sub-sessions)
- Per-agent token spend
- Org-level spend summaries

The JSONL metrics file **complements** Paperclip — it adds task-level context (which task cost how much, rework rate, finding output) that Paperclip doesn't track. A future dashboard panel could read `swarm-metrics.jsonl` and render:
- Task throughput over time (line chart: tasks/day)
- Token spend by agent (stacked bar: worker vs sub-sessions vs review vs gate)
- Rework rate (gauge: % of tasks that were rework)
- Finding output efficiency (KB of findings per 1k tokens spent)

These are **not** built as part of this finding — the schema enables them; Hermes decides when to build the dashboard panel.

### Bootstrap: creating the metrics infrastructure

```bash
# Create metrics directory
mkdir -p "C:\Users\ankur.singh\Obsidian Vault\Projects\VTO-Agents\metrics"

# Initialize empty metrics file with a header comment (JSONL doesn't need headers, but a comment helps humans)
echo "# VTO Swarm Performance Metrics — one JSON object per line, appended by Hermes on task review" > "C:\Users\ankur.singh\Obsidian Vault\Projects\VTO-Agents\metrics\swarm-metrics.jsonl"

# Backfill: for every existing T001-T010 task note, compute metrics and append lines
# (Hermes runs this once on first metrics-enabled review cycle)
```

### Metrics write protocol (Hermes's cron prompt addition)

Add to Hermes's `vto-review-done` cron prompt:

```
After writing the Review verdict on a task note:
1. Read the task note's frontmatter: compute duration_s = (now - assigned_on) in seconds.
2. Read the worker's token self-report from the Result section (if present).
3. Pull authoritative token counts from Paperclip API if reachable (GET localhost:3100/api/agents/<profile>/spend).
4. Count how many finding files were produced (from the artifacts list).
5. Determine which failure modes were hit (check against FM-1 through FM-6 in F011 orchestration-failure-modes).
6. Append ONE valid JSON line to Projects/VTO-Agents/metrics/swarm-metrics.jsonl per the schema in F011 orchestration-metrics.
```

## Implications for VTO Agent Architecture

1. **New convention:** Every worker (OpenClaw) self-reports token estimates in the task note's Result section: `Tokens used (estimate): worker ~125k, sub-sessions ~340k`. Added to [[SOUL-OpenClaw]] §Playbook step 5.

2. **New responsibility for Hermes:** On `vto-review-done`, after the verdict, compute and append the metrics line. Added to [[SOUL-Hermes]] §Playbook after step 7 (Act on the verdict).

3. **New directory:** `Projects/VTO-Agents/metrics/` — the structured performance log.

4. **Optional dashboard panel:** A future Paperclip tab or Grafana panel reading `swarm-metrics.jsonl`. Not built now; schema is the enabler.

## Evidence

- [[Loop Protocol Spec]] §Stage 3 Outputs — the `Result & context returned` section already has a slot for self-reported metrics
- [[System Flow]] §4 — the model fallback ladder already encodes token cost awareness (free models for scraping, Claude for reasoning)
- nmg-vto `Decisions.md` — the "attribute the removal cost before optimising it" pattern (2026-07-29): measurement was wrong because the timer started AFTER the expensive operation. The same discipline applies here — token estimates must measure the right thing, and the `tokens_estimate` sub-fields separate the consumers so cost attribution is honest
- Agent OS Paperclip at `localhost:3100` — existing spend tracking infrastructure that the metrics schema complements

## Related

- [[F011 orchestration-automation]]
- [[F011 orchestration-failure-modes]]
- [[SOUL-Hermes]]
- [[SOUL-OpenClaw]]
- [[System Flow]]