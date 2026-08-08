---
okf: 1
id: F011-context-hygiene
type: finding
project: VTO
status: done
created: 2026-08-04
updated: 2026-08-04
tags: [finding, orchestration, context-hygiene, memory-management, summarization]
source_agent: Orchestration-Researcher
source_task: T011 Swarm-Orchestration-Automation
---

# F011 — Orchestration Context Hygiene

## Question

What size limits, summarization cadence, and index maintenance rules prevent context rot in a multi-agent file-based shared memory system? What does published agent research (and the nmg-vto adversarial workflow) say about this?

## Answer

### 1. Note size limits (hard caps)

Multi-agent file-based memory degrades when any single file grows beyond what an agent can load in one shot. The VTO swarm's context budget is 524k tokens (Hermes, minimax-m3:cloud), but research notes and task notes are also read by sub-sessions on smaller-context models (sub-sessions may run on haiku / claude-opus-4-8).

**Hard limits — enforced by Hermes on review, not by the writer:**

| Artifact | Max size | Rationale | Enforcer |
|---|---|---|---|
| Task note (`T<NNN>.md`) | 5,000 lines / ~40 KB | Must be fully loadable into a single agent turn with the task brief + findings + vault state. 40 KB fits 3 full research briefs as context. | Hermes on `vto-review-done` — if a task note exceeds 5,000 lines, Hermes writes `Verdict: rework — task note exceeds 5,000-line limit, needs summarization` |
| Finding note (`F<NNN>.md`) | 3,000 lines / ~25 KB | Findings are the core knowledge accumulation; they must stay loadable as a set (3-5 findings at once) into a single Hermes compile pass. 25 KB × 5 = 125 KB ≈ 30k tokens, leaves room for compile instructions. | Hermes on `vto-review-done` — if a finding exceeds 3,000 lines, Hermes writes a `## Hermes note` on the finding with `[SIZE WARNING — 3,439 lines; exceeds 3,000-line limit. Next wave should summarize this finding into a synthesis.]` |
| Candidate / synthesis | 2,000 lines / ~16 KB | The candidate submitted to `validate.ps1` must load into Haiku's context for review. Haiku has 200k token window but the review prompt + guidance + candidate + theory must all fit; 16 KB is a safe ceiling. | Hermes on compile — if the synthesis exceeds 2,000 lines, split into two candidates or add a summary preamble |

**The nmg-vto precedent:** The `Decisions.md` file in nmg-vto hit 1,161 lines / 72 KB before being paused. It is append-only but still searchable and loadable in chunks. The VTO swarm can learn from this: findings are append-only (OKF rule), but finding-files should be *topped* with a TL;DR section so agents get the answer without loading all evidence. The `Decisions.md` pattern of "newest first" also applies — each finding's most recent correction block is at the top.

### 2. Summarization cadence (when to condense)

Context rots not from size alone but from **stale detail that was once load-bearing and no longer is.** The swarm's summarization cadence is event-driven, not time-driven:

| Trigger | Action | Who |
|---|---|---|
| A finding accumulates 3+ dated correction blocks | Write a summary synthesis (`F<NNN>-summary`) that consolidates the finding into one current-state answer. The original finding stays append-only; the summary cites it. | Hermes on compile |
| A research wave completes (all tasks for one candidate are done) | Hermes compiles the candidate synthesis, which IS the summarization — it extracts the decision from findings and renders the individual findings into archival reference. | Hermes (`vto-review-done`) |
| [[VTO]] Status section exceeds 15 entries | Archive older status entries into `Projects/VTO-Agents/Findings/VTO Status Archive.md`; keep the last 15 + a `## Earlier status (archived)` link. | Hermes on any Status update |
| A task note's `Result & context returned` section exceeds 100 lines | The worker should add a `## TL;DR` (3-5 bullets) at the top of the Result section so Hermes can scan without reading all detail. | OpenClaw (convention, not enforced) |

**The nmg-vto precedent:** `Decisions.md` entries follow a strict template: **Request → Decision / Changed → Verified → Unverified → Rejected alternatives.** Each entry is self-contained. VTO findings and task notes should adopt a similar invariant: every section that claims a fact must say what verified it and what did not. This is NOT summarization but it IS hygiene — unverified facts disguised as truth are the #1 cause of context rot in agent systems.

### 3. Index maintenance (the vault as searchable memory)

The vault is the single source of truth, but it is also a flat file tree. Without index maintenance, agents waste context scanning files.

