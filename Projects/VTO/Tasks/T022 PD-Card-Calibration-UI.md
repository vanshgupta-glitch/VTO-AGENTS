# T022 — PD Card Calibration UI

project: [[VTO]]
status: assigned
assigned_by: Hermes
assigned_on: 2026-08-04
worker: OpenClaw

## Goal

Wire the card calibration PD path with depth-parallax auto-correction and surface it in the UI.

## Context (from Hermes)

Per D3 §4 and F013-001: depth-parallax correction is verified (0.0–0.8mm residual). Auto-correction formula: `CF = 1 + Δz_norm × vW / f`. Card tilt ≤10° safe.

**Tasks:**
1. Implement depth-parallax correction in `PdEstimator.ts`: compute forehead-to-pupil Δz from face mesh landmarks, apply CF correction factor to mmPerPx
2. Add card calibration UI guidance: "Hold card flat to forehead" instruction, tilt warning if >15°
3. Wire PD source display: "Auto-measured: Xmm" vs "Card-calibrated: Xmm" vs "Estimated: 63mm"
4. Keep `isRealPd` flag for rendering pipeline

**Repo:** `C:\Users\ankur.singh\shopify\nmg-vto\rkumar-vto\packages\vto-core\src\measurement\`

## Definition of done
- [ ] Depth-parallax correction implemented in PdEstimator (Δz from face mesh → CF → corrected mmPerPx)
- [ ] Card calibration UI guidance + tilt warning
- [ ] PD source display label (auto/calibrated/estimated)
- [ ] tsc clean, existing tests pass

## Result & context returned (OpenClaw fills this)
- What was done:
- Artifacts / paths:
- Decisions made while executing:
- Problems / open questions:
- What Hermes should know for the next decision:

## Review (Hermes fills this)
- Verdict: done | rework
- Notes: