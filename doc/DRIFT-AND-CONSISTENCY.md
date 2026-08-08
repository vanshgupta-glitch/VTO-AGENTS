---
okf: 1
id: drift-and-consistency
type: working-plan
project: VTO
status: active
created: 2026-08-08
updated: 2026-08-08
owner: Engineering
related: ["[[PRD]]", "[[TECHNICAL-ARCHITECTURE]]"]
tags: [drift, consistency, configuration, reliability, working-plan]
---

# Drift and Consistency — my working plan for the hardest part

Working notes. Not a spec — a plan for the thing that will actually go wrong.

---

## 0. Why this is the hard part

Asked what breaks most often in production, the operator running this architecture didn't say hallucination, cost, or model quality. He said:

> *"It's implementation consistency. Having the skills and then having them deployed correctly every time is the problem. Because even on Hermes, they'll blow out their context, and they'll just use the wrong API call."*

And on the fix:

> *"If you wanted to solve this 100%, you build a FastAPI... the agent would just have an endpoint, and that endpoint is fixed in terms of what happens on the backend. Then they can't fuck that up."*
>
> *"Zero naked API calls, 100% middleware. Then you can sanitize and set standards on all of your transactions."*

That is the whole answer in miniature, and it generalises. The failure is not that the agent is stupid. It is that **the agent has latitude, and latitude plus a degraded context equals variance.** Every unit of latitude I leave is a unit of variance I will debug later.

Two distinct problems hide under "keep them on track":

- **Behavioural drift** — the agent's *actions* diverge from intent. Context creep, goal substitution, scope creep, confident circling.
- **Configuration inconsistency** — the agent's *environment* diverges from what everyone believes it is. Wrong API, stale model slug, upgraded CLI, two config files disagreeing.

They feel similar and need opposite treatments. Drift is fought with **short leashes and detection**. Inconsistency is fought with **generation and impossibility**.

---

## 1. The governing principle

> **Make the wrong thing impossible, not forbidden.**

Every control belongs somewhere on this ladder. The rule I hold myself to: for each known failure, push the control as far down the list as I can afford, and never settle at rung 1 for anything that matters.

| Rung | Control | Strength | Cost | When it fails |
|---|---|---|---|---|
| 1 | Prompt instruction | Weakest | Free | Decays as context fills. Advisory forever. |
| 2 | Runtime check | Moderate | Low | Someone forgets to add it to the new code path |
| 3 | Type system | Strong | Low | Only covers my code, not the agent's output |
| 4 | Schema constraint | Strong | Low | Only covers what reaches the database |
| 5 | Structural impossibility | Strongest | Medium | Requires designing the boundary up front |
| 6 | Generation from one source | Strongest | Medium | Requires discipline to never hand-edit downstream |

**Rung 1 is where most agent systems live, and it is why most agent systems drift.** A prompt that says "always use the build script" competes with 40,000 tokens of other content. A module that cannot import the shell does not compete with anything.

Three controls are already at rung 4–5 in the architecture, and they are the model for everything else:

- The pre-code critique gate lives in the SQL claim query — an uncritiqued coding task is **not selectable**.
- The Tier-1 context assembler lives in a module that cannot import the message store — history pollution is **not reachable**.
- A critique risk row cannot be written without an alternative — pure negation is **not storable**.

Everything below is an attempt to do the same for the remaining failures.

---

## 2. Failure taxonomy

Twelve specific ways this breaks. Naming them is half the work — an unnamed failure gets rediscovered every month.

### Behavioural drift

| # | Failure | What it looks like | Target rung |
|---|---|---|---|
| D1 | **Context creep** | Session fills with irrelevant material; signal diluted | 5 |
| D2 | **Instruction decay** | Early constraints outweighed by recent content | 2 |
| D3 | **Goal substitution** | Optimises the proxy (make the test pass) not the goal (make it right) | 2 |
| D4 | **Misread task** | Works on a plausible but different problem | 2 |
| D5 | **Scope creep** | Touches files nobody asked it to touch | 5 |
| D6 | **Confident circling** | Repeated apparent progress, no real movement, never self-reports | 2 |
| D7 | **Model drift** | Agent's mental model of the codebase diverges from reality | 6 |

