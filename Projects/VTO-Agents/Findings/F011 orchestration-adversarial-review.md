---
okf: 1
id: F011-adversarial-review
type: finding
project: VTO
status: done
created: 2026-08-04
updated: 2026-08-04
tags: [finding, orchestration, adversarial-review, refutation, verification]
source_agent: Orchestration-Researcher
source_task: T011 Swarm-Orchestration-Automation
---

# F011 — Adversarial Finding Review (adapted from nmg-vto refutation pattern)

## Question

When should a second agent try to refute a research finding before Hermes accepts it? How do we adapt nmg-vto's 15/20/21-agent adversarial review pattern to VTO's research finding review workflow?

## Answer

### The nmg-vto refutation pattern (extracted from `Decisions.md`)

The nmg-vto repo ran three documented adversarial review rounds:

**15-agent run** (2026-07-31, lens-centre capture):
- 15 agents surveyed the codebase
- One adversarial verifier per claimed bug, prompted to **refute** (not confirm)
- Verifiers were told: "try to prove this claim is wrong — check the source, find counter-evidence"
- 3 real defect clusters confirmed; 2 claims REFUTED and **recorded so they are not re-litigated**
- Refuted claims get an explicit entry: "Refuted (recorded): <claim> — <why it was wrong>"

**20-agent run** (2026-07-31, lens synthesis):
- 20 agents in round 2
- 6 confirmed defect clusters, all fixed
- 3 refuted claims recorded: split-bake dropping separate lens meshes (pre-existing bug #1), runtime's /lens/i-only matcher (pre-existing gap), disc triangulation (verified clean)
- Key pattern: refuted claims are NOT discarded — they get a permanent record explaining why they were wrong, so future agents don't re-discover and re-litigate them

**21-agent run** (2026-07-30, 3d_app improvement analysis):
- 5 parallel area surveys → one adversarial verifier per claimed bug
- 14/15 bug claims survived adversarial verification
- One claim refuted: `Markers.sync` sprite-texture "leak" — refuted and recorded
- The two HIGH-severity claims were additionally **re-checked by hand** (the human verified the verifier)
- Method documented as: agent surveys → adversarial verifier per claim (prompted to refute against source) → synthesis

### Core pattern distilled

```
1. Primary agent(s) produce claims (findings, bug reports, research conclusions)
2. Adversarial verifier is prompted to REFUTE each claim — "prove this wrong against the source"
3. Two outcomes:
   a. Claim SURVIVES → accepted (verifier couldn't break it)
   b. Claim REFUTED → recorded permanently as refuted, with the counter-evidence
4. Synthesis: all surviving claims + all refuted claims (with why) → final report
```

The critical insight: **the verifier is prompted to refute, not confirm.** Confirmation bias is the default; adversarial prompting is the countermeasure.

### Adaptation to VTO research finding review

The VTO swarm is smaller (2 agents + sub-sessions, not 15-21). A full 20-agent review per finding is cost-prohibitive. The adaptation is **tiered adversarial review based on finding risk:**

#### Tier 1 — Standard findings (default): single-claim adversarial check

Every research finding that Hermes plans to cite in a candidate must pass a **single adversarial refutation pass**:

**When:** Inside `vto-review-done`, before Hermes compiles a candidate.

**How:** Hermes spawns a sub-agent (via a dedicated profile or `hermes profile create vto-refuter --clone`) with this prompt:

```
You are an adversarial verifier. Your job is to REFUTE the claims in the finding at:
C:\Users\ankur.singh\Obsidian Vault\Projects\VTO-Agents\Findings\F<NNN>.md

For EACH claim in the finding:
1. Find the evidence it cites (URLs, file paths, data)
2. Try to disprove it — check if the evidence actually supports the claim, or if it's misinterpreted/missing/outdated
3. If the claim survives, say "SURVIVES: <one-line why>"
4. If the claim is refuted, say "REFUTED: <what's wrong> — <counter-evidence or missing evidence>"

If ALL claims survive, report "FINDING SOUND — all claims survive adversarial review."
If ANY claim is refuted, report "FINDING NEEDS CORRECTION — <list refuted claims with counter-evidence>."

Do NOT confirm; your ONLY job is to find flaws. A claim that feels true but lacks evidence IS a flaw.
```

**Cost:** One cheap-model call per finding (can run on haiku / minimax). At 2-4 findings per wave, this is 2-4 adversarial passes — minutes, not hours.

**Outcome:** The refuter's report is stored alongside the finding as `F<NNN>-adversarial-review.md`. If the finding survives, the report is one paragraph. If refuted, Hermes writes a correction block on the original finding (not silent rewrite) and the refuted claim is recorded permanently.

#### Tier 2 — Candidate-level adversarial review (synthesis gate)

**When:** Hermes compiles a candidate from multiple findings and before submitting to `validate.ps1`.

**How:** This IS the existing validate.ps1 Stage 1 (Catalyst adversarial review on Haiku). It ALREADY does adversarial review at the candidate level. The Tier 1 check (above) reduces the chance that a finding with a bad claim reaches the candidate — so validate.ps1 finds fewer issues.

**The validate.ps1 Stage 1 IS adversarial review.** Catalyst prompts Haiku to review for adherence, factual errors, and logical gaps — this is the same spirit as nmg-vto's "prompted to refute." The difference: validate.ps1 is more structured (adherence review) while nmg-vto's approach is more open-ended ("find any flaw"). The VTO system can optionally add a `/refute-finding` Catalyst command for a more adversarial Stage 1 mode, but the existing `/review-adherence` already serves the purpose.

#### Tier 3 — Deep milestone review (go/no-go decisions)

**When:** A candidate represents a go/no-go decision (e.g., "switch to learned per-pixel glasses segmenter"), has ≥3 cited findings, or is manually flagged `-Depth deep`.

**How:** Full multi-agent adversarial swarm, adapted from nmg-vto's 21-agent pattern but scaled to the VTO swarm's resources:

1. Spawn 3-5 parallel adversarial sub-agents (via `sessions_spawn`), each assigned ONE claim from the candidate
2. Each sub-agent is prompted: "REFUTE this claim against its cited evidence + any counter-evidence you can find. Do not confirm."
3. Collect all reports; surviving claims + refuted claims with counter-evidence
4. Hermes reads all reports and decides: if ≥1 BLOCKER-level refutation, candidate returns to REWORK without proceeding to validate.ps1. If no blockers, submit to validate.ps1 `-Depth deep` — now validate.ps1's Opus verdict has the adversarial reports as additional review material

**Cost:** This is expensive (5+ sub-agent calls). Reserved for milestones per [[LOOP-ENGINEER]] depth policy: `-Depth deep` for milestone syntheses and go/no-go decisions.

### The refuted-claim register

Following nmg-vto's pattern of *recording refuted claims to prevent re-litigation*, the VTO swarm maintains:

**`Projects/VTO-Agents/Findings/REFUTED-CLAIMS.md`** — a permanent register:

```markdown
# Refuted Claims Register

Claims that were investigated, found to be false, and must NOT be re-litigated.

| Date | Finding | Claim | Why refuted | Refuter |
|---|---|---|---|---|
| 2026-08-04 | F003-xyz | "LaMa model is 12 MB" | Actual wasm is 35 MB; 12 MB was JS glue only | adversarial-review pass |
```

When any agent proposes a claim, it must check this register first. If the claim appears, it cites the register entry rather than re-litigating.

### When NOT to run adversarial review

| Scenario | Skip adversarial review? | Reason |
|---|---|---|
| Finding is a pure data dump (scraped competitor pricing, URLs) | Yes | No claims to refute; it's raw data |
| Finding is self-evident from source (e.g., "CLAUDE.md line 47 says X") | Yes — but validate.ps1 Stage 1 still runs on the candidate | The claim IS verifiable by reading the file; adversarial review adds nothing |
| Finding was produced by a sub-agent that already had adversarial instructions | No — still run Tier 1 | Sub-agents have confirmation bias; the adversarial verifier is independent |
| Finding contradicts a prior REFUTED claim | Yes, but flag it | The prior refutation stands; the new finding must explicitly address why it disagrees with the register |

## Implications for VTO Agent Architecture

1. **New SOUL / profile:** `vto-refuter` — a dedicated adversarial-verifier profile (clone of Hermes with a refutation-focused SOUL). Created once, reused for all Tier 1 checks.

2. **New invariant:** "No finding enters a candidate without Tier 1 adversarial check." Added to [[LOOP-ENGINEER]] or [[VTO Agent Architecture]] as a pre-compile gate.

3. **New file:** `Projects/VTO-Agents/Findings/REFUTED-CLAIMS.md` — the permanent refuted-claim register.

4. **validate.ps1 enhancement (optional):** Add a `/refute-finding` Catalyst command for Tier 3 deep mode. Not required for Tier 1/2.

## Evidence

- nmg-vto `Decisions.md` entries dated 2026-07-30 and 2026-07-31 — documented 15/20/21-agent adversarial review rounds with explicit "Refuted (recorded)" entries
- nmg-vto `Decisions.md` §2026-07-31 lens synthesis: "Refuted (recorded): split-bake dropping separate lens meshes = pre-existing bug #1; runtime's /lens/i-only matcher missing Glass_*-named lenses = pre-existing gap (flag to Vansh); disc triangulation verified clean (Euler/area/winding audit)"
- nmg-vto `Decisions.md` §2026-07-30 3d_app analysis: "21-agent workflow — 5 parallel area surveys → one adversarial verifier per claimed bug (prompted to *refute* against source) → synthesis. 14/15 bug claims survived; the `Markers.sync` sprite-texture 'leak' was refuted and is recorded"
- [[LOOP-ENGINEER]] — existing validate.ps1 Stage 1 IS adversarial review (Catalyst on Haiku), already in place
- Published multi-agent research: adversarial verification is the top-recommended countermeasure to LLM hallucination in agent chains (Anthropic, LangChain, and AutoGPT postmortems all cite it)

## Related

- [[LOOP-ENGINEER]]
- [[Loop Protocol Spec]]
- [[F011 orchestration-automation]]
- [[F011 orchestration-failure-modes]]