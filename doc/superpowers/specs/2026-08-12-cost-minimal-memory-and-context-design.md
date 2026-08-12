---
okf: 1
id: spec-cost-minimal-memory
type: spec
status: draft
created: 2026-08-12
updated: 2026-08-12
tags: [memory, context, cost, hermes, solutions-store]
---

# Cost-minimal memory and context management

**Status:** draft, awaiting review
**Supersedes:** nothing. Amends `config/swarm.config.yaml` `documents:` block; adds a memory tier.
**Governing constraint:** no change may contradict the recorded guidance of Eean Ovens.

## 1. Problem

The swarm has no memory tier. Three sockets for one exist and are wired to nothing:

- `solutions.find` — declared in Critic's `allowed_operations` ([agents/critic/agent.yaml](../../../agents/critic/agent.yaml))
- `consult_solutions: true` — declared in the `recovery` block of **every** agent
- `solutions_min_success_rate: 0.5` — declared in [config/swarm.config.yaml](../../../config/swarm.config.yaml)

Nothing implements any of them. Consequently a failure the swarm has already solved is
re-solved from scratch at full price, every time it recurs.

Separately, the document-enrichment cadence is set to `enrich_every_n_loops: 1`, which runs
a full Opus rewrite of the progressive documents on every loop.

## 2. Evidence base

Two sources, both external to this repo, both authoritative for different reasons.

### 2.1 The Hermes memory system

Source: *"Hermes Agent Memory System: Curated Memory, Session Search and Self-Improvement"*.
This documents the memory subsystem of `hermes`, which is the runtime of all four Tier-2
orchestrators ([config/runtimes.yaml](../../../config/runtimes.yaml)). Its findings are
therefore configuration levers, not general reading.

| Mechanism | Documented purpose | Cost consequence |
|---|---|---|
| Memory injected as a frozen snapshot at session start | *"preserves prefix caching because the system prompt stays stable"* | The whole system prompt can be a cache hit |
| External recall fenced into the user message, never the system prompt | *"protects prompt cache stability"* | Recall cannot invalidate the cached prefix |
| `session_search` returns raw DB rows, no LLM summarization | traceable recall | Retrieval costs **zero tokens** |
| `nudge_interval` (default 10) forks a background review agent | self-improvement | One extra full model call per 10 turns |
| Layers: `MEMORY.md`/`USER.md` (2200/1375 chars) → SQLite FTS5 → external provider | tiering | Layers 1-2 have zero marginal model cost; layer 3 does not |

### 2.2 The Eean Ovens call (2026-08-08)

Source: `~/Downloads/EEAN CHAT.pdf`, a ~50-minute call between Eean Ovens, Mohit Maheshwari
and Lalit Chaudhary. This repo is a transcription of Eean's methodology — progressive
documents, "fully kitted", constructive critique, fresh-session orchestration, and
*"there is no such thing as the agent did it"* all originate there and appear verbatim in
`soul/` and `doc/`. His guidance is binding.

Cost-relevant rulings, with timestamps:

| Ruling | Timestamp |
|---|---|
| *"it'll save you probably 40 or 50% of your turns. Like, literally, like, 50% of your turns"* — on orchestration | 41:59 |
| *"lacking orchestration is a huge mistake... almost always going to cause big refactors"* | 41:38 |
| *"you iterate that orchestration whenever you're starting a new sprint, and anytime that your projects break down"* | 41:59 |
| *"if you're 1, 2, 3 turns, and the problem resurfaces, then you go back up to orchestration"* | 30:15 |
| *"You can just have it reread. You don't have to give it a new context."* | 28:30 |
| *"you turn that in before you ever start coding, every single time"* — on constructive critique | 31:28 |
| *"We don't do a whole lot of model optimization anymore. We spent a lot of time on that."* | 41:11 |
| *"we built a product knowledge store... it had a solutions architecture... That thing actually worked incredibly well... paid off extremely well"* | 39:19 |
| *"there are some memory systems that are turnkey that do this now, that might work as well or better than ours... Hermes has some hybrid of that you could probably implement"* | 39:19 |

## 3. Governing principle

```
cost = turns × tokens-per-turn
```

Eean's measured claim is that orchestration reduces `turns` by 40-50%. The Hermes article
shows `tokens-per-turn` can be driven toward zero for recall. Therefore:

