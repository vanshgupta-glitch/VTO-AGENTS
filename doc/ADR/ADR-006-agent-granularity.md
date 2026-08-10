---
okf: 1
id: adr-006
type: adr
status: accepted
date: 2026-08-08
tags: [adr, granularity, proliferation, governance]
---

# ADR-006 — Agent granularity: the promotion test and over-add signals

**Status:** Accepted · **Date:** 2026-08-08
**Generalises:** [[ADR-001-agent-boundaries]]

---

## Context

[[ADR-001]] cut nine orchestrators to five by applying a test. That test was applied once, by hand, to a roster that already existed. Without writing it down, the next capability arrives and someone reasons "this feels like a distinct concern" — and the roster grows back.

Capability-based routing makes adding an agent *cheap*, which is precisely the condition under which rosters inflate. The mechanism that makes extension easy is the mechanism that makes discipline necessary.

This question was asked directly in the source interview — *"how narrow should one agent's role be? What's your tell that you made too many agents?"* — and answered only obliquely. This ADR answers it.

---

## Decision

### The promotion test

A role becomes an **agent** only when all three hold:

1. **Failure-path judgment.** On its *failure* path it must interpret an open-ended situation. Test the failure path, never the happy path — almost every role looks deterministic when things go well.
2. **Materially different options.** The choices lead to genuinely different next actions, and cannot be reduced to a decision table without losing something.
3. **Exclusive context.** It holds context no adjacent role has.

**If judgment exists but a neighbour is better positioned, the judgment moves and the agent is not created.** This third clause resolves more cases than the first two combined.

### The authority scale

| Level | Authority | Verdict |
|---|---|---|
| A0 | Same input → same output | Operation |
| A1 | Chooses *how* from an enumerable set | Tool or Skill |
| A2 | Assigns meaning to ambiguous output | Agent **only if** no neighbour is better placed |
| A3 | Produces options that did not exist | Agent |
| A4 | Changes what the system does next | Agent |

### The topology test

Independent of authority, and it should agree — two methods reaching the same answer from different evidence is the strongest signal available.

| Shape | Implication |
|---|---|
| Invoked by one caller, invokes nothing | A **capability of that caller** |
| Invoked by many, invokes nothing | A **service** |
| Invokes others, and its output routes conditionally | Possibly an **agent** |
| Output never routes conditionally | Not an agent — nothing depends on its judgment |

**When the two tests disagree, the authority test wins** and the disagreement is recorded — it usually means the invocation graph is wrong, not the classification.

### Over-add signals

Review the roster when any appear:

| Signal | What it means |
|---|---|
| An agent's output is never routed conditionally | It has no authority; nothing depends on its judgment |
| Two prompts differ only in tone, model, or risk appetite | That is model routing, not an agent boundary |
| An agent has never returned anything but success | Its failure path is untested or nonexistent |
| An agent is invoked by exactly one caller and invokes nothing | A capability wearing a costume |
| A new agent is proposed to "keep concerns separate" | Separation of concerns justifies a module, not an identity |
| Roster grows without escalation depth falling | Added surface, no added judgment |

### Demotion is normal

Demotion is a routine outcome, not an admission of error. An agent whose authority migrates elsewhere becomes a skill or service **and keeps its Slack persona** — presentation and agency are separable ([[ADR-001]]). Users see no change; the system carries one less prompt.

### Ceiling

**Soft ceiling: seven agents.** Not a hard limit — a trigger. The eighth proposal requires re-running the promotion test on the whole roster, not just the newcomer, because the argument for the eighth is usually an argument that two existing agents should have been one.

---

## Rationale

**The failure-path clause is what makes the test usable.** Judging on the happy path classifies nearly everything as deterministic and deletes real judgment — TestRunner's triage, Scout's blocked-page handling. Judging on the failure path finds the judgment, and then the exclusive-context clause decides where it should live.

**The exclusive-context clause is what prevents proliferation.** Most proposed agents fail here, not on judgment. Test triage *is* judgment; it belongs to whoever holds the diff. Visual-difference reading *is* judgment; the recommendation belongs to whoever holds the plan.

**Two independent tests are worth the redundancy.** Authority is a judgment call about a role; topology is an observation about a graph. When they agree, confidence is high. When they disagree, something is genuinely wrong somewhere.

---

## Consequences

**Gained.** Roster growth becomes a decision with a written test rather than an intuition. The next capability is classified in minutes, defensibly.

**Cost.** Some real judgment ends up living inside skills and services rather than in a named agent, which makes it slightly harder to find. Mitigated by skills being versioned, tested artifacts rather than buried prompt text ([[ADR-002]]).

**Governance.** Every roster change records which test it passed, in [[decision]]. A proposal that cannot name the clause it satisfies is rejected by default.

---

## Alternatives considered

**One agent per pipeline stage.** Rejected — that is what produced twelve. A stage is a step in a sequence; an agent is a thing that decides. [[ADR-004]] separates them properly.

**One agent per domain (VTO, Shopify, research).** Rejected — domain is a *knowledge* axis, and knowledge packs ([[ADR-002]]) handle it without multiplying identities. Otherwise every new codebase multiplies the roster.

**No rule; decide case by case.** Rejected — case-by-case with a cheap extension mechanism is how rosters reach twelve without anyone deciding to.

---

## Related

[[ADR-001-agent-boundaries]] · [[ADR-002-skills-architecture]] · [[ADR-004-workflow-engine]] · [[decision]]
