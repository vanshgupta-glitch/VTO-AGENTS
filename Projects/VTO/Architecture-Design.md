# VTO Architecture Design — Complete Rewrite

## Overview
This document design the complete agent architecture for the VTO project, rebuilt from scratch using the orchestration cycles and flows documented in existing md files. The architecture follows the OKF (OKF-FORMAT) format and maintains compatibility with the validation gate, kanban board, and swarm orchestration.

## Core Identities

### Hermes — Orchestrator (SOUL-Hermes)
**Role**: Owns the goal, makes decisions, breaks work into tasks, assigns them, reviews results, and updates the project hub. Does NOT execute long tool-heavy work personally.

**Key Responsibilities**:
1. **Swarm Firing**: Pick research agents based on open questions in VTO.md, create task notes, update Task Log index
2. **Absorption**: Read findings from Projects/VTO-Agents/Findings/, cross-link contradictions/confirmations
3. **Compilation**: Synthesize absorbed knowledge into ONE candidate output note
4. **Validation Gate**: Submit candidate to `catalyst-env\vto\validate.ps1` (Stage 1: Catalyst Haiku review → Stage 2: Claude Opus final verdict)
5. **Verdict Action**: APPROVED → write into VTO.md; REWORK → create new task for OpenClaw with numbered rework instructions
6. **Board Mirroring**: Every task assigned to vto kanban board via `hermes kanban --board vto create`

**Orchestration Cycle (Playbook)**:
1. Read VTO.md + open questions → choose which research agents matter now (start with 2-4, not all 11)
2. For each chosen agent, create task note `Projects/VTO/Tasks/T<NNN> <agent-id>.md` with Context: "Load Projects/VTO-Agents/Research Agents/<file>.md as your mission brief; deliver per its Output contract." Set status: assigned. Update Task Log.
3. Instruct OpenClaw: "Work the assigned VTO research tasks — spawn one sub-session per task, max 3 concurrent."
4. When tasks return, read each finding note in Projects/VTO-Agents/Findings/. Cross-link contradictions and confirmations between findings.
5. Synthesize what was absorbed into ONE candidate output note (finding synthesis, decision draft, or deliverable write-up).
6. Submit to validation gate: `catalyst-env\vto\validate.ps1 -File "<candidate>"` (standard for normal; -Depth deep for milestone syntheses)
7. Act on verdict: APPROVED → write into VTO.md (Status + Decisions), citing finding ids. REWORK → copy numbered rework instructions into a new task note for OpenClaw and re-loop.
8. Repeat until goal's research needs are met, then shift swarm from research agents to build tasks.

**Board Mirroring**:
- On assign: `hermes kanban --board vto create "T<NNN> <title>" --body "Task note: Projects/VTO/Tasks/T<NNN>…md" --created-by hermes --idempotency-key T<NNN>` — never set an assignee
- On review/verdict: `hermes kanban --board vto comment <card-id> "REVIEWED: <done|rework> — <one line>"`

### OpenClaw — Worker (SOUL-OpenClaw)
**Role**: Executes tasks and research missions with real tools and returns context in writing. Never changes scope, priorities, or the plan.

**Key Responsibilities**:
1. **Task Pickup**: Open Projects/VTO/Tasks/, take status: assigned notes (lowest number first), set in-progress
2. **Brief Loading**: Each research task points at one file in Projects/VTO-Agents/Research Agents/ — that file is the complete mission
3. **Spawn Sub-sessions**: Multiple assigned research tasks → sessions_spawn one sub-session per task (≤3 at once). Collect each sub-session's result before closing yours.
4. **Findings Production**: Each mission produces Projects/VTO-Agents/Findings/F<NNN> <topic>.md in OKF type: finding format — Question / Answer / Evidence (with URLs) / Implications for VTO
5. **Hand Back**: Fill the task note's "Result & context returned" (link the finding notes!), set status: done, update the [[VTO Task Log]] index row
6. **Rework Tasks**: When Hermes assigns a task carrying "Rework instructions" from a validation verdict, fix EXACTLY the numbered items — each has an acceptance criterion; meet it, cite the evidence in the task note, change nothing else.

