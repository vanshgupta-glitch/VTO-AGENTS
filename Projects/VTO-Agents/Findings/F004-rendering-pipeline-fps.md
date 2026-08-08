---
okf: 1
id: F004-rendering-pipeline-fps
type: finding
project: VTO
status: final
created: 2026-08-04
updated: 2026-08-04
tags: [vto, rendering, fps, benchmark, pipeline, mediapipe, three-js, lama, webcam]
task: T004 Rendering-Delivery-Feasibility
sources: [nmg-vto codebase: landmark-debug-engine.ts, GlassesRenderer.ts, FpsGovernor.ts, qualityTiers.ts, capabilityProbe.ts]
---

# F004 — Full Live-Webcam Pipeline FPS Benchmark

## Question

What is the full pipeline FPS on a real device with a live webcam: MediaPipe FaceLandmarker + three.js renderer + segmenter + texture-imprint cover + LaMa gap-fill?

## Answer

**No live-device benchmark data exists in the codebase — no real FPS measurements have been recorded.** The codebase provides the architecture for measurement (FPS governor with quality tiers, capability probe) but has never been instrumented on actual hardware. Based on architectural analysis, the pipeline is estimated at 20-30 FPS on a mid-range laptop (integrated GPU, GPU-bound on transmission pass), with the MediaPipe face detection on the main thread being the single biggest bottleneck (blocks the JS event loop for 20-47ms per detection). The FpsGovernor fallback ladder (transmission → environment → tracking cadence) provides graceful degradation but has never been triggered in a real session.

### Estimated Pipeline Breakdown (mid-range laptop, integrated webcam, 1280×720)

| Stage | Est. time (ms) | Notes |
|---|---|---|
| `getUserMedia` frame acquisition | ~2-5 | Browser internal, depends on camera resolution |
| MediaPipe FaceLandmarker (main thread) | 20-47 | CLAUDE.md estimates; runs every Nth frame based on tier |
| Face pose estimation + smoothing | <1 | Pure math, One-Euro filters |
| three.js render (frame GLB, lens materials, occlusion) | 3-8 | Depends on transmission on/off (glass render pass is biggest GPU cost) |
| Segmenter (NOT YET IN CODEBASE) | 10-20 (est.) | Proposed GlassesSegmenter ONNX, not implemented |
| Texture-imprint cover rasterization | 0.5-2 | CPU-side triangle raster at 512² atlas, done in JS |
| LaMa gap-fill (ONNX Runtime Web WASM) | 50-150 (est.) | Not measured; 512² input, WASM backend, only for gap regions |
| Canvas compositing | ~1 | Browser internal |

**Total per frame (all stages): ~87-233 ms → ~4-11 FPS with LaMa active.**
**Without LaMa (texture-imprint only): ~27-82 ms → ~12-37 FPS.**
**Face mesh + frame placement only (no removal): ~23-58 ms → ~17-43 FPS.**

The FpsGovernor targets expose the tier expectation: high=45 FPS (face mesh + frame only — removal off), mid=28 FPS, low=24 FPS.

### Key Architectural Findings

1. **MediaPipe runs on MAIN THREAD, not Worker.** The codebase tried `tracker.worker.ts` but it fails on Shopify's cross-origin CDN ("ModuleFactory not set"). This means MediaPipe detection blocks all other JS — rendering, UI updates, imprint rasterization — during its 20-47ms window.

2. **The `detectEveryN` cadence** (high=1, mid=1, low=2) controls how often MediaPipe runs. At 30 FPS screen, low-tier runs detection every 2nd frame (15 Hz effectively). The engine interpolates between detections using last-known landmarks.

3. **Lens transmission is the most expensive GPU render feature.** The `FALLBACK_LADDER` drops transmission first. The `QualityTier` sets: high=transmission on, mid=transmission on, low=transmission off. The fallback lens opacity is 0.35 (cheap alpha blending instead of transmission render pass).

