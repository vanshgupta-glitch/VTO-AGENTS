---
okf: 1
id: loop-engineer
type: protocol
project: VTO
status: active
created: 2026-08-03
updated: 2026-08-03
tags: [loop, validation, catalyst, quality-gate]
---

# LOOP ENGINEER — the validated output loop

The VTO loop with a **two-stage validation gate** at the end. Nothing Hermes produces becomes project truth until it survives the gate.

## The loop

```
Hermes assigns task (T###)                       [[SOUL-Hermes]]
        │
OpenClaw executes → findings (F###)              [[SOUL-OpenClaw]]
        │
Hermes absorbs findings → compiles CANDIDATE output (one .md)
        │
┌──── VALIDATION GATE — validate.ps1 ──────────────────────────┐
│  Stage 1 · CATALYST review — CHEAP model (Haiku)             │
│    /import-theory → /review-adherence  (or /review-theory)   │
│    Imbue's adversarial reviewer does the token-heavy         │
│    fault-finding at ~1/10th the token cost.                  │
│  Stage 2 · CLAUDE verdict — STRONG model (Opus), ONE pass    │
│    Reads candidate + Catalyst reviews, spot-checks only      │
│    BLOCKER/MAJOR findings, rules: APPROVED or REWORK.        │
└──────────────────────────────────────────────────────────────┘
        │
APPROVED → Hermes writes it into [[VTO]] as a decision/knowledge
REWORK   → numbered fix list goes back to Hermes → new T### for
           OpenClaw → loop repeats
```

## Why Catalyst sits where it sits (max validation per token)

[Imbue Catalyst](https://github.com/imbue-ai/catalyst) is an AI-scientist harness whose core strength is **adversarial review**: independent agents tasked with falsifying claims, finding edge cases, and checking adherence to guidance. Imbue's own numbers: ~65% of a full Catalyst run's tokens go to review/scoring — and those steps **work fine on a weaker model**. So:

- The **expensive part of validation** (systematically attacking every claim) runs on **Haiku** through Catalyst's structured review skills — a manual review step costs ~1/7th of Opus.
- **Opus is spent exactly once**, on a single pass that reads the pre-chewed review reports instead of re-deriving them. Claude stays the *ultimate* validator; Catalyst makes each Opus token count.
- Full Catalyst evolution workflows (100+ subagents) are deliberately NOT used — massive token burn for marginal gain here. We use only its CLI **skills** in a local environment.

## How to run the gate

```powershell
# standard gate (default) — 1 review agent, cheapest
C:\Users\ankur.singh\catalyst-env\vto\validate.ps1 -File "<candidate .md>"

# deep gate — per-claim falsification subagents; reserve for milestones
C:\Users\ankur.singh\catalyst-env\vto\validate.ps1 -File "<candidate .md>" -Depth deep
```

Exit codes: `0` APPROVED · `2` REWORK · `1` pipeline error. Verdict lands in `catalyst-env\vto\validation-reports\<stamp>-<name>.verdict.md` — Hermes copies REWORK verdicts into the task note that gets reassigned.

### Depth policy (token budget)

| Candidate | Depth |
|---|---|
| Single research finding (F###) | `standard` |
| Compiled multi-finding synthesis / go-no-go decision | `deep` |
| Code/asset deliverable write-up | `standard`, plus OpenClaw's own tests |

## Where things live

| Piece | Path |
|---|---|
| Catalyst clone (branch `stable`, Windows-patched) | `C:\Users\ankur.singh\catalyst` |
| Validation environment (skills + DB + guidance) | `C:\Users\ankur.singh\catalyst-env\vto` |
| Gate runner | `catalyst-env\vto\validate.ps1` |
| Review criteria the reviewers follow | `catalyst-env\vto\GUIDANCE.txt` |
| Immutable candidate copies | `catalyst-env\vto\inbox\` |
| Catalyst database (theories/reviews, append-only) | `catalyst-env\vto\.ai-scientist-db\` |
| Verdicts | `catalyst-env\vto\validation-reports\` |

## Windows patches applied to the clone

- `context_manager.py` — `fcntl` (POSIX) file lock → cross-platform (`msvcrt` on Windows).
- `run_experiment.py` — `resource`/`preexec_fn` made POSIX-conditional (timeouts still enforced).
- 36 symlink-stub `scripts/*.py` + the `gemini_skills/skills` dir-symlink replaced with real copies (git-on-Windows can't materialize symlinks).
- The Catalyst **server/dashboard needs WSL2 and is not used** — CLI-skills mode only.

## Related

[[VTO Agent Architecture]] — base task protocol · [[SOUL-Hermes]] · [[SOUL-OpenClaw]] · [[VTO]] · [[OKF-FORMAT]]
