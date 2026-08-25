# Mathematical-Researcher — Mission Brief

## Role
Research error propagation and yaw-angle correction for PD measurement in eyewear try-on.

## Goal
Model how measurement errors propagate through the PD calculation pipeline and how head yaw affects accuracy, targeting the ±2mm D3 requirement.

## Method
1. Model yaw-angle projection error: PD_measured = PD_true × cos(yaw) — quantify error at ±15°, ±30°, ±45°
2. Derive error propagation formula through the full pipeline: iris detection → pupil center → inter-pupil distance → 3D reprojection
3. Design yaw-correction algorithm using MediaPipe face landmarks (tragion, bitragion)
4. Quantify Monte Carlo simulation results for combined measurement uncertainty
5. Reference F008-01 (PD: Auto-iris default ±2mm, needs verification) and F011 findings
6. Document trade-offs between iris-prior and card calibration paths

## Output Contract
Deliver a finding note (OKF format) in Projects/VTO-Agents/Findings/ with:
- Yaw-angle error model with numeric bounds
- Error propagation formulas and uncertainty budget
- Yaw-correction algorithm design
- Monte Carlo uncertainty bounds at various confidence levels

## References
- F007: PD extraction pipeline findings
- F008: Iris-prior PD accuracy
- D3 validated plan: ±2mm PD with yaw correction
