---
okf: 1
id: decision
type: decision-record
project: VTO
status: active
created: 2026-08-08
updated: 2026-08-08
tags: [decisions, strategic-memory]
---

# decision.md — strategic memory

The durable decisions of this project. Read this instead of task history, reports, or conversation logs.

**Recorded here:** accepted architectural decisions · confirmed root causes · validated discoveries · proven patterns · operating constraints · resolved failure modes · evidence-backed accuracy findings · human-approved changes.

**Not recorded here:** plans, ideas, TODOs, hypotheses, open investigations, transient failures, agent conversations, raw reports, task execution detail, speculation.

Test before adding an entry: *will this still matter after 50 future tasks?* If no, it does not belong.

`ACTIVE` = in force · `SUPERSEDED` = kept so it is not reintroduced.

Product-level decisions (D1/D2/D3 — the VTO technical plan) live in `Projects/VTO/VTO.md` and are not duplicated here.

---

D-001

STATUS: ACTIVE

DATE:
2026-08-08

TYPE:
Architecture

STATEMENT:
Work flows through three tiers — a strategist that decides what matters, discipline orchestrators that decompose and dispatch, and executors that do the work.

REASON:
Coding agents without an orchestration tier drift from intent and produce large refactors. Merging planning with scheduling means neither is done well.

EVIDENCE:
An operator running this architecture across multiple client codebases in production independently describes the same structure — orchestration as director of technology, pushing down to agents that are both product owner and coder — and attributes 40–50% turn reduction to it.

IMPACT:
Never add an agent that spans tiers. A new capability belongs to exactly one tier. Collapsing to two tiers is only justified if measured recovery rate falls below 50%.

---

D-002

STATUS: ACTIVE

DATE:
2026-08-08

TYPE:
Architecture

STATEMENT:
Context is assembled per tier: the strategist gets a fresh session with progressive documents and one bounded report; orchestrators get their own discipline; executors get everything.

REASON:
A strategist fed execution detail degrades into a log reader, and a long-running session accumulates bias toward defending its own earlier plan rather than re-evaluating it.

EVIDENCE:
Operator testimony: an orchestration agent's *"context cannot be polluted with all the problems of the code"* and *"always do a fresh session"* for orchestration. Our v2.0 design specified the opposite and was corrected before implementation.

IMPACT:
Any code path that can invoke an agent without the tier-aware assembler is a defect. Context capacity is not a mandate — a large window is not a reason to fill it.

---

D-003

STATUS: ACTIVE

DATE:
2026-08-08

TYPE:
Architecture

STATEMENT:
Each codebase carries three living documents — definitions, agent rules, and trajectory — refreshed by an explicit enrichment stage, and these are the strategist's memory.

REASON:
A fresh session is only useful if something high-quality loads into it; without durable documents, freshness is amnesia and understanding is re-derived every cycle.

EVIDENCE:
Operator names progressive documentation as one of two elements that make orchestration work, and reports that coherence compounds through it over time.

IMPACT:
Enrichment is a pipeline stage, not a chore. Document staleness is a tracked guardrail. A decision made against a stale document is a process failure, not a judgment failure.

---

D-004

STATUS: ACTIVE

DATE:
2026-08-08

TYPE:
Architecture

STATEMENT:
Hand-offs write or update a document and post a pointer; chat carries notification and audit, never payload.

REASON:
Messages do not accumulate into understanding; documents do. One authoritative version beats many paraphrases scattered across threads.

EVIDENCE:
Operator: *"your back and forth is always through documentation"* — and the recovery move is to have an agent **re-read** the document rather than be re-prompted with fresh context.

IMPACT:
When correcting an agent, update the document and tell it to re-read. Do not restate the correction in a message.

---

D-005

STATUS: ACTIVE

DATE:
2026-08-08

TYPE:
Process

STATEMENT:
Every coding task passes a blocking constructive critique before dispatch, in helpful-skeptic mode where each risk raised is paired with a viable alternative.

