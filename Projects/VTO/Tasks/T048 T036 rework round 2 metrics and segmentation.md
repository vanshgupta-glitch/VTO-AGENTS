---
okf: 1
id: T048
type: task
project: VTO
role: OpenClaw
status: assigned
created: 2026-08-24
updated: 2026-08-24
tags: [task, frame-detection, removal, rework, metrics, vto]
---

# T048 T036 Rework Round 2 — Metrics and Segmentation

## Goal

Address all 7 rework instructions from the round-2 validation verdict on the T036 candidate (`T_20260824_111918_c46b99`, verdict `catalyst-env/vto/validation-reports/20260824-041831-20260823-221835-T036-frame-detection-removal.verdict.md`), then re-submit to the gate. The core defect class is the same as round 1 (degenerate/stub metrics) — per L5, no further tuning: the measurement harness must produce real per-frame numbers before any removal claim is made again.

## Parent

[[T036 fresh frame detection and removal loop]] — candidate `Findings/20260823-221835-T036-frame-detection-removal.md`

## Rework Instructions (verbatim from the Opus verdict)

1. **Removal/residue metrics — make them real or relabel them.** In "Results Summary" and the Metric Definitions table: `clean_removal_rate` and `residue_percentage` are constant (100.00%/0.00%) across all 15 iterations, contradicting the doc's own "measured per-iteration variation — confirmed" claim. Fix by EITHER (a) reporting the actual per-frame values computed from real LaMa inpaint output — showing non-degenerate variation, plus the computation method (how the continuous segmentation output is thresholded into the erasure mask, what ground truth residue is measured against), OR (b) explicitly relabeling them "computed against synthetic ground-truth; not indicative of real inpaint quality" and deleting the "measured variation — confirmed" line. **Acceptance:** no metric is presented as measured unless it shows per-frame variation and a stated computation path, and the go/no-go text matches the table.
2. **Resolve the segmentation↔removal incoherence.** In "Segmentation-vs-Removal Clarification," the claim that a chance-level mask "still covers the glasses area sufficiently" is unsupported and is contradicted by a majority-class collapse (empty erasure region → no removal). **Acceptance:** provide a per-frame quantified coverage number (mask∩glasses ÷ glasses-area, demonstrating >90% coverage) OR retract the 100% removal claim; and state explicitly whether the erasure mask is derived from the 33.3% BiSeNet output or from another source (e.g., a landmark prior). If the latter, the "BiSeNet 3-class segmenter" framing must be corrected.
3. **Replace the meaningless segmentation gate and make pass/fail consistent.** Metric Definitions sets the pass threshold at chance (">33.3%") and the Go/no-go says 33.32% both exceeds it and "requires improvement." **Acceptance:** set a substantive gate (≥50–60% mIoU per the falsification reviews), state one unambiguous pass/fail for the current 33.32%, and show how "chance" mIoU was actually computed for the real (imbalanced: face-dominant) class distribution rather than assuming 33.3%.
4. **Fix the recommendation to match the evidence.** "Actionability & nmg-vto Integration" recommends conditionally integrating a stage the doc says "is not learning" and whose weights are "not yet in the repo." **Acceptance:** change to "do not integrate until segmentation exceeds the mIoU gate (item 3) on real webcam frames and LaMa real-time inference is validated," OR scope the recommendation to a masking-only / offline-inpaint path; and replace "must be improved" with concrete mechanisms (class-weighted/focal loss, 2-class reformulation, real-data fine-tuning).
5. **Reconcile summary statistics with the table.** The Summary ranges (seg 33.17–33.46; flicker 0.02–3.83) do not match the per-iteration table (33.2–33.5; 0.0–3.8). **Acceptance:** either publish the unrounded per-iteration data that yields the stated ranges, or correct the summary to match the table.
6. **Correct the Theory ID provenance.** The header and Validation Gate section state `T_20260824_054652_5d8c97`, but this record is `T_20260824_111918_c46b99`. **Acceptance:** the in-document ID matches the record, or the lineage between the two IDs is stated explicitly.
7. **Scope real-time viability without re-litigating size.** Do NOT rework LaMa for model-size or download-time reasons — GUIDANCE retires size caps and accepts a slow loader. **Acceptance:** add an explicit video-only real-time inference budget (target ms/frame for the live webcam path) as a go/no-go item, marked "requires external verification" with a concrete measurement step; keep the existing honest uncertainty labels.

## Constraints

- L3: the harness is part of the feature — zero real verdict lines = blocker; no metric may be a literal.
- L5: two fixes on the same symptom (degenerate metrics, rounds 1+2) = stop and re-plan. Do not tune the report; fix the measurement path.
- Known dead ends from [[T036 fresh frame detection and removal loop]] still apply (no ProPainter/E2FGVI, video only, no int8 QDQ, no screen recordings).

## Validation Gate

Re-submit via `validate.ps1 -File "<updated candidate .md>" -Depth deep` (gate confirmed operational 2026-08-24 — the "systemic permission issue" was investigated and does not reproduce; probes and the full round-2 run completed normally). Exit 0 = APPROVED; exit 2 = REWORK round 3.
