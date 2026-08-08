---
okf: 1
id: F011-failure-modes
type: finding
project: VTO
status: done
created: 2026-08-04
updated: 2026-08-04
tags: [finding, orchestration, failure-modes, resilience, dedup, staleness, handoff]
source_agent: Orchestration-Researcher
source_task: T011 Swarm-Orchestration-Automation
---

# F011 — Orchestration Failure Modes: Detection + Recovery

## Question

What failure modes threaten a self-driving Hermes↔OpenClaw swarm beyond the individual task failures already catalogued in [[Loop Protocol Spec]], and what are the detection + recovery protocols for dedup, staleness, lost handoffs, and other swarm-level failures?

## Answer

### Failure mode catalog

The [[Loop Protocol Spec]] §Stages 1-4 already catalogues per-stage failure modes (e.g., "Two parallel Hermes-spawns assign the same T###", "Worker silently scope-creeps"). This finding covers **swarm-level failures** — failures that emerge from the interaction between agents, not from any single agent's execution.

---

### FM-1: Duplicate research (dedup failure)

**What:** Two or more agents research the same question independently, producing redundant or contradictory findings. This is the #1 waste vector in multi-agent research swarms.

**Why it happens in this swarm:**
- Hermes assigns overlapping research missions (e.g., FittingBox-Researcher and Competitor-Researcher both scrape competitor pricing)
- A task is marked `rework` and re-assigned, but the original sub-session had already started (race condition)
- A finding is written but not yet indexed in [[VTO-Agents]], so a new agent doesn't know it exists

**Detection:**

| Signal | Check | Who |
|---|---|---|
| Two task notes have identical or overlapping Goal text | `grep -l "FittingBox" Projects/VTO/Tasks/T*.md` → if >1 result, check if goals overlap | Hermes on `vto-review-done` before assigning |
| Two findings have >70% keyword overlap in their Question section | Compare new finding's Question against all existing findings' Questions (simple Jaccard on keywords) | Hermes on `vto-review-done` when absorbing |
| A finding's `source_agent` is `assigned` to a task that is still `in-progress` | The agent brief path is in both a `status: assigned`/`in-progress` task AND a `status: done` task's Context | Hermes scans task notes for duplicate agent assignments |

**Recovery:**

```
IF duplicate detected BEFORE execution:
  → Cancel the newer task (set status: cancelled, note "Duplicate of T<NNN>")
  → Add a note to the surviving task: "Also covers scope of cancelled T<NNN>"

IF duplicate detected AFTER both findings exist:
  → Do NOT discard either. Hermes reads both.
  → If they agree: merge into one finding (keep both as append-only; add a cross-reference)
  → If they disagree: this is now a CONTRADICTION (escalate to contradiction-resolution sub-task)
  → Record the duplication in REFUTED-CLAIMS.md: "Research on <topic> was duplicated in F<X> and F<Y>; resolved <date>"
```

**Prevention:**
- Hermes MUST scan [[VTO Task Log]] and [[VTO-Agents]] §"Findings" before assigning any new research task
- Task notes MUST cite the specific research agent brief they implement — two tasks citing the same brief file = flagged
- The `status: cancelled` state (currently unused) becomes a de-duplication marker

---

### FM-2: Stale claims (temporal drift)

**What:** A finding claims something that was true when written but is no longer true (e.g., "Fittingbox bundle is 79 KB shell + 12 MB deferred" — but Fittingbox updated their app).

**Why it happens in this swarm:**
- Findings are append-only (OKF rule) — corrections are additive, but the original claim still reads as truth
- No time-based expiration on findings
- Sub-sessions don't know a prior finding has been superseded

**Detection:**