REASON:
Without it agents code from optimism, which is the origin of most downstream rework. Catching a wrong approach costs one cheap call; catching it after implementation costs a full cycle.

EVIDENCE:
Operator runs this before every coding task and warns explicitly that a purely adversarial stance produces results that are *"overly conservative"* and *"lack optimism on solutions."*

IMPACT:
The gate is non-bypassable and enforced in the task-claim query, not by prompt. A critique that only lists problems is malformed and must be rejected.

---

D-006

STATUS: ACTIVE

DATE:
2026-08-08

TYPE:
Architecture

STATEMENT:
Every action reaching outside the process goes through a fixed, named set of operations; agents never compose shell commands or invent invocations.

REASON:
Implementation inconsistency is the dominant production failure. A denylist forbids what was anticipated and permits everything an agent can invent; an allowlist makes the wrong call inexpressible.

EVIDENCE:
Operator identifies implementation consistency as what breaks most often — agents blow context and reach for the wrong call — and prescribes fixed endpoints with *"zero naked API calls, 100% middleware."*

IMPACT:
New capability means a new named operation with one implementation, never a flag on an existing one. Attempted out-of-set actions are logged and treated as a configuration signal, not agent misbehaviour.

---

D-007

STATUS: ACTIVE

DATE:
2026-08-08

TYPE:
Constraint

STATEMENT:
Agents communicate only through shared channels; there is no direct agent-to-agent messaging.

REASON:
Complete auditability and the ability for a human to interrupt anywhere are worth the latency and rate-limit cost.

EVIDENCE:
Design requirement confirmed by the project owner; consistent with the operator's practice of routing all state through inspectable artifacts.

IMPACT:
Any proposal for a faster private path between agents is rejected by default. Volume problems are solved by moving payload into documents, not by adding channels.

---

D-008

STATUS: ACTIVE

DATE:
2026-08-08

TYPE:
Constraint

STATEMENT:
Git is never automated, and one named human owns the commit, the live state, and production error states.

REASON:
Automation does not dilute accountability. An unowned failure is how error states accumulate silently.

EVIDENCE:
Operator: *"There's no such thing as the agent did it. There's only a human that pushed code"* — one person pushing, one person responsible for live state, one for production errors.

IMPACT:
Permanent, not a v1 limitation. Blocked in code, not in prompts. No roadmap item may assume this relaxes.

---

D-009

STATUS: ACTIVE

DATE:
2026-08-08

TYPE:
Architecture

STATEMENT:
Policies that matter are enforced structurally — schema constraints, type unions, module boundaries, generated configuration — never by prompt instruction alone.

REASON:
A prompt competes with everything else in the context window and loses as the window fills. A structure does not compete.

EVIDENCE:
Operator's recurring failure is agents blowing context and doing the wrong thing despite instruction; his own proposed fix is structural, not prompt-based.

IMPACT:
When an agent misbehaves, the reflex to edit its prompt is usually wrong. Ask first whether the failure could have been made impossible. Prompt edits are correct only for genuine ambiguity.

---

D-010

STATUS: ACTIVE

DATE:
2026-08-08

TYPE:
Recovery

STATEMENT:
Circling is detected by the system from external signals and never relies on an executor reporting itself stuck.

REASON:
The dangerous failure is not an executor that knows it is stuck — it is one fixing the same thing repeatedly while believing it succeeded. That executor never asks for help.

EVIDENCE:
Operator's rule of thumb: when a problem resurfaces after one to three turns, stop and step up to orchestration. The trigger is observed recurrence, not a self-report.

IMPACT:
Recovery triggers are computed from run history. An executor's claim of progress is evidence, never proof.

---

D-011

STATUS: ACTIVE

DATE:
2026-08-08

TYPE:
Architecture

STATEMENT:
The orchestration system is built fresh in its own repository; the VTO product codebase is continued and never rebuilt.

REASON:
The product is substantial working software and is the thing the swarm exists to improve. Mixing the two also means swarm churn pollutes the product history the swarm reads.

