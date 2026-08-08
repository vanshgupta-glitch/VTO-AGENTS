---
okf: 1
id: loop-protocol-spec
type: protocol
project: VTO
status: active
created: 2026-08-04
updated: 2026-08-04
tags: [loop, contract, automation, source-of-truth]
---

# VTO Loop Protocol — automation contract (source of truth)

This is the **binding spec** for the VTO task loop as it exists today. Every stage below is concrete: an implementer building automation against it should not need to re-read [[VTO Agent Architecture]], [[LOOP-ENGINEER]], or the souls — everything they need is here.

Today's loop has **four stages**:

1. Dispatcher handoff (human → machine, currently Rohit / Claude / Telegram)
2. Hermes-assign (writes the task note)
3. OpenClaw-execute (worker, parallel sub-sessions allowed)
4. validate.ps1 (Catalyst + Claude gate)

Conventions and formats: [[OKF-FORMAT]] · numbering `T001`, `T002`, … with `F001`, `F002`, … for findings. All paths are absolute Windows paths; vault root is `C:\Users\ankur.singh\Obsidian Vault\`.

---

## Stage 1 — Dispatcher handoff

The dispatcher is the **human or higher agent** that wakes the right agent at the right time. Today this is Rohit (the user), often via Telegram through Hermes. Long-term this becomes a cron/poller — see "Open questions" at the end.

### Inputs

| Input | Where it comes from | Required? |
|---|---|---|
| Trigger intent | Human says e.g. *"review VTO and assign next tasks"* or *"work the next assigned VTO task"* | yes |
| Current vault state | Hermes / OpenClaw read [[VTO]] + [[VTO Task Log]] + `Projects/VTO/Tasks/` on wake | yes |
| Working agent identity | Human names the agent (Hermes or OpenClaw) in the intent | yes |
| Kanban task (when used) | The new kanban dispatcher may also pre-stage work as a kanban card; cards have `body` (the spec), `assignee` (profile name), `parents=[…]` for deps | optional, only when orchestrating from a parent card |

### Outputs

| Output | Where it lands | Form |
|---|---|---|
| Wake-up message | Sends agent into a fresh session with the trigger intent as the first user turn | Free text; agent reads vault for context |
| (Sometimes) Kanban card | `~/.hermes/kanban.db` via `kanban_create` — only when the work is being pre-staged from a parent orchestrator card | `{id, title, body, assignee, parents}` |

### Trigger / timing

- Fires on **human command**. Today the canonical phrases are:
  - *"review VTO and assign next tasks"* → wakes Hermes; Stage 2.
  - *"work the next assigned VTO task"* → wakes OpenClaw; Stage 3.
  - *"validate <candidate>"* → wakes Hermes to run Stage 4 (or the human runs `validate.ps1` directly).
- Future: cron polls `Projects/VTO/Tasks/` for `status: assigned` → wakes OpenClaw; Hermes wakes on `status: done` notes. **Not active.**

### Known failure modes & recovery

| Failure | Symptom | Recovery |
|---|---|---|
| Wrong agent woken | Agent says it can't do the work (e.g. Hermes asked to run a long execution) | Human retries with the right agent name |
| Stale vault context | Agent acts on outdated `[[VTO]]` status | Human restates the trigger intent; agent re-reads the vault |
| Kanban card created with unknown assignee | Dispatcher SILENTLY drops the card — it sits in `ready` forever | Check profile list with `hermes profile list`; recreate with a real `assignee` |
| Long task with no heartbeat (>1 h with no `kanban_heartbeat`) | Dispatcher reclaims the task as `ready` after `kanban.dispatch_stale_timeout_seconds` (default 4 h) | Re-spawn — no penalty (no failure counter tick) but in-flight progress is lost |
| Agent asks a question (clarify) while headless | The call times out; task sits in `running` with no signal | Don't `clarify` from headless work; use `kanban_block(reason=...)` + `kanban_comment` to surface the question |

---

## Stage 2 — Hermes-assign

**Profile:** Hermes (orchestrator). **Model:** `minimax-m3:cloud` via local Ollama (524k context). **Resources:** [[SOUL-Hermes]], [[VTO]], [[VTO Task Log]], `Projects/VTO-Agents/Research Agents/`.

### Inputs

| Input | Source | Required? |
|---|---|---|
| Trigger intent | From Stage 1 | yes |
| Project goal | Read [[VTO]] (the "Ultimate goal" section) | yes |
| Research-agent briefs | `Projects/VTO-Agents/Research Agents/*.md` — eleven pre-written missions | when assigning research |
| Open task notes | `Projects/VTO/Tasks/` notes with `status: assigned` or `status: in-progress` | yes (to avoid duplicates) |
| Task Log index | [[VTO Task Log]] table — every assigned task gets a row | yes |
| Note template | The template at the bottom of [[VTO Task Log]] | yes |
| REWORK verdict (re-loop case) | Latest `validation-reports/*.verdict.md` with `VERDICT: REWORK`; numbered **Rework instructions for Hermes** section | only on re-loop |
| Parent kanban card (if orchestrating) | `kanban_show()` returns `parents`, `body`, `worker_context`, prior attempts | only when fanned out from a parent card |

### Outputs

| Output | Path / form | Mutable? |
|---|---|---|
| Task note (one per assignment) | `Projects/VTO/Tasks/T<NNN> <short-name>.md` from the [[VTO Task Log]] template | mutable while `assigned` / `in-progress` |
| Status on the new note | `status: assigned` set in frontmatter | mutable |
| Updated Task Log | Row appended to the index table in [[VTO Task Log]] | mutable |
| (Optional) Review verdict | Writes `Review` section on a returned task note with `verdict: done` or `rework` | mutable, written by Hermes on return |
| (Orchestrator-only) Child kanban cards | `kanban_create(title=..., assignee=<profile>, parents=[this_id])` per child | created via tool, immutable after |

**Task note frontmatter (must match the template):**

```yaml
project: [[VTO]]
status: assigned          # assigned | in-progress | done | rework
assigned_by: Hermes
assigned_on: YYYY-MM-DD
worker: OpenClaw
```

Numbering rule: `T<NNN>` — pick the next free integer in [[VTO Task Log]] (zero-pad to 3 digits). On rework, Hermes assigns a **new** task with the next integer; the original note stays at `rework` as history.

### Trigger / timing

- Fires when Stage 1 says *"review VTO"* and there is work to assign.
- Fires again after every Stage 3 return (Hermes reads the returned context, marks `done` or `rework`, and either assigns the next task from the goal or compiles a candidate for Stage 4).
- Fires on every Stage 4 verdict (APPROVED → write into [[VTO]] and assign next; REWORK → assign a new task carrying the numbered rework list).

### Known failure modes & recovery

| Failure | Symptom | Recovery |
|---|---|---|
| Hermes tries to do the execution itself | Long tool-heavy work burns Hermes context; no task note exists afterward | Stop, write the task note, hand off to OpenClaw (Stage 3) |
| Two parallel Hermes-spawns assign the same `T###` | Duplicate task numbers | Check the Task Log table before picking a number; merge duplicates by marking the older one `cancelled` |
| Task note missing a Definition of done | OpenClaw can't verify completion → notes back "done" against moving goalposts | Hermes must rewrite the note with **checkable** items before assigning |
| REWORK path: rework instructions left in chat instead of a new task note | Verdict's fixes get lost; next loop re-reviews the same candidate | Copy the verbatim numbered list into the **Definition of done** of a new task note |
| Hermes updates [[VTO]] Status without running Stage 4 | Unvalidated prose enters project truth | Revert; route through validate.ps1 first |
| Assigning 11 research missions at once | OpenClaw's `sessions_spawn` only allows ≤3 concurrent children; the rest queue silently | Assign in batches; Hermes picks **2–4** agents per firing (per [[SOUL-Hermes]] §"Playbook" step 1) |

---

## Stage 3 — OpenClaw-execute

**Profile:** OpenClaw (worker). **Model:** primary `anthropic/claude-opus-4-8` via Claude CLI; fallback `ollama/minimax-m3:cloud` for heavy-context reads. **Resources:** [[SOUL-OpenClaw]], terminal + files + browser + Firecrawl skills, source repo `C:\Users\ankur.singh\shopify\nmg-vto`, `memory_search`.

### Inputs

| Input | Source | Required? |
|---|---|---|
| Trigger intent | From Stage 1 (human says *"work the next assigned VTO task"*) | yes |
| Task note | `Projects/VTO/Tasks/T<NNN> <short-name>.md` with `status: assigned` | yes |
| Research-agent brief (research tasks) | Path referenced in the task note's **Context** — one file in `Projects/VTO-Agents/Research Agents/` | for research tasks |
| nmg-vto repo (build/verify tasks) | `C:\Users\ankur.singh\shopify\nmg-vto` — `CLAUDE.md` + `Decisions.md` are authoritative; README/.claude are stale | when touching code/assets |
| Sub-session capacity | `sessions_spawn` accepts **max 3 concurrent** children per OpenClaw session | hard limit |
| Existing findings | `Projects/VTO-Agents/Findings/F<NNN>.md` (read for citations, never rewrite silently — append corrections per OKF) | for cross-referencing |

### Outputs

| Output | Path / form | Mutable? |
|---|---|---|
| Task-note status flip | Sets `status: in-progress` on pickup → `status: done` on completion (or `rework` if blocked) on the same note | mutable |
| **Result & context returned** section | The five sub-bullets filled out on the same task note: What was done; Artifacts/paths; Decisions made; Problems/open questions; What Hermes should know for the next decision | mutable (append-only in spirit) |
| Findings (research tasks) | `Projects/VTO-Agents/Findings/F<NNN> <topic>.md` with frontmatter `okf: 1`, `type: finding`, then sections **Question / Answer / Evidence (with URLs) / Implications for VTO** | append-only (corrections = dated block, never silent rewrite) |
| Task Log index update | OpenClaw updates the row's Status/Done columns for the assigned task | mutable |
| Sub-session result notes | Each `sessions_spawn` child writes its own finding/task note; OpenClaw cites the paths in its Result section | immutable once child completes |

**Per-task status transitions:** `assigned` → `in-progress` (on pickup) → `done` (work complete + result section filled) or `rework` (blocked, with `## Problems / open questions` describing what stopped it).

### Trigger / timing

- Fires when Stage 1 says *"work the next assigned VTO task"*. OpenClaw opens `Projects/VTO/Tasks/`, picks the lowest-numbered `status: assigned` note (per [[SOUL-OpenClaw]] §"Playbook" step 1).
- Parallelism: if there are multiple `assigned` notes and they're independent research tasks, fire `sessions_spawn` once per task — **max 3 concurrent**. Collect every child's result before marking the parent done.
- For each sub-session, the prompt shape is: *"You are the research agent defined in `<full path to Research Agents/<file>.md>` — read it and execute it fully; write your finding note per the Output contract."*

### Known failure modes & recovery

| Failure | Symptom | Recovery |
|---|---|---|
| `sessions_spawn` slot exhausted (>3 in flight) | New spawns queue silently; OpenClaw thinks they're lost | `process action=list`; wait for one to finish before spawning the next |
| Sub-session returns truncated findings | Parent cites a missing note | Re-fetch the child's session via the session id; merge the body into the parent's finding |
| Worker silently scope-creeps | Returns a `Finding` that doesn't match the Output contract | Hermes catches this in Stage 2 next loop; sets `verdict: rework` on the task note |
| Worker marks itself `done` without filling **Result & context returned** | Hermes has nothing to review | Hermes forces `rework` with "fill the five bullets verbatim" |
| Worker can't reach `nmg-vto` (lock / path gone) | Filesystem errors on read | Confirm path exists; check no other agent is mid-merge; if repo was moved, check [[SOUL-Hermes]] instructions to user |
| Sub-session rewrites a finding's Answer | OKF violation (findings are append-only) | Revert to original; add a dated correction block and bump `updated` in frontmatter |
| Tool absent (no browser / no Firecrawl key) | Worker can't complete a research step | Worker writes the blocker into Result section, sets `rework`, stops; human supplies access or rescopes |

---

## Stage 4 — validate.ps1 (the gate)

**Owner:** Hermes runs it; OpenClaw never does. **Runner:** PowerShell script at `C:\Users\ankur.singh\catalyst-env\vto\validate.ps1`. **Effect:** approves a candidate output as project truth, or kicks it back as a numbered rework list.

### Inputs

| Input | Source | Required? |
|---|---|---|
| Candidate `.md` | File path passed via `-File` (typically an `F###` finding or a Hermes-compiled synthesis) | yes |
| Depth | `-Depth standard` (default) or `-Depth deep` (per-claim falsification subagents; reserve for milestones) | default standard |
| Review model | `-ReviewModel` (default `haiku` — cheap, mandatory for Stage 1 cost reason) | optional override |
| Verdict model | `-VerdictModel` (default `opus` — strong, single pass for Stage 2) | optional override |
| Catalyst env | `C:\Users\ankur.singh\catalyst-env\vto\` (GUIDANCE.txt, .ai-scientist-db, scripts) | yes — script `Set-Location`s here |
| Claude executable | `C:\Users\ankur.singh\.local\bin\claude.exe` (the real one; the `claude` shim on PATH is Hermes, NOT this) | yes |
| Env vars set by runner | `CLAUDE_BASH_MAINTAIN_PROJECT_WORKING_DIR=1`, `CLAUDE_CODE_DISABLE_AUTO_MEMORY=1` | yes (script sets them) |

### Outputs

| Output | Path / form |
|---|---|
| Frozen candidate copy | `catalyst-env\vto\inbox\<stamp>-<name>.md` (immutable for the run) |
| Theory ID | `T_YYYYMMDD_HHMMSS_xxxxxx` parsed from Stage-1a output; written into the verdict |
| Review IDs | `R_YYYYMMDD_HHMMSS_xxxxxx` (one or more) parsed from Stage-1b output |
| Verdict file | `catalyst-env\vto\validation-reports\<stamp>-<name>.verdict.md` — exact format: `# Validation Verdict — <name>` · `VERDICT: APPROVED` or `VERDICT: REWORK` · `THEORY-ID: …` · `## Basis` (3–8 bullets) · (REWORK only) `## Rework instructions for Hermes` (numbered list, each with WHAT/WHERE/acceptance) |
| Exit code | `0` = APPROVED, `2` = REWORK, `1` = pipeline error (e.g. malformed theory/review id) |
| Stdout | Re-emits the verdict in full plus `[gate] verdict saved: <path>` |

### Trigger / timing

- Runs **only after Hermes compiles a candidate** from one or more `Findings` (or a single finding rise to a candidate on its own). Never on raw working notes.
- Standard depth by default; `-Depth deep` for milestone syntheses and go/no-go decisions (per [[LOOP-ENGINEER]] "Depth policy" table).
- Single consecutive run per candidate — Stage 1b and Stage 2 are not re-entered; a REWORK verdict means Hermes writes a **new task** and the next loop re-enters at Stage 2.

### Pipeline (in order; do not reorder)

1. `Set-Location $EnvDir` · freeze candidate into `inbox/<stamp>-<name>.md`.
2. **Stage 1a — import** (`$ReviewModel`): `claude --permission-mode acceptEdits --model haiku -p "/import-theory inbox/<stamp>-<name>.md"` → parse theory id `T_…`.
3. **Stage 1b — review** (`$ReviewModel`): `claude … -p "/review-adherence <tid>"` (or `/review-theory` for `deep`) → parse review ids `R_…`.
4. **Stage 2 — verdict** (`$VerdictModel`): one Opus call reads `GUIDANCE.txt`, the frozen theory, and the review `.md`s; spot-checks only BLOCKER/MAJOR + any load-bearing claim the reviews missed. Emits the exact verdict schema (see Outputs).
5. Verdict written to `validation-reports/<stamp>-<name>.verdict.md`; exit code set by the `VERDICT:` line.

### Known failure modes & recovery

| Failure | Symptom | Exit | Recovery |
|---|---|---|---|
| Candidate file missing | `Write-Error "Candidate file not found: …"` | 1 | Re-run with the right `-File` path |
| Stage 1a returns no theory id (no `T_…` in stdout) | `Write-Error "No theory ID in import output"` | 1 | Re-run; if persistent, inspect the Haiku output — Catalyst CLI may have errored silently |
| Stage 1b returns no review ids (no `R_…`) | `Write-Error "No review IDs in review output"` | 1 | Re-run with the same `-File`; the artifact was frozen, so it stays idempotent |
| `claude -p` non-zero exit | script throws `"claude -p failed (exit $N)"` | 1 | Check the Claude CLI at `C:\Users\ankur.singh\.local\bin\claude.exe`; ensure `claude` (the shim) isn't being picked up by mistake |
| Verdict missing the `VERDICT:` line | script warns "Verdict format unrecognized" | 1 | Re-run; if Opus keeps producing unparseable output, edit the verdict prompt to tighten the format requirement |
| **REWORK verdict** | exit 2; numbered rework list in the verdict file | 2 | **Hermes** copies the `## Rework instructions for Hermes` list verbatim into the **Definition of done** of a new `T###` task note for OpenClaw. Re-loop from Stage 2. |
| Wrong claude binary picked up | run silently targets the Hermes shim instead of Opus | varies | Confirm `$Claude` resolves to `C:\Users\ankur.singh\.local\bin\claude.exe`; if the shim shadows, run with that full path explicitly |
| Catalyst server/dashboard relied on | WSL2-only dependency — fails on native Windows | 1 | Do **not** use the server/dashboard. CLI-skills mode only (Windows patches already applied; see [[LOOP-ENGINEER]] §"Windows patches") |
| Verdict file overwritten by a newer run | `validation-reports/` filenames are timestamped but two runs within the same second collide | 1 second granularity | Acceptable for current cadence; if it becomes a problem, add a millisecond suffix inside the script |

---

## Cross-stage invariants

These hold regardless of which stage is executing — if any of them breaks, the loop is broken.

1. **The vault is the single source of truth.** Anything not written into the vault (`[[VTO]]`, [[VTO Task Log]], a task note, a finding) does not exist for downstream stages.
2. **Context flows through task notes, not chat.** Sessions are disposable; notes are not. A later Hermes or OpenClaw must be able to pick up from the vault alone.
3. **Nothing becomes truth in [[VTO]] without a Stage 4 APPROVED verdict.** Any other path of writing status/decision text into [[VTO]] is a defect.
4. **One task = one note.** Each `T###` is small, verifiable, with an explicit Definition of done written before work starts.
5. **Findings are append-only.** Corrections = dated block + bump `updated` in frontmatter. Silent rewrites are defects.
6. **OKF everywhere.** Every note in `Projects/VTO-Agents/` carries the frontmatter in [[OKF-FORMAT]]; GitHub-ready.

---

## Open questions (for the automator)

These are the seams where today's human-in-the-loop lives; an automated version needs to resolve them.

1. **Dispatcher trigger** — what cron / poll wakes Hermes and OpenClaw and when? Per [[VTO Agent Architecture]] "How the loop actually fires (today vs later)": planned but not active.
2. **Candidate compilation** — which subset of `Findings` becomes one candidate, and when does Hermes decide to compile (vs. keep absorbing)? Not formalized; Hermes currently judges ad hoc.
3. **Depth policy threshold** — currently Hermes picks `-Depth deep` by gut feel. A heuristic (e.g. "compile spans ≥3 findings" or "is a go/no-go decision") would make it explicit.
4. **Concurrency ceiling** — `sessions_spawn` is hard-capped at 3; Hermes is soft-capped at "2–4 agents per firing" by [[SOUL-Hermes]]. Aligning these into one explicit batch-size rule would let the dispatcher pre-batch.
5. **Heartbeat contract** — the kanban dispatcher wants `kanban_heartbeat` every ~15 min during long workers. Today only kanban-spawned workers do this; direct human-spawned Hermes/OpenClaw runs do not. Decide which paths emit heartbeats.
6. **REWORK routing** — Hermes is currently the only path that copies a verdict's rework list into a new task note. Worth scripting as a tiny `validate → assign rework` shim so a re-loop doesn't drift.

---

## Related

- [[VTO Agent Architecture]] — base protocol
- [[Loop State Machine]] — transition + payload contract layered on top of this spec (the implementer-facing doc)
- [[LOOP-ENGINEER]] — gate rationale + Catalyst details
- [[SOUL-Hermes]] — orchestrator soul
- [[SOUL-OpenClaw]] — worker soul
- [[VTO]] — project hub; [[VTO Task Log]] — task index
- [[OKF-FORMAT]] — note format every stage writes in
- Stage-tied validation invariants: every APPROVED verdict from Stage 4 is the only path that mutates [[VTO.md]] "Status" or "Ultimate goal".