4. **The CoverageAtlas imprint is pure CPU JS — no WebGL.** The 512² atlas rasterization (`CoverageAtlas.imprint()`) walks every triangle in the face mesh (MediaPipe's 478 landmarks + skirt vertices), doing barycentric bilinear sampling per texel. At 478 vertices / ~900 triangles, this is fast (<2ms) but runs on the main thread.

5. **LaMa ONNX uses WASM backend, not WebGPU.** `LamaInpainter.ts` explicitly uses `onnxruntime-web` WASM CDN at v1.27.0. The WebGPU backend is not configured. WASM LaMa at 512² is estimated at 50-150ms per frame — too slow for per-frame use, acceptable for gap-fill (only a fraction of frames need it, and only gap regions, not the full frame).

6. **No actual device measurements exist anywhere in the repo.** `FpsGovernor.sample()` is designed to receive live FPS samples and trigger fallback, but there's no FPS counter in the engine, no `performance.now()` wrapping around pipeline stages, and no benchmark harness. The `qualityTiers.targetFps` values (45, 28, 24) are aspirational targets, not measured capabilities.

## Evidence

### Quality Tier Configuration (`qualityTiers.ts`)

```
high: antialias=true, dprCap=2, transmission=true, environment=true, detectEveryN=1, targetFps=45
mid:  antialias=true, dprCap=1.5, transmission=true, environment=true, detectEveryN=1, targetFps=28
low:  antialias=true, dprCap=1.5, transmission=false, environment=true, detectEveryN=2, targetFps=24
```

### Capability Probe (`capabilityProbe.ts`)

- `classifyDevice`: mobile → 'low', desktop → 'high'
- Reads unmasked GPU renderer string, deviceMemory, hardwareConcurrency, DPR, mobile UA hint
- No actual GPU benchmark — purely advisory; FpsGovernor is the real safeguard

### MediaPipe Worker Limitation (`landmark-debug-engine.ts` line 6-10)

```
Phase-1 note: detection runs on the MAIN THREAD, not the Web Worker. MediaPipe
tasks-vision fails to initialize inside a module worker on Shopify's cross-origin
CDN ("ModuleFactory not set"); the worker path (FaceTracker) stays committed but
dormant, to be re-enabled once that's solved (R5).
```

### LaMa Inpainter (`LamaInpainter.ts`)

- Uses `onnxruntime-web@1.27.0` WASM backend from jsdelivr CDN
- Input: [1,3,S,S] image + [1,1,S,S] mask, default S=512
- Heavy assets loaded lazily via dynamic import
- Falls back to Telea on any failure

### FpsGovernor (`FpsGovernor.ts`)

- Watches rolling FPS samples, triggers fallback after 45 frames below target
- Steps DOWN only (no auto-step-up) to avoid oscillation
- Terminal rung (trackingFps) returned repeatedly → engine keeps lowering detection cadence

## Implications for VTO

1. **Instrument the pipeline immediately.** Before any architectural decisions about segmenter/inpainting, insert `performance.now()` wrappers around each pipeline stage in `landmark-debug-engine.ts` and log the breakdown. Without real numbers, all FPS claims are speculation.

2. **MediaPipe main-thread is the single biggest bottleneck.** Solving the Worker issue (R5 — "ModuleFactory not set" on Shopify CDN) would free the main thread for rendering and potentially double effective FPS. This is higher priority than adding a segmenter.

3. **LaMa at 50-150ms per frame makes per-frame inpainting infeasible.** The existing code already treats LaMa as a gap-filler (not full-frame), which is the correct strategy. The texture-imprint cover does the heavy lifting — LaMa should only fill atlas gaps at extreme angles.

4. **The FPS targets (45/28/24) are aspirational.** The fallback ladder's 45-frame debounce window (1-2 seconds at target FPS) means the governor will trigger quickly if targets are unrealistic. The targets may need downward adjustment once real measurements exist.

5. **For the v2 candidate's FPS requirement (≥30fps face mesh + frame, ≥15fps full removal):** This is achievable ONLY if (a) MediaPipe is off-thread, (b) texture-imprint covers >90% of pixels, and (c) LaMa gap-fill runs sparingly. Without Worker fix, ≥30fps for face mesh is borderline.

6. **Benchmark recommendation:** Test on a real mid-range laptop (integrated WebGL, 8GB RAM, built-in webcam) with Chrome DevTools Performance panel. Measure: (a) bare face mesh + frame placement, (b) + texture-imprint cover, (c) + LaMa on full frame, (d) + LaMa on gap region only. Report at 720p and 480p webcam resolutions.
