---
okf: 1
id: CANDIDATE-frame-detection-removal
type: finding
project: VTO
status: done
created: 2026-08-04
updated: 2026-08-04
tags: [vto, candidate, synthesis, frame-detection, frame-removal, patents, fto]
sources: [F001-fittingbox-summary, F001-fittingbox-frame-removal, F001-fittingbox-frame-removal-scale-fit, F001-fittingbox-scale-fit, F001-fittingbox-runtime, F001-fittingbox-runtime-engine, F001-fittingbox-privacy, F001-fittingbox-metrics, F001-fittingbox-network-waterfall, F001-fittingbox-network-runtime, F001-fittingbox-network-cdn, F001-fittingbox-merchant-adoption, F002-patent-fto-map, F002-patent-fieldscan, F002-patent-priorart, F002-patent-designaround, F002-patent-fittingbox-families]
---

# Candidate — Frame Detection & Removal Improvement Plan

## Question
How should the VTO improve its frame detection and frame removal feature, given what FittingBox does and the patent landscape?

## What FittingBox Does (grounded in F001)

FittingBox's frame removal is a **dual-path, feature-gated premium add-on** (`addon_frameRemoval`, per F001-fittingbox-frame-removal-scale-fit §Answer):

1. **Live webcam frame removal — client-side WASM.** The FBxLive engine (custom C++ → Emscripten WASM + WebGL2, per F001-fittingbox-runtime-engine §Answer) performs real-time diminished reality on the webcam stream locally. No network image uploads observed during the live path (per F001-fittingbox-frame-removal-scale-fit §Answer, corroborated by F001-fittingbox-metrics row "Frame removal (live): Client-side"). The engine runs off the main thread via Worker + OffscreenCanvas (per F001-fittingbox-runtime-engine §Answer).

2. **Photo/still try-on frame removal — server-side.** The browser uploads a base64 photo + glasses UID to a `POST {restApiUrl}render` endpoint; the server returns `outputImageB64` + `eyesPoints` (per F001-fittingbox-frame-removal §Answer). Face detection and face-shape analysis run on dedicated server endpoints (`detectionservice`, `faceshapeservice` — per F001-fittingbox-privacy §Answer). This is FittingBox's architectural dodge for the weight problem: classification of each pixel as "background / lenses / frame" runs on their cloud, not in the browser (per F001-fittingbox-frame-removal §Implications).

3. **Scale/fit — iris-based PD, server-computed.** Default PD is 63 mm statistical average (`pdType: "statistic_pd"`, `isRealPd: false` — per F001-fittingbox-scale-fit §Answer). The server returns `eyesPoints` from the render call; a separate PD-measurement product uses the same FBxLive engine + `fbx-streamgrabber` for webcam-based PD with claimed "1 mm accuracy, 7 of 10 measurements" (per F001-fittingbox-scale-fit §Answer). No credit-card calibration was found (per F001-fittingbox-scale-fit §Answer; independently confirmed via PostHog regex noise in F001-fittingbox-frame-removal-scale-fit §Answer).

