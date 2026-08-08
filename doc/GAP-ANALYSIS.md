---
okf: 1
id: gap-analysis-eean
type: analysis
project: VTO
status: draft
created: 2026-08-08
updated: 2026-08-08
source: "Eean Ovens call transcript (EEAN CHAT.pdf), sections 24:34–44:57"
related: ["[[PRD]]", "[[TECHNICAL-ARCHITECTURE]]"]
tags: [gap-analysis, orchestration, progressive-documents, adversarial-review, remediation]
---

# Gap Analysis — our design vs. Eean Ovens' operating practice

**Source:** call transcript with Eean Ovens, who runs this architecture in production across multiple client codebases.
**Audited:** [[PRD]] v2.0 and [[TECHNICAL-ARCHITECTURE]] v2.0, both dated 2026-08-08.
**Verdict:** the tier structure is validated. The **context strategy is wrong**, and four practices he calls mandatory are absent or misclassified.

> Transcription note: "claw code" = Claude Code, "claw.md" = `CLAUDE.md`, "lm.md" = `llm.md`, "open claw" = OpenClaw. Read accordingly.

---

## 0. Scoreboard

| # | Gap | Severity | Status in our docs |
|---|---|---|---|
| **G1** | Orchestration context is polluted with execution detail | **P0 — breaks the design** | We specified it as a *feature* |
| **G2** | Progressive documents do not exist | **P0** | Entirely absent |
| **G3** | Hand-offs are chat messages, not documents | **P0** | Slack is the payload, not the pointer |
| **G4** | Adversarial review classified nice-to-have, and in the wrong mode | **P0** | PRD F4.7 = `N`; vault says "refute, never confirm" |
| **G5** | No circularity detection — we only catch self-declared stuck | **P1** | Missing |
| **G6** | No solutions knowledge store | **P1** | Missing; schema is 80% there already |
| **G7** | Operations are a denylist, not a fixed-endpoint allowlist | **P1** | We block git; he blocks improvisation |
| **G8** | Issues + PRs are not first-class artifacts | **P1** | We have DB rows, no repo artifacts |
| **G9** | Executor CLI versions unpinned | **P2** | Absent |
| **G10** | No "fully kitted" error/logging standard enforced at review | **P2** | Logging exists; no standard, no gate |
| **G11** | Prod/live-state ownership not named | **P2** | Implied, never stated |
| **G12** | We over-invest in model optimization | **P2** | Whole vault doc devoted to it |

**What we got right and should not change:** the three-tier split (he independently describes the same CTO → product-owner → developer structure), Claude Code at the orchestration layer with Hermes as the wrench-turning layer (*"anything that's applying, that's turning the wrenches, always Hermes"* — exactly our Tier 1/Tier 2 split), discipline-specific step-up on failure, and the human-owns-the-commit rule.

---

## G1 — Orchestration context pollution *(P0)*

### What he said

> *"In order for it to make a good decision at the level of the organization, its context cannot be polluted with all the problems of the code. It has to have this high level where everything that we're trying to do, everything that we've done, is all readable."*
>
> *"If you're doing orchestration, always do a fresh session. You want to prepare all of the documents in advance, and then you do a fresh session every time with orchestration."*

### What we wrote

[[TECHNICAL-ARCHITECTURE]] §2.2 step 7: *"Assemble context. Gather the task's cross-channel history from the `messages` table."* [[PRD]] §6.5 sells this as a virtue: *"agents that start with full context by construction."*

### The problem

We apply **one context strategy to all three tiers**. For an executor that is correct — it needs the errors, the diffs, the prior attempts. For Claude it is actively harmful. Feeding the strategist every STUCK event, every stack trace, and every rejected diff buries the signal it exists to find. We would have built a very expensive log reader.

There is a second-order failure too: a long-running Claude session accumulates the biases of everything it has already seen, so it stops re-evaluating the plan and starts defending it.

### The fix — tier-differentiated context

| Tier | Session | Context fed |
|---|---|---|
| **1 — Claude** | **Fresh every single invocation. No exceptions.** | Progressive documents (G2) + one curated report. **Never** raw channel history. |
| **2 — Orchestrators** | Fresh per task | Task thread + its own discipline's history + the relevant progressive document |
| **3 — Executors** | Fresh per run | Everything: full thread, prior attempts, errors, diffs |