> **Protect every turn-reducing mechanism. Attack only repeated turns and per-turn waste.**

The naive optimisation — reduce use of the expensive Tier-1 model — is rejected: it
increases `turns`, which dominates. Per-model micro-optimisation is also rejected, on
Eean's explicit testimony that it is a dead end he has already paid for.

## 4. Protected invariants (non-goals)

These are out of scope and must not change:

1. Opus at Tier 1 — Eean runs Opus 5 for orchestration (24:34).
2. `requires_precode_critique: true` — *"every single time"* (31:28).
3. Critique remains **constructive**, never purely adversarial — pure adversarial review
   produces output that *"will lack optimism on solutions"* (31:28).
4. Fresh session for orchestration (28:30).
5. Documents remain the only channel between tiers (30:15).
6. No per-agent model reassignment as a cost lever (41:11).
7. ADR-002 full-loading of knowledge packs. Packs are not excerpted or summarised.

## 5. Components

### 5.0 Runtime and model assignment

Fixed by owner directive 2026-08-12: **Claude Code at the orchestration layer — the slot
where Eean runs Opus — and the cheaper models everywhere else.**

| Tier | Agents | Runtime | Model | Cost unit |
|---|---|---|---|---|
| 1 | claude | Claude Code | `claude-opus-5` | Subscription quota |
| 2 | admin, researcher | hermes | `openrouter/deepseek/deepseek-v4-flash` | $ / token |
| 2 | critic, coder | hermes | `openrouter/qwen/qwen3-coder-flash` | $ / token |
| 3 | openclaw, opencode | own CLIs | unchanged | — |

Two consequences follow, and they are the reason this section exists.

**The cost unit is not uniform across the swarm.** Tier 1 runs on a Claude Code
subscription, where the marginal cost of a token is zero until a rate limit is reached; the
scarce resource is quota per rolling window. Tiers 2 and 3 are metered per token. A single
dollar figure cannot govern both, which is why §5.6 records two units and
`daily_cost_cap_usd` is retired (§5.6).

**Tier 2 stays on Hermes, so the Hermes memory tier stays load-bearing.** §5.3 and §5.5
apply unchanged. Had Tier 2 moved to Claude Code, both would have needed rebuilding on
`CLAUDE.md` and Claude Code's own memory, and `tools/setup.py` would have had to render
Claude Code agent definitions rather than Hermes `SOUL.md`. It does not, so it doesn't.

**Model ID correction.** `agents/claude/agent.yaml` and `config/bridge.config.yaml` both
name `claude-opus-4-8` (Opus 4.8). The current Opus is `claude-opus-5`, at the same list
price — $5 / $25 per MTok — so this is a capability upgrade at no cost, and on a
subscription no cost either way. It also halves the minimum cacheable prefix, which §5.4
depends on.

This assignment is a decision, not an optimisation, and §4.6 is unaffected: no per-agent
model tuning follows from it.

**Assumption flagged for confirmation:** `config/bridge.config.yaml:69` gives OpenClaw
`claude-haiku-4-5`. It is an executor rather than an orchestrator, so the directive's
"cheaper model everywhere else" arguably applies — but OpenClaw is a distinct runtime whose
model is configured outside this registry, and `agents/openclaw/` does not exist at all
(§9). Left unchanged here; resolve alongside the OpenClaw gap.

### 5.1 Solutions store

A curated store of resolved failures, kept separate from Hermes' `state.db` (which holds
raw transcripts).

**Storage:** `data/solutions.db` — SQLite with an FTS5 index. `data/` is already gitignored.

```sql
CREATE TABLE solutions (
  id            INTEGER PRIMARY KEY,
  theme_hash    TEXT NOT NULL,
  capability    TEXT NOT NULL,
  symptom       TEXT NOT NULL,   -- verbatim ERROR: from the STUCK block
  root_cause    TEXT NOT NULL,   -- verbatim HYPOTHESIS:, corrected on resolution
  fix           TEXT NOT NULL,
  files_touched TEXT NOT NULL,   -- JSON array
  verified_by   TEXT NOT NULL,   -- operation that proved the fix
  created_at    TEXT NOT NULL,
  hit_count     INTEGER NOT NULL DEFAULT 0,
  success_count INTEGER NOT NULL DEFAULT 0
);

CREATE VIRTUAL TABLE solutions_fts USING fts5(
  symptom, root_cause, fix, content='solutions', content_rowid='id'
);
```