| Signal | Check | Cadence |
|---|---|---|
| Finding `updated` date > 30 days old AND was cited in a candidate | Flag for freshness review before citing in new candidate | Every compile (pre-validate.ps1) |
| Finding claims "X uses approach Y" about an external system | Re-verify against live source if finding > 14 days old | On candidate compile, or on `-Depth deep` |
| [[VTO]] goal or constraints changed (e.g., D2 pivot superseded D1) | All findings created before the pivot date are flagged: "⚠ This finding was written under D1 constraints (pre-2026-08-04 pivot); may not apply under D2" | Hermes on `vto-review-done` — compare finding `created` date against [[VTO]] §Decisions dates |

**Recovery:**

```
IF finding is stale AND cited in an upcoming candidate:
  → Hermes adds a banner to the finding: "[STALE — last updated <date>; needs refresh before citing in new candidate]"
  → Assign a quick refresh task: "Re-verify <specific claim> against current source; update finding with dated correction block"
  → If the refreshed claim contradicts the original: add correction block, do NOT silently rewrite

IF finding is stale AND NOT cited anywhere:
  → Add banner: "[ARCHIVAL — not cited in any active candidate; retained for history]"
  → Do NOT delete — append-only rule applies
```

**Prevention:**
- Every finding that cites an external source must include the date it was checked: `[verified: URL, checked 2026-08-04]`
- The `vto-staleness-monitor` cron (from [[F011 orchestration-automation]]) extends to flag findings > 30 days old
- Candidate compile step: Hermes checks `updated` dates of all cited findings; if any is > 30 days, flags it

---

### FM-3: Lost handoffs (context discontinuity)

**What:** Information produced by one agent (usually OpenClaw or a sub-session) never reaches the next agent (usually Hermes), breaking the loop. A task appears "done" but the knowledge never propagated.

**Why it happens in this swarm:**
- Worker marks task `done` but forgets to fill `Result & context returned` (already catalogued in [[Loop Protocol Spec]] §Stage 3 failure modes)
- Sub-session writes a finding file but the parent session doesn't cite it in the task note
- Finding file exists on disk but isn't tracked in [[VTO-Agents]] index (orphan finding)
- Worker writes to a wrong path (typo in file path) — the content exists but nothing links to it
- Hermes's cron fires, reads a task note, compiles a candidate — but a sub-session finding arrived between the status flip and the compile (race)

**Detection:**

| Signal | Check | Who |
|---|---|---|
| Task note `status: done` but `Result & context returned` is empty or has <3 of 5 bullets filled | Count non-empty bullets in Result section | Hermes on `vto-review-done` — forces `rework` |
| Task note cites "F<NNN>" but that file doesn't exist at the cited path | `test -f` the cited path; if missing, check `Findings/` for any file with matching topic | Hermes on review — flags as "missing artifact" |
| A `.md` file exists in `Findings/` with OKF frontmatter but no row in [[VTO-Agents]] §Findings | Compare `ls Findings/F*.md` against index entries | Hermes on `vto-review-done` — adds orphan to index with note "[ORPHAN — found on disk, not linked from any task; added to index YYYY-MM-DD]" |
| Task note `status: done` but the kanban card is still in `running` (desync) | Compare task note status against kanban card status | Dispatcher watchdog — if desync persists > 2 cron cycles, flag for human |

**Recovery:**

```
IF Result section is incomplete:
  → Hermes writes verdict: "rework — fill all 5 bullets of Result & context returned"
  → Task re-enters the loop as `status: rework`, OpenClaw's next poll picks it up

IF cited finding file is missing:
  → Hermes searches `Findings/` for partial matches (topic keywords, source_agent name)
  → If found at wrong path: add a redirect note on the task note, fix the citation
  → If genuinely missing: mark task `rework` with "finding F<NNN> not found — re-execute or confirm it was never written"

IF orphan finding found:
  → Hermes adds to [[VTO-Agents]] index
  → Scans all `status: done` task notes for any that SHOULD have cited it (matching agent/research question)
  → If found: adds cross-reference to the task note's Result section
  → If no matching task: label "[ORPHAN — no originating task found; contents unverified]"

IF kanban-vault desync:
  → The dispatcher (kanban_db.py) already handles stale locks (§4.1 retry rules)
  → If desync persists (card stuck in `running` > 2 cycles while vault says `done`): escalate to `blocked (needs_input)`
```