Concretely in the code: `slack/history.ts` gains a `contextPolicy` parameter driven by `agent.tier`. Tier 1 resolves to a document-assembly path that never touches the `messages` table. This is a small change made now and an expensive one made later.

**The report, not the transcript.** His management analogy is the specification: *"If a developer is not effective, they don't talk to the CTO. The product owner gives a report that the CTO reads."* Orchestrators must write a **report** — a synthesis — not forward a transcript. Add `reportUp()` to the orchestrator contract: a bounded summary with what was attempted, what was learned, and what decision is needed.

---

## G2 — Progressive documents *(P0)*

### What he said

> *"There are 2 elements that make it work. One is progressive documents… We have 3 total documents. `llm.md` is definitions — all of the codebase definitions. Then `CLAUDE.md`. And `trajectory.md` — all of the history of this codebase, all of our future goals. Whenever we do a refactor analysis we put all of this in here. It has all of the issues as well as all the committed PRs."*
>
> *"This is doing full analysis of all of our codebase problems and challenges… then I have it enrich our progressive documents."*

### What we wrote

Nothing. The word "document" appears in our architecture only as an artifact path. Our Claude re-derives codebase understanding from scratch on every invocation.

### The problem

This is the **other half** of the mechanism that makes G1's fresh session work. A fresh session is only useful if there is something high-quality to load into it. Without progressive documents, "fresh session" just means "amnesia."

It also means we pay full re-analysis cost every loop and accumulate nothing. He is explicit that coherence compounds: *"that way you're adding to documentation and the coherence of it over time."*

### The fix

Three documents per codebase, in the repo under `docs/`:

| Document | Contents | Written by | Read by |
|---|---|---|---|
| `llm.md` | Codebase definitions: modules, entry points, data flow, vocabulary, invariants | Claude (enrichment pass) | All tiers |
| `CLAUDE.md` | Operating rules for coding agents. **Points at the other two** so they are re-read continuously | Human + Claude | Tier 2/3 |
| `trajectory.md` | Full history: what we've done, why, what we're trying to do next, open issues, merged PRs, refactor analyses | Claude (enrichment pass) | **Tier 1 primarily** |

**The enrichment pass is a new pipeline stage** — the thing our loop is missing entirely:

```
ANALYSE → ENRICH → PLAN → decompose → build → verify → report → ANALYSE
   ▲         │
   │         └─ Claude rewrites llm.md + trajectory.md from what it just learned
   └──────────── next loop's fresh session loads the enriched documents
```

Run it: at the start of every work order, at the end of every loop, and on demand after a large refactor. He runs it *"whenever you're starting a new sprint, and anytime that your projects break down."*

**Why `trajectory.md` matters most:** it is the artifact that lets a fresh session make an organization-level decision. Everything we've done and everything we intend, readable in one pass, with none of the code's mess.

---

## G3 — Hand-offs must be documents, not chat *(P0)*

### What he said

> *"The way that you go back and forth between them is through issues development and progressive documents… your back and forth is always through documentation."*
>
> *"You don't have to give it a new context. You can just have it reread."*

### What we wrote

[[PRD]] §6.5: every hand-off is a Slack message. Slack carries the payload.

### The problem

Slack is a good **log** and a bad **artifact**. A hundred messages do not accumulate into a coherent understanding; a document does. Our design produces a perfect record of every decision and no durable statement of what is currently true.

The "just have it reread" point is operationally significant and we missed it: after orchestration produces a fix, you do **not** re-prompt the coding agent with new context. You tell it to re-read the document. That is cheaper, and more importantly it keeps one authoritative version of the truth instead of N paraphrases scattered across threads.

### The fix

**Invert the relationship: the document is the payload, Slack is the notification.**

```
Before:  Coder → [long Slack message with the full directive] → executor
After:   Coder → writes/updates docs/issues/T037.md
              → posts to #swarm-code: "T037 updated — re-read docs/issues/T037.md"
              → executor re-reads, continues
```

Add a `documents` table (path, kind, version, sha256, last_written_by, last_read_by) so the system knows whether an agent has read the current version. Add `docs/issues/` as a real directory of markdown issue files — which also delivers G8.

Slack keeps every job it currently has except one: it stops being where content lives.

---

## G4 — Adversarial review: wrong class, wrong mode *(P0)*

### What he said