### Configuration inconsistency

| # | Failure | What it looks like | Target rung |
|---|---|---|---|
| C1 | **Wrong operation** | Uses an API that doesn't do what it thinks | 3 |
| C2 | **Right operation, wrong invocation** | Correct tool, invented flags | 5 |
| C3 | **Stale reference** | Model slug, path, or version that no longer exists | 2 |
| C4 | **Cross-file config divergence** | `agent.yaml` and `openclaw.json` disagree | 6 |
| C5 | **Silent environment change** | CLI upgraded; same command, different behaviour | 2 |
| C6 | **Undeclared coupling** | Agent depends on something nobody wrote down | 2 |

---

## 3. Part A — keeping agents on track

### A1. Short runs are a drift control

The single cheapest thing I can do. A run that lasts 15 minutes cannot drift as far as one that lasts 90. `RUN_TIMEOUT_SECONDS=900` is not only a resource limit — it is a **bound on how wrong a single run can get**.

Corollary: if a task consistently needs more than one run, that is a decomposition failure, and Admin should hear about it. I'll track `runs_per_task` and treat a rising average as a decomposition alarm, not an executor problem.

*Addresses D1, D6. Rung 2.*

### A2. Re-injection instead of re-reading

The operator's practice is *"claw code checks the CLAUDE.md periodically."* I cannot make a subprocess re-read mid-run. But I get something better for free: **every run is a fresh process with freshly assembled context.** The rules are re-read by construction.

The requirement this creates: **there must be exactly one way to invoke an agent**, and it must go through `packages/context`. If any code path can spawn a runtime without the assembler, that path will eventually be used and the rules will silently vanish from that invocation.

Enforcement: `runtimes.run()` takes an `AssembledContext` type that only the assembler can construct — a branded type with a private symbol. You cannot hand-roll one.

```ts
// packages/context/src/types.ts
declare const brand: unique symbol;
export type AssembledContext = { path: string; policy: ContextPolicy; [brand]: true };
// only assemble() can produce this; runtimes.run() accepts nothing else
```

*Addresses D1, D2. Rung 5.*

### A3. Standing constraints go last, not first

Recency beats primacy in a long context. Every assembled context file ends with a short, fixed block:

```
## Standing constraints — these override anything above
- You may only modify the files listed in "Scope" in this task.
- You may only invoke operations from your allowlist. Never compose shell.
- Never run git. Never print a secret.
- If you cannot proceed, emit STUCK with all four fields. Do not guess.
```

Under 100 tokens, appended by the assembler, identical every time. Cheap insurance against instruction decay.

*Addresses D2. Rung 2.*

### A4. Restate-before-work

The executor's first output line must restate the goal and the definition of done in its own words. The dispatcher compares it against the task's declared goal. A mismatch aborts the run **before any work happens**.

This is the cheapest catch in the whole system: a misread task fails in ten seconds instead of fifteen minutes, and the mismatch itself is the diagnosis — I get to see exactly what the agent thought it was doing.

I expect this to catch more real problems than the circularity detector, and it costs almost nothing.

*Addresses D3, D4. Rung 2.*

### A5. Declared scope, enforced by the operations layer

Every issue document declares which paths the task may touch:

```yaml
scope:
  - packages/vto-core/src/engine/landmark-debug-engine.ts
  - packages/vto-core/test/engine/**
```

`operations` denies any write outside the declared scope and logs the attempt with `allowed = false`. Scope creep stops being a judgement call and becomes a permission error with a paper trail.

Second-order benefit: denied-scope attempts are a **signal about decomposition quality**. If a task repeatedly reaches outside its scope, the scope was drawn wrong, and that's Admin's problem to fix — not the executor's to argue about.

