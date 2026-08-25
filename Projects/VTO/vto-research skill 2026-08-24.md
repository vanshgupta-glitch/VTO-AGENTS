---
okf: 1
id: vto-research-skill-log
type: log
project: VTO
status: done
created: 2026-08-24
updated: 2026-08-24
tags: [log, orchestration, skill, cron, research-heartbeat]
---

# vto-research skill created and registered — 2026-08-24

## What happened

The `vto-research` cron job (job_id `9eeff07fd93e`) fired in Claude Code and reported
**"Skill(s) not found and skipped: vto-research"** — the cron existed but the skill it invokes did not.

## What was done

1. **Created the skill** at `C:\Users\ankur.singh\.claude\skills\vto-research\SKILL.md`
   (Claude Code user-level, so every session — including cron-fired ones — resolves it).
2. **Registered it** in the swarm catalogue: [[SKILLS]] §7, `vto` domain table, with a location note.
3. **Verified**: the skill now appears in the live Claude Code skill index; the next cron fire will
   resolve it instead of skipping.
4. **Revised same day** (Rohit): research execution must run on the FREE runtimes, not on Claude —
   OpenCode (free, big-pickle) primary, OpenClaw (claude-haiku-4-5) fallback. Claude only frames
   the mission and validates method + result. The skill now encodes this.
5. **Cron mystery solved + identities created same day**: the failing cron is a **hermes cron**
   (job `9eeff07fd93e`, was firing every 1m; retuned to **every 15m**) that attaches hermes skill
   `vto-research` — installed now at `AppData\Local\hermes\skills\vto-research\` as a thin trigger
   that fires the OpenClaw **vto-researcher** agent. Created two OpenClaw agents with SOULs derived
   from the authoritative vault souls: **vto-researcher** (`soul/researcher.md` → workspace
   `~\openclaw-ws\vto-researcher`) and **vto-critic** (`soul/critic.md` → workspace
   `~\openclaw-ws\vto-critic`; carries the refuter instrument for findings AND the constructive
   critic for plans — per the soul's own distinction). The full executor-side tick lives at
   `~\.openclaw\skills\vto-research\SKILL.md`; the Claude Code skill now uses these identities for
   its fallback/refute steps too. First live tick: T037 → [[F016-competitor-teardown]] (OpenCode
   found exhausted — zero-output streams; OpenClaw/haiku executed).
6. **Human visibility added same day** (Rohit): every agent must post a work-report summary to its
   DEPARTMENT channel so the human in the loop can see what the inner loop did — the admin check
   stays, but what was checked is now visible. Implemented three ways: (a) the skill's step 12
   posts each tick's report to **#swarm-research** as the researcher bot via
   `scripts/agent-report.ts` (new, vault root); (b) `apps/daemon` gained `postWorkReport()` —
   every swarm-loop task now also reports to its role's department channel (uncommitted; needs
   the usual both-machines daemon cutover); (c) convention documented in
   [[ORCHESTRATION-DIAGRAM]] §"Work reports" + [[Orchestration-Flows]] §9.

## What the skill does (one tick per fire)

Implements [[F011 orchestration-automation]] Config 1 (`vto-poll-assigned` contract) — orchestrated
by Claude Code, executed on the free runtimes — plus [[Orchestration-Flows]] flows 1.4–1.6 and the
Tier-1 adversarial review (§3.1):

1. Rehydrate from [[CONTEXT-HANDOFF]] (120-line cap).
2. Scan `Projects/VTO/Tasks/` for `status: assigned`/`rework` notes tagged `*research*`
   (currently the T037–T046 wave, e.g. [[T037 competitor research teardown]] …
   [[T046 testing research qa-ground-truth]]).
3. Claim ONE (rework first, else lowest-numbered); mark `in-progress` + `claimed` timestamp.
4. Load the mission brief from `Projects/VTO-Agents/Research Agents/` (task Method is the fallback).
5. Fire the mission (brief + Known Dead Ends + OKF contract + target `F<NNN>` path) to
   **OpenCode** (`opencode run … -m opencode/big-pickle`), falling back to **OpenClaw**
   (`openclaw agent --local --message-file … --model claude-haiku-4-5`) when OpenCode is
   exhausted. The executor writes the draft finding to `Projects/VTO-Agents/Findings/`
   incrementally (`status: draft`).
6. Claude validates method + result (dead ends respected, every claim cited, questions actually
   answered), fixes OKF structure, sets `status: done`. If both runtimes are down the task reverts
   to `assigned` — the research is never run on Claude.
7. Tier-1 refuter per finding — also a cheap-model call (OpenClaw/haiku) →
   `F<NNN>-adversarial-review.md`; refutations go to `REFUTED-CLAIMS.md` + a Correction block,
   never a silent rewrite.
8. Close out: task note Result & Context Returned, `status: done`, [[VTO Task Log]] row,
   kanban mirror via `hermes` CLI when available.

One task per fire — the cron cadence is the rate limiter. Build/code tasks are explicitly out of
scope; they stay on the Slack/Postgres swarm loop ([[ORCHESTRATION-DIAGRAM]]).

## Related

[[VTO]] · [[SKILLS]] · [[Orchestration-Flows]] · [[F011 orchestration-automation]] · [[VTO Task Log]]
