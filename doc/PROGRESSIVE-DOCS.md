---
okf: 1
id: progressive-docs
type: specification
project: VTO
status: active
created: 2026-08-08
updated: 2026-08-08
owner: Engineering
related: ["[[decision]]", "[[PRD]]", "[[TECHNICAL-ARCHITECTURE]]"]
tags: [progressive-documents, context, enrich, templates]
---

# Progressive documents — specification and templates

Governs `llm.md`, `CLAUDE.md`, and `trajectory.md`: what each contains, who writes it, when, and how they are kept true.

**Why they exist.** The strategist runs a fresh session on every invocation ([[decision]] D-002). Freshness only helps if something high-quality loads into it — otherwise it is amnesia. These three documents are that something. They are the strategist's entire memory, and their quality is the ceiling on the quality of every strategic decision the system makes.

---

## 1. The three documents

| | `llm.md` | `CLAUDE.md` | `trajectory.md` |
|---|---|---|---|
| **Answers** | What is this codebase? | How do agents behave here? | Where have we been, where are we going? |
| **Written by** | Strategist (ENRICH) | Human, amended by strategist | Strategist (ENRICH) |
| **Read by** | All tiers | Tiers 2 and 3 | Tier 1 primarily |
| **Changes** | When the code changes | Rarely | Every loop |
| **Length ceiling** | 400 lines | 150 lines | 300 lines |
| **Rots when** | A refactor lands and nobody enriches | An agent's mistake is corrected in chat instead of here | A loop closes without a history entry |

**Length ceilings are budgets, not targets.** `trajectory.md` is loaded on every strategist invocation, so every line costs money on every loop, forever. Over ceiling, the next ENRICH must compress before it appends. A document that grows without bound eventually gets skimmed instead of read, which is the same as not existing.

---

## 2. The division-of-content rule

This is the part that decides whether the set stays coherent. Content has exactly one home.

| Content | Home | Never in |
|---|---|---|
| What a module is, what it does, how data flows | `llm.md` | `trajectory.md` |
| Vocabulary, invariants, entry points | `llm.md` | anywhere else |
| Rules agents must follow in this repo | `CLAUDE.md` | `llm.md` |
| Pointers to the other two documents | `CLAUDE.md` | — |
| What happened last loop and why | `trajectory.md` | `llm.md` |
| Current status, priorities, open issues | `trajectory.md` | `decision.md` |
| Durable decisions with evidence | `decision.md` | `trajectory.md`, `llm.md` |
| Architecture rationale and specification | the specs (`PRD`, `TECHNICAL-ARCHITECTURE`) | all three |
| Task detail, agent conversations, raw logs | nowhere — Slack and the database hold these | all three |

**The rule in one line:** if it is already written somewhere, link to it. Never restate.

Restating is how two copies drift, and drift between documents is invisible because each file reads correctly on its own. Where a progressive document needs to reference a decision, it names the ID (`D-008`) and moves on.

---

## 3. `llm.md` — definitions

What a competent engineer would need in order to reason about the codebase without reading it. Facts, not opinions; structure, not history.

```markdown
# <codebase> — definitions

Last enriched: YYYY-MM-DD (loop N) · Verified against commit <sha>

## What this is
Two or three sentences. What it does, who uses it, what it runs on.

## Entry points
| Entry | File | Triggered by |
|---|---|---|

## Modules
One block per module. Purpose, public surface, what it depends on,
what depends on it. Skip internals — those live in the code.

### <module>
Purpose:
Public surface:
Depends on:
Depended on by:

## Data flow
The two or three paths that matter, described in sequence.

## Invariants
Things that must remain true. Each one is a thing an agent could
break without realising.

## Vocabulary
Terms this codebase uses in a non-obvious way.

## Where things live
| Kind | Path |
|---|---|

## Known-wrong
Claims in this document flagged by the last verification pass as
unverified or stale. Empty is the goal.
```

**The `Known-wrong` section is not optional.** A definitions file that is confidently wrong is worse than none, because agents trust it. When verification cannot confirm a claim, the claim moves here rather than being silently deleted or silently kept.

---

## 4. `CLAUDE.md` — agent operating rules

Short, imperative, and pointing outward. Its main job is to send agents to the other two documents.