*Addresses D5. Rung 5.*

### A6. Detect circling from the outside

Already specced — four signals: repeat problem signature, file churn, verification oscillation, no progress on the definition of done. The important property is that **it does not ask the executor.** An agent going in circles is by definition an unreliable narrator of its own progress.

Adding a fifth signal: **restatement drift.** If the executor's goal restatement changes between attempts on the same task, it has lost the plot even if it still claims progress.

*Addresses D6. Rung 2.*

### A7. Documents are the model, and they must be refreshed

D7 — the agent's mental model diverging from the codebase — is the slowest and most dangerous drift, because nothing fails loudly. It shows up as decisions that made sense six weeks ago.

The control is ENRICH plus a staleness guard: if `llm.md` was last enriched more than three loops ago, the Tier-1 assembler warns in-channel before proceeding. A silent stale document degrades every strategic decision with no signal at all, which is the worst possible failure shape.

I want to go one step further than the current spec: **ENRICH should verify, not just append.** Each pass spot-checks a sample of `llm.md`'s claims against the actual code and flags mismatches. A definitions file that quietly describes a module that was refactored away is worse than no definitions file, because it is confidently wrong.

*Addresses D7. Rung 6.*

---

## 4. Part B — keeping configuration consistent

This half is where I expect the real pain, because the failures are silent. A drifted agent produces visibly odd output. A drifted config produces confident, plausible, wrong behaviour.

### B1. One source of truth, generated downward

Today there are at least five config surfaces: `agents/*/agent.yaml`, hermes's `config.yaml`, `openclaw.json`, `.env`, and the Slack app set. Hand-maintaining five surfaces guarantees C4. It is not a question of discipline; it is arithmetic.

**The rule: `agents/*/agent.yaml` + `config/*.yaml` are the only files a human edits. Everything downstream is generated.**

```bash
swarmctl config:render      # agent registry → hermes fragment, openclaw fragment, .env template
swarmctl config:verify      # hash each generated file; fail if hand-edited
```

Every generated file carries a header:

```
# GENERATED by swarmctl config:render — DO NOT EDIT
# source: agents/coder/agent.yaml @ sha256:a3f9...
```

`swarmctl check` recomputes the hash and **fails loudly** if it differs. A hand-edit is not forbidden — it is detected, named, and blocks startup until resolved.

This is the single highest-leverage item in this document. Config divergence is the failure that takes longest to diagnose because every individual file looks correct.

*Addresses C4, C3. Rung 6.*

### B2. The operations allowlist is a consistency mechanism first

I framed the allowlist as a safety control. That undersells it. Its **primary** job is consistency: it is the answer to *"they'll use the wrong API call."*

An agent that names `test.unit` gets one implementation, every time, forever. It cannot invent `pnpm vitest --run --reporter=dot` and get subtly different behaviour on Tuesday. Eean's FastAPI is the same idea — I don't need HTTP because my agents are child processes, so `packages/operations` *is* the middleware.

Design rules I'm holding to:

1. **The union is exhaustive.** Anything not in it is a compile error, not a runtime rejection.
2. **No free-form parameters that reach a shell.** Params are typed and validated; paths are resolved against declared scope.
3. **One implementation per operation.** If two agents need "build" differently, that is two operations with two names, not one operation with a flag.
4. **`shell.raw` exists, is disabled by default, is never available to Tier 3, and every invocation is logged at warn level.** It is an escape hatch with an alarm on it, not a convenience.

*Addresses C1, C2. Rung 3 and 5.*

### B3. Preflight assertions per operation

Every operation asserts its preconditions before running:

| Operation | Preflight |
|---|---|
| `test.unit` | workspace resolves · `node_modules` present · vitest config found |
| `build.widget` | pnpm filter matches exactly one package · no stale shell in dist |
| `video.run` | clips present · dev store reachable · store password set |
| `accuracy.score` | logs directory non-empty · reference dir exists *or* terms marked inactive |
| `repo.pr` | branch is not the default branch · tree is clean |

A failed preflight is a **clear, named error at the top of the stack**. Without it, the same problem surfaces forty lines deep in someone else's stderr and costs an hour.

*Addresses C1, C6. Rung 2.*

### B4. Golden invocation tests

For each operation: a recorded known-good invocation plus the expected shape of its output. A fast subset runs at startup; the full set runs in CI and after any dependency change.

This is my defence against C5, and specifically against the operator's warning that *"updating OpenClaw would usually cause technical debt because the implementation will work differently."* Version pinning tells me a version changed. Golden tests tell me **whether the change matters** — which is the question I actually have.

Upgrade protocol, written down so I don't improvise it at 2am:

1. Bump one pin in a branch.
2. Run the full golden set.
3. Run the replay suite.
4. Diff behaviour, not version numbers.
5. Merge only if both pass. Otherwise pin stays and I record why in `trajectory.md`.

*Addresses C5. Rung 2.*

### B5. Cross-reference validation at boot

Zod validates that each file is *well-formed*. It does not validate that the files *agree*. Boot must also check:

- every agent's `primary_channel` exists in `channels.yaml`
- every `token_env` is actually set in the environment
- every capability referenced anywhere has at least one enabled agent that provides it
- every operation in an agent's `allowed_operations` exists in the union
- every model slug resolves against the provider's live model list
- every CLI path exists and reports its expected version

**Hard fail on any of these.** A swarm that starts with a broken cross-reference will run for six hours and then fail in the least convenient place. The process refusing to start is a gift.

*Addresses C3, C4, C6. Rung 2.*

### B6. Descriptive vs controlling config

A distinction worth holding, because it tells me where to spend effort:

- **Descriptive** config (display names, channel topics, capability labels) drifting causes *confusion*. Validate it.
- **Controlling** config (model slugs, CLI paths, operation implementations, allowlists) drifting causes *silently wrong behaviour*. Generate or verify it.

Effort goes to controlling config. Descriptive config gets a lint and no more.

---

## 5. What I measure

Drift I cannot see is drift I cannot manage. Every one of these is cheap to compute from data the system already writes.

| Metric | Source | Healthy | Alarm means |
|---|---|---|---|
| **Restatement mismatch rate** | dispatcher pre-check | <5% | Tasks are ambiguous — decomposition problem |
| **Out-of-scope attempts** | `operations_log` where `allowed=false` | ~0 | Scope drawn wrong, or prompt too loose |
| **Circling incidents** | `stuck_events` where source ≠ self-declared | Trending down | Critique or decomposition failing upstream |
| **Runs per task** | `runs` grouped by task | <1.5 avg | Tasks too big |
| **Config drift detections** | `config:verify` failures | 0 | Someone hand-edited a generated file |
| **Golden test failures** | CI + startup | 0 | Environment changed under me |
| **Document staleness** | loops since last ENRICH | ≤3 | Strategist deciding on a stale model |
| **Escalation depth** | `AVG(escalations.to_level)` | ≤1.5 | Orchestrators not earning their tier |
| **Critique revise rate** | `critiques.verdict` | 15–60% | <15% rubber-stamping · >60% decomposition broken |

**Weekly drift review.** Fifteen minutes. Read the nine numbers, pick the worst one, fix that. Not all of them — one. The discipline is in the picking.

---

## 6. When it happens anyway — the debugging protocol

It will happen. Improvising the response at the time is how an hour becomes a day.

