---
okf: 1
id: F011-automation
type: finding
project: VTO
status: done
created: 2026-08-04
updated: 2026-08-04
tags: [finding, orchestration, automation, cron, heartbeat, configuration]
source_agent: Orchestration-Researcher
source_task: T011 Swarm-Orchestration-Automation
---

# F011 — Swarm Orchestration Automation (Cron / Heartbeat Configs)

## Question

How should OpenClaw's heartbeat/cron poll `Projects/VTO/Tasks/` for `status: assigned` and self-start, and how should Hermes be scheduled to review `done` notes? Produce exact cron/heartbeat configs ready to apply.

## Answer

The automation contracts are **two cron/heartbeat entries**: one on OpenClaw's profile (polls for `assigned` tasks), one on Hermes's profile (reviews `done` tasks). They work together to replace the human trigger phrases with self-driving polling.

### Config 1 — OpenClaw: poll for assigned tasks

**Mechanism:** `hermes cron add` on the OpenClaw profile. This fires a cron job every 5 minutes that scans `Projects/VTO/Tasks/` for any note with `status: assigned` and spawns OpenClaw to execute the lowest-numbered one.

```bash
# Apply to OpenClaw's profile
hermes cron add \
  --profile OpenClaw \
  --name "vto-poll-assigned" \
  --schedule "*/5 * * * *" \
  --prompt "Open the vault at C:\Users\ankur.singh\Obsidian Vault\Projects\VTO\Tasks\ and scan for any file whose frontmatter has 'status: assigned'. If none, report 'no assigned tasks' and exit — nothing else. If found, pick the LOWEST-NUMBERED task note (T001 < T002 < ...), set its status to 'in-progress', load its full content, execute it fully per the Goal/Context/Definition of done sections, fill the 'Result & context returned' section completely, set status to 'done', update the row in VTO Task Log, and return exactly what you completed. Do NOT pick up a second task — one per cron fire."
```

**Poll interval rationale:** 5 minutes. This is the sweet spot:
- Faster than 2 min: wasteful re-scans when no new tasks exist (95% of cycles).
- Slower than 10 min: adds latency that hurts the feel of a "self-driving" swarm when tasks are queued.
- 5 min aligns with the existing `kanban_heartbeat` expectation (~15 min for long tasks). Even the shortest research sub-task takes 5-15 min, so a 5 min poll cadence never misses a newly-assigned task for more than one cycle.
- If Hermes assigns 2-4 tasks at once per its playbook (step 1), OpenClaw picks up one every 5 min → batch of 3 clears in 15 min, well within reason.

**Concurrent-child safety gate:** OpenClaw's `sessions_spawn` is hard-capped at 3 concurrent sub-sessions. The cron-prompt above picks **one** task per fire. If the just-fired task is a multi-sub-session research mission, the sub-sessions are managed inside that run. The next cron tick 5 min later picks the next `assigned` note — by then, sub-sessions from the prior run may still be in flight, but the parent session has completed and written its results. This naturally rate-limits to ~1 parent task every 5 min, keeping sub-session slots from saturating.

**Idempotency guard:** If OpenClaw fires, picks up T005, sets `in-progress`, but the run times out / crashes before marking `done`, the next cron tick sees T005 as `in-progress` (not `assigned`) and skips to the next available. The watchdog-reclaim path (per [[Loop State Machine]] §4.1) handles timeouts separately.

### Config 2 — Hermes: review done tasks + assign next

**Mechanism:** `hermes cron add` on Hermes's profile. This fires every 10 minutes to review recently-done task notes, absorb findings, and potentially compile candidates or assign follow-up tasks.

```bash
# Apply to Hermes's profile
hermes cron add \
  --profile Hermes \
  --name "vto-review-done" \
  --schedule "*/10 * * * *" \
  --prompt "Open the vault at C:\Users\ankur.singh\Obsidian Vault\Projects\VTO\Tasks\ and scan for task notes whose frontmatter has 'status: done' and whose 'Review' section is EMPTY (no 'Verdict:' line yet). If none, check [[VTO]] and the swarm state: are there research agents still unassigned that match current open questions? If so, assign the next 2-4 as new tasks per the playbook. If no unassigned agents and no done tasks to review, report 'swarm idle' and exit.

If done tasks ARE found: read each finding note they produced (in Projects/VTO-Agents/Findings/), absorb cross-confirmations/contradictions, and decide:
1. If the done tasks complete a research wave (e.g., all tasks for a candidate are in): compile the findings into ONE candidate output note, submit to validate.ps1, and act on the verdict per the playbook.
2. If more tasks are needed (some agents still unassigned): assign the next batch, update VTO Task Log.
3. If the done task was a build/implement task (not research): review the returned context, mark verdict on the task note's Review section, and if APPROVED, update [[VTO]] Status.

Fill the 'Review' section on EVERY reviewed task note with 'Verdict: done' or 'Verdict: rework' plus notes. One review pass per cron fire. See [[SOUL-Hermes]] §Playbook for full workflow."

# Alternative config (preferred): use hermes's built-in scheduler
# If 'hermes cron add' supports --tool mode to just run a profile wake-up:
hermes cron add \
  --profile Hermes \
  --name "vto-review-done" \
  --schedule "*/10 * * * *" \
  --prompt "Review VTO and assign next tasks"
```

