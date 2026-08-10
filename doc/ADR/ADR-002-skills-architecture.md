---
okf: 1
id: adr-002
type: adr
status: accepted
date: 2026-08-08
tags: [adr, skills, knowledge, operations, reuse, versioning]
---

# ADR-002 — Skills, knowledge and operations: the reuse architecture

**Status:** Accepted · **Date:** 2026-08-08
**Depends on:** [[ADR-001-agent-boundaries]] · **Enables:** [[ADR-003-multi-codebase]]

---

## Context

Each agent carried one `system.md` — a monolithic prompt with no sharing and no versioning. Five agents against one codebase hides the problem. Five against three codebases is **fifteen divergent prompts**, and nothing validates a prompt. This is the config-divergence failure in [[DRIFT-AND-CONSISTENCY]] §B1 applied to the one surface with no schema to catch it.

The operator names skills as the only mechanism by which codebase-specific knowledge persists inside agents — *"those Hermes agents would have skills based upon their deployment"* — but in his setup skills live in the agent runtime, where they cannot be diffed, tested, or rolled back.

[[ADR-001]] also created immediate demand: Scout and Scaffolder became skills, and there was nowhere to put them.

---

## Decision

**Three distinct reusable units. Do not conflate them.**

| Unit | Is | Contains | Executes on | Versioned |
|---|---|---|---|---|
| **Operation** | A deterministic capability | Typed params, one implementation | Code — no LLM | With the codebase |
| **Skill** | A reusable *procedure* | Markdown steps, may invoke operations, may include LLM steps | The invoking agent, borrowing its identity | Semver, independently |
| **Knowledge pack** | Durable domain *facts* | Statements, no procedure | Loaded into context | Semver, independently |

**Why skill and knowledge are separate:** a skill answers *"how do I do X"*, a knowledge pack answers *"what is true here"*. They change on different cadences, compose differently, and mixing them is precisely how prompts bloat past the point where anyone can reason about them.

### Prompt composition

```
agent system prompt =
    base persona           (agents/<id>/persona.md — short, stable, identity only)
  + knowledge packs        (declared in agent.yaml — loaded IN FULL)
  + skill INDEX            (name + one-line when-to-use — NOT bodies)
  + standing constraints   (appended LAST — recency beats primacy)
```

**The index, never the bodies.** Loading every skill body reproduces the context-flooding problem one layer down. The agent sees a one-line description per available skill and loads a body only when it decides to use one. Progressive disclosure applied to capability.

### Skill layout

```
skills/<scope>/<name>/
├─ skill.yaml     # version · applies_to · requires (operations) · provides (capability) · when_to_use
├─ SKILL.md       # the procedure
└─ test/          # golden cases — REQUIRED
```

```yaml
# skills/_shared/web-harvest/skill.yaml
name: web-harvest
version: 2.1.0
when_to_use: "Fetching page content when a plain request may be blocked, rendered, or paginated"
applies_to: ["*"]
requires: [web.fetch, web.render, web.screenshot]
provides: web.harvest
owner_agents: [researcher]
```

### Versioning and pinning

Semver. `agent.yaml` pins ranges: `skills: [web-harvest@^2, vto-visual-diff@1.3]`. The registry resolves at boot, composes the prompt, and **hashes the result**. `swarmctl config:verify` recomputes and fails on drift — the same generate-and-verify treatment config gets in [[DRIFT-AND-CONSISTENCY]] §B1, now covering prompts.

A skill change affecting N codebases surfaces as **N hash changes**, which is the point: the blast radius is visible before it lands, not after.

### Resolution order

Most specific wins, like CSS specificity:

```
codebases/<slug>/skills/<name>     ← codebase-specific override
skills/<domain>/<name>             ← domain (vto, shopify)
skills/_shared/<name>              ← universal
```

An override must declare `overrides: <name>@<version>` so the registry can warn when the base has moved beneath it. Silent overrides are how forks rot.

### Discovery and invocation

Two-phase, so the runtime stays in control:

```
1. Agent receives its prompt containing the skill index.
2. Agent emits, on its own line:   SKILL: web-harvest@2.1.0
3. Runtime validates the name against the agent's declared skills.
   Undeclared → rejected, logged, agent re-prompted with the reason.
4. Runtime loads SKILL.md, appends it, re-invokes.
5. Invocation written to operations_log with the resolved version.
```

Skill use is therefore **auditable and attributable**: which agent used which version of which procedure, and whether it worked.

### Skills are tested

Every skill ships golden cases in `test/` — a recorded input and the expected shape of its output. A skill change runs its own goldens plus the goldens of every agent that pins it. This is the answer to a shared abstraction's central danger: one edit, N silent breakages.

---

## Rationale

**Repo artifacts, not runtime features.** The operator's skills live inside Hermes. Ours are files: diffable, reviewable in a PR, testable in isolation, rollable-back by version, and hash-verified against drift. This is a deliberate divergence and we think an improvement.

**The index/body split is the load-bearing detail.** Without it, "reusable skills" becomes "every agent carries every procedure," which is worse than the monolithic prompt it replaced because it is larger and looks organised.

**Knowledge packs prevent a subtler failure.** Domain facts embedded in a procedure get copied when the procedure is copied, then diverge. Extracted, they have one home and one version.

---

## Consequences

**Gained.** One home per procedure. A wrong instruction is fixed once, not five times. Prompt composition becomes generated-and-verified rather than hand-maintained. Skills carry tests, so shared-abstraction risk is bounded.

**Cost.** A registry loader, a composer, a two-phase invocation path, and a golden-test runner. Roughly one build step ([[TECHNICAL-ARCHITECTURE]] §9 step 5) grows in scope.

**New failure mode introduced.** A skill can now be wrong in five places at once. Mitigated by golden tests and by hash-visible blast radius, but it is a real trade: shared abstractions convert many small failures into fewer large ones.

**Immediate migration.** Scout → `skills/_shared/web-harvest` (owner: Researcher). Scaffolder → `skills/shopify/project-scaffold` (owner: Coder). VideoTester's analysis → `skills/vto/visual-diff`. Stuck diagnosis and constructive critique become shared skills rather than prompt text, so their wording is versioned.

---

## Alternatives considered

**Keep monolithic prompts, accept duplication.** Rejected — fifteen prompts with no validation is the highest-drift surface in the system, and prompt drift is silent.

**Prompt fragments with static includes.** Rejected — includes give sharing without versioning, pinning, testing, or resolution order. It solves the copy-paste and none of the drift.

**Skills in the agent runtime, as the operator does.** Rejected — not testable in isolation, not rollable-back, not visible in review.

**Vector-retrieved knowledge instead of declared packs.** Rejected for now: non-deterministic context assembly makes a wrong decision unreproducible. Revisit only if declared packs exceed the context budget.

---

## Related

[[ADR-001-agent-boundaries]] · [[ADR-003-multi-codebase]] · [[DRIFT-AND-CONSISTENCY]] · [[TECHNICAL-ARCHITECTURE]]
