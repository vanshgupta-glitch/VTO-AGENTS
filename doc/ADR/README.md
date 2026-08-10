---
okf: 1
id: adr-index
type: index
status: active
created: 2026-08-08
updated: 2026-08-08
tags: [adr, index, architecture]
---

# Architecture Decision Records

Each ADR records one decision, its reasoning, and what it costs. ADRs are **superseded, never edited** — the reasoning at the time is the point.

| ADR | Decision | Status |
|---|---|---|
| [001](ADR-001-agent-boundaries.md) | **Agent boundaries — the roster is five.** Promotion test, authority scale, and the demotion of Scout, Scaffolder, TestRunner, VideoTester and Accuracy | Accepted |
| [002](ADR-002-skills-architecture.md) | **Skills, knowledge and operations.** Three reuse units, semver pinning, resolution order, index-not-bodies composition, golden tests | Accepted |
| [003](ADR-003-multi-codebase.md) | **Multi-codebase support.** Codebase as a first-class scope from day one; what is scoped and what is shared | Accepted |
| [004](ADR-004-workflow-engine.md) | **Pipelines are declared workflows.** Forced by 001; adds the NARRATIVE stage and explicit failure routing | Accepted |
| [005](ADR-005-critique-symmetry.md) | **Critique applies to work orders.** Scoped by leverage, not by discipline | Accepted |
| [006](ADR-006-agent-granularity.md) | **Granularity governance.** The written promotion test, over-add signals, and a soft ceiling of seven | Accepted |

---

## The roster these produce

**Five agents** — Claude (strategist), Admin (scheduler), Critic (pre-code and pre-plan review), Researcher, Coder — plus two executor runtimes, OpenClaw and OpenCode.

**Personas without agents** — VTO TestRunner, VTO VideoTester, VTO Accuracy, VTO Scout post to Slack under their own bot identities with no LLM, prompt, or model behind them. Presentation and agency are separable.

---

## Target structure

Consolidated from ADR-002 and ADR-003. The pieces marked **new** did not exist in TAD v3.0.

```
swarm/
├─ agents/                         # 5 — was 12
│  ├─ claude/ · admin/ · critic/ · researcher/ · coder/
│  │    ├─ agent.yaml              # authority · escalation · caps · ops · skills · knowledge
│  │    └─ persona.md              # identity only — short and stable
│  └─ _executors/openclaw/ · opencode/
│
├─ skills/                         # NEW — versioned procedures
│  ├─ _shared/
│  │  ├─ web-harvest/              # was Scout
│  │  ├─ stuck-diagnosis/
│  │  ├─ constructive-critique/
│  │  └─ report-writing/
│  ├─ vto/
│  │  ├─ visual-diff/              # was VideoTester's analysis
│  │  ├─ accuracy-interpretation/
│  │  └─ patent-teardown/
│  └─ shopify/
│     ├─ theme-extension/
│     └─ project-scaffold/         # was Scaffolder
│        ├─ skill.yaml             # version · applies_to · requires · provides · when_to_use
│        ├─ SKILL.md
│        └─ test/                  # golden cases — REQUIRED
│
├─ knowledge/                      # NEW — durable facts, no procedure
│  ├─ vto-domain/ · shopify-conventions/ · competitor-landscape/
│
├─ workflows/                      # NEW — declared pipelines
│  ├─ improvement-loop.yaml · research-loop.yaml · enrich.yaml
│
├─ codebases/                      # NEW — the multi-codebase seam
│  └─ vto-widget/
│     ├─ codebase.yaml             # repo path · docs path · skill scopes · knowledge · operations
│     └─ skills/                   # optional codebase-specific overrides
│
├─ personas/                       # NEW — Slack identities with no agent behind them
│  └─ testrunner.yaml · videotester.yaml · accuracy.yaml · scout.yaml
│
├─ packages/
│  ├─ core/ · context/ · documents/ · operations/ · db/ · slack/
│  ├─ runtimes/ · registry/ · observability/
│  └─ workflow/                    # NEW — the stage interpreter
│
├─ apps/bridge/ · cli/ · bootstrap/
├─ harnesses/                      # Python — video + accuracy
├─ fixtures/ · test/ · data/
└─ doc/
```

**Progressive documents live in each target repository**, not here — `<repo>/<docs_path>/llm.md`, `CLAUDE.md`, `trajectory.md`. They describe that codebase and must version alongside it.

---

## Reconciliation still owed

These ADRs supersede parts of PRD v3.0 and TECHNICAL-ARCHITECTURE v3.0 that have **not yet been rewritten**. Where they conflict, **the ADR wins.**

| Document | Sections superseded |
|---|---|
| [[PRD]] | §5.2 roster (12→5) · §6.11 channel map · §7 features naming demoted agents · §8 flows · §9 MVP phase contents |
| [[TECHNICAL-ARCHITECTURE]] | §4 agent folder · §5 structure · §6 `agents` table + scope columns · §7 bot tokens (12→5 + personas) · §9 build sequence |

Reconciling both into v4.0 is tracked as `OPEN-007` in [[trajectory]].

---

## Related

[[decision]] · [[trajectory]] · [[PRD]] · [[TECHNICAL-ARCHITECTURE]] · [[DRIFT-AND-CONSISTENCY]] · [[PROGRESSIVE-DOCS]]