> *"Before I ever start coding, the coding agent will do an adversarial review… You turn that in before you ever start coding, every single time."*
>
> *"Here's the important thing. You want it to be a **constructive criticism**. If you have it just be adversarial, it'll actually be counterproductive. Because all it'll do is come up with everything that's wrong, and your end result will be overly conservative, or it will lack optimism on solutions. What you want is a **helpful skeptic**. A **constructive critic**."*
>
> *"Otherwise it'll just start coding, and it'll code from optimism, which usually results in problems."*

### What we wrote

Two things, both wrong.

1. [[PRD]] F4.7 classifies adversarial review as **nice-to-have**: *"Valuable; deferrable."*
2. We cite [[F011 orchestration-adversarial-review]], which instructs: *"Do NOT confirm; your ONLY job is to find flaws"* and *"the verifier is prompted to refute, not confirm."*

That second one is precisely the pure-adversarial mode he warns produces conservative, pessimistic output.

### The resolution — two different reviews, currently conflated

This is worth getting right rather than just swapping a word. They are different jobs at different times:

| | **Constructive Critic** | **Refuter** |
|---|---|---|
| **When** | *Before* coding, on the plan | *After* research, on a claim |
| **Subject** | A proposed approach | A stated fact |
| **Stance** | "What will not work, and what would work instead" | "Prove this claim wrong against its evidence" |
| **Output** | Risks **plus** alternatives | SURVIVES / REFUTED + counter-evidence |
| **Failure if wrong mode** | Pure refutation → paralysis, no plan survives | Constructive framing → bad facts get talked into acceptance |
| **Class** | **MUST-HAVE, every coding task** | Nice-to-have, research findings only |

Our vault's refuter is correct **for its job** — verifying research claims after the fact. It is the wrong instrument for pre-coding design review, and we had no instrument for that at all.

### The fix

- **[[PRD]] F4.7 → split into F4.7a (Constructive Critic, class `M`) and F4.7b (Refuter, class `N`).**
- Add a **PRE-CODE stage** to the pipeline, before CODE. Non-skippable. A coding todo cannot be dispatched to an executor until a critic review exists for it.
- Write `prompts/constructive-critic.md` with the stance made explicit: *"You are a helpful skeptic. For each risk you raise you must also propose a viable alternative. A criticism without a path forward is not useful. Do not reject the approach wholesale unless you can say what to do instead."*
- The critic runs on a **cheap** model. It is a high-frequency stage.

**Expected payoff is large.** He attributes 40–50% turn reduction to orchestration discipline overall, and calls coding-from-optimism the main source of downstream problems. This is the cheapest P0 on the list to implement.

---

## G5 — Circularity detection *(P1)*

### What he said

> *"Anytime your agents start to go in circles, step up to orchestration."*
>
> *"If you're 1, 2, 3 turns and the problem resurfaces, then you go back up to orchestration."*

### What we wrote

Escalation triggers on a **self-declared** STUCK ([[TECHNICAL-ARCHITECTURE]] §2.3).

### The problem

The dangerous failure mode is not an executor that knows it is stuck. It is an executor that is **confidently going in circles** — fixing the same thing three different ways, each time believing it succeeded. That executor never declares STUCK, so our escalation ladder never fires. This is the exact case he names.

### The fix

A **circularity detector** in the dispatcher, running on every completed run, independent of what the executor claims:

- **Repeat-signature:** same `theme_hash` recurring across 3 runs within one work order → force escalation.
- **Churn:** same file touched in ≥3 consecutive runs with no verification passing → force escalation.
- **Verification oscillation:** a test flips fail → pass → fail across runs → force escalation.
- **No-progress:** 3 runs, zero net change to `definition_of_done` completion → force escalation.

Any trigger writes a synthetic `stuck_event` with `declared_by = 'system'` and enters the normal ladder. Cheap to build — the schema already stores everything needed.

---

## G6 — Solutions knowledge store *(P1)*

### What he said

> *"We built a product knowledge store specific to the codebase… every time they came up with a solution that fixed a problem, we would put it into this knowledge store. That thing actually worked incredibly well… that is one thing that paid off extremely well."*

Asked what he would build **more** of, this was his answer.

### What we wrote

Nothing. Every stuck event is diagnosed from first principles, forever.

### The fix — and we are most of the way there

Our `stuck_events` table already stores `theme_hash`, `diagnosis`, `unstick_directive`, and `resolution_level`. **A resolved stuck event is already a solution record.** We simply never designed retrieval.

Add:

```
solutions
  id · theme_hash · problem_signature · diagnosis · directive
  source_stuck_event_id · times_reused · success_rate
  codebase · created_at · last_used_at
```

