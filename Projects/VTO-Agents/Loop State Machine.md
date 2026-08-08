---
okf: 1
id: loop-state-machine
type: protocol
project: VTO
status: draft
created: 2026-08-04
updated: 2026-08-04
tags: [loop, state-machine, contract, automation, design]
---

# VTO Loop State Machine & Automation Contract

This is the **bindine|working)task card** spec that connects
the four manual stages in [[Loop Protocol Spec]] to the kanban dispatcher's
state model. It is what an implementer writes code against.

The loop today is **two state models layered on top of each other**:

1. **Kanban dispatcher states** — what `~/.hermes/kanban.db` knows about a card.
2. **Vault task-note states** — what `Projects/VTO/Tasks/T<NNN>.md` carries
   (the manual protocol's frontmatter).

Both must move together. The contract below names the join.

> **Status of this doc:** *draft* — not yet wired in. The parent task
> [[Loop Protocol Spec]] is the source of truth for inputs/outputs; this
> doc is the source of truth for the *transitions* between those stages.

---

## 1. Two layered state models

### 1a. Kanban card states (the dispatcher's view)

`kanban_db.py` already defines `VALID_STATUSES = {"triage", "todo", "scheduled",
"ready", "running", "blocked", "review", "done", "archived"}`. The VTO loop
uses a strict subset:

```
triage → todo → ready → running → review → done
                ↑         ↓           ↓
                └── (rework re-queue)  blocked
                          ↓
                       (crashed / timed_out / failed)
```

- **triage** — orchestrator (Hermes or a specifier) fleshes the body before dispatch. Optional.
- **todo** — body complete; waiting on parents (gate-driven via `parents=[…]`); auto-promotes to `ready` when all parents `done`.
- **ready** — eligible for the dispatcher to claim.
- **running** — a worker session owns the lock; in flight.
- **review** — worker returned a result; awaiting verdict (validate.ps1 or orchestrator review). *Transient.*
- **done** — accepted. May still be cited as a parent of children.
- **blocked** — genuine human-blocker (`needs_input` / `capability`). Sticks across unblock; loop breaker escalates after N re-blocks for the same reason.
- **archived** — terminal; kept for history.

### 1b. Vault task-note states (the manual protocol's view)

`Projects/VTO/Tasks/T<NNN> <name>.md` frontmatter:

```
status: assigned | in-progress | done | rework
```

Plus the **Review** verdict written by Hermes after Stage 4:

```
Review.verdict: done | rework
Review.verdict_file: <path to validation-reports/*.verdict.md>   # when validate.ps1 was used
Review.attempt: <int>           # 1-indexed; bumped on each re-loop
```

### 1c. The join

| Vault task-note | Mapsto | Kanban card |
|---|---|---|
| (none yet) | → | `triage` → `todo` |
| `assigned` | → | `ready` |
| `in-progress` | → | `running` |
| (worker returned, awaiting verdict) | → | `review` |
| `done` (with `Review.verdict: done`) | → | `done` |
| `rework` (with numbered rework list in Definition of done) | → | `ready` (new `T<NNN+1>` task is created with the rework list) |
| Worker stuck, asked Hermes a question | → | `blocked` (`needs_input`) |
| Tool missing / no access | → | `blocked` (`capability`) |
| Worker timeout / crash / no heartbeat | → | `ready` (reclaimed by dispatcher) or `archived` after N attempts |

**Invariant:** the vault task-note status is **always one step behind** the kanban card status, because the kanban card status reflects *who is acting now* and the vault reflects *what the work has produced*. The dispatcher reads the vault as ground truth; the kanban card is the worker's lifecycle log.

---

## 2. State machine — VTO card transitions

States are the kanban states (uppercase). Events are lowercase names that
the dispatcher / orchestrator / worker / validate.ps1 may emit.

```
                    ┌──────────┐
        specifier   │  triage  │
       fleshes body └────┬─────┘
                         │ specifier_ready
                         ▼
                    ┌──────────┐
        parents     │   todo   │   ← may stay here if `parents=[…]` not done
       not done  →  └────┬─────┘
                         │ parents_done    (auto by dispatcher)
                         ▼
                    ┌──────────┐
   dispatcher tick │  ready   │
   picks eligible  └────┬─────┘
                         │ claim            (worker.session_id assigned, lock acquired)
                         ▼
                    ┌──────────┐
   worker in flight │ running │──────────┐
                    └────┬─────┘          │
              heartbeat  │                │
              (every     │                │   watchdog
              ~15 min)   │                │   heartbeat_timeout
                         │                │   (no heartbeat > 1 h after
                         │                │    kanban_heartbeat stale window)
                         │                ▼
                         │           ┌──────────┐
                         │           │  ready   │   (re-queued, no failure tick)
                         │           └──────────┘
                         │
                         │ worker_return          (kanban_complete or worker exit)
                         │   payload = {summary, metadata, result, artifacts, created_cards}
                         ▼
                    ┌──────────┐
   verdict needed  │  review  │
                    └────┬─────┘
                         │
            ┌────────────┴───────────────┐
            │                             │
   verdict_approved                 verdict_rework
            │                             │
            ▼                             ▼
       ┌──────────┐              ┌──────────────┐
       │   done   │              │ create new   │
       └──────────┘              │ T<NNN+1>     │
                                 │ with rework  │
                                 │ Definition   │
                                 │   of done    │
                                 └──────┬───────┘
                                        │ specifier_ready
                                        ▼
                                    ┌──────┐
                                    │ todo │ (or ready if no parents)
                                    └──────┘

       ┌──────────┐
       │ blocked  │   ← kanban_block(kind in {needs_input, capability})
       └────┬─────┘
            │   unblock (human) or
            │   same-reason-loop-break (after N re-blocks → archived)
            ▼
        either `ready` (unblocked) or `archived` (escalated)
```

### Event → transition table (authoritative)

| From | Event | To | Emitted by | Payload carries |
|---|---|---|---|---|
| `triage` | `specifier_ready` | `todo` / `ready` | specifier (Hermes or a profile) | full body, assignee, parents |
| `todo` | `parents_done` | `ready` | dispatcher | parent task ids that flipped to `done` |
| `ready` | `claim` | `running` | dispatcher tick | `session_id`, `lock`, `expires_at` |
| `running` | `heartbeat` | `running` | worker | `note` (progress) |
| `running` | `worker_return` | `review` | worker on exit | `summary`, `metadata`, `result`, `artifacts`, `created_cards` |
| `review` | `verdict_approved` | `done` | orchestrator (Hermes) OR `validate.ps1` exit-0 reader | verdict file path |
| `review` | `verdict_rework` | `ready` (new sibling) | orchestrator (Hermes) | new `T<NNN+1>` task id + parent link |
| `running` | `worker_block(kind=needs_input)` | `blocked` | worker (`kanban_block`) | `reason` |
| `running` | `worker_block(kind=capability)` | `blocked` | worker (`kanban_block`) | `reason` |
| `running` | `worker_block(kind=dependency)` | `todo` | worker (`kanban_block`) | parent task id it depends on |
| `running` | `worker_block(kind=transient)` | `ready` | worker (`kanban_block`) | retry hint |
| `running` | `watchdog_timeout` | `ready` | dispatcher watchdog | `attempt` bumped, no failure tick |
| `running` | `worker_crash` (exit signal) | `ready` (retry) or `archived` (≥N attempts) | dispatcher | exit signal, attempt count |
| `blocked` | `unblock` (human) | `ready` | human via board UI | `reason` update + same_reasons counter |
| `blocked` | `same_reason_loop_break` (≥3 re-blocks for same reason) | `archived` | dispatcher / unblock-loop breaker | escalated, surfaces to operator |

The same-reason counter has the existing semantics per `kanban_db.py` — preserved here intentionally; do NOT change without testing.

---

## 3. The exact JSON / message payloads

All payloads live where the relevant actor can emit them. Every payload is
**JSON-serializable** and **durable on the kanban card** (`runs[*].metadata`,
`comments[*].body`, or a frozen `inbox/<stamp>.verdict.md` on disk).

### 3.1 Dispatcher → worker  (`claim`)

Carried in `runs.lock_expires_at`, the `worker_context` block on
`kanban_show`, and the system prompt the worker session is spawned with.

```json
{
  "task_id": "t_f4abce12",
  "card": {
    "id": "t_f4abce12",
    "title": "Design automated VTO loop state machine and contract",
    "body": "<full VTO task-note body — see 3.2>",
    "parents": ["t_aeefb127"],
    "assignee": "default"
  },
  "worker_context": {
    "vault_root": "C:\\Users\\ankur.singh\\Obsidian Vault",
    "task_note_path": "Projects/VTO/Tasks/T<NNN> <short-name>.md",
    "task_note_status_init": "assigned",
    "workspace_kind": "scratch",
    "workspace_path": "C:\\…\\workspaces\\t_f4abce12",
    "max_runtime_seconds": 14400,
    "stale_timeout_seconds": 14400
  },
  "bootstrap": {
    "protocol_doc": "Projects/VTO-Agents/Loop Protocol Spec.md",
    "soul_doc": "Projects/VTO-Agents/SOUL-Hermes.md",
    "validate_script": "C:\\Users\\ankur.singh\\catalyst-env\\vto\\validate.ps1",
    "claude_cli": "C:\\Users\\ankur.singh\\.local\\bin\\claude.exe"
  },
  "retry": {
    "attempt": 1,
    "previous_runs": [],
    "carry_forward": null
  }
}
```

`retry.attempt` is `1` for a fresh `claim`. On rework it is incremented and
`carry_forward` is populated (see 3.7).

### 3.2 Hermes → worker: the task-note body (`assigned` payload)

The task-note body is the *real* spec — Section 4 of [[Loop Protocol Spec]]
applies. JSON-shaped view (the actual artifact is the markdown note):

```json
{
  "task_id": "T<NNN>",
  "project": "VTO",
  "status": "assigned",
  "assigned_by": "Hermes",
  "assigned_on": "2026-08-04",
  "worker": "OpenClaw",
  "goal": "<one clear outcome>",
  "context": {
    "vault_root": "C:\\Users\\ankur.singh\\Obsidian Vault",
    "task_log": "Projects/VTO/VTO Task Log.md",
    "related_task_notes": ["T<NNN-1>"],
    "research_brief_path": "Projects/VTO-Agents/Research Agents/<file>.md",
    "findings_dir": "Projects/VTO-Agents/Findings/"
  },
  "definition_of_done": [
    "<verifiable check 1>",
    "<verifiable check 2>"
  ],
  "result_section_template": {
    "what_was_done": "",
    "artifacts_paths": [],
    "decisions_made": "",
    "problems_open_questions": "",
    "what_hermes_should_know": ""
  }
}
```

The worker mutates only `result_section_template.*` and the top-level
`status`. Everything else is Hermes's contract.

### 3.3 Worker → dispatcher: `worker_return` (`kanban_complete` payload)

The shape `kanban_complete` already accepts — codified here as the contract:

```json
{
  "task_id": "t_f4abce12",
  "outcome_required": true,
  "summary": "1–3 sentences naming concrete artifacts. Human-readable.",
  "metadata": {
    "changed_files": ["abs\\paths\\..md"],
    "tests_run": 0,
    "decisions": ["..."],
    "findings": ["F<NNN>"],
    "task_note_status_after": "done | rework",
    "result_filled_bullets": 5,
    "attempt": 1
  },
  "result": "Short status line (legacy, same as summary).",
  "created_cards": ["t_child_xxx"],
  "artifacts": ["C:\\…\\file.md"]
}
```

If the worker is mid-flight and has to stop early, `kanban_block(reason=…)`
is used **instead** (no `complete`). That is the only way to surface
`needs_input` / `capability` / `dependency` / `transient`.

### 3.4 Worker → kanban: `heartbeat`

```json
{
  "task_id": "t_f4abce12",
  "ts": 1785828695,
  "note": "Imported Loop Protocol Spec, drafted state diagram; 2 of 4 sections done."
}
```

The dispatcher calls no tool on heartbeat — it just records it. If the
dispatcher sees no heartbeat for `stale_timeout_seconds` and no terminal
event, it transitions `running → ready` (re-queue) and bumps `attempt`. **No
failure counter tick** by design.

### 3.5 Worker → orchestrator: ready-for-review handoff

Same as 3.3 but with `task_note_status_after: "done"` plus a **Review packet**:

```json
{
  "task_id": "t_f4abce12",
  "review_packet": {
    "candidate_for_validation": "Projects/VTO-Agents/Findings/F<NNN>.md",
    "candidate_kind": "finding | synthesis | decision-draft | code-deliverable",
    "suggested_depth": "standard | deep",
    "why": "single finding → standard. multi-finding synthesis → deep. go/no-go → deep."
  }
}
```

### 3.6 Orchestrator (Hermes) → validate.ps1

The gate receives a single CLI invocation. The PowerShell script is the
authoritative caller; the JSON below is *what Hermes (or an automation
shim) must record when invoking it* so the run is reproducible:

```json
{
  "candidate_path": "C:\\…\\Findings\\F<NNN>.md",
  "depth": "standard | deep",
  "review_model": "haiku",
  "verdict_model": "opus",
  "expect": {
    "frozen_copy": "C:\\Users\\ankur.singh\\catalyst-env\\vto\\inbox\\<stamp>-<name>.md",
    "verdict_file": "C:\\Users\\ankur.singh\\catalyst-env\\vto\\validation-reports\\<stamp>-<name>.verdict.md",
    "exit_codes": {"0": "APPROVED", "2": "REWORK", "1": "pipeline error"}
  }
}
```

Output of the gate — the verdict file Hermes / automation reads:

```json
{
  "schema": "# Validation Verdict — <name>",
  "verdict": "APPROVED | REWORK",
  "theory_id": "T_20260804_002836_60ee5b",
  "review_ids": ["R_…", "R_…"],
  "basis": "<3–8 bullets of upheld/overruled findings>",
  "rework_instructions": [
    {"n": 1, "what": "...", "where": "...", "acceptance": "..."}
  ]
}
```

### 3.7 Orchestrator (Hermes) → dispatcher: rework re-loop (`verdict_rework`)

This is the rework handoff. The dispatcher records it as a transition
event + creates a new task card (or links an existing one) with the rework
list as its Definition of done.

```json
{
  "task_id_parent": "t_<original>",
  "verdict_file": "C:\\…\\validation-reports\\<stamp>-<name>.verdict.md",
  "verdict": "REWORK",
  "rework_items": [
    {"n": 1, "what": "...", "where": "...", "acceptance": "..."}
  ],
  "new_task_card": {
    "title": "T<NNN+1> <short> — rework",
    "assignee": "default",
    "parents": ["t_<original>"],
    "body": "<<Definition of done> = the verbatim numbered rework list, one bullet per item, acceptance as its sub-bullet; <Context> links the verdict file + prior T<NNN> note + findings>>"
  }
}
```

`retry.attempt` on the **new** card starts at `1`, but the workflow keeps
a `carry_forward` chain so a third re-loop is tracked. See §5.

---

## 4. Retry rules

Retries live on **two** counters and they are not the same thing:

| Counter | Where | When bumped | What it gates |
|---|---|---|---|
| `attempt` | `kanban.runs[*].attempt` and on the new task card's `metadata.retry.attempt` | Every time a NEW task card is created from a rework verdict OR the watchdog reclaims a crashed worker | Decision cap (see below) |
| `runs.failure_counter` (kanban built-in) | `tasks.failure_count` per `kanban_db.py` | ONLY when `kanban_complete` returns a structural failure (e.g. `phantom_ids`) OR a watchdog reclaim exceeds reclaim-cap | Hard stop / archive |

### 4.1 Decision rules

| Outcome | Action |
|---|---|
| Worker returns `done` with all 5 result bullets filled AND validate.ps1 verdict = APPROVED | Terminal — `done`. No retry. |
| Worker returns `done` with all 5 result bullets filled BUT validate.ps1 verdict = REWORK | **Create new sibling T<NNN+1>** with the numbered rework list in Definition of done. Bump `attempt` on the new card from 1 (it is a fresh card, but `carry_forward.parent_attempt` records `attempt+1`). |
| Worker returns `rework` (self-blocked; e.g. moved goalposts) | Hermes does NOT auto-retry. Either Hermes scopes a new task OR escalates to `blocked` for `needs_input`. |
| Worker hits `watchdog_timeout` (no heartbeat in stale window) | **Re-queue** to `ready`. **No** failure counter tick. `attempt` bumped (so the second timeout for the same card reaches the reclaim-cap). |
| Worker enters `blocked (needs_input)` | Stop. Do not retry until human unblocks. |
| `attempt` reaches **2 on a single card** for the same rework reason (i.e. rework → rework loop) | **Escalate** to `blocked` with reason `"rework-loop: rework reason unchanged across re-loop"` for human decision (accept partial / re-scope / abandon). **Do not auto-create T<NNN+2>.** |
| Same-reason `blocked` re-block counter reaches **3** (kanban built-in loop breaker) | **Archive** the card with archived=true; surface to human via cron. |
| Worker invoked with phantom `created_cards` ids in `kanban_complete` | Pipeline error; card stays in `running` until ids validate (kernel side). |

### 4.2 Where the failure reason lands

- **Validation rework** — the *verdict file* (`validation-reports/<stamp>-<name>.verdict.md`) is durable. The new T<NNN+1> task note has a `Context` section that links the verdict file path; the verifier reads it on pickup.
- **Worker self-rework** — the worker writes `## Problems / open questions` on the task note and sets `status: rework`. Hermes picks it up and decides.
- **Watchdog reclaim** — `runs[*].summary` records `"reclaimed: no heartbeat for N seconds"`.
- **Hard stop / archive** — `runs[*].result` records the final reason + the unblock-counter snapshot.

---

## 5. Sequence diagram

```mermaid
sequenceDiagram
    autonumber
    participant U as User / Trigger
    participant D as Dispatcher
    participant K as Kanban Card (kanban.db)
    participant H as Hermes (orchestrator)
    participant O as OpenClaw (worker)
    participant V as validate.ps1 (gate)

    Note over U,V: ── Happy path, first attempt ──

    U->>D: "review VTO and assign next tasks"
    D->>K: create card {title, body, assignee=default, parents=[]}
    K-->>D: status=ready, id=t_X
    D->>H: spawn session with task body as first turn
    H->>H: read vault, write T<NNN> note (status=assigned)
    H->>K: kanban_block?  no — Hermes is the parent
    H-->>D: returns; D marks card done for Hermes's own turn
    Note over H: Hermes next loop

    U->>D: "work the next assigned VTO task"
    D->>K: claim (assign session_id, lock)
    K-->>D: status=running, attempt=1
    D->>O: spawn session with task body + retry{attempt:1, carry_forward:null}
    O->>K: kanban_heartbeat (every ~15 min)
    O->>O: executes task; mutates T<NNN>.status: in-progress → done
    O-->>D: worker_return {summary, metadata, created_cards:[]}
    D->>K: status=review
    D->>H: notify "ready for review"

    H->>H: reads T<NNN>.result, F<NNN>+ findings
    H->>H: compiles candidate (single .md)
    H->>V: validate.ps1 -File <candidate> [-Depth deep]
    V-->>V: Stage1a import (haiku) → T_…
    V-->>V: Stage1b review (haiku) → R_…
    V-->>V: Stage2 verdict (opus)  → writes verdict file
    V-->>H: exit 0 (APPROVED) or 2 (REWORK)

    alt APPROVED
        V-->>H: VERDICT: APPROVED
        H->>K: verdict_approved  → status=done
        H->>H: write decision into [[VTO]] status (cites verdict file + finding ids)
    else REWORK
        V-->>H: VERDICT: REWORK + numbered rework list
        H->>K: verdict_rework
        H->>K: kanban_create new card T<NNN+1> (parents=[old_t])
        H->>K: status=todo (or ready if no parents)
        H-->>D: ready for next loop
    end

    Note over U,V: ── Rework re-loop ──

    D->>K: ready → claim → running
    D->>O: spawn, retry{attempt: 2, carry_forward: {parent: t_X, verdict_file, rework_items}}
    O->>K: heartbeat; executes Definition of done (verbatim rework list)
    O-->>D: worker_return (status=review)
    H->>V: validate.ps1 again
    alt APPROVED on re-loop
        V-->>H: APPROVED → status=done
    else REWORK on re-loop
        V-->>H: REWORK
        Note over H,K: attempt reaches 2 with same rework theme → escalate to blocked(reason="rework-loop")
        H->>K: status=blocked (needs_input)
        U->>D: human decision: accept partial / re-scope / archive
    end

    Note over U,V: ── Failure branches (collapsed) ──

    rect rgba(255,200,200,0.2)
        Note over O,K: worker uses kanban_block(reason, kind)
        O->>K: kind=needs_input → status=blocked (waits human)
        O->>K: kind=capability → status=blocked (no auto-retry)
        O->>K: kind=dependency → status=todo (auto-promotes when parent done)
        O->>K: kind=transient → status=ready (auto-retried)
    end

    rect rgba(200,200,255,0.2)
        Note over D,K: watchdog reclaim
        D-->>D: no heartbeat > stale_timeout
        D->>K: status=ready, attempt+=1, no failure tick
    end
```

---

## 6. Acceptance — what this contract is checked against

Manual protocol's known stages (per [[Loop Protocol Spec]]):

- [x] Stage 1 dispatcher handoff — represented by `U → D` and the `claim` payload.
- [x] Stage 2 Hermes-assign — `Hermes` writes T<NNN> from project goal, picks next number from [[VTO Task Log]], fills Definition of done before work starts.
- [x] Stage 3 OpenClaw-execute — `OpenClaw` flips `assigned → in-progress → done|rework`, fills the 5 result bullets.
- [x] Stage 4 validate.ps1 — `validate.ps1` is invoked with the candidate; verdict file is the only mutation path into [[VTO]] Status / Decisions.
- [x] Retry path — REWORK always re-enters at Stage 2 with a new T<NNN+1>; rework loop is bounded by `attempt ≤ 2` per rework theme, then escalates to `blocked`.

Stages not currently covered (open questions for the automator):

- [ ] **Dispatcher trigger** — cron / poll is planned but not active. State machine assumes either human wake or future cron trigger; the transition set is the same either way.
- [ ] **Candidate compilation heuristic** — Hermes currently judges ad hoc when findings become one candidate. Formalizing this is the next design task.
- [ ] **Multi-card parallel research** — `sessions_spawn ≤ 3` is a worker-side cap; it does NOT change the state machine, but it does mean the dispatcher may see N sibling cards land in `review` simultaneously.

---

## 7. Open questions surfaced for review

1. **Re-claim cap before archived.** Current proposal: if `attempt` reaches 2 with the *same rework theme* (or 5 reclaim timeouts total), escalate to `blocked`. Is that the right ceiling?
2. **`review` as a real status vs ephemeral.** The dispatcher today treats `review` as a kanban status. Do we need it for VTO, or can the dispatcher stay in `running` until `verdict_*` lands? (Pro of `review`: human-visible queue; con: extra state.)
3. **Worker's `done` vs Hermes's `done`.** The worker writes `T<NNN>.status = done` when it has filled the 5 result bullets. The kanban card does NOT become `done` until the orchestrator (or gate) accepts. The two `done`s are different and we should keep them separate in docs / UI labels.
4. **Heartbeat during Hermes's own orchestrator turn.** Hermes rarely heartbeats; runs are usually short. If a Hermes turn hits an `assigned → done` path with no intermediate state, it can finish without ever heartbeating — that's fine, but the watchdog config should not flag it as crashed.
5. **`blocked` reason propagation to vault.** When the kanban card is `blocked`, the worker writes the reason into `runs[*].summary`. Should we also mirror it into the T<NNN> task note's `## Problems / open questions` so the vault reflects it?

---

## Related

- [[Loop Protocol Spec]] — protocol doc with inputs/outputs per stage (this doc's source of truth)
- [[LOOP-ENGINEER]] — gate rationale + Catalyst details
- [[SOUL-Hermes]] — orchestrator soul
- [[SOUL-OpenClaw]] — worker soul
- [[VTO]] — project hub
- [[OKF-FORMAT]] — note format
