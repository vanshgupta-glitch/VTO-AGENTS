# stuck-diagnosis v1.0.0

## When to use

An executor you dispatched has declared STUCK, or the system detected circling, and the solutions store returned no match.

**Do not use** when the store returned a hit — apply the stored directive first; you only diagnose when it fails.
**Do not use** on your own work. This is for diagnosing an executor, and the whole value is that you hold context it does not.

## Inputs

- The stuck event, with all four fields present. If any is missing, **return it for completion — do not diagnose a shrug.**
- Every prior stuck event on this task.
- The run history: what each attempt changed and what happened.
- The issue document, including its declared scope.

## Procedure

1. Read the executor's `HYPOTHESIS` **first**. It is often right and always cheap to check. If it is right, you are done in one step.

2. Read the `ERROR` verbatim. Not the executor's summary of it — the actual text. Summarised errors are undiagnosable, which is why the field is required.

3. Compare `ATTEMPTED` against prior attempts on this task.
   > **DECIDE:** is this a *new* approach failing, or the *same* approach failing again in different clothing?
   > Same approach twice means the executor is out of information, not out of effort. Do not send it back to try harder.

4. Look for what the executor could not have known. This is where your value is — you hold the task history, the plan, and prior tasks in this codebase. Common cases:
   - an interface moved in an earlier task
   - the definitions in `llm.md` describe a structure that was refactored
   - a dependency task was marked done but did not deliver what this task assumed
   - the scope was drawn wrong and the real fix is outside it

5. > **DECIDE:** can you reframe this into something the executor *can* do?
   > - **Yes** → write the directive. Go to 6.
   > - **No, but the task is wrong** → escalate to Admin. Re-scoping is not yours.
   > - **No, and the plan is wrong** → escalate to Admin, who will escalate to Claude.

6. Write the `UNSTICK`. It must contain a **reframing**, not the same approach restated with emphasis. If your directive could be summarised as "try again more carefully," you have not diagnosed anything.

7. Record the solution: theme, diagnosis, directive. Even a partial one. The next occurrence should cost a lookup, not a diagnosis.

## Failure modes

| Symptom | Cause | What to do |
|---|---|---|
| Stuck event missing a field | Executor did not follow the contract | Return for completion. Do not escalate the task. |
| Third stuck on the same theme | Attempt cap reached | Escalate with a diagnosis. Do not grant a third attempt. |
| Executor's hypothesis is right and you cannot act on it | The blocker is outside its scope | Escalate to Admin — this is a scoping problem, not a coding one. |
| Every attempt is a variation of one idea | The executor's model of the problem is wrong | Your directive must replace the model, not refine the attempt. |
| You do not know either | You lack context too | Escalate. Say what you ruled out — that is worth passing on. |

If none apply, escalate with all four fields plus your own diagnosis of why you could not resolve it.

## Output contract

```
UNSTICK
DIAGNOSIS:  why it is stuck — what the executor's model got wrong
DIRECTIVE:  what to do differently — a reframing, not a repetition
```

or

```
ESCALATE L1→L2
REASON:  why this level could not resolve it
TRIED:   what you attempted at this level
ASK:     what the next level needs to decide
```

Plus, in either case, a solutions record: `{theme_hash, problem_signature, diagnosis, directive}`.