**Swarm Engine**:
- Uses `sessions_spawn` tool: one sub-session per assigned research task, max 3 concurrent
- Sub-sessions get hard-aborted around 10 minutes. Write finding file after EACH answered question (frontmatter `status: draft`, update as you go). An abort must never lose work; a respawn continues from the existing draft, never restarts.
- If it is not written in the vault, it did not happen. Sub-session results included.
- Cite or it is opinion: every external fact gets a URL or file path.
- OKF everywhere — this memory will live on GitHub and brief future agents.

**Board Mirroring**:
- Starting a task: `hermes kanban --board vto comment <card-id> "IN PROGRESS — OpenClaw"` (find the card by its T<NNN> title; if Hermes forgot to create one, create it unassigned with idempotency-key T<NNN>)
- Finishing: `hermes kanban --board vto comment <card-id> "DONE — finding <F-note name>, result in vault task note"`
- Blocked: `hermes kanban --board vto comment <card-id> "BLOCKED — <why>"`

### Critic — Adversarial Reviewer (SOUL-Critic)
**Role**: Continuously and adversarially review all research findings, candidate syntheses, and technical decisions before they become project truth. Using Imbue Catalyst as the critic agent, systematically attempt to falsify claims, identify edge cases, check adherence to guidance, and ensure only verified knowledge enters the project knowledge base.

**Key Responsibilities**:
1. **Catalyst Subagent Design**: Design OpenClaw's sessions_spawn/cron poll Projects/VTO/Tasks/ for status: assigned critic tasks, and how Hermes should be scheduled to review Catalyst review outputs. Produce exact cron/heartbeat configs.
2. **Adversarial Review Protocol**: Define exact process for Catalyst refutation run on a given finding/candidate:
   - Import-theory
   - Review-adherence / review-theory
   - Fault-finding
   - Score recording
   - Output format
   - How many independent refutation agents should run per review?
3. **Refutation Documentation**: When Catalyst run refutes a claim, record in append-only finding `Findings/F<NNN> critic-<topic>.md` that documents: question/answer, what was challenged, whether claim survived or was modified.
4. **Context Hygiene for Critic**: Best practices for feeding Catalyst the right context — how much VTO knowledge, which finding/candidate, which research-agent briefs, and which prior verdicts should be included to maximize adversarial effectiveness without excessive token burn.
5. **Critic Metrics**: Per Catalyst review run: log duration, tokens, number of claims challenged, refutation rate, surviving claims. Where logged. How does critic's refutation rate correlate with Stage 2 (Claude Opus) verdict outcome?
6. **Failure Modes and Recovery**: Detection of stale claims (Catalyst reviewing already-accepted knowledge), lost handoffs between Catalyst and Hermes, and adversarial review gridlock (claims refuted but not resolved). Produce recovery protocols for each.

**Output Contract**:
- Finding notes: `Findings/F<NNN> critic-<topic>.md` (OKF type: finding) per answered question: Question / Answer (with adversarial review protocol) / Evidence (Catalyst run outputs, refutation scores, surviving claims) / Implications for VTO
- Rollup finding: `F<NNN> critic-landscape.md` with comparison table: Catalyst review run × claim challenged × refutation outcome × claim survived? × modification needed
- All findings link [[VTO]] and this research-agent file. Critic proposals that change [[VTO Agent Architecture]] or the SOULs go in an "Implications" list for Hermes to accept/reject explicitly.

## Orchestration Cycles & Flows

### Swarm Firing Cycle
```
1. Hermes reads VTO.md → identifies open questions
2. Hermes picks N research agents (2-4 initially, not all 11)
3. For each agent: create task note T<NNN> <agent-id>.md in Projects/VTO/Tasks/
   - Context: "Load Projects/VTO-Agents/Research Agents/<file>.md as mission brief"
   - Status: assigned
   - Update VTO Task Log index
4. Hermes kanban: create card T<NNN> on vto board
5. Instruct OpenClaw: "Work assigned VTO research tasks — spawn one sub-session per task, max 3 concurrent"
6. OpenClaw spawns sub-sessions, each reads its research agent brief
7. Each sub-session produces Finding F<NNN> <topic>.md
8. OpenClaw hands back: fills task note result, sets status: done, updates Task Log
9. Hermes absorbs findings: reads F001-F<NNN>, cross-links contradictions/confirmations
10. Hermes compiles candidate output note
11. Hermes submits to validation gate
12. On verdict: APPROVED → update VTO.md; REWORK → create new task for OpenClaw
```

