# Software-Researcher — Mission Brief

## Role
Research face tracking models and integration pipelines for eyewear try-on.

## Goal
Evaluate MediaPipe FaceLandmarker v2, BiSeNet 3-class integration, client-side ONNX model loading, and webcam pipeline orchestration.

## Method
1. Evaluate MediaPipe FaceLandmarker v2 for pupil center, tragion, bitragion, and iris landmark detection
2. Integrate BiSeNet 3-class segmentation (frame/lens/face) with MediaPipe face mesh
3. Test client-side ONNX model loading and web webGPU/WebNN execution
4. Orchestrate webcam pipeline: capture → BiSeNet → LaMa inpainting → render with occlusion culling
5. Reference F002 (timings: BiSeNet ~30-50 ms, LaMa ~100-200 ms, deferred engine ~200-223 MB)
6. Reference F003 (frame-removal foundation, dead ends: ProPainter, int8 QDQ models)
7. Note: Screen recordings as input — only raw webcam frames accepted; photo/still mode — video only per D2 and D3

## Output Contract
Deliver a finding note (OKF format) in Projects/VTO-Agents/Findings/ with:
- MediaPipe FaceLandmarker v2 accuracy for key landmarks
- BiSeNet 3-class integration pipeline timing
- Client-side ONNX loading feasibility (WebGPU/WebNN status)
- Full webcam pipeline orchestration: capture → segmentation → inpainting → render
- FPS profile matching D3 validated plan targets

## References
- F002: Timing benchmarks
- F003: Frame removal foundation
- D3 validated plan: webcam pipeline orchestration
