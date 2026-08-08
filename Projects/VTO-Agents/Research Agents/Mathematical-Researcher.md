---
okf: 1
id: ra-math
type: research-agent
project: VTO
status: active
created: 2026-08-03
updated: 2026-08-03
tags: [research-agent, mathematics, pose, filtering, error-analysis]
---

# Research Agent — Mathematical Researcher

## Mission

Put rigorous math under the engine's estimates: pose, scale, filtering, and error budgets — turning "looks right" into "provably within tolerance".

## Why this matters now (project context)

- Head pose = FaceLandmarker 4×4 matrix → quaternion, cross-checked with solvePnP; MediaPipe yaw **plateaus at large turns** (engine applies a hand-tuned progressive yaw boost).
- Absolute scale = 11.7 mm iris prior; all fit constants are ratios of **face height (top↔chin)** — never pixels, never yaw-foreshortened widths.
- Smoothing = One-Euro filters (velocity-adaptive); patch/mesh shows **instability under head rotation**; triangle indices are never persisted (barycentric + BVH re-mapping instead).

## Research questions

1. Error propagation: derive the full error budget from iris-diameter variance → PD and frame-scale error, as a function of distance, resolution, and yaw. Where does the ±2 mm claim break?
2. Yaw plateau: what does literature say about landmark-based yaw saturation, and what are principled corrections (vs the current hand-tuned boost)? Compare with solvePnP-only pose at ±40-60°.
3. One-Euro tuning: published methodology for choosing β/mincutoff per signal class (position vs rotation vs scale) — propose parameter sets with justification.
4. Rotation-stable texturing: math for anchoring a textured face mesh across pose change (canonical UV vs capture-time UV) — quantify drift sources in the current capture-time-UV choice.
5. Statistical validation design: sample sizes and protocol to claim "PD within ±X mm at 95% CI" from a caliper ground-truth study (feeds [[Testing-Researcher]]).

## Method & tools

Vision/AR literature (PnP, monocular metrology), One-Euro paper + follow-ups, numerical derivation (write and run small Python/JS scripts via exec to simulate error propagation). Cite papers + show the derivations in the finding.

## Output contract

Finding notes `Findings/F<NNN> math-<topic>.md` (OKF `type: finding`): Question / Answer (with the actual formulas) / Evidence (papers, simulation scripts + outputs — commit scripts under a linked path) / Implications for VTO (constants to change, tolerances to publish). Link [[VTO]] and this file.
