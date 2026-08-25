---
okf: 1
id: context-handoff
type: handoff
status: active
owner: docsmanager
ceiling_lines: 120
session: active — docsmanager online
updated: 2026-08-22
tags: [context, handoff, session, ledger]
---

# CONTEXT-HANDOFF — read this, then stop reading

**Sole writer: the Documents Manager** ([[soul/docsmanager]]). Everyone else reads. Hard ceiling 120 lines — rewritten in place, never appended. If this file is over ceiling or stale, that is a docsmanager defect: say so in `#swarm-docs`.

## How to rehydrate (fresh session — start here)

1. Read this file top to bottom. It is capped, so this is always cheap.
2. Follow a link below **only when a decision needs it** — never re-read history to "catch up"; the whole point of this file is that you do not have to.
3. If what you need is not here and not linked, ask the Documents Manager in `#swarm-docs` — do not scroll Slack.

## Goal right now

Rebuild frame-removal from scratch on branch `card-face-width`, informed by v1's post-mortem. Target: ≥98% quality vs the FittingBox reference. A doc-loop workflow run is starting to drive the rebuild.

## In flight

| Task | Role | Goal (one line) | Since |
|---|---|---|---|
| frame-removal-rebuild | operator (doc-loop) | Rebuild frame removal from scratch on `card-face-width`, informed by v1 learnings | 2026-08-22 |

## Completed this session

| Task | Outcome | Evidence |
|---|---|---|
| frame-removal-v1 | SCRAPPED 2026-08-22 — did not meet quality gate | origin/distributed-swarm@4b6d5b0 |

## Blocked / awaiting gate

*(none currently)*

## Decisions this session

- Frame-removal v1 scrapped 2026-08-22 after failing quality gate. Entire approach rebuilt from scratch.
- Branch pivot: `frame-removal` → `card-face-width`. Old code preserved at `origin/distributed-swarm@4b6d5b0`.
- Post-mortem captured → learnings inform the rebuild.

## Warnings

*(none currently)*

## Open questions for the next session

- Does the `card-face-width` approach avoid v1's convergence failure mode? Verify against FittingBox reference early.

## Where everything else lives (links, never restated)

- What the codebase is → `rkumar-vto` `llm.md` · agent rules → its `CLAUDE.md`
- Where the project has been / is going → [[trajectory]]
- Durable decisions → [[decision]] · architecture → [[DISTRIBUTED-ARCHITECTURE]] · [[ORCHESTRATION-DIAGRAM]]
- Who does what → [[AGENT-SPECS]] · souls → [[soul/README]]
- Frame-removal v1 post-mortem → `Projects/VTO/LEARNINGS-frame-removal.md` (in vault — read before starting the rebuild)
- Raw record → Slack channels + Supabase Postgres (tasks · runs · gates) — via docsmanager, not by scrolling