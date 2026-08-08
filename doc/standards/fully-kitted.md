---
okf: 1
id: fully-kitted
type: standard
project: VTO
status: active
created: 2026-08-08
updated: 2026-08-08
tags: [standard, error-handling, logging, critic]
---

# Fully-kitted standard

The bar every change must clear. The Critic checks against this before code is written ([[PRD]] §6.5); TestRunner cannot check most of it, which is why it belongs at the pre-code gate.

**Why it exists.** An orchestration system that does not close the loop on error cases leaves unknowns in the codebase — states nobody knows the system can reach. Those are not found by testing, because nobody wrote a test for a state they did not know existed. They are prevented at review or not at all.

---

## Error states

1. **Every error path is handled or deliberately propagated.** Propagating is a choice; it must be visible in the code, not the default that happens when nobody thought about it.
2. **No silent catch.** A `catch` that neither rethrows, logs with context, nor returns a typed failure is a defect. `catch {}` is never acceptable.
3. **No unknown states.** Every state the code can reach is either handled or unreachable by construction. If you cannot say which, it is unhandled.
4. **Failures are typed, not stringly.** A caller must be able to distinguish failure kinds without parsing a message.
5. **Errors carry enough to diagnose.** What was attempted, with what inputs, and what the underlying cause was. An error that only says something failed costs an hour later.
6. **Degradation is announced.** Code that falls back to a lesser path says so in its output. Silent degradation reads as success and is the hardest class of bug to find.

---

## Logging

7. **Every failure logs once, at the level that owns it.** Not at every frame on the way up — that turns one failure into ten log lines and hides the origin.
8. **Logs are structured.** Fields, not sentences. You will grep these to answer "why did T037 escalate."
9. **Log lines carry their context.** Task, run, and attempt identifiers where they exist. A line that cannot be traced to its cause is noise.
10. **No secrets, ever, at any level.** Including trace. Route through the redaction serializer.
11. **Log volume is bounded.** A loop that logs per iteration must sample or aggregate. Unbounded logging is its own outage.

---

## Verification

12. **Every error path has a test or a written reason it has none.** "Hard to trigger" is a reason; silence is not.
13. **New failure modes are named in the change description.** If a change introduces a way to fail, the reviewer should not have to find it.

---

## Critic checklist

The pass/fail form. Any `NO` without a stated reason is a `REVISE`.

```
[ ] Every new error path handled or deliberately propagated
[ ] No silent catch introduced
[ ] Failures typed, distinguishable by the caller
[ ] Errors carry attempt, input, and cause
[ ] Any fallback announces itself
[ ] Failures log once, structured, with task context
[ ] No secret reachable by any log path
[ ] Error paths tested, or the gap is stated
[ ] New failure modes named in the description
```

---

## What this is not

Not a style guide, and not a demand for exhaustive defensive coding. Defensive code that swallows problems is *worse* than code that fails loudly — it converts a visible failure into an invisible one. The standard asks for one thing: **when this breaks, will someone be able to tell, and will they be able to tell why?**

---

## Related

[[PRD]] · [[DRIFT-AND-CONSISTENCY]] · [[decision]]
