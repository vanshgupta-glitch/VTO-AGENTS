--- 
okf: 1 
id: T041-cron-heartbeat 
type: finding 
project: VTO 
status: done 
created: 2026-08-24 
updated: 2026-08-24 
tags: [task, orchestration-research, cron-heartbeat, finding] 
source_agent: Orchestration-Researcher 
source_task: T041 Orchestration-Researcher: Cron & Heartbeat Configs 
--- 

# T041 — Orchestration Cron & Heartbeat Configs

## Overview
Two cron/heartbeat entry types automate the VTO swarm: one on OpenClaw's profile (polls for `assigned` tasks), one on Hermes's profile (reviews `done` tasks). A dead-man switch monitors stuck `in-progress` tasks.

## Config 1 — OpenClaw: Poll for Assigned Tasks

**Schedule:** `*/5 * * * *` (every 5 minutes)
**Profile:** OpenClaw
**Name:** `vto-poll-assigned`

```bash
# Apply to OpenClaw's profile
hermes cron add \
  --profile OpenClaw \
  --name "vto-poll-assigned" \
  --schedule "*/5 * * * *" \
  --prompt "Open the vault at C:\Users\ankur.singh\Obsidian Vault\Projects\VTO\Tasks\ and scan for any file whose frontmatter has 'status: assigned'. If none, report 'no assigned tasks' and exit — nothing else. If found, pick the LOWEST-NUMBERED task note (T001 < T002 < ...), set its status to 'in-progress', load its full content, execute it fully per the Goal/Context/Definition of done sections, fill the 'Result & context returned' section completely, set status to 'done', update the row in VTO Task Log, and return exactly what you completed. Do NOT pick up a second task — one per cron fire."
```

**Poll interval rationale:** 5 minutes — fast enough to self-start idle tasks within one cycle, slow enough to avoid wasteful re-scans (95% of cycles have no new tasks). 5 min aligns with existing `kanban_heartbeat` expectation and ensures a batch of 3 tasks clears in 15 min when Hermes assigns 2-4 at once.

**Concurrent-child safety gate:** `sessions_spawn` hard-capped at 3 concurrent sub-sessions. Cron picks **one** task per fire. If a just-fired task is multi-sub-session research mission, the sub-sessions are managed inside that run. The next cron tick 5 min later picks the next `assigned` note — by then, sub-sessions from the prior run may still be in flight, but the parent session has completed and written its results. This naturally rate-limits to ~1 parent task every 5 min, keeping sub-session slots from saturating.

**Idempotency guard:** If OpenClaw fires, picks up T005, sets `in-progress`, but the run times out/crashes before marking `done`, the next cron tick sees T005 as `in-progress` (not `assigned`) and skips to the next available. The watchdog-reclaim path (per [[Loop State Machine]] §4.1) handles timeouts separately.

## Config 2 — Hermes: Review Done Tasks + Assign Next

**Schedule:** `*/10 * * * *` (every 10 minutes)
**Profile:** Hermes
**Name:** `vto-review-done`

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
```

**Poll interval rationale:** 10 minutes. Hermes's review pass is heavier than OpenClaw's pickup — it reads findings, cross-references, potentially compiles candidates and runs `validate.ps1`. A full review+compile+validate cycle can take 3-8 minutes. 10 minutes gives slack for that to complete plus buffer between cycles. OpenClaw's 5 min poll means by the time Hermes reviews, there are typically 1-2 freshly-done tasks waiting.

## Config 3 — Dead-man Switch: Task Staleness Monitor

**Schedule:** `0 */2 * * *` (every 2 hours, at minute 0)
**Profile:** Hermes
**Name:** `vto-staleness-monitor`

```bash
# Apply to Hermes's profile
hermes cron add \
  --profile Hermes \
  --name "vto-staleness-monitor" \
  --schedule "0 */2 * * *" \
  --prompt "Open the vault at C:\Users\ankur.singh\Obsidian Vault\Projects\VTO\Tasks\ and find any task note with 'status: in-progress' whose 'assigned_on' date is more than 24 hours ago. For each, check: does the note have partial results in 'Result & context returned'? If yes, write a 'Review' section with 'Verdict: rework — stale, partial results salvaged' and note what was found. If no partial results, set status back to 'assigned' so OpenClaw re-picks it (it was never started). Report the list of reaped tasks."
```

## Cron Cadence Summary

| Cron entry | Profile | Interval | What triggers | Idempotency |
|---|---|---|---|---|
| `vto-poll-assigned` | OpenClaw | Every 5 min | `status: assigned` note found → execute lowest-numbered | Skips `in-progress`, `done`, `rework` |
| `vto-review-done` | Hermes | Every 10 min | `status: done` note with no Review verdict → review + potentially compile/assign | Skips already-reviewed notes |
| `vto-staleness-monitor` | Hermes | Every 2 hours | `in-progress` > 24h old → reap or salvage | Only acts on stale notes |

## Startup / Boot-time Seeding

On this Windows host, the Gateway (OmniRoute) starts on login. Hermes profiles persist across reboots. The cron entries above survive restarts — they are durable in `~/.hermes/profiles/<name>/cron/`. No additional startup script is needed.

**One-time seeding after creating these crons:** the first tick will be up to 5 min away. To start immediately:

```bash
# Manually trigger first cycle (or wait for first tick)
hermes cron fire --profile OpenClaw --name vto-poll-assigned
hermes cron fire --profile Hermes --name vto-review-done
```

## Disable / Pause Automation

```bash
# Disable (keep config, stop firing)
hermes cron disable --profile OpenClaw --name vto-poll-assigned
hermes cron disable --profile Hermes --name vto-review-done

# Re-enable
hermes cron enable --profile OpenClaw --name vto-poll-assigned
hermes cron enable --profile Hermes --name vto-review-done
```

## How this replaces the human triggers

| Human trigger (today) | Automated equivalent |
|---|---|
| *"work the next assigned VTO task"* | `vto-poll-assigned` cron on OpenClaw, every 5 min |
| *"review VTO and assign next tasks"* | `vto-review-done` cron on Hermes, every 10 min |
| *"validate \<candidate\>"* | Triggered inside `vto-review-done` when Hermes compiles a candidate |
| Human noticing a stuck task | `vto-staleness-monitor` every 2 hours |