EVIDENCE:
Product repo measured at 187 TypeScript files, ~19,900 lines, 26 test files, with a mature toolchain. Pre-existing agent files in that repo were unmodified vendor defaults, and its eight agent definitions are documentation stewards that explicitly never write application code — nothing to continue from.

IMPACT:
Product improvements are tasks for the swarm. Swarm infrastructure never lands in the product repo.

---

D-012

STATUS: ACTIVE

DATE:
2026-08-08

TYPE:
Architecture

STATEMENT:
No third-party agent-orchestration framework is used.

REASON:
Those frameworks own the control loop, and this project's control loop — tier-differentiated context, document-mediated hand-off, blocking pre-code critique, discipline-specific recovery — is the product.

EVIDENCE:
Every distinguishing mechanism in the design would require overriding framework defaults; the escape effort exceeds the implementation effort.

IMPACT:
Reject framework adoption proposals unless the control loop itself has become generic, which would be a much larger change.

---

D-013

STATUS: ACTIVE

DATE:
2026-08-08

TYPE:
Architecture

STATEMENT:
State lives in a single-file embedded database with a synchronous driver, migrating to a server database only on named triggers.

REASON:
A synchronous driver removes a class of races from the task-claim path, and a file needs no service to run, monitor, or secure at single-operator scale.

EVIDENCE:
Concurrency requirement is single-digit; the claim path is the only contended write and is served by an immediate-mode transaction.

IMPACT:
Migrate when any one holds: a second machine runs executors, a second human needs concurrent writes, a remote dashboard needs live state, or lock contention exceeds the retry budget. Until then, adding a broker or cache is unjustified.

---

D-014

STATUS: ACTIVE

DATE:
2026-08-08

TYPE:
Constraint

STATEMENT:
Executor CLI versions are pinned, verified at startup, and upgraded only through a behaviour-diff gate.

REASON:
An upgrade to a working agent CLI changes behaviour rather than just capability, and the resulting debt is discovered late.

EVIDENCE:
Operator names upgrading OpenClaw as one of two clear wasted-effort items, because *"the implementation will work differently."*

IMPACT:
Version drift warns loudly at startup. An upgrade requires a full golden-invocation and replay pass before merge, with the outcome recorded.

---

D-015

STATUS: ACTIVE

DATE:
2026-08-08

TYPE:
Constraint

STATEMENT:
Two environment facts are invariant until proven otherwise: the free-tier gateway serves only free models on this account, and the `claude` name on PATH may resolve to a different binary.

REASON:
Both have already caused wasted effort, and both fail silently — the second produces plausible output from the wrong model.

EVIDENCE:
A paid-model call through the free gateway returns a payment error; the PATH entry was observed resolving to a different agent's shim.

IMPACT:
The multi-CLI design is required, not incidental — proposals to route everything through one gateway are rejected. Always invoke by absolute path.

---

D-016

STATUS: ACTIVE

DATE:
2026-08-08

TYPE:
Accuracy

STATEMENT:
The 0.98 target is a calibrated proxy for perceptual indistinguishability, not a guarantee, and two of its four terms are currently inactive.

REASON:
The composite must be validated against human judgment, and reporting a score without saying which terms contributed overstates what was measured.

EVIDENCE:
Perceptual and fit terms require competitor reference frames that have not been captured; without them the score runs on verdict correctness and temporal stability only.

IMPACT:
Every published score names its active terms. Periodic human spot-checks calibrate the threshold. If spot-checks show a lower score is already indistinguishable, lower the threshold rather than spending to reach 0.98.

---

D-017

STATUS: ACTIVE

DATE:
2026-08-08

TYPE:
Constraint

STATEMENT:
Two divergent copies of the product repository exist, and the historical task log describes work that is not present in the accessible copy.

REASON:
Pointing an autonomous system at the wrong copy causes it either to redo completed work or to build against a state that does not exist.

EVIDENCE:
Three commits named as complete in the task log are absent from the accessible copy, as are the artifacts they claim to have produced; that copy's head is an earlier, explicitly parked feature branch.

