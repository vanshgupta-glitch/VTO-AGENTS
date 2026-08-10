---
okf: 1
id: adr-003
type: adr
status: accepted
date: 2026-08-08
tags: [adr, multi-codebase, scoping, registry]
---

# ADR-003 — Multi-codebase support

**Status:** Accepted · **Date:** 2026-08-08
**Depends on:** [[ADR-002-skills-architecture]]

---

## Context

The architecture is half-plural. `documents.codebase` and `solutions.codebase` are already scoped columns; `VTO_REPO_PATH` is a single environment variable; the context assembler assumes one repository. The seam runs through configuration, context assembly, and two tables, so closing it later means touching all three simultaneously — and by then there is data in the wrong shape.

The operator is plural throughout: *"we have this for every codebase"*, *"go through all of our codebases and review all the issues and come up with a narrative"*, *"every single client would have their own Hermes agents."*

The stated goals include multiple codebases, multiple Shopify applications, and multiple research domains. Building single-repo and generalising later is the expensive order.

---

## Decision

**Codebase is a first-class scope, present from the first line of code.** One codebase is the degenerate case of many, not a different design.

### The registry

```
codebases/
├─ vto-widget/
│  ├─ codebase.yaml
│  └─ skills/            # optional codebase-specific overrides
└─ <next>/
   └─ codebase.yaml
```

```yaml
# codebases/vto-widget/codebase.yaml
slug: vto-widget
display_name: VTO Widget
repo_path: C:/Users/<you>/shopify/nmg-vto
default_branch: main
docs_path: docs                      # progressive documents live at <repo>/<docs_path>/

knowledge: [vto-domain, shopify-conventions]
skill_scopes: [_shared, vto, shopify]
operations:  [build.widget, test.unit, test.types, lint, video.run, accuracy.score, repo.diff, repo.pr, deploy.dev]

model_overrides: {}                  # rarely used; per-codebase tier changes
active: true
```

`swarmctl` requires `--codebase <slug>` wherever ambiguity is possible, and refuses to guess when more than one is active.

### What is scoped per codebase

| Scoped | Shared |
|---|---|
| Progressive documents (`llm.md`, `CLAUDE.md`, `trajectory.md`) | Agent personas |
| Issue and work-order documents | Shared skills (`skills/_shared`) |
| Solutions store rows | Universal knowledge packs |
| Available operations | The workflow definitions |
| Codebase-specific skill overrides | `decision.md` — strategic memory is org-wide |
| Tasks, runs, verifications, accuracy scores | The operations *contract* (implementations may differ) |

**`decision.md` is deliberately org-wide.** Architectural decisions about how the swarm works are not per-repository, and duplicating them per codebase would recreate the divergence this ADR exists to prevent.

### Schema

Every operational table carries `codebase` as a **non-null** column: `tasks`, `runs`, `work_orders`, `loops`, `verifications`, `accuracy_scores`, `stuck_events`, plus the already-scoped `documents` and `solutions`. Non-null, not nullable-with-a-default — a nullable scope column becomes a global row that quietly matches everything.

Unique keys that were global become composite: `solutions(theme_hash, codebase)` is already correct; `documents(path)` becomes `documents(codebase, path)`.

### Context assembly

The assembler resolves per codebase:

- **Tier 3 (executor)** — that codebase's `CLAUDE.md` and `llm.md`, plus the task thread. *(This corrects a real omission: executors previously received thread history and no definitions — the role that most needs the codebase model was the only one not given it.)*
- **Tier 2 (orchestrator)** — that codebase's relevant progressive document plus its own discipline history.
- **Tier 1 (strategist)** — **may span codebases.** Loads `trajectory.md` from every active codebase plus `llm.md` from those in scope for the current objective.

Cross-codebase analysis is the strategist's privilege and no one else's. It is also where the operator's *"review all the issues and come up with a narrative"* actually happens.

### Solutions resolution

Lookup is exact on `(theme_hash, codebase)`. A cross-codebase hit is **offered, never applied**: the recovery engine may surface *"a similar problem was solved in `vto-widget`"* as evidence for the orchestrator's diagnosis, but never substitutes the directive. A fix that worked in one repository can be actively wrong in another, and applying it silently is worse than diagnosing from scratch.

### Cost and metrics

Attributed per codebase and per work order. "Is this work order worth continuing" is unanswerable without the second, which is currently missing.

---

## Rationale

**Plural-from-day-one is cheaper than generalising.** The cost now is a config file, a required flag, and one more column on eight tables. The cost later is a migration across config, assembly and schema with live data in the wrong shape.

**Non-null scope columns are the enforcement.** A nullable `codebase` becomes an implicit global that matches everything, and the first time a solution from one repo is applied to another it will look like a mysterious bad fix rather than a scoping bug.

**Strategist-only cross-scope reading** preserves the context discipline. Widening the scope for lower tiers would flood them with irrelevance — the precise failure [[decision]] D-002 exists to prevent.

---

## Consequences

**Gained.** A second Shopify application, a second research domain, or a client repository is a `codebase.yaml` and a skill scope — not a fork.

**Cost.** Every query carries a scope. Every CLI invocation carries a flag. Modest and mechanical, but pervasive — which is exactly why it must exist before there is code to retrofit.

**Interacts with [[decision]] D-017.** Canonical repository identity is still unresolved. This ADR makes that *less* dangerous, not more: two divergent copies can be registered as two codebases and compared, rather than one being silently assumed correct.

**New discipline required.** Adding a codebase means deciding its skill scopes and knowledge packs deliberately. Copying another codebase's `codebase.yaml` and editing the path is the failure mode to watch for.

---

## Alternatives considered

**Single-codebase now, generalise on demand.** Rejected — the seam runs through three layers and the retrofit hits all three with live data present.

**One swarm deployment per codebase.** Rejected: N deployments means N sets of everything to keep consistent, which is the divergence problem with extra infrastructure. Shared skills and one solutions corpus are the whole point.

**Codebase as a runtime parameter with no registry.** Rejected — nowhere to declare which skills, knowledge and operations apply, so every invocation would re-specify them and drift.

---

## Related

[[ADR-002-skills-architecture]] · [[decision]] · [[TECHNICAL-ARCHITECTURE]] · [[PROGRESSIVE-DOCS]]