Then, in the stuck engine, **before** invoking the orchestrator's LLM:

```
lookup(theme_hash) → hit?
  ├─ yes: apply the known directive, increment times_reused, skip the LLM call
  └─ no:  invoke the orchestrator, and on resolution write a new solutions row
```

He notes his team barely uses theirs now *"because the agents are smarter"* — but ours also serves as **cost control** and as the corpus that makes G5's detector smarter. Start with exact `theme_hash` matching; add vector similarity only if exact matching proves too narrow. Do not start with a vector database.

---

## G7 — Operations middleware, not a denylist *(P1)*

### What he said

> *"It's implementation consistency… even on Hermes, they'll blow out their context, and they'll use the wrong API call."*
>
> *"If you wanted to solve this 100%, you build a FastAPI for every single customer… you programmatically develop all of your deployment architecture into that endpoint. The agent would just have an endpoint, and that endpoint is fixed in terms of what happens on the backend. Then they can't fuck that up."*
>
> *"Have zero naked API calls, 100% middleware, and then you can sanitize and set standards on all of your transactions."*

### What we wrote

[[TECHNICAL-ARCHITECTURE]] §7 gotcha 8: a git **denylist** checked before every spawn.

### The problem

A denylist enumerates what is forbidden. Everything else — including every wrong-but-not-forbidden command an agent can invent — is permitted. He identifies implementation inconsistency as *the single most frequent breakage in production*, and a denylist does nothing about it.

### The fix — promote `runtimes` into an Operations API

Replace "agent composes a shell command, we screen it" with "agent names an operation, we execute a fixed implementation."

```ts
// packages/operations — the only path to the outside world
type Operation =
  | { op: 'build.widget' }
  | { op: 'test.unit';        filter?: string }
  | { op: 'test.types' }
  | { op: 'lint';             paths: string[] }
  | { op: 'video.run';        clips: ClipName[] }
  | { op: 'accuracy.score';   refs?: string }
  | { op: 'fetch.page';       url: string; render: boolean }
  | { op: 'repo.diff';        base: string }
  | { op: 'deploy.dev' };
```

Every operation has one implementation, one place to fix, and one place to log. Anything not in the union is **not expressible** — which is a far stronger guarantee than "not permitted."

Free-form shell survives only behind an explicitly flagged `op: 'shell.raw'` that is disabled by default, logged loudly, and never available to Tier 3.

Note this makes his FastAPI concrete for us: we do not need a separate HTTP service, because our agents are child processes rather than remote callers. `packages/operations` **is** the middleware. Keep the git denylist as defence in depth — but the allowlist is the actual control.

---

## G8 — Issues and PRs as first-class artifacts *(P1)*

### What he said

> *"The orchestration agent is going to have repo access. So it's going to see what the PRs are and the comments are, **which your agents should be creating**. And so it's going to know exactly what's going on."*
>
> *"Orchestration analyzes what they've done, it comes up with a solution, and it pushes it back down through issues and progressive documents."*

### What we wrote

Tasks are database rows. No issues, no PRs, no comments.

### The problem

Our Claude has no repo-native view of work in flight. It reads code and Slack. Meanwhile `trajectory.md` (G2) is supposed to contain *"all of the issues as well as all the committed PRs"* — which presumes those artifacts exist.

### The fix

- Executors create **PRs with descriptive comments** rather than posting bare diffs to Slack. Human still merges — this changes nothing about G11.
- Orchestrators create **issue files** in `docs/issues/T###.md`. This is the same mechanism as G3; one implementation serves both.
- Claude is granted **read access to the repo, PRs, and issues** as part of its fresh-session context bundle.
- The enrichment pass folds merged PRs and closed issues into `trajectory.md`.

---

## G9 — Pin the executor CLIs *(P2)*

> *"Upgrading OpenClaw… once an agent works really well — updating would usually cause technical debt because the implementation will work differently."*

We pin our Node dependencies and say nothing about the four agent CLIs, which are the components most likely to break behaviour on upgrade. Add `EXPECTED_*_VERSION` to `.env`, verify in `swarmctl check`, **warn loudly on drift**, and treat any CLI upgrade as a change requiring a full replay-test pass — never a casual `npm update`.

Known-good today: opencode 1.18.14 · openclaw 2026.7.1-2 · hermes v0.18.0 · claude 2.1.216.

---