4. **Engine delivery — ~12 MB monolith, deferred.** FBxLive.wasm = 10.5 MB raw / 2.8 MB gz-transferred + FBxLive.data = 1.4 MB + JS glue = 254 KB (per F001-fittingbox-network-cdn table). These are downloaded on widget init (startVto), not on first paint — the entry bundle is just ~79 KB Angular main (per F001-fittingbox-network-cdn §Implications). This is how FittingBox sidesteps the 250 KB entry constraint: small shell, heavy engine deferred to activation, cached per-session (per F001-fittingbox-metrics headline #1).

5. **Privacy split.** Live path keeps webcam frames local. Photo/removal path uploads biometric-grade facial imagery (base64) to FittingBox cloud — a privacy liability and GDPR exposure (per F001-fittingbox-privacy §Answer, §Implications).

### Contradiction note
F001-fittingbox-summary states frame removal is "server-side" and positions this as a universal statement. F001-fittingbox-frame-removal-scale-fit and F001-fittingbox-metrics both document the **dual** architecture: live = client WASM, photo = server upload. The summary oversimplifies; the detailed findings are consistent with each other. For this candidate, the dual-path characterization from the detailed findings is authoritative.

## Patent Constraints (grounded in F002)

> **Hard disclaimer (verbatim, required): "This is research, not legal advice — a licensed patent attorney must do the formal FTO before launch."**

### Patents that directly gate our approach

**A) Frame removal — FittingBox Family A (US 9,892,561 B2, WO/2018/002533, EP 3,479,344).** Priority 2016-06-30, expiry ~2036.
- **Claim gist:** detect a wearable object (glasses) → superimpose a first overlay containing a mask → modify the appearance of part of the mask to conceal the object. (per F002-patent-fittingbox-families §Family A)
- **Reads-on risk: HIGH.** Our detect-then-mask-then-inpaint pipeline maps conceptually. The spec discloses a "face-model-projection mask + inpainting + relighting" embodiment that mirrors our texture-imprint cover approach (per F002-patent-fto-map row A1). The FTO map flags: "do not assume our approach is a clean miss" (per F002-patent-fto-map §Top risks #2).
- **Design-around levers:** Our detector is geometric contour-tracing seeded by MediaPipe landmarks (not a learned per-pixel glasses-segmentation model — per F002-patent-designaround §Answer rows (a) and §Claim elements we clearly do NOT practice). Our CLIP classifier runs once at steady capture to label eyewear *type*, not to produce the erase mask (per F002-patent-designaround §Answer). Defense rests on pre-2016 prior art: academic glasses-removal-for-face-recognition literature from early-to-mid 2000s, general inpainting prior art (Criminisi 2004, Telea 2004, PatchMatch 2009 — per F002-patent-priorart §Answer), and any pre-2016 try-on products that offered removal (per F002-patent-priorart §Product prior art). Attorney must locate specific pre-2016 citations.

**B) Iris-based PD — FittingBox Families G (US 10,201,273, ~2033) and H (EP 4,751,250 A1, 2024→~2044).** Plus EssilorLuxottica 2D-image PD (WO/2023/126,793, US 12,469,254 B2, ~2042) and Ditto reference-object head scaling (US 12,014,462 B2, ~2041) (per F002-patent-fieldscan §Answer, F002-patent-fto-map rows E/G/H).
- **H (known-object eye measurement) is the single highest-priority patent risk.** It claims: select video frame meeting criteria → identify a *known object* → use its reference length for eye measurement (per F002-patent-fittingbox-families §Family H). Our `PdEstimator.setScaleReference` with an 85.6 mm credit-card hook is a near verbatim map (per F002-patent-fto-map row H, F002-patent-fieldscan §Implications). Expiry ~2044 = longest threat window.
- **Design-around:** make the card-calibration path entirely optional and default to iris-prior-only PD (no known-object path). Our default mode uses no prescribed head movement and no known object (per F002-patent-fieldscan §Implications, F002-patent-designaround §Claim elements we clearly do NOT practice). An attorney must verify that "optional known object" creates non-infringement.

**C) ML-based eyewear detection — FittingBox Family N (US 12,462,602 B2, ~2041).** Claims training an ML system on AR images with segmentation + contour to detect/model a virtual element (per F002-patent-fittingbox-families §Family N, F002-patent-fto-map row N).
- **Risk: MEDIUM.** Our MobileCLIP zero-shot classifier is trained on web images, not FittingBox-style AR-augmented training data. It classifies eyewear *type* (full-rim/half-rim/rimless/none), not per-pixel mask (per F002-patent-designaround §Answer, §Where design-around is weakest #2). Attorney should check if "a trained image classifier of eyewear in any form" reads.

**D) Virtual try-on placement overlay — broad field (FittingBox Families B/C, Meta US 10,712,811, Warby Parker EP 3,830,799 B1, Snap US 11,954,762, Zeiss).** (per F002-patent-fieldscan §Placement/try-on-overlay community, F002-patent-fto-map rows B/C). Crowded, heavily-patented space. Our differentiator: Mesh-imprint head cover + GLB anchor-based placement (per F002-patent-fto-map row B design-around, F002-patent-designaround §Answer).

### What we clearly do NOT practice (FTO strengths)
- No multi-angle/multi-camera capture rig (per F002-patent-designaround §Claim elements we clearly do NOT practice, F002-patent-fto-map row D design-around)
- No learned per-pixel glasses *mask* segmentation model as the core detector (per F002-patent-designaround)
- No server-side face processing for removal (all client-side — per F002-patent-designaround)
- No stored 3D model of the user's bare face pulled from a database (per F002-patent-designaround)
- No depth camera (per F002-patent-fieldscan §Answer — clean miss on Essilor depth-PD)

### Prior art assets (defensive)
- Pre-2016 glasses removal literature in face recognition context (per F002-patent-priorart §Answer)
- Inpainting is decades-old public technology: Criminisi 2004, Telea 2004, PatchMatch 2009, LaMa 2021 (per F002-patent-priorart §Answer, F002-patent-designaround §Answer)
- Academic eyeglasses removal: ERGAN 2019, ByeGlassesGAN 2020 (postdate Family A priority, weaken newer families and show crowded field — per F002-patent-priorart §Answer)
- Lyu et al. CVPR 2022 (per F002-patent-priorart §Known lead from project brief) — postdates Family A, confirms field crowding

## Recommended Approach for Our VTO

> Every step must respect: client-side only, 250 KB gz entry, GLB ≤3 MB/50k tris, lazy-load model at try-on.