IMPACT:
Canonical-repository identity must be established before any agent is pointed at code. Until then, treat the task log's completion claims as unverified.

---

D-018

STATUS: ACTIVE

DATE:
2026-08-08

TYPE:
Process

STATEMENT:
Refutation-mode review — where the reviewer's only job is to find flaws — is scoped to verifying research claims after the fact and is never used as a pre-code design review.

REASON:
The two reviews answer different questions. Proving a stated fact wrong against its evidence is valuable; applying the same stance to a plan produces paralysis and conservatism.

EVIDENCE:
Operator warns that purely adversarial review is counterproductive on plans. Earlier project research prescribed refutation without scoping it, and that document has been annotated rather than withdrawn.

IMPACT:
Two distinct instruments with distinct prompts. Never merge them into one reviewer.

---

D-021

STATUS: ACTIVE

DATE:
2026-08-08

TYPE:
Architecture

STATEMENT:
The roster is five agents — Claude, Admin, Critic, Researcher, Coder — plus two executor runtimes; a role becomes an agent only if, on its failure path, it interprets an open-ended situation, chooses between materially different actions, and holds context no adjacent role has.

REASON:
Nine of twelve proposed agents were pipeline stages rather than deciders. An LLM producing deterministic output is pure cost and pure variance, and each agent is a prompt, an identity, and a drift surface.

EVIDENCE:
Two independent tests — a five-level authority scale and an invocation-topology test — reached the same classification from different evidence. Four roles scored A0–A1; the two judgments buried inside them relocated to roles with better context.

IMPACT:
See [[ADR-001-agent-boundaries]] and [[ADR-006-agent-granularity]]. Every roster change must name the promotion clause it satisfies. Soft ceiling of seven; the eighth proposal re-tests the whole roster. Demotion keeps the Slack persona — presentation and agency are separable.

---

D-022

STATUS: ACTIVE

DATE:
2026-08-08

TYPE:
Architecture

STATEMENT:
Reuse is modelled as three distinct units — operations (deterministic code), skills (versioned procedures loaded on demand), knowledge packs (durable facts) — and agent prompts are composed from them, generated and hash-verified.

REASON:
One monolithic prompt per agent has no sharing and no versioning. Five agents across three codebases is fifteen divergent prompts on the only surface with no schema to validate it.

EVIDENCE:
The operator names skills as the sole mechanism by which codebase-specific knowledge persists in agents, but keeps them in the runtime where they cannot be diffed, tested, or rolled back.

IMPACT:
See [[ADR-002-skills-architecture]]. Agents receive a skill *index*, never skill bodies. Skills carry golden tests. A skill change surfaces as N hash changes so blast radius is visible before it lands.

---

D-023

STATUS: ACTIVE

DATE:
2026-08-08

TYPE:
Architecture

STATEMENT:
Codebase is a first-class scope present from the first line of code; one codebase is the degenerate case of many.

REASON:
The seam runs through configuration, context assembly and eight tables. Retrofitting hits all three at once, with live data already in the wrong shape.

EVIDENCE:
Schema columns were already plural while configuration and the context assembler were singular — a half-built seam that would have failed on the second codebase.

IMPACT:
See [[ADR-003-multi-codebase]]. Scope columns are non-null. Only the strategist may read across codebases. A cross-codebase solution match is offered as evidence, never applied — a fix that worked in one repository can be actively wrong in another.

---

D-024

STATUS: ACTIVE

DATE:
2026-08-08

TYPE:
Architecture

STATEMENT:
The pipeline is a declared workflow artifact, and it includes a NARRATIVE stage between analysis and planning.

REASON:
Sequencing was emergent from per-stage agents; removing four of them left nothing carrying the sequence. Separately, priority ordering across several gaps has nothing to appeal to without a narrative.

EVIDENCE:
The original topology had no feedback edges at all — failure routing existed only implicitly in dispatcher code.

