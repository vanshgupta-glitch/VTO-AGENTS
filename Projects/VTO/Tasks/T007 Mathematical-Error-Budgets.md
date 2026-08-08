# T007 — Mathematical Error Budgets & Filtering

project: [[VTO]]
status: assigned
assigned_by: Hermes
assigned_on: 2026-08-04
worker: OpenClaw

## Goal

Derive rigorous mathematical foundations for the VTO engine's estimates — PD error propagation, yaw correction, One-Euro filter tuning, and rotation-stable texturing — turning "looks right" into "provably within tolerance."

## Context (from Hermes)

Load `Projects/VTO-Agents/Research Agents/Mathematical-Researcher.md` as your mission brief; deliver per its Output contract.

**Additional constraints from D2 (personal/quality-first pivot, see [[VTO]] §Decisions D2):**
- The PD measurement pipeline is being redesigned (auto-iris + optional card calibration)
- The v2 candidate flagged PD accuracy claims (±2mm iris, ±0.5mm card) as unverified — this mission must produce the actual error budget math
- Video-only (all estimates from live webcam frames, not stills)

**Priority ordering:**
1. PD error propagation — full error budget from iris-diameter variance → PD and frame-scale error as function of distance, resolution, yaw. This directly feeds the v2 rework.
2. Yaw plateau correction — principled alternatives to the current hand-tuned progressive yaw boost; compare with solvePnP-only pose at ±40-60°
3. One-Euro filter tuning — published methodology for β/mincutoff per signal class (position vs rotation vs scale)
4. Rotation-stable texturing — math for anchoring textured face mesh across pose change (canonical UV vs capture-time UV drift sources)
5. Statistical validation design — sample sizes to claim "PD within ±X mm at 95% CI" (feeds Testing-Researcher)

## Definition of done
- [ ] Finding note `Findings/F007 math-pd-error-budget.md` — full error propagation derivation with actual formulas and simulation outputs
- [ ] Finding note `Findings/F007 math-yaw-correction.md` — principled yaw saturation correction, compared to current boost
- [ ] Finding note `Findings/F007 math-one-euro-tuning.md` — parameter sets for position/rotation/scale with published justification
- [ ] Finding note `Findings/F007 math-rotation-texturing.md` — drift sources quantified, canonical-UV tradeoffs
- [ ] Each finding: actual formulas, simulation scripts committed under linked path, concrete implications (constants to change, tolerances to publish)

## Result & context returned (OpenClaw fills this)
- What was done:
- Artifacts / paths:
- Decisions made while executing:
- Problems / open questions:
- What Hermes should know for the next decision:

## Review (Hermes fills this)
- Verdict: done | rework
- Notes: