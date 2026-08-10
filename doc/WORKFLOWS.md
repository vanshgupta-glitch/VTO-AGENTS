---
okf: 1
id: workflows
type: specification
status: active
created: 2026-08-08
updated: 2026-08-08
implements: "[[ADR-004-workflow-engine]]"
tags: [workflows, pipeline, stages, transitions]
---

# WORKFLOWS — stage grammar and definitions

Implements [[ADR-004-workflow-engine]]. Rationale lives there; this document is the contract.

**The dispatcher executes a definition. It does not infer a sequence.** Where prose in [[PRD]] describes the loop and a definition here disagrees, **the definition wins.**

---

## 1. Stage grammar

```yaml
- id: STAGE_NAME                 # required · UPPER_SNAKE · unique within workflow
  executor: <executor-ref>       # required · see §2
  persona: <persona-id>          # optional · Slack identity that posts; defaults to the executor
  context: <policy>              # optional · overrides tier default. Rare — justify in a comment
  session: fresh | continue      # default fresh
  codebase: required | any       # default required
  gate: <gate-id>                # optional · blocking precondition, see §4
  produces: <artifact-type>      # optional · what a successful run must emit
  reports_to: <agent-ref>        # optional · who receives the output (routing ≠ transition)
  timeout_s: <int>               # default from RUN_TIMEOUT_SECONDS
  transitions:                   # see §3
    on_success: <target>
    on_fail: <target>
    on_stuck: <target>
    on_circling: <target>
    on_empty: <target>
    below_target: <target>
```

**Required on every stage:** `id`, `executor`, and at minimum `on_success`. A stage with no failure transition fails validation at load — an undeclared failure path is the flaw [[ADR-004]] exists to remove.

---

## 2. Executor kinds

| Ref | Runs | LLM | Identity |
|---|---|---|---|
| `agent:<id>` | An agent from the registry | Yes | Its own |
| `operation:<name>` | A typed operation from the allowlist | No | `persona:` or the workflow's |
| `skill:<scope>/<name>` | A skill, executed by the stage's owning agent | Usually | Borrows the agent's |
| `human` | Halts and waits | No | — |

A stage naming an `operation` has no prompt and no model. It may still post under a **persona** — presentation and agency are separable ([[ADR-001]]).

---

## 3. Transition targets

| Target | Meaning |
|---|---|
| `STAGE_NAME` | Jump to that stage in this workflow |
| `workflow:<name>` | Enter a sub-workflow; return here on its completion |
| `route_to: agent:<id>` | Hand the artifact to an agent as work; the stage stays open |
| `escalate` | Enter the escalation ladder at the current level + 1 |
| `halt` | Terminate the workflow cleanly and report |
| `end` | Terminal success |

`carry:` may accompany any target to pass evidence forward:

```yaml
below_target:
  target: ANALYSE
  carry: [accuracy_report, failing_frames]
```

**Carried evidence must be quoted, not summarised.** A redo that paraphrases its own failure re-derives the same plan.

---

## 4. Gates

A gate is a blocking precondition checked before a stage may claim work. Gates are enforced in the claim query, not in application code ([[TECHNICAL-ARCHITECTURE]] §2.3).

| Gate | Passes when | Applies to |
|---|---|---|
| `critique` | An `approved` or `approved_with_notes` critique exists for the artifact | PLAN, PRE_CODE |
| `dependencies` | All `depends_on` tasks are `done` | any task-scoped stage |
| `documents_fresh` | Progressive docs enriched within `DOC_STALENESS_WARN_LOOPS` | ANALYSE (warns, does not block) |
| `human` | A human reaction recorded | HUMAN_GATE |

---

## 5. `improvement-loop`

The main loop. One work order, one codebase.

```yaml
name: improvement-loop
scope: codebase
version: 1.0.0

stages:
  - id: ANALYSE
    executor: agent:claude
    context: documents-only
    session: fresh
    gate: documents_fresh
    produces: analysis
    transitions:
      on_success: NARRATIVE
      on_empty: halt

  - id: NARRATIVE
    executor: agent:claude
    produces: narrative_document
    transitions:
      on_success: ENRICH
      on_empty: halt              # "nothing worth doing" is a valid, reportable outcome

  - id: ENRICH
    executor: workflow:enrich
    transitions:
      on_success: PLAN
      on_fail: escalate

  - id: PLAN
    executor: agent:claude
    produces: work_order
    gate: critique                # ADR-005 — the work order is reviewed too
    transitions:
      on_success: DECOMPOSE
      on_fail: ANALYSE

  - id: DECOMPOSE
    executor: agent:admin
    produces: issue_documents
    transitions:
      on_success: PRE_CODE
      on_fail: escalate

  - id: PRE_CODE
    executor: agent:critic
    produces: critique
    transitions:
      on_success: CODE
      on_fail:
        target: route_to
        agent: agent:admin        # REVISE returns to the decomposer, never to the executor

  - id: CODE
    executor: agent:coder
    produces: pull_request
    transitions:
      on_success: TEST
      on_stuck: workflow:recovery-loop
      on_circling: workflow:recovery-loop

  - id: TEST
    executor: operation:test.suite
    persona: testrunner
    transitions:
      on_success: VIDEO
      on_fail:
        target: route_to
        agent: agent:coder
        as: triage                # the role holding the diff interprets the failure

  - id: VIDEO
    executor: operation:video.run
    persona: videotester
    then: skill:vto/visual-diff
    reports_to: agent:claude
    transitions:
      on_success: ACCURACY
      on_fail: route_to agent:coder

  - id: ACCURACY
    executor: operation:accuracy.score
    persona: accuracy
    reports_to: agent:claude
    transitions:
      on_success: REPORT
      below_target:
        target: ANALYSE
        carry: [accuracy_report, failing_frames]

  - id: REPORT
    executor: agent:admin
    produces: report              # capped synthesis — never a transcript
    transitions:
      on_success: HUMAN_GATE

  - id: HUMAN_GATE
    executor: human
    gate: human
    transitions:
      on_success: end
```