`success_rate` is derived as `success_count / hit_count`, not stored, so it cannot drift
from its inputs. A freshly written solution has `hit_count = 0` and therefore no defined
rate; it is **provisional** and is returned regardless of the threshold, flagged as
unproven in the fenced block. Without this carve-out no solution could ever earn its first
hit and the store would stay permanently empty in effect.

**Write path.** When a `⛔ STUCK` is resolved and the fix passes verification, the resolving
agent writes one row. The STUCK block's four mandatory fields
([tools/setup.py](../../../tools/setup.py) `STANDING_CONSTRAINTS`) map directly:
`ERROR:` → `symptom`, `HYPOTHESIS:` → `root_cause` (corrected to the actual cause),
`RESOURCES:` → `files_touched`, `ATTEMPTED:` → discarded.

**Read path.** Before any retry, `solutions.find(symptom)` runs an FTS5 query ranked by
`bm25()`. Results are filtered to `success_rate >= solutions_min_success_rate` (0.5, the
existing config value). A hit is injected into the **user message** inside a
`<memory-context>` fence — never into the system prompt (see §5.4).

**Outcome recording.** `hit_count` increments on every returned row. `success_count`
increments only when the run that consumed the hit subsequently passes verification. A
solution that stops working therefore decays below the threshold on its own.

**Why FTS5 rather than the vector database Eean used.** An embedding store costs a model
call per write and per query, permanently. FTS5 costs zero tokens. Eean pre-authorised the
substitution at 39:19 by pointing at turnkey systems and at Hermes specifically. This is not
a contradiction of his recommendation but the cheaper implementation of it.

### 5.2 Event-driven ENRICH

Replace the fixed cadence with the trigger set Eean actually describes.

```yaml
documents:
  enrich_triggers:
    - sprint_start          # 41:59 "whenever you're starting a new sprint"
    - theme_resurface       # 30:15 "1, 2, 3 turns, and the problem resurfaces"
    - circling              # existing circularity_repeat_threshold: 3
    - staleness_ceiling     # hard cap; documents may not rot silently
  theme_resurface_turns: 3
  staleness_ceiling_loops: 5
  verify_claims_per_pass: 5     # unchanged
```

Removed: `enrich_every_n_loops: 1`, `staleness_warn_loops: 3`.

`staleness_ceiling_loops` replaces the warn-only setting with one that acts. Event-driven
must not degrade to never; if no trigger has fired in 5 loops, ENRICH runs regardless.

`theme_resurface` fires when the same `theme_hash` reappears within
`theme_resurface_turns` turns — the same hash the recovery path already computes for
circularity detection.

### 5.3 Context by reference, not by value

Tier 3's `context_policy: full` currently specifies `complete_cross_channel_task_history`.
Replace the assembled payload with:

| Pushed into context (costs tokens every run) | Available on demand (costs nothing unless used) |
|---|---|
| Task brief — written once per task, re-read per attempt | `session_search` handle over `state.db` |
| Prior attempts' STUCK blocks only | Full transcripts |
| Solutions-store hit, if any | — |

This implements *"You can just have it reread"* (28:30). The article confirms
`session_search` performs no LLM summarization, so granting the *ability* to look is free
whereas supplying the transcript is not.

Tier 2 `context_policy: discipline` currently specifies `own_channel_history` last 50
messages. Reduce to the task thread only, plus the same `session_search` handle.

### 5.4 Prompt-prefix cache stability

Three rules inherited from the article's stated rationale:

1. **The system prompt is entirely static.** It is exactly
   `soul + knowledge packs + skills index + standing constraints`, which
   [tools/setup.py](../../../tools/setup.py) already composes deterministically and hashes.
   This becomes a tested property rather than an emergent one.
2. **The task header goes in the user message.** The `[T### · loop N · stage=X]` header
   defined in [config/bridge.config.yaml](../../../config/bridge.config.yaml) must never
   enter the system prompt. One variable token there converts a cached read into a full
   cold read on every call.
3. **All recall is fenced.** Solutions hits and any other retrieved material go in
   `<memory-context>` blocks in the user message.

Knowledge packs `swarm-protocol` (7,661 B) and `vto-domain` (6,483 B) are loaded by all six
agents. They stay fully loaded per ADR-002, but must be emitted in a byte-identical order so
the shared prefix is cacheable.

