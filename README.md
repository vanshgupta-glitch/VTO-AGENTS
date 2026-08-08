# VTO-AGENTS

Specification repository for the **VTO Autonomous Engineering Swarm** — a three-tier multi-agent system that improves a Shopify eyewear virtual try-on product with minimal human involvement.

This repo holds the design. The implementation is built fresh in a separate repository; the VTO product itself lives in `nmg-vto` and is not rebuilt.

## Contents

### `doc/` — the specification

| File | What it is |
|---|---|
| [PRD.md](doc/PRD.md) | Product requirements v3.0 — what the system does, the 12-agent roster, the three loops, features classified must-have vs nice-to-have, user flows, MVP phasing, success metrics, and explicit non-goals |
| [TECHNICAL-ARCHITECTURE.md](doc/TECHNICAL-ARCHITECTURE.md) | Technical architecture v3.0 — tech stack with reasoning, full folder structure, 20-table database schema explained in plain English, environment variables, configuration gotchas, and the build sequence |
| [DRIFT-AND-CONSISTENCY.md](doc/DRIFT-AND-CONSISTENCY.md) | The working plan for the hardest part — keeping agents on track and configuration coherent. Failure taxonomy, the enforcement ladder, what gets measured, the debugging protocol, and what can't be solved |

### Retained research

| File | Why it survived the cleanup |
|---|---|
| `Projects/VTO/VTO.md` | Holds the validated **D2** pivot and **D3** technical plan — the decisions the swarm optimises toward, and the seed content for `trajectory.md` |
| `Projects/VTO-Agents/Findings/F011 orchestration-*.md` | Research about the swarm itself: cron/heartbeat configs, the FM-1–6 failure-mode catalogue, context-hygiene limits, tiered adversarial review, and the metrics schema. Cited directly by the architecture. |

Everything else — souls, agent briefs, loop protocol drafts, task notes, and the dashboard write-space — was removed as superseded by `doc/`. It remains in git history.

## The system in one paragraph

**Claude** runs a fresh session every invocation, fed only progressive documents (`llm.md`, `CLAUDE.md`, `trajectory.md`), analyses the codebase, finds gaps, and issues work orders. **Nine Hermes orchestrators** — Admin, Critic, Scout, Researcher, Coder, Scaffolder, TestRunner, VideoTester, Accuracy — each own one discipline: they decompose, dispatch, and diagnose their own executors when those executors stall or start circling. **OpenClaw and OpenCode** execute in parallel, calling only named operations from a fixed allowlist. Every message passes through a Slack channel, so the whole thing is auditable and interruptible. The loop runs until measured accuracy against FittingBox reaches ≥0.98, then halts at a human commit gate. Git is never automated, and no failure is ever attributed to an agent.

## Start here

Read [PRD.md](doc/PRD.md) for what and why, then [TECHNICAL-ARCHITECTURE.md](doc/TECHNICAL-ARCHITECTURE.md) §9 for the build sequence. Steps 1–9 need no Slack tokens.
