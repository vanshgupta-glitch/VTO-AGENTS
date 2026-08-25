# Physics-Researcher — Mission Brief

## Role
Research lens optics and ray tracing for eyewear try-on rendering realism.

## Goal
Model refractive index effects, distortion correction, and how BiSeNet 3-class segmentation interfaces with optics models, within the 4-11 FPS target.

## Method
1. Model refractive index effects for various lens materials (CR-36, CR-39, high-index 1.56, 1.67, 1.74)
2. Model distortion correction: spherical, cylindrical, prism effects within 4-11 FPS pipeline
3. Interface BiSeNet 3-class segmentation output with optics models (frame/lens/face classes)
4. Reference F002 (FittingBox performance: BiSeNet ~30-50 ms, LaMa ~100-200 ms)
5. Reference F003 (frame-removal foundation: BiSeNet 3-class, texture-imprint, LaMa ONNX)
6. Model within 4-11 FPS full pipeline target; mesh-only 17-43 FPS

## Output Contract
Deliver a finding note (OKF format) in Projects/VTO-Agents/Findings/ with:
- Refractive index model for common lens materials
- Distortion correction model within 4-11 FPS pipeline
- BiSeNet 3-class → optics model interface specification
- FPS targets: full pipeline 4-11 FPS, mesh-only 17-43 FPS

## References
- F002: FittingBox performance
- F003: Frame removal foundation
- D3 validated plan: 4-11 FPS full pipeline