Measured current system-prompt sizes, for regression reference:

| Agent | Soul | Knowledge | Composed |
|---|---|---|---|
| admin | 4,497 B | 6,393 B | ~2,947 tok |
| coder | 4,792 B | 8,451 B | ~3,535 tok |
| critic | 4,788 B | 8,451 B | ~3,534 tok |
| researcher | 4,946 B | 8,384 B | ~3,557 tok |

**Minimum cacheable prefix.** Anthropic's minimum is model-dependent and **not monotonic
across generations** — 512 tokens on `claude-opus-5`, 1024 on Opus 4.8, 2048 on Opus 4.7,
4096 on Opus 4.6 and Haiku 4.5. Below the minimum a prefix silently fails to cache: no
error, just `cache_creation_input_tokens: 0`. Two implications:

- Tier 1's move to `claude-opus-5` (§5.0) **halves** its minimum from 1024 to 512, so
  material that was previously too short to cache now caches with no code change.
- Never assume a prefix caches because it did on another model. §5.6's `cached_tokens`
  column is what settles it.

Cache economics, for the metered tiers: a read costs roughly **0.1×** the input price, a
write **1.25×** at the default 5-minute TTL or **2×** at one hour. The 5-minute TTL breaks
even at two requests; the 1-hour TTL needs three, so it only pays where traffic is bursty
enough that entries would otherwise expire between runs.

### 5.5 Hermes memory configuration

Set explicitly in each generated profile's `config.yaml` rather than relying on defaults.

```yaml
memory:
  memory_enabled: true
  user_profile_enabled: false
  memory_char_limit: 2200
  user_char_limit: 0
  provider: none
  nudge_interval: 9999
```

Rationale per key:

- `user_profile_enabled: false`, `user_char_limit: 0` — `USER.md` models an individual
  human's preferences. These agents have no human user; the file would be dead weight in
  every prompt.
- `provider: none` — keeps the system on layers 1 and 2, which have zero marginal model
  cost. Every external provider adds embedding and recall calls.
- `memory_enabled: true` with the default 2200-char limit — retained so an agent *can*
  record a durable fact, but it is not the primary mechanism. Durable engineering knowledge
  belongs in the solutions store (§5.1), which is queryable and decays; `MEMORY.md` is for
  the rare standing fact that must be in every prompt.
- `nudge_interval: 9999` — the default of 10 forks an entire background review agent every
  10 turns. That cadence suits long interactive sessions; these orchestrators run 1-3 turns
  per task and exit, so the fork is either never reached or spent reviewing a session about
  to be discarded.

  **Implementation must verify this value before committing to it.** The documented
  behaviour is *"when `turns_since_memory >= nudge_interval`, a background review is
  requested"*. Under that comparison `nudge_interval: 0` would fire on **every turn** — the
  exact opposite of the intent — so 0 must not be used as a disable value unless
  `hermes memory status` confirms it is treated as a sentinel. A large finite value is
  correct under either reading, which is why it is specified here.

This is written by `tools/setup.py` alongside the existing `model:` block, so it is
generated and drift-checked like everything else.

### 5.6 Measurement

Per-run accounting to `data/runs.db`:

```sql
CREATE TABLE runs (
  id                INTEGER PRIMARY KEY,
  task_id           TEXT NOT NULL,
  agent             TEXT NOT NULL,
  model             TEXT NOT NULL,
  prompt_tokens     INTEGER,
  completion_tokens INTEGER,
  cached_tokens     INTEGER,
  duration_ms       INTEGER,
  outcome           TEXT NOT NULL,   -- success | stuck | timeout | error
  started_at        TEXT NOT NULL
);
```

`cached_tokens` is the critical column: it is the only way to verify §5.4 is working rather
than assumed — a prefix that silently fails to cache is invisible in every other field.

**Two cost units, reported separately.** Because Tier 1 bills against a subscription quota
and Tiers 2–3 bill per token (§5.0), a single number would be meaningless:

| Tier | Unit | Reported as |
|---|---|---|
| 1 (Claude Code) | Quota per rolling window | Tokens and requests per window, against the plan's limit |
| 2–3 (OpenRouter, metered) | US dollars | Tokens × per-model rate |