IMPACT:
See [[ADR-004-workflow-engine]]. Failure routing is declared per stage. "Nothing here is worth doing" is a valid, reportable outcome — otherwise the strategist manufactures work.

---

D-025

STATUS: ACTIVE

DATE:
2026-08-08

TYPE:
Process

STATEMENT:
Critique is scoped by leverage rather than discipline; work orders are reviewed and blocked, not only coding tasks.

REASON:
A wrong coding plan wastes one task. A wrong work order wastes an entire loop — decomposition, critique, implementation, testing, scoring — in service of the wrong objective.

EVIDENCE:
The gate was scoped by an agent flag on Coder, leaving the highest-leverage artifact in the system reviewed by nothing, including after a Claude re-plan on escalation.

IMPACT:
See [[ADR-005-critique-symmetry]]. Work-order critique asks four different questions from the coding checklist. Revise rate below 15% means rubber-stamping; above 60% the upstream artifact is the problem, not the critique.

---

D-026

STATUS: ACTIVE

DATE:
2026-08-08

TYPE:
Constraint

STATEMENT:
Executors receive their codebase's definitions and agent rules, not only task thread history.

REASON:
The role most needing the codebase model was the only one not given it.

EVIDENCE:
Tier 3 context was specified as full thread history. The operator's agent-rules document exists specifically to send coding agents to the definitions continuously.

IMPACT:
Tier 3 assembly loads that codebase's agent rules and definitions alongside the thread. Corrects an omission in the v3.0 context policy.

---

D-027

STATUS: ACTIVE

DATE:
2026-08-08

TYPE:
Recovery

STATEMENT:
Stored solutions are invalidated when enrichment detects structural change to the code they reference.

REASON:
A directive keyed on a problem theme stays valid forever, but a refactor can make it actively wrong; the reuse success rate only degrades after it has already failed several times.

EVIDENCE:
Solutions are keyed on theme and codebase with no dependency on code structure, so nothing connects a refactor to the advice that assumed the old structure.

IMPACT:
Enrichment records which modules changed; solutions referencing them are flagged stale and re-diagnosed on next hit rather than served. Prevents the store from confidently teaching an obsolete fix.

---

D-028

STATUS: ACTIVE

DATE:
2026-08-08

TYPE:
Constraint

STATEMENT:
Agent-driven staged and canary deployment to production was considered and deferred; only deployment to a development store is in scope.

REASON:
Recorded so a future session does not re-derive the question. The operator runs CI/CD, canary and production push through agents successfully, so this is a scope choice rather than a judgment that it cannot work.

EVIDENCE:
Production deployment sits downstream of the human commit gate, and that gate is permanent per D-008. Automating past it would require relaxing the accountability rule.

IMPACT:
Revisit only after the loop has demonstrably run unattended. Any proposal must state how it preserves single-human ownership of the live state.

---

D-019

STATUS: SUPERSEDED

DATE:
2026-08-08

TYPE:
Architecture

STATEMENT:
Uniform context assembly — every agent receives the full cross-channel history of its task.

REASON:
Recorded retroactively so it is not reintroduced as a simplification. It was specified as a feature on the reasoning that full context prevents blind starts.

EVIDENCE:
Superseded by D-002 before implementation. Correct for executors, harmful for the strategist.

IMPACT:
Do not unify the context assemblers. The apparent duplication between them is the point.

---

D-020

STATUS: SUPERSEDED

DATE:
2026-08-08

TYPE:
Process

STATEMENT:
Per-role model optimisation — selecting a cheapest-sufficient model for each role and tuning it against measured capability.

REASON:
Recorded retroactively so the effort is not restarted. Substantial planning work was invested in it.

EVIDENCE:
Named by the operator as effort that stopped paying off once capable, token-efficient models became the default. Two project documents on the subject were left with empty decision tables and unverified capability estimates.

IMPACT:
Keep the coarse split — free tier for mechanical work, paid for judgment — because that is a real cost constraint. Pick one capable model per tier, pin it, and revisit only when a metric demands it.

---
