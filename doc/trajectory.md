---
okf: 1
id: trajectory
type: progressive-document
project: VTO
status: active
created: 2026-08-08
updated: 2026-08-08
last_enriched: 2026-08-08
loop: 0
tags: [trajectory, progressive-document, strategic-memory]
---

# VTO Agents — trajectory

**Last enriched:** 2026-08-08 (loop 0, seeding) · **Verified against:** `d68f868`

Strategic history and direction for the swarm project itself. Read with [[decision]] (what was decided) and [[llm]] (what the code is). Per [[PROGRESSIVE-DOCS]] §2, nothing here is restated from either.

---

## Goal

Build an autonomous multi-agent engineering system that improves a Shopify eyewear virtual try-on product with minimal human involvement. The product is client-side — MediaPipe FaceLandmarker, three.js, GLB assets, TypeScript monorepo — and competes with FittingBox.

**Done looks like:** a goal posted in Slack becomes a reviewed, tested change at the human commit gate with **two human touches** — one to start, one to commit. The improvement loop terminates on a measured composite accuracy of **≥0.98** against FittingBox, not on anyone's opinion.

---

## Where we are

**Status: specification complete, nothing implemented.**

Build-sequence step numbers below refer to [[TECHNICAL-ARCHITECTURE]] §9. One numbering, everywhere.

| | |
|---|---|
| **Done** | PRD v3.0 · Technical Architecture v3.0 · decision record (20 entries) · drift-and-consistency plan · progressive-document spec |
| **Not started** | Steps 1–13. Core protocol, schema, documents package, context assemblers, registry, operations allowlist, runtimes, Slack, orchestration, bridge, agents, verification, research arm |
| **Blocked** | Canonical repository identity (D-017) · Slack app provisioning · FittingBox reference frames |

**Steps 1–9 need no Slack tokens.** The state machine, context discipline, critique gate and recovery engine are all buildable and testable offline against recorded fixtures. Only step 10 onward waits on provisioning.

---

## How we got here

Newest first.

**2026-08-08 — Architecture review: roster cut from twelve agents to five.**
Applied two independent tests — a five-level decision-authority scale and an invocation-topology test — to every proposed role. They agreed. Scout, Scaffolder, TestRunner, VideoTester and Accuracy held A0–A1 authority and became skills, tools and services; their Slack personas survive without agents behind them. Six ADRs written: agent boundaries, skills architecture, multi-codebase scoping, declared workflows, critique symmetry, granularity governance. Four hidden flaws closed along the way — the work order was reviewed by nothing, executors never received the definitions, solutions never invalidated on refactor, and the pipeline had no feedback edges at all. **Learned: pipeline stages were being mistaken for agents. A stage is a step in a sequence; an agent is a thing that decides.** Cost: one session. PRD and TECHNICAL-ARCHITECTURE now lag the ADRs — see OPEN-007.

**2026-08-08 — Progressive documents seeded.**
Wrote the specification for `llm.md` / `CLAUDE.md` / `trajectory.md`, including the division-of-content rule and the ENRICH verification pass. Seeded this document from a draft that mixed status with restated decisions and architecture; both were removed in favour of links, and a history section was added — the operator's `trajectory.md` is defined by history, and the draft had none. Cost: one session. Learned: the drift risk in this document set is duplication, not omission.

**2026-08-08 — Repository reduced to the specification.**
Stripped 161 files from the vault — souls, eleven research-agent briefs, loop protocol drafts, 29 task notes, product research findings, dashboard write-space. Kept `doc/`, the validated product decisions, and the five F011 findings that are research *about* the swarm. Everything recoverable from history at `08623fd`.

**2026-08-08 — Repository lineage discrepancy confirmed.**
Analysed the product repo to decide rebuild vs continue. Verdict: the product continues — 187 TypeScript files, ~19,900 lines, 26 test files, mature toolchain — and the swarm is built fresh in its own repository (D-011). While verifying, found that three commits named complete in the historical task log are absent from the accessible copy, along with every artifact they claim to have produced. Recorded as D-017. **This is the oldest unresolved problem and it blocks pointing any agent at code.**

**2026-08-08 — v3.0 rewritten from scratch.**
An operator running this architecture across client codebases in production contradicted the v2.0 context strategy directly. Twelve gaps identified; both specs rewritten rather than patched, because the context strategy was wrong at the root rather than incomplete. Four disciplines added as first-class: progressive documents, tier-differentiated context, blocking constructive critique, documents-as-medium. Cost: one session. **Learned: having an orchestration tier and practising orchestration discipline are different things, and only the second one pays.**

**2026-08-08 — v2.0 designed.**
First full specification. Correct tier structure; wrong context strategy — it fed every tier the same cross-channel history and described that as a feature. Superseded before any code was written, which is the cheapest possible time to be wrong. Recorded as D-019 so it is not reintroduced as a simplification.

**Before 2026-08-08 — prior swarm iterations.**
A vault-and-kanban loop, then a cron-driven engineering loop, then a flat-bot Slack design. Each got the transport or the roster right and the discipline wrong. Their research output survives in the F011 findings; their designs are superseded.

---

## Current priorities

