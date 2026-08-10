# decomposition v1.0.0

## When to use

Turning one approved work order into ordered, routed, checkable issue documents. Also when re-decomposing after a task has failed twice.

**Do not use** to decide whether the objective is worth pursuing — that is settled before it reaches you.
**Do not use** to invent acceptance criteria the work order did not provide. If they are missing or uncheckable, reject the work order.

## Inputs

- The approved work order, with its acceptance criteria.
- The current queue: what is in flight, what is blocked, what recently failed.
- The registry, for capability → agent resolution.
- On re-decomposition: every prior attempt and its stuck events.

## Procedure

1. Take each acceptance criterion and ask: **what command proves this?**
   > **DECIDE:** can every criterion be turned into a checkable line?
   > If not, **reject the work order**. Do not soften the criteria to make it decomposable — that converts a planning problem into a fleet of tasks nobody can close.

2. Split by **capability**, not by file. A task that needs research and then code is two tasks with a dependency, not one task that does both.

3. Size each task so **one executor run can finish it**. If a task plausibly needs three runs, it is two tasks. Watch `runs_per_task`: a rising average means your splits are too big, and the metric will show it before you notice.

4. Write the **scope** for each task — the exact paths it may modify. Draw it tight. The operations layer denies anything outside, and repeated out-of-scope attempts mean *you* drew it wrong, not that the executor misbehaved.

5. Wire dependencies by task id.
   > **DECIDE:** where two orderings are equally valid, prefer the one that **fails cheapest** — put the task most likely to invalidate the plan first.

6. Assign `required_capability`, never an agent name. Naming an agent means the next agent added requires editing you.

7. Check the queue for collision: no two in-flight tasks may modify the same file. If they would, sequence them.

8. Write each as a document in `docs/issues/`. Post pointers, not bodies.

## Re-decomposition after two failures

The decomposition was wrong, not the executor. Say which:

| Diagnosis | Fix |
|---|---|
| **Too large** | Split it further |
| **Wrong discipline** | The required capability was mis-stated |
| **Missing dependency** | Something it needed was not done |
| **Dead assumption** | The task presumed something no longer true — **this goes up, not sideways** |

An escalation without one of these named is a bug.

## Failure modes

| Symptom | Cause | What to do |
|---|---|---|
| Acceptance criteria not mechanically checkable | The work order is underspecified | Reject to Claude. Do not invent criteria. |
| Every split still needs multiple runs | The objective is larger than one work order | Escalate — this is a planning problem. |
| Two tasks keep colliding on one file | Wrong split axis — you split by feature where the code is coupled | Re-split along the coupling. |
| A task returns stuck twice with the same theme | Your decomposition, not the executor | Diagnose and re-split. Do not re-dispatch unchanged. |

## Output contract

One issue document per task:

```markdown
# T037 — <short name>
work_order: W014 · capability: code.implement · depends_on: [T036]
codebase: vto-widget

## Goal
One sentence.

## Definition of done
- [ ] each line verifiable by running something

## Scope
- exact paths this task may modify

## Context
file paths, prior task ids, links
```

Plus one Slack pointer per task, and a queue summary in your report upward.