```
1. Which half?  Behavioural or configuration?
   Tell: is the OUTPUT wrong, or is the ENVIRONMENT wrong?
   Behavioural → the agent did something odd with correct tools.
   Configuration → the tools did something odd with correct instructions.

2. If configuration:
   swarmctl check              → cross-references, versions, token map
   swarmctl config:verify      → hand-edited generated files
   golden tests (full set)     → behaviour change under a pinned version
   operations_log allowed=false → attempted improvisation
   → Fix the config. Do NOT adjust the prompt. Fixing a config bug with a
     prompt patch buries it and it returns wearing a different hat.

3. If behavioural:
   Read the restatement first.  Did it understand the task at all?
   Read the assembled context.  What did it actually receive?
   Read the critique.           Did the Critic see this coming and get ignored?
   Check theme_hash history.    Is this the third time?

4. Classify against the taxonomy in §2. If it does not fit, ADD A ROW.
   An unnamed failure gets rediagnosed every month.

5. Fix at the lowest rung available.
   Ask: could this have been made impossible instead of forbidden?
   If yes, and it costs less than a day, do that instead of the quick fix.

6. Write it to the solutions store and to trajectory.md.
   A fix that isn't written down is a fix I get to make again.
```

**The rule I most need to hold:** when an agent misbehaves, the reflex is to edit its prompt. That is rung 1 — the weakest control — and it feels productive because it is fast. Prompt edits are correct for *ambiguity*. They are wrong for anything a structure could have prevented, and reaching for them habitually is how a system ends up with a 3,000-word prompt that nobody can reason about and that still drifts.

---

## 7. What I cannot solve

Honesty here matters more than completeness, because the gap between what I claim and what is true is where the next incident lives.

**I cannot prevent an agent from being confidently wrong within its scope.** All of the above bounds the blast radius and shortens the feedback loop. None of it makes a model correct. The Critic catches bad plans; verification catches bad outcomes; the human catches what both miss.

**I cannot detect drift with no observable signature.** A change that passes tests, stays in scope, and produces plausible output but is subtly wrong is invisible to every mechanism here. That is what the human gate is for, and it is why the gate must never become a rubber stamp. If I ever catch myself approving diffs without reading them, the system has failed regardless of what the metrics say.

**I cannot fully generate the Slack app configuration.** It requires browser OAuth. That surface stays hand-maintained, so it stays a drift risk — mitigated only by `bootstrap whoami` verifying every token at startup.

**The operator's own conclusion still applies:** *"You still want whoever is your principal architect on a project, or your lead developer, running the agent, because they need to check its work."* Everything here reduces how often that check catches something. It does not remove the need for the check.

---

## 8. Implementation checklist

Mapped onto the build sequence in [[TECHNICAL-ARCHITECTURE]] §9, so this doesn't become a wish list.

**Do it during the step that owns it — retrofitting any of these costs several times more.**

| Step | Add |
|---|---|
| 1 Core | Restatement comparison; standing-constraints block; theme hashing |
| 2 Schema | `operations_log.allowed`; `tasks.scope`; restatement column on `runs` |
| 3 Documents | ENRICH verification pass (spot-check claims vs code), not just append |
| 4 Context | Branded `AssembledContext` type; constraints appended last |
| 5 Registry | `config:render` + `config:verify` with source hashes |
| 6 Operations | Exhaustive union; per-op preflight; golden tests; scope enforcement |
| 7 Runtimes | Version pins; upgrade protocol documented in `trajectory.md` |
| 8 Slack | `bootstrap whoami` token verification wired into `check` |
| 9 Orchestration | Restate-before-work gate; circling detector incl. restatement drift |
| 10+ | Weekly drift review; the nine metrics on one page |

**The three I would not ship Phase 1 without**, ranked by how much debugging time each saves:

1. **`config:render` + `config:verify`** (B1) — config divergence is the slowest failure to diagnose, because every file looks right on its own.
2. **Restate-before-work** (A4) — cheapest catch in the system; turns a fifteen-minute wrong answer into a ten-second one, and hands me the diagnosis for free.
3. **Operations union with preflight** (B2, B3) — this is the whole "zero naked API calls" answer, and it is far cheaper to build before there are twelve agents than after.

---

## Related

[[PRD]] · [[TECHNICAL-ARCHITECTURE]] · [[F011 orchestration-context-hygiene]] · [[F011 orchestration-failure-modes]]