**Poll interval rationale:** 10 minutes. Hermes's review pass is heavier than OpenClaw's pickup — it reads findings, cross-references, potentially compiles candidates and runs `validate.ps1`. A full review+compile+validate cycle can take 3-8 minutes. 10 minutes gives slack for that to complete plus buffer between cycles. OpenClaw's 5 min poll means by the time Hermes reviews, there are typically 1-2 freshly-done tasks waiting.

### Config 3 — Dead-man switch: task staleness monitor

A third cron entry protects against tasks stuck in `in-progress` indefinitely:

```bash
# Apply to Hermes's profile
hermes cron add \
  --profile Hermes \
  --name "vto-staleness-monitor" \
  --schedule "0 */2 * * *" \
  --prompt "Open the vault at C:\Users\ankur.singh\Obsidian Vault\Projects\VTO\Tasks\ and find any task note with 'status: in-progress' whose 'assigned_on' date is more than 24 hours ago. For each, check: does the note have partial results in 'Result & context returned'? If yes, write a 'Review' section with 'Verdict: rework — stale, partial results salvaged' and note what was found. If no partial results, set status back to 'assigned' so OpenClaw re-picks it (it was never started). Report the list of reaped tasks."
```

### Cron cadence summary

| Cron entry | Profile | Interval | What triggers | Idempotency |
|---|---|---|---|---|
| `vto-poll-assigned` | OpenClaw | Every 5 min | `status: assigned` note found → execute lowest-numbered | Skips `in-progress`, `done`, `rework` |
| `vto-review-done` | Hermes | Every 10 min | `status: done` note with no Review verdict → review + potentially compile/assign | Skips already-reviewed notes |
| `vto-staleness-monitor` | Hermes | Every 2 hours | `in-progress` > 24h old → reap or salvage | Only acts on stale notes |

### Startup / boot-time seeding

On this Windows host, the Gateway (OmniRoute) starts on login. Hermes profiles persist across reboots. The cron entries above survive restarts — they are durable in `~/.hermes/profiles/<name>/cron/`. No additional startup script is needed.

**One-time seeding after creating these crons:** the first tick will be up to 5 min away. To start immediately:

```bash
# Manually trigger first cycle (or wait for first tick)
hermes cron fire --profile OpenClaw --name vto-poll-assigned
hermes cron fire --profile Hermes --name vto-review-done
```

### Disable / pause automation

```bash
# Disable (keep config, stop firing)
hermes cron disable --profile OpenClaw --name vto-poll-assigned
hermes cron disable --profile Hermes --name vto-review-done

# Re-enable
hermes cron enable --profile OpenClaw --name vto-poll-assigned
```

### How this replaces the human triggers

| Human trigger (today) | Automated equivalent |
|---|---|
| *"work the next assigned VTO task"* | `vto-poll-assigned` cron on OpenClaw, every 5 min |
| *"review VTO and assign next tasks"* | `vto-review-done` cron on Hermes, every 10 min |
| *"validate \<candidate\>"* | Triggered inside `vto-review-done` when Hermes compiles a candidate |
| Human noticing a stuck task | `vto-staleness-monitor` every 2 hours |

## Implications for VTO Agent Architecture

These are proposals — Hermes must explicitly accept or reject each:

1. **[[VTO Agent Architecture]] §"How the loop actually fires"** should be updated: replace the "Later (automatable): …" paragraph with a reference to this finding and the active cron configs. The human-trigger path stays as fallback.

2. **[[SOUL-Hermes]] §Playbook** step 3 ("Fire.") should be reworded: *"The `vto-poll-assigned` cron on OpenClaw will pick up assigned tasks automatically within 5 minutes; no manual fire command needed unless debugging."*

3. **[[SOUL-OpenClaw]] §Playbook** step 1 ("Pick up.") should add: *"The `vto-poll-assigned` cron on your profile polls every 5 minutes — tasks assigned while you're idle will self-start. In a manual session, `work the next assigned VTO task` still works."*

4. **[[Loop Protocol Spec]] §Open questions #1** (dispatcher trigger): this finding resolves it with concrete crons. Mark resolved if accepted.

## Evidence

- [[Loop Protocol Spec]] §Stage 1 — defines the trigger inputs and handoff contract that crons replace
- [[Loop State Machine]] §1a — kanban state model that crons must respect (`ready → running → review`)
- [[SOUL-OpenClaw]] §Playbook — the exact steps a cron must replicate
- [[SOUL-Hermes]] §Playbook — the review + compile + validate workflow
- nmg-vto `Decisions.md` — the "build stamp" lesson: deploy ≠ evidence; same logic applies to cron: `cron add` ≠ running; verify with `cron list` after setup

## Related

- [[VTO Agent Architecture]]
- [[Loop Protocol Spec]]
- [[System Flow]]
- [[F011 orchestration-failure-modes]]
- [[F011 orchestration-metrics]]