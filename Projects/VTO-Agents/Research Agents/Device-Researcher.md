# Device-Researcher — Mission Brief

## Role
Research device-level depth sensing (LiDAR, TrueDepth, stereo camera) for eyewear try-on PD calibration.

## Goal
Analyze how device-specific depth sensors can augment or replace the iris-prior PD estimation, improving accuracy toward the ±2mm D3 target.

## Method
1. Characterize LiDAR/TrueDepth/sRGB accuracy for PD measurement (±0.5mm, ±1.5mm, ±5mm eyes-closed per D3)
2. Evaluate aperture/exposure variation on webcam depth estimation consistency
3. Research device-API availability (iOS ARKit TrueDepth, Android ARCore Depth, WebUSB depth sensors)
4. Document fallback chain: LiDAR → TrueDepth → stereo → iris-prior → average prior
5. Reference F007 (PD extraction pipeline) and F008 (iris-prior PD) findings
6. Note: TrueDepth operating band 25-50 cm; LiDAR rear-facing, cm-class natural scenes

## Output Contract
Deliver a finding note (OKF format) in Projects/VTO-Agents/Findings/ with:
- Device-specific depth accuracy table
- Fallback chain with accuracy tiers per device type
- API availability matrix (iOS/Android/Web)
- Recommendations for PD measurement strategy per device class

## References
- F007: PD extraction pipeline findings
- F008: Iris-prior PD accuracy findings
- D3 validated plan: ±2mm PD target, device fallback chain
