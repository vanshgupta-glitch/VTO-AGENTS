---
okf: 1
id: CANDIDATE-frame-detection-removal-v2
type: finding
project: VTO
status: approved
created: 2026-08-04
updated: 2026-08-04
tags: [vto, candidate, synthesis, frame-detection, frame-removal, personal-project, quality-first, reworked, swarm-complete]
supersedes: [CANDIDATE-frame-detection-removal]
sources: [F001-fittingbox-summary, F001-fittingbox-frame-removal, F001-fittingbox-frame-removal-scale-fit, F001-fittingbox-scale-fit, F001-fittingbox-runtime, F001-fittingbox-runtime-engine, F001-fittingbox-privacy, F001-fittingbox-metrics, F001-fittingbox-network-waterfall, F001-fittingbox-network-runtime, F001-fittingbox-network-cdn, F002-patent-priorart, F002-patent-designaround, F003-software-segmentation-models, F003-software-lama-benchmark, F003-software-mask-classification, F004-rendering-propainter-feasibility, F004-rendering-pipeline-fps, F004-rendering-atlas-coverage, F004-rendering-glb-pipeline, F007-001-math-pd-error-budget, F008-01-medical-iris-diameter, F010-testing-pd-protocol]
rework-applied: [2026-08-04: PD accuracy claims → design targets with depth-parallax; >90% coverage → ~85-90% design target; staged-adoption + ProPainter dead end; Open Questions updated with resolved + new PD question]
---

# Candidate v2 — Frame Detection & Removal (Personal / Quality-First)

**Supersedes [[CANDIDATE-frame-detection-removal]] (D1).** Per Rohit's 2026-08-04 override: this is now a personal, non-commercial project optimized for maximum quality + user experience. All patent-constrained tradeoffs from D1 are dropped. See [[VTO]] §Decisions D2 for the seven overrides.

## Question

How should the VTO improve its frame detection and frame removal, optimized purely for maximum quality and user experience on live webcam video, with no patent, size, or commercial constraints?

## What FittingBox Does (grounded in F001 — still useful context)

FittingBox's frame removal is a **dual-path, feature-gated premium add-on** (`addon_frameRemoval`, per F001-fittingbox-frame-removal-scale-fit §Answer):

1. **Live webcam frame removal — client-side WASM.** The FBxLive engine (custom C++ → Emscripten WASM + WebGL2, per F001-fittingbox-runtime-engine §Answer) performs real-time diminished reality on the webcam stream locally. No network image uploads observed during the live path (per F001-fittingbox-frame-removal-scale-fit §Answer, corroborated by F001-fittingbox-metrics row "Frame removal (live): Client-side"). The engine runs off the main thread via Worker + OffscreenCanvas (per F001-fittingbox-runtime-engine §Answer).

2. **Photo/still try-on frame removal — server-side.** The browser uploads a base64 photo + glasses UID to a `POST {restApiUrl}render` endpoint; the server returns `outputImageB64` + `eyesPoints` (per F001-fittingbox-frame-removal §Answer). Face detection and face-shape analysis run on dedicated server endpoints (`detectionservice`, `faceshapeservice` — per F001-fittingbox-privacy §Answer).

3. **Scale/fit — iris-based PD, server-computed.** Default PD is 63 mm statistical average (`pdType: "statistic_pd"`, `isRealPd: false` — per F001-fittingbox-scale-fit §Answer). The server returns `eyesPoints` from the render call; a separate PD-measurement product uses the same FBxLive engine + `fbx-streamgrabber` for webcam-based PD with claimed "1 mm accuracy, 7 of 10 measurements" (per F001-fittingbox-scale-fit §Answer). No credit-card calibration was found (per F001-fittingbox-scale-fit §Answer; independently confirmed via PostHog regex noise in F001-fittingbox-frame-removal-scale-fit §Answer).