**Prevention:**
- Add a "handoff checklist" to [[SOUL-OpenClaw]]: before marking `done`, confirm (1) all 5 bullets filled, (2) all cited file paths exist, (3) [[VTO Task Log]] row updated
- Add a "handoff verification" to Hermes's `vto-review-done`: before absorbing, confirm cited findings exist on disk
- The `vto-staleness-monitor` catches tasks that are `done` but with incomplete results (already in FM-1)

---

### FM-4: Concurrent write conflicts

**What:** Two agents write to the same file simultaneously (e.g., Hermes updates [[VTO]] Status while a sub-session appends to a finding Hermes is reading).

**Why it happens:** The vault is a flat filesystem. No file locking. Agents run asynchronously.

**Detection:** Hard to detect programmatically. Symptoms include:
- File appears truncated (one write overwrote another)
- Frontmatter has mismatched fields (two writers merged incompletely)
- A finding has a correction block that doesn't match any known review

**Recovery:**
```
IF file appears corrupted:
  → Hermes checks git history: `git -C "C:\Users\ankur.singh\Obsidian Vault" log --oneline -5 -- <file>`
  → Restore from last known good commit
  → Re-apply any lost changes from session logs (session_search for the lost work)
```

**Prevention (the real answer):**
- **Hermes is the ONLY agent that mutates [[VTO]], [[VTO Task Log]], and [[VTO-Agents]] index.** OpenClaw and sub-sessions ONLY write task notes and finding files — never the hub/index files.
- Task notes: only ONE worker touches a task note at a time (assigned to one worker). No concurrent write.
- Finding files: ONLY the sub-session that created them writes to them. Once `status: done`, only Hermes appends correction blocks.
- This is a **write-partitioning discipline**, not a technical lock. The current architecture already mostly enforces it; formalize it as an invariant.

---

### FM-5: Cron collision (double-fire)

**What:** A cron job fires while its previous invocation is still running, causing two instances of the same review/execute cycle.

**Why it happens:** `*/5 * * * *` fires every 5 minutes on the minute. If a task takes >5 min (e.g., a heavy research mission), the next tick fires while the first is still executing.

**Detection:** Two task notes with the same worker flipping `in-progress` within the same window.

**Recovery:**
- OpenClaw's idempotency guard: the cron prompt picks the LOWEST-NUMBERED `status: assigned` task. If the prior cron fire already picked up T005 (now `in-progress`), the new fire skips to T006 — no collision on the same task.
- Hermes's idempotency guard: the cron prompt reviews only notes with `status: done` AND empty Review section. If Hermes #1 already reviewed T005, Hermes #2 sees the Review section is filled and skips it.

**Prevention:**
- The prompt-level idempotency guards ARE the prevention
- If double-fire becomes frequent (tasks consistently >5 min for OpenClaw), increase the interval to 10 min or add a lock-file check before execution

---

### FM-6: Swarm silence (all agents idle, no tasks flowing)

**What:** The swarm stops. No tasks are `assigned`, no tasks are `in-progress`, no tasks are `done` with pending review. Days pass. The project stalls silently.

**Why it happens:**
- Hermes's `vto-review-done` runs, finds nothing to review AND nothing to assign → reports "swarm idle" and exits
- But "nothing to assign" might be wrong: there ARE research agents still unassigned, just not the ones Hermes thinks are next
- Or the goal in [[VTO]] is complete enough that Hermes considers the project done, but Rohit hasn't confirmed