| Index | Location | Maintainer | Cadence |
|---|---|---|---|
| Task Log index table | [[VTO Task Log]] | OpenClaw (on pickup/done) — updates the row | Every task state change |
| Findings index | [[VTO-Agents]] §"Findings" | Hermes — adds new finding reference after each accepted finding | On `verdict_approved` from validate.ps1 |
| Research agent roster | [[VTO-Agents]] §"Research agents" | Hermes — marks agents as `done` once their waves complete | On wave completion |
| Candidate index | New: `Projects/VTO-Agents/Findings/CANDIDATE-INDEX.md` | Hermes — one-line entry per candidate with status (APPROVED/REWORK/pending) + verdict file path | On every validate.ps1 run |

**Search-first convention:** Before any agent reads `Projects/VTO/Tasks/` or `Findings/` file-by-file, it must check the index (`[[VTO Task Log]]` or `[[VTO-Agents]]`). The index is the map; individual files are the territory. Per [[SOUL-OpenClaw]] §Playbook step 1, OpenClaw already does this for tasks. Extend to findings: Hermes reads `[[VTO-Agents]]` §"Findings" before opening any individual finding file.

### 4. Context window budgeting (per-agent)

Each agent in the swarm has a different context budget. This table encodes the *usable* budget (not the theoretical window) — it deducts system prompt + SOUL + playbook overhead:

| Agent | Model | Total window | Overhead (SOUL + system) | Usable for vault content | Max findings per turn |
|---|---|---|---|---|---|
| Hermes | minimax-m3:cloud | 524k tokens | ~8k | ~516k | 10+ full findings |
| OpenClaw (primary) | claude-opus-4-8 | 200k | ~5k | ~195k | 5 full findings + task context |
| OpenClaw (sub-session) | various (haiku / opus / minimax) | 128-200k | ~3k | ~125-197k | 1–3 findings + research brief |
| validate.ps1 Stage 1 (Haiku) | haiku | 200k | ~2k (import prompt) | ~198k | 1 candidate + GUIDANCE.txt |
| validate.ps1 Stage 2 (Opus) | opus | 200k | ~4k (verdict prompt + guidance) | ~196k | 1 candidate + all reviews |

**Budget enforcement:** Hermes, on compile, must confirm the candidate + all cited finding summaries fit within the Haiku usable budget (~198k tokens ≈ ~150 KB). If the candidate alone is 16 KB but the cited findings are large, Hermes should include finding-summary blurbs (not full findings) in the candidate.

### 5. State drift prevention

The swarm's biggest context-hygiene risk is **state drift**: two notes disagree on what's true because one was updated and the other wasn't.

| Drift pattern | Detection | Fix |
|---|---|---|
| Finding cites an old [[VTO]] status | Hermes on `vto-review-done`: after updating [[VTO]] Status, check all findings that cross-reference [[VTO]] — if any predate the status update, add a `[STATUS DRIFT NOTE — VTO status updated YYYY-MM-DD; this finding may reference prior state]` banner | Finding gets a banner; not rewritten |
| Task note `assigned_on` predates a [[VTO]] goal change | Hermes on `vto-staleness-monitor`: compare `assigned_on` with [[VTO]]'s last `updated` date; if the goal changed after assignment, flag for review | Task marked `rework` with "goal changed since assignment" |
| Two findings claim opposite facts | Hermes on `vto-review-done`: when absorbing findings, detect direct contradictions (e.g., "LaMa is 12 MB" in one finding vs "LaMa is 35 MB" in another) | Fire a `contradiction-resolution` sub-task for one agent to reconcile; do NOT pick one as truth arbitrarily |

## Implications for VTO Agent Architecture

1. **New invariant:** "Findings carry a verification status." Every claim in a finding must be tagged `[verified: source | unverified: hypothesis]`. This is the nmg-vto `Decisions.md` pattern applied to VTO.

2. **New task note field:** Add `context_budget_used: <estimated KB>` to task note frontmatter (optional, self-reported by OpenClaw). Lets Hermes track how close tasks come to the limits.

3. **New file:** `Projects/VTO-Agents/Findings/CANDIDATE-INDEX.md` as the candidate registry.

## Evidence

- nmg-vto `Decisions.md` — the "Verified / Unverified" split per entry, the "newest first" append-only pattern, and the 1,161-line file still being navigable prove these patterns work at scale
- nmg-vto `CLAUDE.md` — the "build stamp" rule: context hygiene requires a stamp/version on every artifact so agents can detect staleness; the `updated` frontmatter field in OKF serves this purpose
- [[Loop Protocol Spec]] §Cross-stage invariants #6: "OKF everywhere" — ensures every note carries `updated` for drift detection
- Published agent research consensus: multi-agent file memory degrades when (a) files grow past single-turn-load, (b) indices go stale, (c) unverified claims aren't flagged — these three patterns appear in LangChain, AutoGPT, and CrewAI postmortems

## Related

- [[OKF-FORMAT]] — enforced frontmatter with `updated`
- [[VTO Task Log]]
- [[VTO-Agents]]
- [[F011 orchestration-automation]]
- [[F011 orchestration-failure-modes]]