```markdown
# Agent rules — <codebase>

## Read first
- docs/llm.md        — what this codebase is
- docs/trajectory.md — where it has been and is going
Re-read both if you have been working for a while or feel uncertain.

## Standing constraints
- Modify only files listed in your task's Scope.
- Invoke only operations from your allowlist. Never compose shell.
- Never run git. Never print a secret.
- If you cannot proceed, emit STUCK with all four required fields.
  Do not guess.

## Conventions
Language, formatting, testing, naming. Only what an agent would
otherwise get wrong.

## Verification
The commands that must pass before work is considered done.

## Do not
Specific past mistakes, one line each. This section grows by
correction, never by speculation.
```

**The `Do not` section is the highest-value part** and the one that requires discipline. When an agent makes a mistake and it is corrected in chat, the correction dies with the session. Written here, it applies to every future agent. If a mistake happens twice, its absence from this section is the root cause.

---

## 5. `trajectory.md` — history and direction

The document that lets a session with no memory make an organisation-level decision.

```markdown
# <project> — trajectory

Last enriched: YYYY-MM-DD (loop N)

## Goal
One paragraph. What done looks like, and the number that measures it.

## Where we are
Status in one line, then what is built, what is not, what is blocked.
Reference build-sequence step numbers so there is one numbering.

## How we got here
Newest first. One entry per loop or significant event:
what changed, why, what it cost, what it taught.
Compress entries older than ~10 loops into a single summary block.

## Current priorities
Ordered. Each with the reason it outranks the one below.

## Open issues
| ID | Title | Owner | Blocking? |
Index only — the issue documents themselves live in docs/issues/.

## Risks
| Risk | Impact | Status |
Only live risks. Retired risks move into "How we got here".

## Roadmap
Phases with entry and exit criteria. Must match the PRD; where it
does not, the PRD wins and this section is corrected.

## Next analysis questions
The three to five questions the next strategist session should answer.
Written by the previous session, for the next one.

## Decisions
Pointer only: see decision.md. Do not restate decisions here.
```

**`Next analysis questions` is the section people skip and should not.** It is how one fresh session hands intent to the next without sharing memory. Written honestly it is the closest thing the system has to continuity of thought.

---

## 6. The ENRICH procedure

Runs at work-order start, at loop end, after any large refactor, and on demand.

```
1. LOAD      current llm.md + trajectory.md
2. INSPECT   repo diff since last enrich · merged PRs · closed issues
3. VERIFY    sample N claims from llm.md against the actual code
             confirmed → leave · contradicted → correct in place
             unverifiable → move to Known-wrong
4. UPDATE    llm.md: structural changes only
             trajectory.md: prepend a history entry, refresh status,
             priorities, risks, and next questions
5. COMPRESS  if either exceeds its ceiling, compress before appending
6. RECORD    stamp date, loop number, and verified-against commit
7. PUBLISH   commit, hash into the documents table, post the diff
```

**Step 3 is what separates enrichment from appending.** Without verification the documents accumulate claims that were true once, and the strategist reasons from them with full confidence. `N` starts at five claims per pass — enough to detect rot, cheap enough to run every loop.

**Staleness guard.** If `trajectory.md` was last enriched more than three loops ago, the Tier-1 context assembler warns in-channel and proceeds. Silent staleness is the worst failure shape available here: every strategic decision degrades and nothing signals it.

---

## 7. Anti-patterns

Each of these has a specific consequence, which is why they are worth naming.

| Anti-pattern | Consequence |
|---|---|
| Restating a decision instead of linking it | Two copies drift; both look right alone |
| Appending without compressing | Document gets skimmed, then ignored |
| Appending without verifying | Confident wrongness — the worst state |
| Letting `Do not` stay empty after a correction | The same mistake recurs, forever |
| Putting task detail in `trajectory.md` | Turns strategic memory into a task log |
| Enriching only when convenient | Staleness accumulates silently |
| Deleting a wrong claim instead of moving it to `Known-wrong` | Loses the fact that it was ever believed |

---

## 8. Scope

Each codebase gets its own set. This repository is the swarm's own project, so its set lives in `doc/`. The VTO product repository gets a separate set under its `docs/` once canonical-repository identity is settled ([[decision]] D-017).

`decision.md` is **not** a progressive document. It is strategic memory with different rules — append-only, evidence-required, never compressed away. Progressive documents describe and narrate; `decision.md` adjudicates.

---

## Related

[[decision]] · [[trajectory]] · [[PRD]] · [[TECHNICAL-ARCHITECTURE]] · [[DRIFT-AND-CONSISTENCY]]
