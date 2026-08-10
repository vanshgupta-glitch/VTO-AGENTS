---
okf: 1
id: adr-005
type: adr
status: accepted
date: 2026-08-08
tags: [adr, critic, review, gate]
---

# ADR-005 — Critique applies to work orders, not only to coding tasks

**Status:** Accepted · **Date:** 2026-08-08

---

## Context

The pre-code gate was scoped by agent flag: `requires_precode_critique: true` on Coder. Coding tasks are reviewed; nothing else is.

That leaves the **work order reviewed by nothing** — and the work order is the highest-leverage artifact in the system. A wrong coding plan wastes one task. A wrong work order wastes an entire loop: decomposition, critique, implementation, testing, video, scoring, all in service of the wrong objective.

The asymmetry had no justification. It came from thinking of critique as *"review the code plan"* rather than *"review the reasoning before anyone acts on it."*

---

## Decision

**Critique is scoped by leverage, not by discipline.** Three tiers:

| Artifact | Critique | Blocking | Rationale |
|---|---|---|---|
| **Work order** | Full | **Yes** | Highest leverage. A wrong objective wastes an entire loop. |
| **Coding task plan** | Full | **Yes** | Unchanged from PRD v3.0. |
| **Research task plan** | Light | No | Cheap to redo; findings are reviewed on the way out instead. |
| **Scaffold / mechanical task** | None | No | Below the threshold where critique pays. |

### Work-order critique asks different questions

Not the coding checklist. Four questions about the objective itself:

1. **Is this the highest-value gap?** Or a visible one standing in front of a larger one.
2. **Are the acceptance criteria actually checkable?** An uncheckable criterion produces a task that can never be honestly closed.
3. **Does the evidence support the intent?** Or is the strategist reasoning from a stale progressive document.
4. **What would make this the wrong thing to build?** Stated as a condition, not an opinion — something a later loop can test.

Verdicts as before: `APPROVED` · `APPROVED WITH NOTES` · `REVISE`. A `REVISE` returns to **Claude**, never onward to Admin.

### The rule that keeps critique constructive holds everywhere

Every risk raised must be paired with a viable alternative. Enforced structurally — `critiques.risks` cannot store an entry without one. A critic that can only object is an obstacle, and an obstacle at the work-order level halts the whole system rather than one task.

### Guarding the guard

Two thresholds, from [[PRD]] §10.2, now applied per artifact type:

- **Revise rate below 15%** → rubber-stamping. The critique is theatre; rewrite the prompt.
- **Revise rate above 60%** → the upstream artifact is the problem, not the critique. At work-order level that means the strategist is planning from a stale or thin document; fix ENRICH, not the Critic.

---

## Rationale

**Leverage, not discipline, is the right axis.** Scoping by "is this code" was an accident of how the gate was first described. Scoping by "how much does being wrong here cost" produces a different and better answer.

**The cost asymmetry is stark.** A work-order critique is one cheap-model call against a short document. Catching a wrong objective there versus at the accuracy stage is one call against an entire loop — including a human's review time at the gate.

**It closes a real hole in the recovery ladder.** Escalation ends at Claude re-planning, and until now nothing checked the re-plan. A second wrong plan would consume a second full loop before anyone noticed.

**Light critique for research is deliberate**, not an oversight. Research is cheap to redo and its output is reviewed on the way out. Blocking it would add latency to the stage most likely to change the plan anyway.

---

## Consequences

**Gained.** The most expensive mistake available — building the wrong thing well — now has a gate in front of it. The Critic's utilisation rises, which improves the signal in its own metrics.

**Cost.** One additional cheap call per work order, and one more place the loop can stall. Bounded by the same attempt caps as every other gate: two revisions, then escalate to the human.

**Risk introduced.** A Critic that over-revises work orders halts the system rather than one task. This is why the >60% threshold exists and why `REVISE` must carry an alternative — the Critic must always leave a path forward.

**Ordering constraint.** Work-order critique runs *after* NARRATIVE ([[ADR-004]]) and *before* DECOMPOSE. Reviewing an objective without the narrative that motivated it produces a critique of a sentence rather than of a decision.

---

## Alternatives considered

**Have Admin validate work orders during decomposition.** Rejected — Admin would be judging the objective it is about to execute, and a decomposer that can reject its own input has an incentive it should not have.

**Critique everything uniformly.** Rejected — critique on mechanical tasks costs latency and returns nothing, and a gate that never fires trains everyone to ignore it.

**Have a second strategist review the first.** Rejected — two agents with the same context and stance produce agreement, not review. The Critic's value is a *different* stance, not a second opinion.

---

## Related

[[ADR-001-agent-boundaries]] · [[ADR-004-workflow-engine]] · [[PRD]] · [[standards/fully-kitted]]