## G10 — "Fully kitted" standards, enforced at review *(P2)*

> *"If they produce orchestration that doesn't close loops on your error reporting, you're just going to end up with unknowns in your code. That has to be a high standard… your adversarial review has to have standards for that."*
>
> *"You need fully kitted error states. You need fully kitted logging. That has to push its way up into the implementation pipeline."*

We have structured logging for the *swarm*. We have no standard for the code the swarm *writes*.

Write `docs/standards/fully-kitted.md` — every error path handled and reported, every failure logged with enough context to diagnose, no silent catches, no unknown states. Then make it a **checklist in the Constructive Critic prompt (G4)**, so it is enforced before coding rather than discovered after. Standards enforced at review are policy; standards enforced after the fact are archaeology.

---

## G11 — Name the human who owns prod *(P2)*

> *"There's no such thing as the agent did it. There's only a human that pushed code."*
>
> *"One person is pushing code. One person is responsible for the live state. One person is responsible for error states on prod."*

Our docs say "the Operator" throughout without ever stating the responsibility. Add a named-owner section to the [[PRD]]: one person owns the commit, the live state, and production error states. The system may prepare everything; it attributes nothing.

---

## G12 — Stop optimizing models *(P2)*

> *"We don't do a whole lot of model optimization anymore. We spent a lot of time on that. And now… we just use that on a ton of stuff right now."*

Asked what he wasted effort on, this was one of two answers. Our vault carries a whole [[Model-Optimization-Plan]] with empty decision tables plus a [[Model-Capability-Synthesis]] full of unverified `[M]`/`[L]` estimates.

Keep the coarse cost tiering — free OpenCode for mechanical work, paid for judgment — because that is a real constraint. **Drop per-role model tuning.** Pick one capable model per tier, pin it, and revisit only when a metric says to. Mark both vault documents `status: deferred`.

---

## Remediation plan

### Do before writing any code

| Order | Change | Touches |
|---|---|---|
| 1 | **G2** — create `llm.md`, `CLAUDE.md`, `trajectory.md`; define the enrichment pass | New docs + [[PRD]] §5 pipeline |
| 2 | **G1** — tier-differentiated context policy; Tier 1 fresh session always | [[TECHNICAL-ARCHITECTURE]] §2.2, `slack/history.ts` |
| 3 | **G4** — Constructive Critic as a mandatory PRE-CODE stage | [[PRD]] §7 F4.7, `prompts/`, stage table |
| 4 | **G3** — documents as payload, Slack as pointer; `documents` table | [[PRD]] §6.5, schema |

### Do during the build

| Order | Change | Touches |
|---|---|---|
| 5 | **G7** — Operations API allowlist | `packages/operations` (new) |
| 6 | **G5** — circularity detector | `orchestration/dispatcher.ts` |
| 7 | **G8** — issues + PRs as artifacts, repo access for Claude | `docs/issues/`, executor prompts |
| 8 | **G6** — `solutions` table + lookup-before-LLM | schema, `stuck-engine.ts` |
| 9 | **G9–G12** — pinning, standards, ownership, model descope | config, docs |

### Revised pipeline

```
ANALYSE  (Claude, fresh session, progressive docs only)
   ↓
ENRICH   (Claude rewrites llm.md + trajectory.md)          ← NEW
   ↓
PLAN     (work order)
   ↓
DECOMPOSE (Admin → issue files, not just DB rows)
   ↓
PRE-CODE (Constructive Critic — mandatory, blocking)       ← NEW
   ↓
CODE → TEST → VIDEO → ACCURACY
   ↓        ↖ circularity detector can force step-up ↗     ← NEW
REPORT   (orchestrator writes a synthesis, not a transcript) ← NEW
   ↓
back to ANALYSE (fresh session, enriched documents)
```

Three new stages and one changed hand-off. The tier structure is untouched — it was right.

---

## What this is worth

He gives one number: skipping orchestration discipline costs *"probably 40 or 50% of your turns."* Our design had the orchestration **tier** but not the orchestration **discipline** — no progressive documents, no fresh sessions, no pre-coding critic, no document-mediated hand-off. Those four things are the discipline. Everything else on this list is refinement.

---

## Related

[[PRD]] · [[TECHNICAL-ARCHITECTURE]] · [[F011 orchestration-adversarial-review]] · [[F011 orchestration-context-hygiene]] · [[Model-Optimization-Plan]] · [[Model-Capability-Synthesis]]
