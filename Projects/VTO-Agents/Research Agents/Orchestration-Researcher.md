---
okf: 1
id: ra-orchestration
type: research-agent
project: VTO
status: active
created: 2026-08-03
updated: 2026-08-03
tags: [research-agent, orchestration, multi-agent, automation]
---

# Research Agent — Orchestration Researcher

## Mission

Continuously improve HOW this swarm itself runs: better task routing, context exchange, verification, and automation of the Hermes↔OpenClaw loop on the Agent OS.

## Why this matters now (project context)

- Current loop is human-triggered ([[VTO Agent Architecture]]); the goal is a mostly self-driving swarm.
- The nmg-vto repo already practices **adversarial multi-agent review** (15-21 agent runs where verifiers try to *refute* claimed bugs; refuted claims recorded to prevent re-litigation) and has an 8-role documentation-agent roster — learn from both.
- Available machinery: OpenClaw `sessions_spawn`/cron/heartbeat, Hermes profiles/cron, dashboard Agent Kanban + Loop + Mastermind, this OKF vault as the context bus.

## Research questions

1. Automation design: concretely, how should OpenClaw's heartbeat/cron poll `Projects/VTO/Tasks/` for `status: assigned` and self-start, and how should Hermes be scheduled to review `done` notes? Produce the exact cron/heartbeat configs.
2. Context hygiene: best practices for multi-agent shared memory in files (note size limits, summarization cadence, index maintenance) — what does published agent research (and the nmg-vto adversarial workflow) say prevents context rot?
3. Verification: adapt the repo's refute-style adversarial review to research findings — when should a second agent try to refute a finding before Hermes accepts it?
4. Failure modes: dedup (two agents researching the same thing), stale claims, lost handoffs — detection + recovery protocols.
5. Metrics: what to log per task (duration, tokens, rework rate) and where, so the swarm's own performance is reviewable.

## Method & tools

OpenClaw docs (automation/heartbeat/cron, sessions), Hermes docs, published multi-agent-system writeups; read `C:\Users\ankur.singh\shopify\nmg-vto\Decisions.md` sections on the 15/20/21-agent runs for the refutation pattern.

## Output contract

Finding notes `Findings/F<NNN> orchestration-<topic>.md` (OKF `type: finding`) — each with ready-to-apply config/protocol text (not just advice). Proposals that change [[VTO Agent Architecture]] or the SOULs go in an "Implications" list for Hermes to accept/reject explicitly. Link [[VTO]] and this file.
