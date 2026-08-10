---
okf: 1
id: adr-004
type: adr
status: accepted
date: 2026-08-08
tags: [adr, workflow, pipeline, narrative]
---

# ADR-004 — Pipelines are declared workflows, not emergent behaviour

**Status:** Accepted · **Date:** 2026-08-08
**Forced by:** [[ADR-001-agent-boundaries]]

---

## Context

The improvement loop was described as a sequence of stages, and each stage happened to have an agent standing in it. Sequencing was therefore emergent: an agent finished, posted, and the dispatcher routed to whoever was next. The pipeline existed only as the sum of routing rules.

[[ADR-001]] removed four of those agents. TEST, VIDEO and ACCURACY are now operations with no one at the wheel, so nothing carries the sequence.

A second problem surfaced independently. The operator's chain is *analyse → **narrative** → project scopes → work*. Ours went analysis straight to work orders, so the strategist emits a list rather than a story and priority ordering has nothing to appeal to.

---

## Decision

**The pipeline is a declared artifact.** `workflows/<name>.yaml` defines stages, who or what executes each, transitions, and failure routing. The dispatcher executes the definition; it does not infer the sequence.

```yaml
# workflows/improvement-loop.yaml
name: improvement-loop
scope: codebase

stages:
  - id: ANALYSE
    executor: agent:claude
    context: documents-only
    session: fresh
    produces: analysis

  - id: NARRATIVE                      # NEW — see below
    executor: agent:claude
    produces: docs/narrative/<loop>.md
    on_empty: halt                     # nothing worth doing is a valid, reportable outcome

  - id: ENRICH
    executor: agent:claude
    produces: [llm.md, trajectory.md]

  - id: PLAN
    executor: agent:claude
    produces: work_order
    gate: critique                     # ADR-005 — work orders are reviewed too

  - id: DECOMPOSE
    executor: agent:admin
    produces: issue_documents

  - id: PRE_CODE
    executor: agent:critic
    blocking: true
    on: [code.implement, code.refactor]

  - id: CODE
    executor: agent:coder
    on_stuck: recovery-loop
    on_circling: recovery-loop

  - id: TEST
    executor: operation:test.*
    on_fail: { route_to: agent:coder, as: triage }

  - id: VIDEO
    executor: operation:video.run
    then: skill:vto/visual-diff
    reports_to: agent:claude

  - id: ACCURACY
    executor: operation:accuracy.score
    reports_to: agent:claude
    below_target: { route_to: ANALYSE, carry: failure_evidence }

  - id: REPORT
    executor: agent:admin
    produces: report                   # capped synthesis, never a transcript

  - id: HUMAN_GATE
    executor: human
    terminal: true
```

### The NARRATIVE stage

A new artifact between analysis and planning: **one document per loop that says what is going on and why it matters, across everything in scope.** Not a list of gaps — a reading of them.

It exists because priority ordering needs something to appeal to. Given five gaps and no narrative, "which first" is arbitrary; given a narrative, ordering follows from the story. It is also what the operator's *"come up with a narrative"* actually produces, and it is what makes several work orders cohere rather than compete.

`on_empty: halt` matters. **"Nothing here is worth doing right now" is a valid outcome** and must be reportable — otherwise the strategist manufactures work to have something to say, which is the unbounded-gap-finding problem ([[trajectory]] OPEN-004) arriving by a different route.

### Executor kinds

`agent:<id>` · `operation:<name>` · `skill:<scope>/<name>` · `human`

A stage naming an operation has no LLM, no prompt, and no identity — but may still post under a **persona** for Slack readability ([[ADR-001]]).

### What the dispatcher keeps

Stage sequencing moves into the definition. The dispatcher retains what genuinely needs code: the atomic claim, heartbeat and watchdog, circularity detection, the escalation ladder, and idempotency. Those are mechanisms, not sequence.

---

## Rationale

**A workflow you can read is a workflow you can reason about.** Emergent sequencing means the only way to answer "what happens after VIDEO fails" is to read the dispatcher. A file answers it.

**Explicit failure routing is the real win.** In the emergent model, failure paths were implicit and mostly undrawn — the original topology had no feedback edges at all. Declaring `on_fail`, `on_stuck` and `below_target` per stage makes every loop-back visible, which is where this architecture's value lives.

**Workflows are versionable and testable.** A replay fixture runs against a workflow definition. Changing the loop becomes a reviewable diff.

---

## Consequences

**Gained.** The pipeline survives having fewer agents. Failure routing is visible. Multiple workflows become natural — improvement, research-only, enrich-only — sharing the same agents.

**Cost.** A workflow interpreter, a stage-transition test suite, and a new artifact type to keep consistent with the PRD's description of the loop. One place where PRD prose and a machine-readable file can diverge, so the file wins and the prose cites it.

**Scope discipline.** This is a *sequencer*, not a general workflow engine. No parallel-join semantics, no sub-workflows, no compensation logic until something demands them. A pipeline DSL that grows features nobody asked for becomes the framework [[decision]] D-012 rejects.

---

## Alternatives considered

**Keep sequencing in dispatcher code.** Rejected — it is the busiest, most dangerous file, and every workflow change would edit it.

**Adopt a workflow engine (Temporal, Airflow, or similar).** Rejected — durable-execution semantics for a single-operator loop with single-digit concurrency, plus a service to run and monitor. [[decision]] D-005 and D-012 reasoning applies.

**Skip NARRATIVE, order by acceptance-criteria impact.** Rejected — that ranks gaps against each other in isolation and cannot see that three of them are the same underlying problem.

---

## Related

[[ADR-001-agent-boundaries]] · [[ADR-005-critique-symmetry]] · [[PRD]] · [[TECHNICAL-ARCHITECTURE]]