### 1. Keep the hybrid detection architecture — it IS the design-around

**Current state (from source, per F002-patent-designaround):** `FrameDetector.ts` uses geometric contour-tracing (ray-by-ray from MediaPipe landmarks, evaluating closure/smoothness/thickness/contrast/cross-lens agreement/temporal stability). `ClipEyewearClassifier.ts` runs MobileCLIP zero-shot ONCE at steady capture to label type. This is NOT a learned pixel-wise glasses segmentation model — it is a geometric + classification hybrid.

**Action:** Do NOT replace contour-tracing with a learned per-pixel glasses segmenter (e.g., a segmentation head on MediaPipe). That would walk straight into Family A's strongest claim. Keep contour-tracing as the always-on detector; the CLIP classifier is a secondary type-labeler, not the mask source. (per F002-patent-designaround §Claim elements we clearly do NOT practice, F002-patent-fto-map row A1 design-around)

**Patent-safe improvement path:** Improve contour-tracing robustness without adding learned segmentation:
- Add temporal hysteresis across more frames (already partially present — source: `FrameDetector.ts` per F002-patent-designaround)
- Improve landmark seeding via MediaPipe FaceLandmarker v2 (iris + eyebrow landmarks for rim-zone seeds)
- Add a non-learned edge-linking fallback for partial occlusions

### 2. Strengthen the texture-imprint cover (our strongest differentiator)

**Current state (per F002-patent-designaround):** `coverImprint.ts` + `CoverageAtlas.ts` + `FacePatchLayer.ts` implement a session-fixed UV atlas, per-triangle area-ratio (cos of view angle) facing weight, progressive coverage, calibrate-and-lock gate.

**Action:** This is the technical feature LEAST likely to read on FittingBox Family A. Invest here:
- Increase coverage atlas resolution and capture multiple steady-head poses to expand the patch beyond a single frontal capture (single-webcam, still no multi-angle rig — per our constraint)
- Add a specular-removal pass before imprinting (removes glare from the original glasses that would otherwise bake into the patch)

**Why this beats FittingBox:** Their live removal renders in the closed WASM and their photo/server removal uses inpainting on a single upload. Our progressive texture-imprint is a session-built clean-face model — conceptually closer to "build the face without glasses" rather than "erase existing glasses per frame." This is the strongest FTO talking point. (per F002-patent-fto-map row A1: "Foreground our progressive texture-imprint + area-ratio facing")

### 3. Default PD to iris-prior-only; card-calibration as removable optional path

**Current state (per F002-patent-designaround):** `PdEstimator.ts` computes iris-prior mm-per-px with an optional 85.6 mm card hook.

**Action:** Make iris-prior PD the default and only always-on path. The card-calibration hook is the feature closest to FittingBox Family H (known-object eye measurement, ~2044) and Ditto reference-object scaling (~2041) — see F002-patent-fto-map rows H and Ditto, F002-patent-fieldscan §Implications. Ship card-calibration as a **separately-compiled, dynamically-loaded opt-in module** — NOT a runtime feature flag with the calibration code shipped in the base bundle. (Validation verdict 2026-08-04: a base-bundle flag with the code present is not, by itself, non-practising under the All-Elements Rule / §271(b) inducement; a dynamically-loaded module that merchants can omit entirely is the safer posture.) If an attorney recommends removal, the core product works without it.

**PD improvement without patent exposure:**
- Improve iris/landmark stability from a few seconds of steady video (already client-side per MediaPipe — matches our constraint)
- Keep the `isRealPd` flag pattern (per F001-fittingbox-scale-fit §Implications — FittingBox uses the same pattern, not patented)
- Default to statistical 63 mm when iris is unmeasurable (per F001-fittingbox-scale-fit: FittingBox uses the identical fallback — common practice, not patented)

### 4. Keep inpainting simple and standard — LaMa/Telea, no novel contribution

**Current state (per F002-patent-priorart, F002-patent-designaround):** `LamaInpainter.ts` (LaMa), `InpaintingEngine.ts`, `MaskGenerator.ts` (dilate 4px, feather 6px, lens-subtract, brow-protect). All use decades-old public techniques.

**Action:** Do not develop a novel inpainting method. LaMa + Telea fallback is sufficient and safe. Any "improved inpainting for glasses" risks becoming a novel contribution that strengthens (rather than avoids) a patent claim. The mask generator's dilate/feather/lens-subtract/brow-protect pipeline is geometric, not learned — keep it that way. (per F002-patent-priorart §Implications)

### 5. Lazy-load strategy: match FittingBox's "small shell, deferred engine" pattern

**Current constraint:** 250 KB gz entry budget. FittingBox's approach proves this can work: tiny Angular shell (~79 KB, per F001-fittingbox-network-cdn table) + deferred ~12 MB engine only at try-on activation (per F001-fittingbox-metrics headline #1, F001-fittingbox-network-cdn §Implications).

