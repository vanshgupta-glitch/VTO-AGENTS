# report-writing v1.0.0

## When to use

Sending anything upward — orchestrator to strategist, or strategist to human.

**Do not use** for lateral hand-offs; those carry a document pointer, not a report.
**Do not use** to pass along raw output. If the reader needs the raw output, give them a path to it.

## Inputs

- Everything that happened. You saw it; the reader did not and cannot.
- A hard budget: **2,000 characters.**

## The principle

> The product owner writes the report. The CTO does not read the developer's terminal.

Your reader is reasoning about a system they cannot observe. They have a fresh session and no memory of what you just lived through. Every character you spend on narrative is a character not spent on the thing they need to decide.

**Synthesis is the job, not compression.** A shortened transcript is still a transcript.

## Procedure

1. Write `DECISION` **first**, before anything else. One question, or the words `none — informational`.
   > **DECIDE:** does the reader actually need to decide something?
   > If not, say so explicitly. A report that implies a decision is needed when it is not wastes the most expensive attention in the system.

2. Write `LEARNED` — at most five bullets. Only things that were **not knowable before**. A bullet restating the plan is not a learning.

3. Write `ATTEMPTED` — at most three sentences. What was tried, at the altitude of approach rather than keystroke.

4. Write `EVIDENCE` — permalinks and artifact paths. **Never inline content.** A link costs 60 characters; the thing it points to costs 6,000.

5. Count. Over 2,000, cut from `ATTEMPTED` first, then `LEARNED`. **Never cut `DECISION` or `EVIDENCE`** — those are the two things that cannot be reconstructed from a link.

6. Re-read as the recipient: fresh session, no memory, no channel access.
   > **DECIDE:** could they act on this alone? If not, what single missing sentence would fix it? Add that one; do not add three.

## What surprised you

If something surprised you — a test already failing before you started, a file not where the definitions said it would be, a comment that made no sense — **it goes in `LEARNED` whether or not anyone asked.**

You are the only one who saw it. A file that contradicts `llm.md` is a document defect, and nobody upstream can see it. That kind of observation is often worth more than the task result.

## Failure modes

| Symptom | Cause | What to do |
|---|---|---|
| Over budget by a lot | Writing a transcript | Delete and start from `DECISION`. Do not trim. |
| `LEARNED` restates the plan | Nothing was actually learned | Say `none — proceeded as planned`. That is a valid, honest report. |
| Reader asks a follow-up you could have anticipated | Missing context | Add it, and note the pattern — it will recur. |
| You want to inline a log | The link feels insufficient | It is not. Inline the one line that matters and link the rest. |

## Output contract

```
REPORT [W014]
DECISION:   one question, or "none — informational"
LEARNED:    ≤5 bullets, only what was not knowable before
ATTEMPTED:  ≤3 sentences
EVIDENCE:   permalinks and artifact paths
```

Hard cap 2,000 characters. Overflow is truncated with a pointer, never silently included.