On the subscription tier, cache hits are a **throughput** lever rather than a cost lever:
they buy more work inside the same quota. The same `cached_tokens` column serves both
readings.

`daily_cost_cap_usd: 50` in `config/swarm.config.yaml` is retired — it cannot govern the
subscription tier and was never enforced anywhere. Replace it with a per-unit pair:
`daily_cost_cap_usd` scoped to the metered tiers only, plus a quota-headroom warning
threshold for Tier 1.

## 6. Failure handling

Recall must never block a turn. The article's rule is that provider failures are logged at
debug or warning level and do not block the user-facing turn; the same applies here.

| Condition | Behaviour |
|---|---|
| `solutions.db` missing or corrupt | Log warning, proceed on the normal path |
| `solutions.find` returns nothing | Proceed on the normal path, no penalty |
| All hits below `solutions_min_success_rate` | Treated as no hit |
| No ENRICH trigger fires for 5 loops | `staleness_ceiling` forces a run |
| `runs.db` write fails | Log warning, never fail the run |

No failure in the memory tier may change the outcome of a task. It is an accelerator, not a
dependency.

## 7. Testing

Fills the twelve currently-empty `skills/*/test/` directories.

1. **Solutions replay harness.** Feed recorded STUCK events, assert the store returns the
   expected solution and that ranking respects `success_rate`.
2. **Decay test.** A solution whose consuming runs fail must fall below the threshold and
   stop being returned.
3. **Cache-stability test.** Compose each agent's prompt twice and assert byte-identical
   output. Assert no `[T` task header appears in any composed system prompt.
4. **Trigger test.** Assert ENRICH fires on each of the four triggers and does not fire
   otherwise.
5. **Degradation test.** Delete `solutions.db` mid-run; assert the task still completes.

## 8. Build order

Each step is independently valuable and independently revertible.

0. §5.0 model ID — `claude-opus-4-8` → `claude-opus-5` in `agents/claude/agent.yaml` and
   `config/bridge.config.yaml`. A two-line change that also halves Tier 1's cache minimum,
   so it precedes the cache work in step 2.
1. §5.5 Hermes memory config — smallest change, immediate saving, no new code.
2. §5.4 cache-stability rules and their tests — protects everything downstream.
3. §5.6 measurement — must precede the larger changes so their effect is observable.
4. §5.2 event-driven ENRICH — the largest single saving.
5. §5.1 solutions store — the largest turn saving, and the most new code.
6. §5.3 context by reference — depends on `session_search` being reachable from the bridge.

Step 6 has a hard external dependency: the Bridge does not yet exist. Steps 1-5 do not
depend on it.

## 9. Risks

| Risk | Mitigation |
|---|---|
| `nudge_interval` sentinel misread, forking a review every turn | §5.5 specifies a large finite value, correct under either reading; verified against `hermes memory status` in step 1 of §8 |
| Provisional solutions are reused before they are proven | Returned flagged as unproven; a single failed consuming run gives `success_rate = 0` and removes them |
| Event-driven ENRICH lets documents rot | `staleness_ceiling_loops: 5` forces a run |
| A wrong solution is confidently reused | `success_rate` decay; `verified_by` recorded; hits are advisory context, not directives |
| FTS5 recall is weaker than the vector search Eean used | Measured via `hit_count`/`success_count`; if recall proves inadequate the store schema is unchanged and an embedding index can be added beside it |
| Cache assumptions are provider-dependent | §5.6 `cached_tokens` measures rather than assumes |
| `nudge_interval: 0` loses a self-improvement mechanism | The solutions store replaces it with a cheaper, explicitly-triggered equivalent |

## 10. Open questions

None blocking. Three to settle during implementation:

- Whether OpenClaw's `claude-haiku-4-5` (`config/bridge.config.yaml:69`) should move to a
  cheaper model under the §5.0 directive. Flagged there; entangled with the missing
  `agents/openclaw/` registry entry, so resolve the two together.

- Whether `theme_hash` should be computed over the symptom text or the failing operation.
  The circularity detector already computes one; reuse whichever it uses.
- Whether the daily rollup posts to `swarm-incidents` or a new channel. Deferred to the
  Bridge work, since neither exists yet.

---

[[../../ADR/ADR-002-skills-architecture]] · [[../../PROGRESSIVE-DOCS]] · [[../../DRIFT-AND-CONSISTENCY]] · [[../../standards/fully-kitted]]
