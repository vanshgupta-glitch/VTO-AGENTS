# VTO Agent Architecture — Hermes orchestrates, OpenClaw executes

Project: [[VTO]] · Tasks: [[VTO Task Log]]

## Roles

|             | Hermes 🧠 (Orchestrator)                                                                               | OpenClaw 🔧 (Worker)                                                                             |
| ----------- | ------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------ |
| **Decides** | What to do next, priorities, when a task is done well enough, when the goal is reached                 | How to execute the task it was given                                                             |
| **Does**    | Plans, splits the goal into tasks, writes task notes, reviews returned context, updates [[VTO]] status | Runs the task with real tools (files, shell, web, browser, code), writes results back            |
| **Never**   | Executes long tool-heavy work itself                                                                   | Changes scope, priorities, or the plan                                                           |
| **Runs on** | `deepseek/deepseek-v4-pro` via OpenRouter (thinking/evaluation tier; switched 2026-08-04)              | `openrouter/deepseek-v4-flash-0731` (1M ctx, $0.09/$0.18 per M; switched 2026-08-04) — fallbacks `ollama/minimax-m3:cloud` (free) then `anthropic/claude-opus-4-8` via Claude CLI |

## The loop (task protocol)

1. **Assign** — Hermes creates `Projects/VTO/Tasks/T<NNN> <short-name>.md` from the template in [[VTO Task Log]], fills **Goal / Context / Definition of done**, sets `status: assigned`, and adds the task to the Task Log table.
2. **Execute** — OpenClaw picks up the task note, sets `status: in-progress`, does the work, and writes into the note's **Result & context returned** section: what was done, artifacts/paths, decisions made, problems hit, and anything Hermes needs for the next decision.
3. **Review** — Hermes reads the returned context, marks `status: done` (or `rework` with notes), and compiles significant results into a candidate output.
4. **Validate** — the candidate goes through the two-stage validation gate ([[LOOP-ENGINEER]]): Catalyst adversarial review on a cheap model (Haiku), then Claude (Opus) as the ultimate validator → APPROVED or REWORK. Only APPROVED output updates [[VTO]]; REWORK goes back to step 1 as a new task with the verdict's numbered fixes.
5. Repeat until the ultimate goal in [[VTO]] is met.

## Ground rules

- **The vault is the single source of truth.** If it isn't written in a task note, it didn't happen. Both agents read/write here: `C:\Users\ankur.singh\Obsidian Vault\Projects\VTO\`.
- **Context flows through task notes**, not chat history — chat sessions are disposable; notes are not.
- **One task = one note.** Small, verifiable, with an explicit definition of done.
- Numbering: `T001`, `T002`, … (Task Log table is the index).

## How the loop actually fires (today vs later)

- **Today (human-in-the-loop):** Rohit (or Claude) tells Hermes "review VTO and assign next tasks", then tells OpenClaw "work the next assigned VTO task". Each agent does its half; the vault carries the context between them.
- **Later (automatable):** OpenClaw's cron/heartbeat can poll `Tasks/` for `status: assigned` and self-start; Hermes can be scheduled to review `status: done` notes. Set this up once the first manual loops run cleanly.

## Automation contract

For the implementable, unambiguous specification of every stage (dispatcher handoff → Hermes-assign → OpenClaw-execute → validate.ps1) — exact inputs, outputs, triggers, and failure modes — see [[Loop Protocol Spec]] in `Projects/VTO-Agents/`. That file is the source of truth for any automation; this doc is the protocol summary.