**Read the failure edges, not the happy path.** `TEST` failure routes sideways to Coder; `ACCURACY` below-target routes all the way back to `ANALYSE` carrying evidence. That difference is the whole routing policy in two lines: a defect goes to whoever can fix it, information goes to whoever can re-decide.

---

## 6. `recovery-loop`

The inner loop, entered from any stage that can stall. Not a stage sequence — a decision cascade.

```yaml
name: recovery-loop
scope: task
version: 1.0.0

stages:
  - id: DETECT
    executor: operation:recovery.classify
    produces: stuck_event         # self-declared or system-detected
    transitions:
      on_success: LOOKUP
      on_fail: escalate           # malformed STUCK — re-request, do not escalate the task

  - id: LOOKUP
    executor: operation:solutions.find
    transitions:
      on_success: APPLY           # exact (theme_hash, codebase) hit
      on_empty: DIAGNOSE

  - id: APPLY
    executor: operation:recovery.unstick
    transitions:
      on_success: end
      on_fail: DIAGNOSE           # stored directive failed — degrade its success_rate, diagnose fresh

  - id: DIAGNOSE
    executor: agent:<owning_orchestrator>
    context: discipline
    produces: diagnosis + unstick_directive
    transitions:
      on_success: RECORD
      on_fail: escalate

  - id: RECORD
    executor: operation:solutions.write
    transitions:
      on_success: end
```

`agent:<owning_orchestrator>` resolves at runtime from `tasks.owner_agent_id` — the discipline that dispatched the work diagnoses it. That is the architecture's central claim, expressed in one line.

**Cross-codebase matches are surfaced to `DIAGNOSE` as evidence, never applied by `APPLY`** ([[ADR-003]]).

---

## 7. `enrich`

```yaml
name: enrich
scope: codebase
version: 1.0.0

stages:
  - id: LOAD
    executor: operation:documents.read
    transitions: { on_success: INSPECT }

  - id: INSPECT
    executor: operation:repo.changes_since
    produces: change_set          # diff · merged PRs · closed issues
    transitions: { on_success: VERIFY }

  - id: VERIFY
    executor: agent:claude
    produces: verification_report  # N sampled llm.md claims re-checked against code
    transitions: { on_success: UPDATE }

  - id: UPDATE
    executor: agent:claude
    produces: [llm.md, trajectory.md]
    transitions: { on_success: INVALIDATE }

  - id: INVALIDATE
    executor: operation:solutions.invalidate
    transitions: { on_success: PUBLISH }   # D-027 — refactors stale the fixes that assumed the old structure

  - id: PUBLISH
    executor: operation:documents.commit
    persona: claude
    transitions: { on_success: end }
```

`VERIFY` before `UPDATE` is deliberate. Appending without verifying accumulates claims that were true once, and the strategist then reasons from them with full confidence — the worst available failure state ([[PROGRESSIVE-DOCS]] §6).

---

## 8. `research-loop`

```yaml
name: research-loop
scope: codebase
version: 1.0.0

stages:
  - id: RESEARCH_PLAN
    executor: agent:researcher
    produces: research_plan
    gate: critique                # light — non-blocking per ADR-005
    transitions: { on_success: HARVEST }

  - id: HARVEST
    executor: skill:_shared/web-harvest
    persona: scout
    transitions:
      on_success: SYNTHESISE
      on_fail: route_to agent:researcher   # blocked source — Researcher decides work-around vs report

  - id: SYNTHESISE
    executor: agent:researcher
    produces: finding
    transitions: { on_success: REFUTE }

  - id: REFUTE
    executor: skill:_shared/refutation
    transitions:
      on_success: PUBLISH
      on_fail: SYNTHESISE         # a refuted claim returns for correction, not deletion

  - id: PUBLISH
    executor: operation:documents.write
    transitions: { on_success: end }
```

`REFUTE` is the *other* review instrument ([[decision]] D-018) — it proves stated facts wrong against their evidence. It appears only here. It is never used on a plan.

---

## 9. Validation at load

The interpreter refuses to start on any of these:

| Check | Why |
|---|---|
| Every stage has `on_success` | Otherwise the workflow cannot progress |
| Every stage that can fail declares a failure transition | Undeclared failure paths are the flaw ADR-004 removes |
| Every transition target exists | Typos become silent dead ends |
| No unreachable stage | Dead stages accumulate and mislead readers |
| No cycle without a bounded counter | Deadlock and unbounded spend |
| Every `operation:` is in the allowlist | [[ADR-002]] |
| Every `skill:` resolves at its pinned version | [[ADR-002]] |
| Every `agent:` is enabled in the registry | Stale references |
| Every `persona:` exists | Silent identity fallback is confusing in Slack |

---

## 10. Scope

This is a **sequencer**, not a workflow engine. No parallel-join semantics, no compensation logic, no dynamic stage generation — until something concrete demands them. A pipeline DSL that grows features nobody asked for becomes the framework [[decision]] D-012 rejects.

---

## Related

[[ADR-004-workflow-engine]] · [[ADR-005-critique-symmetry]] · [[SKILLS]] · [[AGENT-SPECS]] · [[PRD]]