4. **Engine delivery — ~12 MB monolith, deferred.** FBxLive.wasm = 10.5 MB raw / 2.8 MB gz-transferred + FBxLive.data = 1.4 MB + JS glue = 254 KB (per F001-fittingbox-network-cdn table). These are downloaded on widget init (`startVto`), not on first paint — the entry bundle is just ~79 KB Angular main (per F001-fittingbox-network-cdn §Implications). This is the "small shell, deferred heavy engine" pattern (per F001-fittingbox-metrics headline #1).

### Contradiction note

F001-fittingbox-summary states frame removal is "server-side" and positions this as a universal statement. F001-fittingbox-frame-removal-scale-fit and F001-fittingbox-metrics both document the **dual** architecture: live = client WASM, photo = server upload. The summary oversimplifies; the detailed findings are consistent with each other. For this candidate, the dual-path characterization from the detailed findings is authoritative.

## Technical Approach Chosen & Why (replaces D1's patent-constraints section)

D1 was shaped primarily by patent avoidance: geometric contour-tracing kept us away from FittingBox Family A's learned-segmenter claim, LaMa+Telea-only kept us in prior-art territory, and the 250 KB gz cap + attorney gates were commercial necessities. D2 throws those constraints out — personal use only. The new optimization function is purely: **best visual quality + best user experience, running on live webcam video in the browser.**

### 1. Learned per-pixel glasses segmenter (replaces geometric contour-tracing)

**Switch TO a learned model.** The current geometric contour-tracer (`FrameDetector.ts` — ray-by-ray from MediaPipe landmarks, evaluating closure/smoothness/thickness/contrast/cross-lens agreement/temporal stability, per F002-patent-designaround §Answer) is robust but inherently limited: it traces contours, not per-pixel masks, so frame boundaries are approximate and transparent/lens regions are not differentiated from opaque frames. A learned per-pixel segmenter will produce a pixel-accurate mask distinguishing frame, lens, and face — the foundation for quality removal.

**Recommendation — BiSeNet fine-tuned for 3-class glasses segmentation (primary), U-Net+MobileNetV3 as fallback.** Per F003-software-segmentation-models:

- **Architecture family:** A lightweight encoder-decoder (U-Net with MobileNetV3/EfficientNet backbone, or SegFormer-B0) trained on paired glasses/no-glasses face images. The training data pipeline can leverage the Lyu et al. CVPR 2022 synthetic-glasses-rendering approach (per F002-patent-priorart §Known lead from project brief): generate paired images by rendering synthetic glasses onto clean faces, producing pixel-perfect glasses/lens/face masks as ground truth. This is the standard approach for data-scarce segmentation tasks.
- **Why not MODNet / SAM:** MODNet is designed for portrait matting (person vs. background), not within-face region segmentation. SAM 2 and MobileSAM are general-purpose; a domain-specific model will be both smaller and more accurate for glasses. ByeGlassesGAN (Lee & Lai 2020, per F002-patent-priorart §Answer) includes a segmentation decoder specifically for glasses — its architecture is a direct reference point, though its PyTorch model would need ONNX export for browser deployment.
- **Runtime delivery:** Export to ONNX, run via ONNX Runtime Web with WebGPU backend. Target inference <20ms per frame on a mid-range GPU (needs verification).
- **Fallback plan:** Keep the current `FrameDetector.ts` geometric contour-tracer as a warm-start and fallback. If the learned model fails to load or produces a low-confidence prediction, fall back to contour-tracing. The segmenter's output can also be used to seed/refine the contour-tracer's landmark seeds (inverse of current approach).

**Exact model choice → needs Software-Research mission.** Current findings lack model-size-vs-accuracy benchmarks for glasses segmentation in browser. A dedicated Software-Research mission must: (a) survey published glasses-segmentation models (ByeGlassesGAN, ERGAN, recent SegFormer/U-Net variants), (b) benchmark 3–5 candidates for ONNX export size, WebGPU inference latency, and segmentation IoU on eyewear images, (c) recommend the best one for real-time video.

### 2. Frame/face cover — hybrid segmenter + texture-imprint (best quality)

**Evaluated three approaches:**

| Approach                                                                      | Quality                                        | Temporal coherence                          | Coverage                               |
| ----------------------------------------------------------------------------- | ---------------------------------------------- | ------------------------------------------- | -------------------------------------- |
| (a) Segmenter + per-frame video inpainting                                    | Good boundaries, but flicker between frames    | ❌ Poor — each frame independently inpainted | Full (every pixel re-synthesized)      |
| (b) Pure texture-imprint (current `coverImprint.ts` + `CoverageAtlas.ts`)     | Good where covered, seams at uncovered angles  | ✅ Excellent — session-fixed UV atlas        | Partial (limited to calibration poses) |
| (c) **Hybrid: segmenter mask + texture-imprint source + inpainting fallback** | **Best** — accurate boundaries + coherent fill | ✅ Atlas for covered areas                   | Near-full (gaps filled by inpaint)     |

**Recommendation: Hybrid (c). Staged adoption — ship the baseline first (single-pose calibration + per-frame LaMa inpainting); adopt multi-pose/hybrid only if Q5 demonstrates a perceptible, measured quality gain over the baseline.** The learned segmenter produces a precise per-pixel mask (frame/lens/face) every frame. The texture-imprint (`coverImprint.ts` + `CoverageAtlas.ts` + `FacePatchLayer.ts`, per F002-patent-designaround §Answer) provides the clean-face source texture — built once at calibration, then rendered from the UV atlas at runtime. Where the atlas has coverage for a given surface point, use it (temporally coherent, zero per-frame synthesis cost). Where coverage is missing (extreme head rotation beyond calibration poses), fall back to LaMa inpainting on just the uncovered region. The segmenter's lens-vs-frame distinction also enables lens-tint simulation on the virtual frame without the original lenses bleeding through.

**Why this beats per-frame inpainting alone (a):** Video inpainting models like ProPainter/E2FGVI produce beautiful results but running them at 30fps in the browser is not feasible today. Per F004-rendering-propainter-feasibility: **ProPainter is a dead end for browser deployment** — 157.8 MB main model, ~42 MB supporting models, no ONNX export path exists, and flow/attention ops have no ONNX Runtime Web equivalent. The texture-imprint approach amortizes the heavy work: one-time calibration (5–10 seconds of pose capture) builds a clean-face model that renders at zero per-frame ML cost for ~85–90% of pixels at typical head poses (design target, to be validated via Q5 below — per F004-rendering-atlas-coverage, multi-pose ±30° yaw calibration achieves ~85–90% coverage at 45° yaw; the current single-pose ±17° hold-still gate drops to 65–75% at 45° yaw).

**Why this beats pure texture-imprint (b):** The current single-pose calibration leaves the atlas incomplete for yaw >20–30°. The segmenter lets us capture multiple poses during calibration (turn head left/right/up/down over 5–10s) and imprint each — dramatically expanding atlas coverage. Plus, the segmenter's boundary precision means no glasses-pixel contamination in the imprint.

**Current source to build from:** `coverImprint.ts` (session-fixed UV chart, area-ratio facing weight), `CoverageAtlas.ts`, `FacePatchLayer.ts`, `CalibrationController.ts` (hold-still gate, calibrate-and-lock), per F002-patent-designaround §Evidence. Add: multi-pose capture loop (guided head-turn UI), segmenter mask integration into the imprint pipeline, and specular-removal pass before imprinting (removes glare from original glasses that would bake into the atlas).

### 3. Inpainting — per-frame LaMa at calibration + runtime gap-fill (staged adoption)

**D1 constrained us to LaMa + Telea only (patent-safe prior art). D2 removes that constraint.** The question is: what inpainting approach gives the best visual quality on live video in the browser?

**SOTA video inpainting models (evaluated — both are dead ends for browser deployment):**

- **ProPainter** (Zhou et al., ICCV 2023) — 157.8 MB main model + ~42 MB supporting models. No ONNX export exists; flow/attention ops have no ONNX Runtime Web equivalent. **Dead end — dropped from architecture.** Per F004-rendering-propainter-feasibility.
- **E2FGVI** (Li et al., 2022) — similar architecture, same ONNX export blockers. **Dead end — dropped.**

Neither runs in the browser, and neither can be exported to browser-compatible ONNX.

**Recommendation — Single-tier LaMa inpainting (staged adoption):**

**Baseline (ships first): Per-frame LaMa at calibration + runtime gap-fill.** The multi-pose calibration sequence captures N frames. Run the segmenter on each to produce per-frame masks, then run LaMa on each frame independently to produce inpainted clean-face frames. These feed into the texture-imprint atlas build. At runtime, LaMa fills only the uncovered gap regions where the atlas has no valid texel.

Per F003-software-lama-benchmark: LaMa ONNX is **~198 MB** FP32 with estimated WebGPU latency of **50–200+ ms per frame** — far above the 33 ms (30 fps) budget. This confirms LaMa is calibration-tier only, not per-frame at runtime. At calibration time (once per session, not per frame), 50–200 ms per frame for 100–200 calibration frames = 5–40 seconds total — acceptable for a one-time calibration step. At runtime, gap-fill regions are small (≤10–15% of frame pixels), which may reduce latency proportionally, but this needs measurement.

**Enhancement (adopted only if Rendering-Research mission Q5 demonstrates perceptible gain):** Multi-pose calibration (±30° yaw, ±15° pitch guided head-turn) to expand atlas coverage from the current single-pose ~65–75% to ~85–90% at 45° yaw. Per F004-rendering-atlas-coverage, the dominant visual quality issue at extreme angles is seam visibility between atlas-covered and inpainted regions — not coverage percentage. The baseline (single-pose calibration + per-frame LaMa) may be indistinguishable from the multi-pose enhancement for typical try-on head motion (±20° yaw). Ship the baseline first; adopt the multi-pose enhancement only if Q5 demonstrates a perceptible, measured quality gain.

**Why not pure per-frame inpainting at runtime:** LaMa at 50–200+ ms per frame cannot sustain interactive frame rates. The texture-imprint approach (baseline) amortizes the inpainting cost: one-time calibration inpainting (5–40 seconds) → zero per-frame ML cost for atlas-covered pixels → small LaMa gap-fill only for uncovered regions.

**Dedicated glasses-removal models (e.g., ByeGlassesGAN):** These models combine segmentation + inpainting into one network. Per F003-software-segmentation-models, ByeGlassesGAN has **no public code or weights** (zero GitHub repos) — dead end. The general observation holds: such models produce a single output frame independently with no temporal coherence, causing flicker when run frame-by-frame on video. Even if weights were available, they'd be a data-source for training, not a runtime inpainter.

### 4. PD / scale — auto-iris default + optional card calibration (best UX)

**D2 says: "choose whatever gives the best USER EXPERIENCE (accuracy + zero friction). Card calibration is fine if it helps; no patent constraint."**

**Two modes, both client-side:**

**Primary — Auto-iris PD (low-friction, near-instant ≈1–3 s auto-measurement).** The existing `PdEstimator.ts` + `irisMetrics.ts` (per F002-patent-designaround §Evidence) already compute iris-prior mm-per-px from MediaPipe iris landmarks. Improve: run iris measurement over ≈1–3 seconds of steady video (not a single frame), filter outliers, converge to a stable estimate. There is no manual step — the measurement runs automatically while the user simply looks at the camera. Display as: "PD: ~63.5 mm (auto-measured)" with a confidence indicator. FittingBox uses an identical iris-based approach but computes it server-side and defaults to statistical 63 mm when unavailable (per F001-fittingbox-scale-fit §Answer) — we beat them by doing it client-side with zero latency and being transparent about measurement vs. default.

**PD accuracy claim:** Iris-prior PD accuracy is ~±2 mm as a design target (needs verification). Per F007-001, this holds at ≥640 px face height + |yaw| ≤30° + HVID within ±0.5 mm of the prior; at 200 px face height (arm's length) total σ rises to ~2.8 mm and the ±2 mm claim fails. The validation gate's independent geometric check further finds a systematic depth-parallax error of ~1.2–5.0 mm from uncorrected card-at-forehead calibration (camera distance 350–500 mm, forehead-to-pupil depth offset 10–30 mm). Per F008-01, `IRIS_DIAMETER_MM` should change from 11.7 → 12.0 mm (Pirayesh 2023, n=344) to reduce systematic error. The ±2 mm iris-only figure and any card-anchored precision figure are design targets pending verification via the PD study protocol (F010-testing-pd-protocol) and the depth-parallax correction research mission below. Until measured, no specific mm figure should be presented to users.

**Optional — Card calibration (one-time precision, ~10s).** The existing `PdEstimator.ts` already has an 85.6 mm credit-card hook (`setScaleReference`, per F002-patent-designaround §Evidence). Surface it as an optional step: "Refine your fit — hold a standard credit card to your forehead for 2 seconds." Card calibration anchors the scene scale and meaningfully reduces PD error beyond iris-only (per F007-001, iris-prior fails universally without card-scale correction at typical arm's-length distances). The card-at-forehead geometry requires a depth-parallax correction (camera-to-forehead ≠ camera-to-pupil distance) — solved by computing the scale factor at the pupil plane using the forehead-to-pupil depth offset from the face mesh after calibration.

**PD fallback chain:** auto-iris (always on) → card-calibrated (if user opted in) → statistical 63 mm (if iris is unmeasurable — matches FittingBox's fallback, per F001-fittingbox-scale-fit §Answer). The `isRealPd` flag pattern from FittingBox (per F001-fittingbox-scale-fit §Implications) is worth keeping: it tells the rendering pipeline whether the PD is measured or estimated, enabling appropriate per-frame adjustment tolerance.

**UI flow:** User clicks "Try On" → face mesh appears instantly → within ≈1–3 seconds of the user simply looking at the camera, iris PD auto-measured and frame snaps to correct scale. If the user wants precision ("is this really my size?"), they tap "Refine fit" → guided card-calibration. Low-friction (no manual step) for the 90% case; optional precision for the 10%.

### 5. No size cap — loading UX specification (replaces 250 KB gz budget)

**D2 drops the ≤250 KB gz entry constraint.** Heavy models are acceptable. The optimization shifts from "how small can we make it" to "how good can the loading experience be."

**Delivery architecture (keep FittingBox's proven pattern, remove the size constraint):**

FittingBox's "small shell, deferred engine" pattern (79 KB Angular entry, ~12 MB engine at activation — per F001-fittingbox-network-cdn §Implications, F001-fittingbox-metrics headline #1) is the correct architecture regardless of budget. The difference: our engine can be 50–100 MB if it delivers better quality, as long as the loading UX is good.

**Loading UX specification:**

1. **Shell / entry bundle:** Three.js core + MediaPipe FaceLandmarker WASM loader + minimal UI (<200 KB gz — still small because it's good UX). Renders instantly on page load. Shows a face-outline placeholder and a "Try On" button.
2. **Activation trigger:** On "Try On" click, begin progressive model download.
3. **Progress indicator:** A single progress bar showing overall engine load progress with component-level detail:
   - "Loading face tracker…" (MediaPipe FaceLandmarker — ~5–10 MB)
   - "Loading glasses detection model…" (segmentation model — ~5–15 MB ONNX)
   - "Loading clean-face builder…" (inpainting model — LaMa ONNX)
   - Each step shows MB loaded / total and an ETA.
4. **Progressive rendering:** Show the bare face mesh + frame placement as soon as MediaPipe loads (step 1), before the removal models are ready. The user sees their face with a virtual frame overlaid — degraded mode, but instant gratification. When the segmenter loads (step 2), the mask appears (glasses region highlighted). When inpainting loads (step 3), the glasses are removed and the clean face appears.
5. **Caching:** All models cached in IndexedDB with versioned keys (content hash as version). Service Worker intercepts model fetches for offline-capable return visits — second visit loads from cache in <2 seconds.
6. **Warm-up / preload:** On mouse-hover of the "Try On" button, begin preloading the smallest model (MediaPipe FaceLandmarker). On touch-down (mobile), begin preloading. This steals ~500ms of preload time that makes activation feel instant.
7. **Total engine size:** MediaPipe (~5–10 MB) + segmentation model (~5–15 MB) + LaMa ONNX (~198 MB per F003) = **~208–223 MB total** → first-visit load **≈ 33–36 s** at 6.25 MB/s. All models cached in IndexedDB after first visit; second visit loads from cache in <2 seconds. Per §3/Q4, ProPainter is a dead end for browser deployment and is not shipped — there is one scenario, one engine size, one load time. See F003-software-lama-benchmark and F004-rendering-propainter-feasibility.

**A slow loader with a better experience wins** (Rohit's directive) — the number is honest: ~208–223 MB is a one-time, cached, progressively-rendered wait (~33–36 s at 6.25 MB/s), never a per-visit cost. Second visits load from cache in <2 seconds. The key is that the experience during loading feels progressive, transparent, and worth the wait.

### 6. Video only — remove photo/still mode

**D2: "Video only. Remove any photo/still mode from the plan entirely. Every feature runs on the live webcam video stream."**

This removes the entire server-side/photo path and its privacy liability, while shifting complexity into the client-side real-time pipeline (live per-frame segmentation, inpainting, and rendering at interactive frame rates):

- **Remove:** Photo capture flow, still-image upload, server-side render endpoint, `POST render` equivalent, still-mode face detection/shape analysis.
- **Keep:** Everything runs on the live webcam stream via `getUserMedia` → MediaPipe FaceLandmarker → segmenter → texture-imprint → inpainting → three.js render.
- **PD measurement** runs on live video frames (2–3 seconds of steady webcam), not on a captured still.
- **Calibration** (multi-pose capture for atlas build) runs on live video — guided head-turn sequence, not uploaded photos.

This also means the FittingBox privacy liability (photo uploads to their server — per F001-fittingbox-privacy §Answer) is irrelevant; our entire pipeline runs locally.

### 7. No patent/attorney/FTO gating

All patent-constrained tradeoffs from D1 are dropped. The "Hard disclaimer" and attorney-action steps are removed. Patent references in this document are purely informational. D2 optimizes purely for quality + UX.

## Recommended Approach for nmg-vto Codebase

> Every step is concrete and sources real files from the current codebase at `C:\Users\ankur.singh\shopify\nmg-vto\rkumar-vto\packages\vto-core\src\`.

### 1. Replace contour-tracing with learned segmenter — new module

**Current state:** `frame-detection/FrameDetector.ts` — geometric contour-tracing (ray-by-ray from MediaPipe landmarks). `frame-detection/ClipEyewearClassifier.ts` — MobileCLIP zero-shot type classifier (per F002-patent-designaround §Evidence).

**Action — add a new `GlassesSegmenter.ts` module:**
- Load an ONNX glasses-segmentation model via ONNX Runtime Web with WebGPU backend.
- Input: the webcam frame (or face-crop). Output: a 3-channel mask (frame / lens / face) at the frame resolution.
- Run every N frames (e.g., every 3rd frame) with mask interpolation for intermediate frames to keep FPS high.
- The CLIP classifier (`ClipEyewearClassifier.ts`) can be retired — the segmenter inherently identifies eyewear presence and type from the mask morphology (full-rim produces a continuous ring; half-rim produces a partial ring; rimless produces lens-only blobs; none produces all-face). If type classification is still needed for rendering decisions (e.g., different cover strategies for different frame types), derive it from the mask, not from a separate CLIP inference.

**Exact model selection → Software-Research mission required** (see Open Questions).

**Keep `FrameDetector.ts` as fallback.** If the ONNX model fails to load (WebGPU unavailable, model download failed), fall back to the current geometric contour-tracer. This ensures the feature degrades gracefully, never breaks.

### 2. Integrate segmenter mask into the texture-imprint pipeline

**Current state:** `coverImprint.ts` + `CoverageAtlas.ts` + `FacePatchLayer.ts` + `CalibrationController.ts` (per F002-patent-designaround §Evidence). The imprint currently uses the contour-tracer's approximate mask.

**Action:**
- Replace the contour-tracer mask source in the imprint pipeline with the segmenter's per-pixel mask. The segmenter's lens-vs-frame distinction prevents lens-tint from the original glasses contaminating the clean-face atlas.
- Add a **specular-removal pass** before imprinting: detect and inpaint specular highlights (glare on original lenses) so they don't bake into the atlas. This is a novel sub-task — see Q9 for the open questions before committing to implementation.
- **Multi-pose calibration:** Extend `CalibrationController.ts` to guide the user through a head-turn sequence (center → left 30° → right 30° → up 15° → down 15°) over ~5–10 seconds. Capture and imprint frames at each pose, building a coverage atlas that spans ±30° yaw and ±15° pitch. This dramatically improves coverage vs. the current single-pose calibration.

**Source files to modify:** `coverImprint.ts`, `CoverageAtlas.ts`, `CalibrationController.ts`, `FacePatchLayer.ts`.

### 3. Two-tier inpainting: LaMa at calibration + LaMa gap-fill at runtime

**Current state:** `LamaInpainter.ts` (LaMa), `InpaintingEngine.ts`, `MaskGenerator.ts` (dilate 4px, feather 6px, lens-subtract, brow-protect — per F002-patent-designaround §Evidence).

**Action:**

**Tier 1 — `CalibrationInpainter.ts` (new module, runs once per session):**
- During calibration, capture N sequential frames from the guided head-turn sequence.
- Run the segmenter on each frame to produce per-frame masks.
- Feed the masked frame sequence into per-frame LaMa inpainting (ProPainter/E2FGVI are dead ends per §3/Q4).
- The output is a sequence of clean-face frames. Feed these into the texture-imprint atlas build (ProPainter/E2FGVI are ruled out per §3/Q4; per-frame LaMa is the calibration path).

**Tier 2 — `GapFillInpainter.ts` (new module, runs per frame for uncovered pixels):**
- At runtime, after rendering the texture-imprint cover, identify atlas coverage gaps (pixels where the UV atlas has no valid texel).
- Run LaMa on just the gap regions (not the full frame) via ONNX Runtime Web + WebGPU.
- The `MaskGenerator.ts` dilate/feather/lens-subtract/brow-protect pipeline can be simplified since the segmenter already produces a clean mask. Keep dilate+feather for gap-region padding only.

**Source files to keep/modify:** `LamaInpainter.ts` (keep as runtime gap-filler), `InpaintingEngine.ts` (add tier routing), `MaskGenerator.ts` (simplify, segmenter provides primary mask).

### 4. PD: auto-iris default + optional card refinement

**Current state:** `measurement/PdEstimator.ts` (iris-prior mm-per-px + optional 85.6 mm card hook), `measurement/irisMetrics.ts` (per F002-patent-designaround §Evidence).

**Action:**
- Make auto-iris PD the default and always-active path. Run on 2–3 seconds of steady webcam video (not a single frame) with outlier filtering for stable convergence.
- Card calibration: keep the existing `setScaleReference` hook. Surface it as an optional "Refine fit" step in the UI — not hidden, not required.
- Default PD fallback: 63 mm statistical average when iris is unmeasurable (matches FittingBox, per F001-fittingbox-scale-fit §Answer). Keep the `isRealPd` flag.
- Display the currently active PD source to the user: "Auto-measured: 63.5mm" vs. "Card-calibrated: 63.2mm" vs. "Estimated: 63.0mm."

**Source files to modify:** `PdEstimator.ts` (temporal filtering), `irisMetrics.ts` (multi-frame convergence).

### 5. Remove size cap — add loading UX

**Current state:** The codebase was designed for the ≤250 KB gz constraint with lazy-loaded models.

**Action:**
- Remove the 250 KB gz budget from all constraints and documentation.
- Add a `LoadingUX.ts` module that implements the progressive loading specification from §5 above: progress bar with component-level detail, progressive rendering (face mesh → mask → clean face), IndexedDB caching with content-hash keys, Service Worker for offline return visits, hover/touch-down preload.
- Preload triggers: `mouseenter` on the "Try On" button starts MediaPipe model fetch. `click` starts segmentation + inpainting model fetch.

**Source files to modify:** Entry point / app shell (add loading UI), model loader (add progress callbacks, cache checks).

### 6. Remove photo/still mode

**Action:**
- Remove any photo capture UI, still-image processing pipeline, and server-side render endpoint stubs.
- Ensure every feature (detection, segmentation, removal, PD, calibration) operates on the live `MediaStream` from `getUserMedia`, never on a captured still image.
- The calibration flow (multi-pose capture) uses the live webcam stream — no photo upload step.

**Source files to check/remove:** Any still-capture components in the UI layer, any `POST render` endpoint references.

### 7. No patent gating

**Action:** Remove patent-related code comments, FTO checklists, and attorney-action TODO items from the codebase. This is a personal project — no patent clearance needed.

## Open Questions / What Needs Research Missions

### ✅ Resolved by T003 Software-Research (F003)

1. **✅ Which learned glasses-segmentation model?** → **BiSeNet (fine-tuned for 3-class glasses segmentation).** U-Net+MobileNetV3 as fallback (~2–3 MB INT8). SegFormer-B0 pending transformer-ops ONNX verification. ByeGlassesGAN: dead end (no public code/weights). Lyu et al. CVPR 2022 synthetic-glasses pipeline recommended for training data. See F003-software-segmentation-models.

2. **✅ LaMa ONNX model size + WebGPU latency.** → **~198 MB FP32, estimated 50–200+ ms per frame.** Confirmed calibration-tier only — cannot meet 33 ms (30 fps) budget. FP16 exports on HuggingFace are broken. FFC ops (RFFT/IRFFT) may not be supported by ORT Web WebGPU EP — needs verification. See F003-software-lama-benchmark.

3. **✅ MobileCLIP retirement confirmation.** → **YES, can replace MobileCLIP.** Once the segmenter produces 3-class masks (frame/lens/face), eyewear type (full-rim, half-rim, rimless, none) is reliably derivable from mask morphology alone. See F003-software-mask-classification.

### ✅ Resolved by T004 Rendering-Research (F004)

4. **✅ ProPainter/E2FGVI in-browser feasibility.** → **Both dead ends.** ProPainter: 157.8 MB + ~42 MB supporting, no ONNX export, flow/attention ops unsupported by ONNX Runtime Web. E2FGVI: same blockers. Dropped from architecture. See F004-rendering-propainter-feasibility.

5. **✅ Multi-pose atlas coverage at extreme angles.** → **~85–90% at 45° yaw (multi-pose ±30° calibration), 65–75% at 45° yaw (current single-pose ±17°).** Seam visibility is the dominant quality issue — not coverage percentage. The baseline (single-pose + per-frame LaMa) may be indistinguishable from multi-pose for typical ±20° try-on head motion. Ship baseline first; adopt multi-pose only if measured gain demonstrated. See F004-rendering-atlas-coverage.

6. **Live webcam FPS benchmark for the full pipeline.** → **Estimated 4–11 FPS with LaMa active, 17–43 FPS face-mesh only.** No live-device benchmarks exist. **MediaPipe main-thread detection (20–47 ms) is the #1 bottleneck** — Worker+OffscreenCanvas migration is higher priority than any new model addition. See F004-rendering-pipeline-fps. (needs actual device measurement)

### New — PD depth-parallax correction (needs verification)

7. **Auto-iris vs. card-anchored PD error on live video under realistic head/card tilt and camera distance, including depth-parallax correction.** The card-at-forehead geometry introduces a systematic depth-parallax error (~1.2–5.0 mm at 350–500 mm camera distance) because the card plane (forehead) and pupil plane differ in depth by 10–30 mm. The correction requires computing the scale factor at the pupil plane using the forehead-to-pupil depth offset from the face mesh. Must verify: (a) that the depth-offset correction brings card PD within measurement tolerances, (b) sensitivity to card tilt angle, and (c) whether this correction can run automatically without user awareness. (needs verification — feeds the PD study protocol in F010-testing-pd-protocol)

### Needs existing findings (no research mission)

8. **GLB frame sizes for real catalog.** The ≤3 MB / 50k tris constraint per frame from D1 may still be a practical limit for loading UX, but it's no longer a hard constraint. Real catalog GLB sizes need profiling. (carried from D1 — needs verification, no research mission required)

9. **Specular-highlight detection and removal before atlas imprint.** The §Implementation item 2 proposes a specular-removal pass to prevent original-lens glare from baking into the clean-face atlas. Open questions: (a) is a saturation+brightness threshold heuristic sufficient, or are learned specular-detection methods needed, (b) what is the computational cost at calibration time, and (c) is this step necessary at all — does glare actually bake into the atlas at visible levels given the segmenter's lens-vs-frame mask already excludes the lens region? (needs verification — defer to a dedicated investigation before committing to implementation)

## Evidence

Every factual claim above is sourced from the following finding files:

**F001 — FittingBox teardown:**
- F001-fittingbox-summary — architecture overview, key metrics table, "what to copy/beat/avoid"
- F001-fittingbox-frame-removal — server-side photo removal pipeline, addon_frameRemoval gating, render endpoint contract
- F001-fittingbox-frame-removal-scale-fit — dual-path clarification (live=client WASM, photo=server), 16 patents claim, removal component reducers
- F001-fittingbox-scale-fit — iris-based PD, 63 mm default, server-computed eyesPoints, no credit-card calibration
- F001-fittingbox-runtime — FBxLive engine signature scan (no three.js/babylon/MediaPipe/TF.js)
- F001-fittingbox-runtime-engine — Emscripten WASM + WebGL2, Worker + OffscreenCanvas, Angular+NgRx app framework
- F001-fittingbox-privacy — live path local / photo path uploads face, analytics/data egress map
- F001-fittingbox-metrics — headline takeaways, engine total ~12.4 MB, default PD 63 mm
- F001-fittingbox-network-waterfall — CDN layout, 3D asset format (fitsource proprietary, no GLB), bundle size table
- F001-fittingbox-network-runtime — accurate CDP sizes (FBxLive.wasm 10.5 MB raw / 2.8 MB gz), deferred engine activation
- F001-fittingbox-network-cdn — CDN domain map, accurate bundle sizes, small-entry/deferred-engine pattern

**F002 — Patent / source analysis (used only for codebase references and prior art, not patent gating):**
- F002-patent-priorart — academic glasses-removal literature (ERGAN 2019, ByeGlassesGAN 2020, Lyu et al. CVPR 2022), inpainting prior art (LaMa 2021, PatchMatch 2009, Criminisi 2004, Telea 2004)
- F002-patent-designaround — nmg-vto source analysis: `FrameDetector.ts`, `ClipEyewearClassifier.ts`, `coverImprint.ts`, `CoverageAtlas.ts`, `FacePatchLayer.ts`, `LamaInpainter.ts`, `InpaintingEngine.ts`, `MaskGenerator.ts`, `PdEstimator.ts`, `irisMetrics.ts`, `CalibrationController.ts`

**File index:** F001-fittingbox-summary · F001-fittingbox-frame-removal · F001-fittingbox-frame-removal-scale-fit · F001-fittingbox-scale-fit · F001-fittingbox-runtime · F001-fittingbox-runtime-engine · F001-fittingbox-privacy · F001-fittingbox-metrics · F001-fittingbox-network-waterfall · F001-fittingbox-network-runtime · F001-fittingbox-network-cdn · F002-patent-priorart · F002-patent-designaround
