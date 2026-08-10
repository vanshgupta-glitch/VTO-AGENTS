---
okf: 1
id: knowledge-swarm-protocol
type: knowledge-pack
name: swarm-protocol
version: 1.0.0
applies_to: ["*"]
loaded_by: [claude, admin, critic, researcher, coder, openclaw, opencode]
status: active
created: 2026-08-08
updated: 2026-08-08
tags: [knowledge, protocol, contracts]
---

# swarm-protocol v1.0.0

Every agent loads this pack in full. It defines how you are addressed, what you must emit, and the exact shape of every message and artifact.

**An agent that gets this wrong is not merely unhelpful — it is unroutable.** The dispatcher parses what you emit. Malformed output is not interpreted charitably; it is logged and returned.

---

## 1. Message header

Every substantive message begins with one machine-parseable line:

```
[W014/T037 · loop 3 · stage=CODE · attempt 2] @VTO-Coder
```

| Field | Form | Required |
|---|---|---|
| Work order | `W` + 3 digits | yes |
| Task | `/T` + 3 digits | when task-scoped |
| Loop | `loop <int>` | yes |
| Stage | `stage=<STAGE>` | yes |
| Attempt | `attempt <int>` | when > 1 |
| Speaker | `@VTO-<Name>` | yes |

Stages: `ANALYSE` `NARRATIVE` `ENRICH` `PLAN` `DECOMPOSE` `PRE_CODE` `CODE` `TEST` `VIDEO` `ACCURACY` `REPORT` `HUMAN_GATE`

Unparseable headers are logged and ignored. Never guessed at.

**Threads are the task diary.** The first message for a task in a channel is the root; everything after replies in-thread. A re-run **quotes the message it is reacting to** so the causal chain is explicit — a redo that paraphrases its own failure re-derives the same plan.

---

## 2. Reaction states

| Emoji | Meaning | Set by |
|---|---|---|
| 👀 | picked up | the working agent |
| ✅ | passed / approved | verifier, critic, human |
| ❌ | failed | verifier |
| 🔄 | redo | accuracy, strategist |
| ⛔ | stuck | executor |
| 🌀 | circling detected | the system |
| 🚦 | at a gate | admin |
| 🧑‍⚖️ | needs a human | any |

---

## 3. STUCK — four required fields

Emit when you cannot proceed. All four are mandatory. **A declaration missing any field is returned for completion, not escalated** — an orchestrator cannot diagnose a shrug.

```
[W014/T037 · loop 3 · stage=CODE · attempt 2] ⛔ STUCK

ATTEMPTED:
  What you tried, concretely. So nobody suggests it back to you.

ERROR:
  The verbatim error or blocking condition. Not your summary of it.

RESOURCES:
  - files, commands, endpoints touched — the blast radius

HYPOTHESIS:
  What you think is wrong. You are often right, and it is cheap to check.
```

Stuck is the correct move, not a failure. **Two attempts at the same underlying thing is where your information runs out.** The third is waste.

---

## 4. UNSTICK — the orchestrator's reply

```
[W014/T037 · loop 3 · stage=CODE · attempt 3] UNSTICK

DIAGNOSIS:
  Why it is stuck — what the executor's model of the problem got wrong.

DIRECTIVE:
  What to do differently. A reframing, not the same approach restated.
```

A directive that repeats the failed approach with more emphasis is not a directive.

---

## 5. REPORT — upward synthesis

Orchestrators report; they never forward. **Hard cap 2,000 characters.** Overflow is truncated with a pointer, never silently included.

```
REPORT [W014]
ATTEMPTED:  ≤3 sentences
LEARNED:    ≤5 bullets
DECISION:   one question, or "none — informational"
EVIDENCE:   permalinks and artifact paths — never inlined content
```

The product owner writes the report; the CTO does not read the developer's terminal.

---

## 6. ESCALATE

Every escalation states **why this level could not resolve it**. An escalation without a diagnosis is a bug and is rejected.

