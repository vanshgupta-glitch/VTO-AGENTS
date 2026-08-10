# VTO-AGENTS

Specification repository for the **VTO Autonomous Engineering Swarm** — a three-tier multi-agent system that improves a Shopify eyewear virtual try-on product with minimal human involvement.

This repo holds the design. The implementation is built fresh in a separate repository; the VTO product itself lives in `nmg-vto` and is not rebuilt.

## Contents

### `doc/` — the specification

| File | What it is |
|---|---|
| **[decision.md](Projects/VTO/decision.md)** | **Start here.** Strategic memory — the durable decisions, in force and superseded. Written so a session with limited context can understand the project without reading task history, reports, or conversation logs. *(Lives in `Projects/VTO/` alongside the product decisions, not in `doc/`.)* |
| [PRD.md](doc/PRD.md) | Product requirements v3.0 — what the system does, the three loops, features classified must-have vs nice-to-have, user flows, MVP phasing, success metrics, and explicit non-goals. *Its roster and channel map are superseded by ADR-001.* |
| [TECHNICAL-ARCHITECTURE.md](doc/TECHNICAL-ARCHITECTURE.md) | Technical architecture v3.0 — tech stack with reasoning, full folder structure, 20-table database schema explained in plain English, environment variables, configuration gotchas, and the build sequence |
| **[ADR/](doc/ADR/)** | **Architecture Decision Records** — six ADRs covering agent boundaries (12→5), skills architecture, multi-codebase scoping, declared workflows, critique symmetry, and granularity governance. Where these conflict with the PRD or architecture doc, **the ADR wins** |
| [AGENT-SPECS.md](doc/AGENT-SPECS.md) | The five agents in full — `agent.yaml`, persona, what each refuses, what "stuck" means per discipline — plus the four Slack personas with no agent behind them |
| [SKILLS.md](doc/SKILLS.md) | Skill schema, invocation, resolution order, testing, and the initial catalogue across `_shared`, `vto` and `shopify` scopes |
| [WORKFLOWS.md](doc/WORKFLOWS.md) | Stage grammar and the four declared pipelines — improvement, recovery, enrich, research — with explicit failure routing |
| [DRIFT-AND-CONSISTENCY.md](doc/DRIFT-AND-CONSISTENCY.md) | The working plan for the hardest part — keeping agents on track and configuration coherent. Failure taxonomy, the enforcement ladder, what gets measured, the debugging protocol, and what can't be solved |
| [PROGRESSIVE-DOCS.md](doc/PROGRESSIVE-DOCS.md) | Specification and templates for `llm.md`, `CLAUDE.md`, `trajectory.md` — the division-of-content rule, the ENRICH procedure with its verification pass, and the anti-patterns that make them rot |
| [trajectory.md](doc/trajectory.md) | This project's own trajectory document — goal, status, history, priorities, open issues, risks, roadmap, and the questions for the next session |
| [standards/fully-kitted.md](doc/standards/fully-kitted.md) | The error-state and logging bar every change must clear, as a Critic checklist |

### Retained research

| File | Why it survived the cleanup |
|---|---|
| `Projects/VTO/VTO.md` | Holds the validated **D2** pivot and **D3** technical plan — the decisions the swarm optimises toward, and the seed content for `trajectory.md` |
| `Projects/VTO-Agents/Findings/F011 orchestration-*.md` | Research about the swarm itself: cron/heartbeat configs, the FM-1–6 failure-mode catalogue, context-hygiene limits, tiered adversarial review, and the metrics schema. Cited directly by the architecture. |

Everything else — souls, agent briefs, loop protocol drafts, task notes, and the dashboard write-space — was removed as superseded by `doc/`. It remains in git history.

## The system in one paragraph

**Claude** runs a fresh session every invocation, fed only progressive documents (`llm.md`, `CLAUDE.md`, `trajectory.md`), analyses the codebase, finds gaps, and issues work orders. **Four Hermes orchestrators** — Admin, Critic, Researcher, Coder — decompose, review, dispatch, and diagnose their own executors when those executors stall or start circling. **OpenClaw and OpenCode** execute in parallel, calling only named operations from a fixed allowlist. Testing, video and accuracy are operations, not agents; they post under their own Slack personas with no model behind them. Every message passes through a channel, so the whole thing is auditable and interruptible. The loop runs until measured accuracy against FittingBox reaches ≥0.98, then halts at a human commit gate. Git is never automated, and no failure is ever attributed to an agent.

## Start here

1. [decision.md](Projects/VTO/decision.md) — what has been decided and why
2. [trajectory.md](doc/trajectory.md) — where the project is and what is next
3. [ADR/](doc/ADR/) — the current architecture; **these win over the PRD and architecture doc where they conflict**
4. [AGENT-SPECS.md](doc/AGENT-SPECS.md), [SKILLS.md](doc/SKILLS.md), [WORKFLOWS.md](doc/WORKFLOWS.md) — the buildable specifications
5. [TECHNICAL-ARCHITECTURE.md](doc/TECHNICAL-ARCHITECTURE.md) §9 — the build sequence. Steps 1–9 need no Slack tokens.