1. **Resolve canonical repository identity.** Everything downstream depends on knowing which copy is real. Pointing an agent at the wrong one means either redoing finished work or building against a state that does not exist. Cheapest possible task, highest possible blast radius. (D-017)
2. **Build the offline core, steps 1–9.** No provisioning dependency, and it retires the two riskiest assumptions: that per-discipline recovery actually rescues executors, and that context discipline measurably improves decisions.
3. **Write the remaining P0 specifications.** `PROTOCOL.md`, `OPERATIONS.md`, `AGENT-SPECS.md`. Steps 1, 6 and 11 cannot start without them.
4. **Provision Slack.** ~40 minutes of manual OAuth, 12 apps. Blocks step 10 and nothing earlier.
5. **Capture FittingBox reference frames.** One-time manual work. Until it exists, 60% of the accuracy score is inactive (D-016).

Priority 3 outranks 4 because specification is the constraint on building, not provisioning. Priority 5 sits last because the loop can run and improve without it — it just cannot *stop* correctly.

---

## Open issues

| ID | Title | Owner | Blocking |
|---|---|---|---|
| OPEN-001 | Canonical repository identity unresolved | Human | Yes — all code work |
| OPEN-002 | Slack workspace and 12 apps not provisioned | Human | Step 10 onward |
| OPEN-003 | FittingBox reference frames not captured | Human | Accuracy terms, Phase 2 exit |
| OPEN-004 | No stopping rule for strategist gap-finding | Strategist | No — but unbounded work generation without it |
| OPEN-005 | `PROTOCOL.md`, `OPERATIONS.md`, `AGENT-SPECS.md` unwritten — now five agents, not twelve | Engineering | Steps 1, 6, 11 |
| OPEN-007 | PRD and TECHNICAL-ARCHITECTURE lag ADR-001..006; where they conflict the ADR wins | Engineering | No — but the divergence is exactly the failure DRIFT-AND-CONSISTENCY warns about, so it should not sit long |

Index only. Issue documents live in `docs/issues/` once the swarm repo exists.

---

## Risks

| Risk | Impact | Status |
|---|---|---|
| Per-discipline recovery diagnoses no better than a plain retry | Critical — invalidates the third tier | Open, measured at Phase 1 exit |
| Progressive documents rot; strategist decides on a stale model | High — degrades silently, no signal | Open, mitigated by staleness guard |
| The 0.98 composite is a poor proxy for indistinguishability | High — loop halts on a lie | Open, mitigated by human spot-checks |
| Critic becomes a rubber stamp or an obstacle | High — loses the cheapest quality gate | Open, bounded by the 15–60% revise-rate band |
| Bridge is a single point of failure | High — system halts | Open, mitigated by watchdog |

Retired risks move into "How we got here" rather than accumulating here.

---

## Roadmap

Phase numbering is the PRD's. Where any other document disagrees, the PRD wins and that document is corrected — the six-phase split in the seeding draft was reconciled into this.

| Phase | Contents | Exit |
|---|---|---|
| **1a — offline core** | Steps 1–9. Protocol, schema, documents, context, registry, operations, runtimes, Slack offline, orchestration | Replay tests cover happy, critique-revise, stuck, circling, escalation, watchdog paths |
| **1b — live slice** | Step 10–11. Bridge live; Claude · Admin · Critic · Coder · TestRunner · OpenClaw | 3 consecutive work orders reach the gate untouched · ≥5 recovery events with ≥70% resolved at L1–L2 · ≥1 in 3 critiques change the plan |
| **2 — verification** | VideoTester · Accuracy · Python harnesses | A score published every loop; a sub-threshold score triggers redo from research with no human |
| **3 — research arm** | Scout · Researcher · Scaffolder | A work order that starts from a research gap reaches the gate, with the research visibly changing the implementation |
| **4 — hardening** | Nice-to-haves, chosen from Phase 1–3 data | — |

---

## Next analysis questions

For the next strategist session, written by this one.

1. **Is the repository question actually hard, or just unasked?** It has blocked everything for a session and the resolution may be a single conversation.
2. **What is the smallest thing that proves per-discipline recovery works?** If that can be tested before the full offline core, the riskiest assumption retires much sooner than Phase 1 exit.
3. **What stopping rule should bound gap-finding?** A codebase always has gaps. Without a relevance threshold tied to the current goal, the strategist generates work indefinitely. (OPEN-004)
4. **Does the Critic need `llm.md` to be good, or merely present?** If a thin definitions file is enough, Phase 1 starts sooner. If not, seeding the product repo's set becomes a Phase 1 blocker rather than a Phase 2 one.
5. **Which of the five active risks is now cheapest to retire?** Retiring the cheapest first frees attention; retiring the largest first is usually premature.

---

## Decisions

See [[decision]]. Not restated here — one home per fact.

Active decisions most relevant to current work: **D-002** tier-differentiated context · **D-006** operations allowlist · **D-011** swarm built fresh, product continued · **D-017** repository lineage unresolved.

---

## Related

[[decision]] · [[PROGRESSIVE-DOCS]] · [[PRD]] · [[TECHNICAL-ARCHITECTURE]] · [[DRIFT-AND-CONSISTENCY]]