### Validation Gate Flow
```
Candidate Output → validate.ps1 -File "<candidate>" -Depth standard (default)
  │
  ├── Stage 1a: Import candidate into Catalyst DB (cheap model Haiku)
  │   - Generates theory ID T_YYYYMMDD-HHMMSS-XXXXXX
  │
  ├── Stage 1b: Catalyst review (cheap model)
  │   - Runs review-adherence (standard) or review-theory (deep)
  │   - Generates review IDs R_YYYYMMDD-HHMMSS-XXXXXX
  │
  └── Stage 2: Claude Opus final verdict
    - Reads: GUIDANCE.txt, theory.md, review report(s)
    - Decides: APPROVED or REWORK
    - Outputs markdown verdict with basis and rework instructions
    - Exit 0 = APPROVED (write into VTO.md, cite verdict file)
    - Exit 2 = REWORK (copy verdict's numbered rework instructions into new task for OpenClaw)
```

### Research Agent Brief Flow
```
Hermes assigns task → OpenClaw spawns sub-session → 
Sub-session loads research agent brief (SOUL-*.md or Research Agents/<file>.md) →
Sub-session executes mission → produces F<NNN> <topic>.md in OKF format
```

### Rework Cycle
```
Validation gate returns REWORK → 
Hermes copies numbered rework instructions from verdict →
Creates new task note T<NNN> <something>-rework.md in Projects/VTO/Tasks/
- Each item states: WHAT is wrong, WHERE, acceptance criterion for the fix
- Sets status: rework (or assigned with rework instructions)
- OpenClaw fixes exactly the numbered items
- After fix: re-submit candidate to validation gate
```

## Infrastructure

### Task Note Template (from VTO Task Log)
```
# T### <short-name>
**Status**: pending|in_progress|done|rework
**Assigned**: OpenClaw|Hermes
**Created**: YYYY-MM-DD

## Goal
<What this task should accomplish>

## Brief
<Load from research agent brief or description>

## Method
<Approach to take>

## Result & Context Returned
<Links to finding notes, key results>

## Validation
<Any validation gate results>

## Board Mirroring
<kanban command output>
```

### Finding Note Format (OKF)
```
--- 
okf: 1
id: F<NNN> <topic>
type: finding
project: VTO
status: active|draft
created: YYYY-MM-DD
updated: YYYY-MM-DD
tags: [research-agent, <topic>
---

# Question
<The research question>

# Answer
<The answer, with evidence>

# Evidence
- URL: <source>
- File: <path in vault>

# Implications for VTO
<How this impacts the VTO project>
```

### Kanban Board Mirroring
Every VTO task must appear on the "vto" kanban board:
- `hermes kanban --board vto create "T<NNN> <title>" --body "Task note: Projects/VTO/Tasks/T<NNN>…md" --created-by hermes --idempotency-key T<NNN>`
- Comments on finish: `hermes kanban --board vto comment <card-id> "DONE — finding <F-note name>, result in vault task note"`
- Comments on review: `hermes kanban --board vto comment <card-id> "REVIEWED: <done|rework> — <one line>"`

## SOUL Documents Structure

### SOUL-Hermes.md (rewrite)
- Identity: Hermes, orchestrator of VTO project
- Mission: Drive VTO project to goal by running research swarms and build loops
- Resources: vault, research agents, OpenClaw, Hermes profiles, Dashboard Mastermind, Loop tab, validation gate, OpenCode
- Playbook: firing a research swarm (8 steps as documented)
- Board mirroring rules
- Rules: vault is truth, never assign more than OpenClaw can verify, keep one live "state of knowledge" summary, write everything in OKF

### SOUL-OpenClaw.md (rewrite)
- Identity: OpenClaw, working agent of VTO project
- Mission: Turn assigned tasks into completed work and written knowledge
- Resources: vault, sessions_spawn tool, web_search/web_fetch/browser, firecrawl skills, OpenCode CLI, exec/files/code tools, memory_search, models (Claude Opus primary)
- Playbook: working the swarm (7 steps as documented)
- Board mirroring rules
- Rules: save incrementally, if not written in vault it did not happen, cite or it is opinion, respect robots/ToS, OKF everywhere

### SOUL-Critic.md (rewrite - new)
- Identity: Critic, adversarial reviewer using Imbue Catalyst
- Mission: Adversarially review all research findings before they become project truth
- Research questions: 6 specific questions about critic design, protocol, documentation, context hygiene, metrics, failure modes
- Method & tools: Catalyst CLI, structured review skills, VTO vault context, web_search/web_fetch, terminal, memory_search
- Output contract: critic-<topic>.md findings + critic-landscape.md rollup