**Action:**
- Entry bundle: three.js core + MediaPipe FaceLandmarker WASM loader + GLB loader + UI shell → target ≤250 KB gz
- At try-on activation: lazy-fetch the MediaPipe model blob + LaMa model + CLIP model (per our constraint "lazy-load model at try-on")
- Cache all fetched models in IndexedDB + Service Worker for return visits
- Consider OffscreenCanvas + Worker for rendering (per F001-fittingbox-runtime-engine §Implications — FittingBox does this and it contributes to smoothness; not patented, an architecture choice)

### 6. Privacy positioning: "face never leaves the browser"

**Action:** Keep the photo/still try-on path fully client-side (unlike FittingBox, which uploads base64 face images to their server — per F001-fittingbox-privacy §Answer). This is both a genuine technical differentiator AND a marketing advantage. All frame removal, PD measurement, and face analysis run in-browser.

### 7. Pre-launch attorney actions (not our code work)

Per F002-patent-fto-map §Recommended next actions before launch:
- Pull and element-map granted claims for: US 9,892,561 (Family A), US 10,201,273 (Family G), EP 4,751,250 A1 (Family H), US 12,469,254 B2 (Essilor 2D PD), US 12,014,462 B2 (Ditto reference-object)
- Verify exact expiry / PTA / terminal disclaimers
- Run formal assignee search for Warby Parker, Snap, Perfect Corp
- Prioritize the iris-PD / known-object-scaling cluster before frame removal

## Open Questions / What Still Needs Verification

1. **Live webcam frame-removal FPS for our pipeline.** FittingBox's live FPS is unmeasured (headless limitation — per F001-fittingbox-runtime §Limitations). Our own MediaPipe + three.js + contour-tracing + LaMa pipeline FPS on a mid-range device with a real webcam needs a benchmark run. (needs verification)

2. **MobileCLIP model size + load time vs 250 KB gz budget.** The zero-shot classifier runs once at capture, but its ONNX model must be lazy-loaded. Model size and inference latency not profiled against the entry budget. (needs verification)

3. **GLB frame sizes for real catalog.** The ≤3 MB / 50k tris constraint per frame is specified but no real catalog GLB has been profiled. FittingBox uses proprietary "fitsource" binaries whose per-frame size is unknown (per F001-fittingbox-network-waterfall §3D asset format — per-frame size could not be measured). (needs verification)

4. **Pre-2016 prior art for Family A.** The F002-prior-art finding identifies the field is old (early 2000s face-recognition glasses removal) but specific published citations that anticipate Family A's claim elements have not been located. Attorney must do this. (needs verification — assigned to attorney)

5. **Coverage-atlas quality with extreme head rotation.** The texture-imprint cover builds from a single frontal calibration pose. How well it holds up at 30°–45° yaw is untested. Potential need for multi-pose capture (still within single-webcam constraint). (needs verification)

6. **F002 finding file reconciliation.** F002-patent-fto-map §Coordination note flags that a parallel T002 retry wrote complementary findings under slightly different filenames (F002-broader-field.md, F002-design-around.md, F002-patent-fittingbox-family.md, F002-prior-art.md) that may contain non-duplicate patent data (e.g., Ditto US 11,495,002 B2 prio 2017, EP 3,659,109 B1 prio 2017). These need deduplication and merge before attorney review. (needs verification — Hermes action)

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
- F001-fittingbox-merchant-adoption — named flagships use VMMV not FittingBox, actual FittingBox clients are Shopify/iframe merchants

**F002 — Patent FTO:**
- F002-patent-fittingbox-families — complete family A-O enumeration, claim gists, jurisdiction, expiry estimates
- F002-patent-fto-map — risk table, top risks, recommended attorney actions, coordination note on parallel T002 retry
- F002-patent-fieldscan — EssilorLuxottica/Ditto/Warby/Snap/Perfect Corp PD and try-on patents
- F002-patent-designaround — nmg-vto source analysis: what we practice vs what we don't, design-around levers for each category
- F002-patent-priorart — pre-2016 and post-2016 academic/public prior art for glasses removal/inpainting, TRELLIS MIT confirmation

**File index:** F001-fittingbox-summary · F001-fittingbox-frame-removal · F001-fittingbox-frame-removal-scale-fit · F001-fittingbox-scale-fit · F001-fittingbox-runtime · F001-fittingbox-runtime-engine · F001-fittingbox-privacy · F001-fittingbox-metrics · F001-fittingbox-network-waterfall · F001-fittingbox-network-runtime · F001-fittingbox-network-cdn · F001-fittingbox-merchant-adoption · F002-patent-fto-map · F002-patent-fieldscan · F002-patent-priorart · F002-patent-designaround · F002-patent-fittingbox-families