**Detection:**
```
IF swarm has been idle for > 2 consecutive Hermes cron cycles (> 20 min):
  → The vto-staleness-monitor (every 2h) catches this anyway
  → For faster detection: add a "swarm heartbeat" counter — if 0 tasks changed state in the last 3 Hermes cycles, flag

IF swarm has been idle for > 24h:
  → Hermes's cron appends a note to [[VTO]]: "[SWARM IDLE — no task state changes in 24h. Last activity: <date>. Check if project is stalled.]"
```

**Recovery:**
```
IF swarm idle < 24h:
  → Hermes does a full re-scan: re-read [[VTO]] goal + all research agent briefs + all findings
  → If any research agent is unassigned and its question is still relevant: ASSIGN IT
  → If all research agents are done: shift to build tasks, or mark project phase complete

IF swarm idle > 24h:
  → Escalate to human: post a kanban comment on the vto board: "[SWARM IDLE — no activity in 24h. Manual trigger: 'review VTO and assign next tasks']"
  → The swarm stays in idle until human intervention
```

**Prevention:**
- Hermes's `vto-review-done` prompt MUST include: "If no done tasks AND no unassigned agents, do a full audit: list every research agent, its status, and whether its questions have been answered. If ANY agent's questions are unanswered and relevant, assign it."
- A "swarm idle for N cycles" counter in the cron output prevents silent stalls

---

## Failure mode summary matrix

| ID | Failure | Severity | Detection lag | Auto-recoverable? | Human needed? |
|---|---|---|---|---|---|
| FM-1 | Duplicate research | MEDIUM | 1-2 review cycles (10-20 min) | Yes — cancel dup, merge findings | Only if contradiction |
| FM-2 | Stale claims | LOW (slow decay) | 30 days (or on compile flag) | Partially — banner + flag; needs refresh task | Only if refreshed claim changes a decision |
| FM-3 | Lost handoffs | HIGH | Next review cycle (10 min) | Partially — Hermes can re-queue; but lost finding = lost work | If finding genuinely missing |
| FM-4 | Concurrent writes | LOW (rare, partitioned) | On next read (symptoms) | Partially — git restore | If corruption is severe |
| FM-5 | Cron collision | LOW (guarded) | Next cycle (5-10 min) | Yes — idempotency guards in prompts | No |
| FM-6 | Swarm silence | HIGH | 20 min to 24h | Partial — auto re-scan; 24h+ needs human | After 24h |

## Implications for VTO Agent Architecture

1. **New invariant:** "Write-partitioning discipline." Hermes exclusively owns [[VTO]], [[VTO Task Log]], [[VTO-Agents]] index. Workers own their task notes and findings. No file is writable by two different agents. Add to [[VTO Agent Architecture]] §Ground rules.

2. **New status:** `cancelled` — formalized as a de-duplication marker (currently unused in the vault frontmatter, though it exists in concept).

3. **New file:** `REFUTED-CLAIMS.md` covers dedup and contradiction resolution tracking.

4. **Enhancement to `vto-staleness-monitor`:** extends from task staleness to finding staleness (> 30 days) and swarm silence detection.

## Evidence

- nmg-vto `Decisions.md` — the "build stamp" lesson: multiple rounds lost to stale bundles that were assumed current. Same applies to findings — a finding read without checking its `updated` date may be stale.
- nmg-vto `Decisions.md` §2026-07-31 — "adversarial review round 2: 6 confirmed defect clusters, all fixed. Refuted (recorded): 3 claims" — this IS dedup + refutation in practice: the same bug reported twice would have been caught as duplicate
- [[Loop Protocol Spec]] §Stages 1-4 — existing per-stage failure modes that this document extends to swarm-level
- [[Loop State Machine]] §4 — retry rules and attempt caps that already handle some of these (watchdog_timeout, rework loops)

## Related

- [[Loop Protocol Spec]]
- [[Loop State Machine]]
- [[VTO Agent Architecture]]
- [[F011 orchestration-automation]]
- [[F011 orchestration-adversarial-review]]
- [[F011 orchestration-context-hygiene]]