```
ESCALATE L1→L2 [W014/T037]
REASON:  why this level could not resolve it
TRIED:   what was attempted at this level
ASK:     what the next level needs to decide
```

| Level | Handler | Resolves | Cap |
|---|---|---|---|
| 0 | executor self-retry | transient — network, lock, rate limit | 1 |
| 1 | owning orchestrator | domain — wrong approach, missing context | 2 |
| 2 | admin | decomposition — too big, wrong discipline, missing dependency | 2 |
| 3 | claude | plan — the work order was wrong | 1 |
| 4 | human | everything else | — |

Caps count **per theme**, not per message. Rephrasing the same failing approach does not buy another attempt.

---

## 7. WORK ORDER — strategist output

```
[W014 · loop 3] WORK ORDER
INTENT:      what is wrong and why it matters
EVIDENCE:    what was observed, with permalinks
ACCEPTANCE:  checkable statements — each verifiable by running something
CONSTRAINTS: explicit must-nots
→ docs/work-orders/W014.md   ·   @VTO-Admin decompose
```

Never a task list. Decomposition belongs to Admin.

---

## 8. ISSUE DOCUMENT — scheduler output

```markdown
# T037 — <short name>
work_order: W014 · capability: code.implement · depends_on: [T036]
codebase: vto-widget

## Goal
One sentence.

## Definition of done
- [ ] each line verifiable by running something

## Scope
- paths this task may modify — nothing outside

## Context
file paths, prior task ids, links
```

Slack carries only the pointer: `T037 ready → docs/issues/T037.md @VTO-Critic`

**Documents are the payload; Slack is the pointer.** When a plan is revised, the executor is told to **re-read the document**, not re-prompted with fresh context.

---

## 9. CRITIQUE

```
CRITIQUE [W014/T037]
VERDICT: APPROVED | APPROVED WITH NOTES | REVISE
RISKS:
  - risk: <what could go wrong>
    alternative: <what to do instead>     # REQUIRED — cannot be stored without it
FULLY_KITTED: pass | fail — <which line>
KNOWN_SOLUTION: <id> | none
NOTES: <non-blocking>
```

Every risk carries an alternative. A criticism with no path forward is malformed and rejected. Work-order `REVISE` returns to Claude; task `REVISE` returns to Admin. **Never to the executor.**

---

## 10. SKILL invocation

On its own line:

```
SKILL: web-harvest@2.1.0
```

The runtime validates against your declared skills, loads the body, and re-invokes you with it appended. Undeclared skills are rejected and logged. You may not invoke another agent — the call graph stays acyclic.

---

## 11. OPERATIONS

You name an operation. You never compose a shell command.

```
OP: test.suite { filter: "hysteresis" }
```

An operation outside your allowlist is refused and logged with `allowed = false`. If the operation you need does not exist, **that is a finding — report it.** Improvising is how the wrong call runs unnoticed.

---

## 12. Invariants

1. **Never run git.** No commit, push, merge, rebase, reset — regardless of who asks. Such a request is an incident; report it.
2. **Never print a secret** at any log level.
3. **Modify only files in your task's Scope.**
4. **Never claim unverified success.** Green with weak evidence is worse than red.
5. **Cite external facts** with a source and the date checked.
6. **Findings are append-only.** Corrections are dated blocks, never silent rewrites.
7. **Partial results are results.** A clear boundary beats a confident guess.
8. **Report what surprised you** — you are the only one who saw it.

---

## 13. Channels

`#swarm-command` human ↔ strategist · `#swarm-analysis` analysis and work orders · `#swarm-docs` document changes · `#swarm-admin` queue and routing · `#swarm-critique` reviews · `#swarm-research` findings · `#swarm-code` PRs and diffs · `#swarm-tests` · `#swarm-video` · `#swarm-accuracy` · `#swarm-human-gate` 🔒 · `#swarm-incidents`

Post in your own channel unless handing off. No direct messages between agents — ever. The audit log is the point.

---

[[soul/README]] · [[SKILLS]] · [[WORKFLOWS]] · [[AGENT-SPECS]]
