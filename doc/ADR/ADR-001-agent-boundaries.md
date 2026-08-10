---
okf: 1
id: adr-001
type: adr
status: accepted
date: 2026-08-08
tags: [adr, agents, boundaries, roster]
---

# ADR-001 — Agent boundaries: the roster is five

**Status:** Accepted · **Date:** 2026-08-08
**Supersedes:** the twelve-agent roster in PRD v3.0 §5.2

---

## Context

PRD v3.0 specified twelve agents: one strategist, nine orchestrators, two executors. Each was to get a Slack app, a system prompt, a model, a channel, and an identity to maintain. Before writing those prompts we tested whether each role earns an agent.

Two independent tests were applied.

**Test 1 — decision authority.** A five-level scale:

| Level | Authority | Test |
|---|---|---|
| A0 | None | Same input always yields same output |
| A1 | Parametric | Chooses *how* from a fixed enumerable set — a decision table would do |
| A2 | Interpretive | Assigns meaning to ambiguous output; the same input can honestly read two ways |
| A3 | Generative | Produces options that did not exist before |
| A4 | Directive | Changes what the *system* does next — reprioritises, halts, redirects others |

**Test 2 — invocation topology.** Every leaf that invokes nothing is a demotion candidate. A leaf with one consumer is a *capability of that consumer*; a leaf with many is a *service*.

The two tests reason from completely different evidence and produced the same answer.

---

## Decision

**Five agents.** Claude, Admin, Critic, Researcher, Coder — plus two executor runtimes (OpenClaw, OpenCode) which are process hosts, not deciders.

**Promotion rule, binding on all future additions:**

> A role becomes an **agent** when, *on its failure path*, it must interpret an open-ended situation and choose between materially different next actions — **and** it holds context that no adjacent role has.
>
> If the judgment exists but a neighbour is better positioned, **the judgment moves and the agent is not created.**

| Role | Authority | Verdict |
|---|---|---|
| **Claude** | A4 + A3 | **AGENT** — sole holder of strategic context; only role that can change what the system pursues |
| **Admin** | A3 + A4 | **AGENT** — decomposition is generative; re-decomposition on failure is directive |
| **Critic** | A3 | **AGENT** — generates alternatives that did not exist |
| **Researcher** | A3 + A2 | **AGENT** — generates strategy from contradictory evidence |
| **Coder** | A3 + A2 | **AGENT** — generates implementations and stuck diagnoses |
| Scout | A1 | **TOOL + SKILL** owned by Researcher |
| Scaffolder | A0–A1 | **TOOL + SKILL** owned by Coder |
| TestRunner | A0 | **SERVICE** (two consumers); triage moves to Coder |
| VideoTester | A2 (analysis) / A4 (recommendations) | **SERVICE + SKILL**; recommendations removed to Claude |
| Accuracy | A0 | **SERVICE**; interpretation moves to Claude |

---

## Rationale, agent by agent

**Claude cannot merge downward.** It is the only role permitted to change what the system pursues, and the only one holding strategic context. A4 is definitionally singular.

**Admin cannot merge into Claude** — the argument is stronger than separation of concerns. Decomposition requires **live queue state**, which [[decision]] D-002 structurally forbids the strategist from holding. Merging would either pollute the strategist or blind the scheduler. The boundary is forced by the context policy, not chosen for tidiness.

**Critic cannot fold into Coder.** A reviewer sharing identity with the author inherits its framing. Worse, a `REVISE` verdict would return to the author with no new information — a loop, not a gate. Separation also permits a cheap model on a high-frequency stage.

**Researcher and Coder** are uncontested: both generate on the failure path.

**Scout is the informative demotion.** It chooses a fetch method from an enumerable set — A1. Both tests agree: single consumer, invokes nothing. The decisive argument is informational — *a fetcher separated from the analyst does not know why it is fetching*, which is exactly the context needed when a page blocks and you must decide between working around it and reporting back. Researcher decides; the harvest executes on the free tier, so the token economy is preserved.

**Scaffolder's apparent distinction is risk profile**, not discipline. Additive-and-safe versus modifying-and-dangerous is a **model-routing** decision. Route cheap work to a cheap model without minting an identity. (Its "Slack setup automation" responsibility was mis-scoped entirely — that is a platform bootstrap operation.)

**TestRunner as specified has A0.** Its declared output is results, reports and logs — no triage. Triage *would* be A2, but the Coder that wrote the change holds the diff, the intent and the plan; TestRunner would hold only the log. The judgment moves to the better-positioned role.

**VideoTester conflates measurement with prescription.** "Frame sits 3mm high above 20° yaw" is analysis (A2, a skill). "Therefore change the pose solver" is A4 and belongs where the plan lives. A measuring instrument that prescribes treatment does the second job with strictly less information than the strategist has.

**Accuracy is arithmetic.** The threshold check is a comparison, not authority. What a sub-threshold score *means* is A4 and belongs to Claude. The active-terms honesty requirement ([[decision]] D-016) is a rule, not a judgment.

---

## Consequences

**Gained.** Five system prompts instead of twelve. Five Slack apps instead of twelve. Five identities to keep consistent. Roughly a third of the prompt-drift surface removed before it existed.

**Lost — nothing.** The four demoted roles held no authority to lose. The two judgments buried inside them — test triage and visual-difference reading — relocate to roles with better context rather than disappearing.

**Forced consequence.** Pipeline stages were being carried by per-stage agents. With no agent at each stage, **the pipeline must become an explicit declared workflow** — see [[ADR-004-workflow-engine]].

**Presentation is preserved.** Slack readability was the real counterargument: a human reading `#swarm-accuracy` wants to see "VTO Accuracy" posting, not "bridge". This resolves cleanly — **keep the persona, drop the agent.** The bridge posts under a bot identity with no LLM, prompt, or model behind it. Presentation and agency are separable, and conflating them is how rosters inflate.

**Over-add signals.** Review the roster when any of these appear:
- an agent whose outputs are never routed conditionally
- an agent invoked by exactly one caller that invokes nothing
- two agents whose prompts differ only in tone or model
- an agent that has never returned anything other than success

---

## Alternatives considered

**Keep twelve for future flexibility.** Rejected — an agent that might one day need judgment is an agent that today costs a prompt, an app, and a drift surface. Promotion is cheap under the rule above; demotion after twelve prompts exist is not.

**Collapse to two tiers (the operator's structure).** He runs Claude Code for orchestration and Hermes for everything that turns wrenches. Rejected: his answer to a stuck coder is to escalate all the way to orchestration, which is slow and expensive. The discipline orchestrators catch it one level down and cheaper. The middle tier earns its keep specifically on the recovery path.

**Let Coder self-critique (also the operator's practice).** Rejected for the inherited-framing and nowhere-to-escalate reasons above.

---

## Related

[[decision]] · [[ADR-002-skills-architecture]] · [[ADR-004-workflow-engine]] · [[ADR-006-agent-granularity]] · [[PRD]]
