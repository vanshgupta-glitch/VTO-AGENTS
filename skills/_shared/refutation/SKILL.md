# refutation v1.0.0

## When to use

Verifying a **stated research claim** against its cited evidence, after the fact.

**Do not use on a plan. Ever.** Applied to a proposal, this stance produces results that are overly conservative and lack optimism about solutions — the plan that survives is not worth building. Pre-code review is `constructive-critique`, and its stance is the opposite of this one.

**Do not use** on a pure data dump — scraped prices, captured URLs. There is no claim to refute.
**Do not use** on something self-evident from a cited file. Reading the file *is* the verification.

Two instruments, two jobs. Picking the wrong one is the most common way this skill causes harm.

## Inputs

- The finding, with its claims and citations.
- The refuted-claims register, if one exists for this codebase.

## The stance

**Try to prove each claim wrong.** Do not confirm. Confirmation bias is the default state, and adversarial prompting is the only reliable countermeasure — but only for facts already asserted, never for options still being weighed.

A claim that *feels* true but lacks evidence **is** a flaw.

## Procedure

1. Check the register first. If this claim was previously refuted, cite the entry and stop. Do not re-litigate what has already been settled.

2. Split the finding into individual claims. A paragraph asserting four things is four claims, and they can have four different verdicts.

3. For each claim, locate the evidence it cites.
   > **DECIDE:** does the evidence actually support this claim, or something adjacent to it?
   > Adjacent support is the most common failure — the source says something *nearby* and the claim overreaches.

4. Attack four ways:
   - **Missing** — no evidence cited at all
   - **Misread** — the source says something different
   - **Overreach** — the source supports a weaker version
   - **Stale** — true when checked, not now. Check the date.

5. Distinguish observation from inference. A claim marked "observed" that was actually inferred is refuted on that basis alone, even if the inference is correct.

6. Verdict per claim. `SURVIVES` needs one line of why. `REFUTED` needs counter-evidence, not doubt.

## Failure modes

| Symptom | Cause | What to do |
|---|---|---|
| You cannot reach the cited source | Link rot, or paywall | `REFUTED — evidence unverifiable`. Unverifiable is not the same as false, and say so. |
| Every claim survives | Either a good finding, or shallow attack | Re-read step 4. If you did not attempt all four attacks, you did not refute. |
| Everything is refuted | You are attacking the framing, not the claims | Refute what was asserted, not how it was worded. |
| A claim contradicts the register | New evidence, or a repeat | Flag it. The prior refutation stands until this finding explicitly addresses why it disagrees. |

## Output contract

```
REFUTATION [F0NN]
CLAIMS:
  - claim: <verbatim>
    verdict: SURVIVES | REFUTED
    why: <one line — for REFUTED, the counter-evidence>
SUMMARY: FINDING SOUND | FINDING NEEDS CORRECTION
```

A refuted claim produces a **dated correction block** on the finding — never a silent rewrite — and a register entry so nobody re-discovers it.

**Refuted claims are not discarded.** The record of why something was wrong is worth as much as the record of what is right, and it is the only thing that stops the same wrong claim returning in six weeks with fresh citations.