## Agent Interaction Flow

```
Hermes (orchestrator)                    OpenClaw (worker)
    │                                       │
    │ 1. Pick agents                        │
    │   ↓                                     │
    │ 2. Create task notes T<NNN>            │ ← Updates Task Log
    │   ↓                                     │
    │ 3. Kanban: create card                │ ← Board mirroring
    │   ↓                                     │
    │ 4. Fire: "Work assigned VTO tasks"    │ → Spawns sub-sessions
    │   ↓                                     │
    │ 5. Sub-sessions execute research      │ → Produce F<NNN> findings
    │   ↓                                     │
    │ 6. Results returned                   │ ← Fill task notes, update Log
    │   ↓                                     │
    │ 7. Absorb: read findings              │ ← Cross-link contradictions
    │   ↓                                     │
    │ 8. Compile candidate                  │
    │   ↓                                     │
    │ 9. Submit to validation gate          │ → validate.ps1
    │   ↓                                     │
    │10. Verdict: APPROVED / REWORK         │
    │   ↓  (APPROVED)                       │
    │11. Write into VTO.md                  │ ← Cite finding ids
    │   ↓  (REWORK)                         │
    │12. Create new task for OpenClaw       │ ← With numbered rework instructions
    │   ↓                                     │
    │13. OpenClaw fixes items               │ → Re-submit to gate
    │   ↓                                     │
    │14. Repeat                             │
```

## Research Agent Briefs (11 Total)

The 11 research agent briefs live in `Projects/VTO-Agents/Research Agents/` and follow OKF format. Each is a complete, self-contained research mission. The existing briefs are:

1. **F001**: Orchestration adversarial review
2. **F002**: Orchestration automation
3. **F003**: Orchestration context hygiene
4. **F004**: Orchestration failure modes
5. **F005**: Orchestration metrics
6. **F006**: FittingBox network API
7. **F007**: FittingBox render analyser
8. **F008**: FittingBox visual UI test stats
9. **F009**: Video test corpus
10. **F010**: FittingBox network API (duplicate/research)
11. **F011**: Orchestration context

(Note: These are the findings F001-F011 already produced; the research agent briefs that produced them are in the archive or need to be reconstructed.)

## New Agent Code Structure

Given the rewrite request, here's the proposed code/orchestration structure:

### 1. Agent Identities (SOUL documents)
- SOUL-Hermes.md — Complete rewrite with new playbook
- SOUL-OpenClaw.md — Complete rewrite with new swarm engine
- SOUL-Critic.md — New document for adversarial review

### 2. Task Infrastructure
- VTO Task Log.md — Updated index format
- Projects/VTO/Tasks/T<NNN> <name>.md — Task notes following template
- Kanban board "vto" — All tasks mirrored here

### 3. Research Agent System
- Projects/VTO-Agents/Research Agents/<file>.md — 11 mission briefs
- Each brief loads as sub-session prompt when spawned
- Output: Projects/VTO-Agents/Findings/F<NNN> <topic>.md

### 4. Validation Gate Integration
- `catalyst-env\vto\validate.ps1` — Already exists, needs integration
- Hermes submits candidate → gets verdict → acts on it

### 5. OKF Format Standardization
All notes in OKF format with frontmatter:
```
--- 
okf: 1
id: ...
type: ...
project: VTO
status: ...
created: ...
updated: ...
tags: [...]
---

# Content
```

## Summary
This architecture design provides the complete framework for rewriting all agent identities and code from scratch. The key elements are:

1. **Three SOUL documents** (Hermes, OpenClaw, Critic) defining agent identities and playbooks
2. **OKF-format infrastructure** for all notes (tasks, findings, verdicts)
3. **Validation gate integration** through catalyst-env validate.ps1
4. **Kanban board mirroring** for live visibility
5. **Orchestration cycles**: swarm firing → absorption → compilation → validation → rework loop
6. **11 research agent briefs** as self-contained missions

The rewrite should maintain backward compatibility where possible (existing findings F001-F011, existing task numbers T001-T035) but refresh the orchestration flows, clarify the identities, and ensure every output passes through the validation gate before becoming project truth.