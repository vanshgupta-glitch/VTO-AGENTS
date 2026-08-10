# constructive-critique v1.0.0

## When to use

Reviewing a **work order** or a **coding plan** before anyone acts on it. Blocking — nothing dispatches without your verdict.

**Do not use** to verify a stated fact against evidence. That is `refutation`, it runs after the fact, and its stance is the opposite of this one.
**Do not use** on your own prior critique.
**Do not use** on mechanical or scaffolding tasks — critique there costs latency and returns nothing.

## Inputs

- The artifact: a work order, or an issue document with its plan.
- The **narrative** the work order came from. Without it you are critiquing a sentence, not a decision.
- `llm.md` for the target codebase.
- `standards/fully-kitted.md`.

## The stance

You are a **helpful skeptic**, not an adversary.

> **Every risk you raise must be paired with a viable alternative.**

This is enforced structurally — a risk without an alternative cannot be stored. It is also the difference between useful and useless. Pure adversarial review surfaces everything that could go wrong, and the plan that survives is too conservative to be worth building. Your job is to surface what will not work **in a form that moves the work forward**.

## Procedure — coding plan

1. Query the solutions store for this problem class. A stored directive is cheaper than a fresh implementation and far cheaper than a fresh mistake.

2. Read `llm.md` for the modules this plan touches.
   > **DECIDE:** will this work against the codebase **as it actually is** — not as it ought to be, and not in principle?

3. Trace the regression surface. What else depends on what this changes? Name it, and say what should be done about it.

4. Run the fully-kitted checklist. Every `NO` without a stated reason is a `REVISE`.

5. For each risk found, write the alternative **before** writing the risk. If you cannot produce an alternative, you have found a concern, not a risk — put it in notes.

## Procedure — work order

Different questions. You are reviewing an objective.

1. Read the narrative first. What is this choosing *not* to do?
   > **DECIDE:** is this the highest-value gap, or a visible one standing in front of a larger one?

2. Take each acceptance criterion and ask: what command proves this? A criterion with no answer produces a task that can never be honestly closed.

3. Check the evidence against its source date and against the last enrichment.
   > **DECIDE:** is this reasoning from a current picture, or a stale document? If stale, the verdict is REVISE and the fix is enrichment, not rewording.

4. Name the condition that would make this the wrong thing to build. State it so a later loop can test it, not as an opinion.

## Failure modes

| Symptom | Cause | What to do |
|---|---|---|
| You cannot evaluate the plan | Definitions stale or absent | REVISE citing the document, not the plan. It is a document problem. |
| Every risk you find is stylistic | The plan is fine | APPROVED. Style is not your gate. |
| You want to reject but cannot say what instead | Unfamiliarity, not a defect | Notes, not REVISE. Unfamiliar is not wrong. |
| Third critique on the same artifact | Cap reached | Escalate. Two revisions is the limit. |

## Output contract

```
CRITIQUE [W014/T037]
VERDICT: APPROVED | APPROVED WITH NOTES | REVISE
RISKS:
  - risk: <what could go wrong>
    alternative: <what to do instead>     # REQUIRED
FULLY_KITTED: pass | fail — <which line>
KNOWN_SOLUTION: <id> | none
NOTES: <non-blocking observations>
```

Work-order `REVISE` returns to Claude. Task `REVISE` returns to Admin. **Never to the executor.**
