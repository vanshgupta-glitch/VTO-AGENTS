---
okf: 1
id: F017-lidar-truedepth
type: finding
project: VTO
status: done
created: 2026-08-24
updated: 2026-08-24
tags: [finding, device, lidar, truedepth, depth-sensing, face-mesh]
source_agent: vto-researcher
source_task: T038
---

# F017 — LiDAR / TrueDepth Analysis for Eyewear Try-On

Related: [[VTO]] · Mission brief: `C:\Users\ankur.singh\openclaw-ws\vto-researcher\mission-T038-F017.md`

## Question

1. What is TrueDepth's achievable depth accuracy (±2mm design target per D3) versus LiDAR alternatives?
2. Which depth APIs are reachable from a browser (WebXR, WebGL2, MediaPipe FaceMesh)?
3. What point cloud processing pipelines exist for glasses segmentation?
4. What are the distance ranges and accuracies at varying poses?
5. Cross-reference F003 (BiSeNet 3-class segmentation + LaMa inpainting).
6. Hardware requirements / limitations for VTO deployment.

## Answer

### Q1: TrueDepth vs LiDAR depth accuracy (vs ±2mm design target)

**TrueDepth (front, structured light):**
- Apple's own operating envelope is **25–50 cm** ("arm's length or less") for Face ID; outside this band accuracy degrades sharply. [Apple Support](https://support.apple.com/en-us/102381)
- Best-case metrology (iPhone 12 Pro, ARKit pipeline, controlled rig): average **plane-distance error 0.104 mm** at stand-offs ≤250 mm, but point dispersion worsens with distance (point-to-plane σ 0.291→0.739 mm from 175→450 mm) and curved-surface profile error runs **1.549 mm @150 mm → 4.692 mm @450 mm**. Authors conclude raw output "cannot be directly used for industrial-level geometric reconstruction". [Springer IJAMT 2025](https://link.springer.com/article/10.1007/s00170-025-15968-z)
- Earlier iPhone X work: measurement error up to **~5% of target distance** (24.39 mm at 480 mm); stable readings need ≥300 mm on matte surfaces, up to 500 mm on shiny/textured ones. [Breitbarth et al., via ResearchGate](https://www.researchgate.net/publication/335876093_Measurement_accuracy_and_dependence_on_external_influences_of_the_iPhone_X_TrueDepth_sensor)
- ARKit face-tracking end-to-end (eye-to-phone distance, robot-mounted phone): errors **0.88%–9.07%** depending on head pose; most accurate 300–400 mm below-center positions; depth arrives at only **15 FPS** inside ARKit. [JMIR mHealth 2023 / PMC10181530](https://pmc.ncbi.nlm.nih.gov/articles/PMC10181530/)
- Verdict vs ±2mm: **±2 mm is achievable only at close range (<250–300 mm), on benign surfaces, with the sensor's native pipeline**. At typical selfie/VTO distances (400–500 mm) realistic error bands are millimetres-to-centimetres, pose-dependent. ±2 mm is *not* a safe design assumption for a consumer flow.

**LiDAR (rear ToF, iPhone Pro / iPad Pro only):**
- Static acquisition: point-to-best-fit-plane distances **<1 mm** at scanning distances ≤1.5 m (90% of points under 1 mm); σ better than 2 mm out to ~4.5 m; collapses near the 5 m max range (13% of points <1 mm at 5 m). Dynamic (handheld, moving): ~1 cm class. [ScienceDirect 2023 scan-to-BIM study](https://www.sciencedirect.com/science/article/pii/S2666165923000510)
- iPad Pro 2021 vs terrestrial laser scanner: static RMS 2.84 cm; dynamic RMS 16.17 cm (±1–2 cm for features ≤4 m). Max range 5 m; ideal working distance ~2 m. [Taylor & Francis 2024](https://www.tandfonline.com/doi/full/10.1080/16874048.2024.2408839)
- Critical internals: the delivered depth image is an ML fusion extrapolated from only **~576 real ToF measurements**; quantization ~0.98 mm between 1–2 m; systematic negative bias of **1–2% of ground truth**; >5 m returns confidence 0 and pure inference. Curved objects get **flattened/merged** — explicitly problematic for spheres and similar geometry (a face qualifies). [KIT, Zea et al., JAIF'22 PDF](https://isas.iar.kit.edu/pdf/JAIF22_Zea.pdf)
- Aalto metrological characterization: std <0.5 cm within effective 0.2–5 m range, but colour-fusion smooths features and creates false depths at sharp edges; **no access to raw depth**. [Aalto thesis 2021](https://aaltodoc.aalto.fi/items/ef2b2645-1c16-461b-a3b4-e65780cce472)

**Head-to-head:** TrueDepth is the only one aimed at faces (front-facing, 30k-dot structured light, works at selfie distance); LiDAR is rear-facing, room-scale, cm-class on natural scenes, and its ML-fused output flattens curvature. Neither is exposed to a browser on iOS (see Q2).

### Q2: Browser-accessible depth APIs

- **WebXR Depth Sensing Module** (W3C): implemented in **one engine only** — Chromium (Chrome/Edge 90+). Firefox: none. Safari/iOS Safari: none. On phones it requires an `immersive-ar` session backed by ARCore → **Chrome for Android only**; Android WebView: not supported. [W3C spec](https://www.w3.org/TR/webxr-depth-sensing-1/) · [caniuse wf-webxr-depth-sensing](https://caniuse.com/wf-webxr-depth-sensing) · [caniuse XRDepthInformation](https://caniuse.com/mdn-api_xrdepthinformation)
- Chrome on **Android XR** also exposes stereo depth frames via WebXR. [Android XR docs, retrieved 2026-08-24](https://developer.android.com/develop/xr/web) — irrelevant to eyewear try-on on phones/laptops.
- **iOS Safari has no WebXR AR session at all** → TrueDepth/LiDAR data is unreachable from any web page on iPhone/iPad. This is consistent with (and reinforces) the standing dead-end "Android depth APIs: no web surface" recorded in [[F001-fittingbox-teardown]].
- **WebGL2** is a rendering API — it rasterizes depth buffers of virtual scenes; it provides no camera-derived scene depth input. No browser currently exposes dual-camera/stereo depth through `getUserMedia` (colour frames only).
- **MediaPipe Face Mesh / Face Landmarker**: landmark `z` is explicitly **relative, non-metric** — "z represents the landmark depth, and the smaller the value the closer the landmark is to the camera. The magnitude of z uses roughly the same scale as x" (weak-perspective model, origin at head-centre depth). [Google AI Edge NormalizedLandmark](https://developers.google.com/edge/api/mediapipe/js/tasks-vision.normalizedlandmark) · [Face Mesh docs](https://mediapipe.readthedocs.io/en/latest/solutions/face_mesh.html)
  - The optional **Face Transform / FaceGeometry module** produces a metric 3D space, but its unit scale comes from the *canonical face model* (default unit: cm) applied as a **constant assumed face size** — a MediaPipe engineer states outright: "we sacrifice the scale (by making it a constant)" because screen coordinates cannot separate face-size from distance. [Google Developers Blog 2020](https://developers.googleblog.com/en/mediapipe-3d-face-transform/) · [github.com/google/mediapipe#1868](https://github.com/google/mediapipe/issues/1868)
  - Same thread: iris-based scale transfer amplifies small landmark error into larger mesh error, needs heavy filtering and blink handling; card-calibration ("ID card trick") recommended instead. [#1868](https://github.com/google/mediapipe/issues/1868) — this independently re-confirms the [[F001-fittingbox-teardown]] dead ends "iris-prior PD below ±2mm impossible without card calibration".
  - Recovering real-world z additionally requires true camera intrinsics, which `getUserMedia` does not reliably provide. [#2043](https://github.com/google/mediapipe/issues/2043)

### Q3: Point cloud processing pipelines for glasses segmentation/try-on

Documented pipelines that use depth-derived point clouds for *eyewear* try-on:
1. **Multi-view registration pipeline** (Wang, Jin & Zhang, Zhejiang Univ., 2023): three depth-camera captures at −30°/0°/+30° → coarse registration on feature points (68 landmarks) → fine registration on overlapping region (overlap rate 85.13–85.29% → 94.79–91.60%) → merged 3D face model → automatic glasses alignment via 3 key-point pairs (bridge + two ear points) → per-frame pose transform from live video → render with occlusion culling against the reconstructed face. Usability scores 4.3–4.8/5. [Journal article](http://www.txxb.com.cn/EN/Y2023/V44/I5/988)
2. **Stereo/depth-camera fit patent** (US 10,685,457): ~20 s 180° head-rotation scan or dual-lens stereo → downsampled/regularized point cloud → facial-feature annotation → eyewear contact-point prediction → placement. Claims mm-class feature dimensions; explicitly notes depth camera removes need for reference-object measurement. [Patent text](https://exa.ai/library/legal/patent/zjx4504tcqqgj057ddy9wn)
3. Common building blocks across both: plane/feature extraction → ICP-style fine registration → key-point alignment of glasses frame to face → occlusion culling at render time. None of these pipelines segment *glasses themselves* from a point cloud — they reconstruct the **face**, then place known glasses geometry onto it.

RGB-only alternative (no point cloud): ECCV 2020 system recovers glasses 3D shape from a single image via U-Net predicting 21 glasses landmarks + frame segmentation mask jointly, then frontalization + Laplacian deformation of a template. [ECVA PDF](https://www.ecva.net/papers/eccv_2020/papers/123700375.pdf) — closest published analogue to the D3 BiSeNet/LaMa 2D stack.

### Q6: Hardware requirements / limitations for VTO deployment

| Capability | Hardware | Web access? |
|---|---|---|
| TrueDepth structured light | Front of iPhone X+ / Face-ID iPads | No — iOS Safari has no WebXR AR; data reachable only via ARKit native ([W3C support table](https://www.w3.org/TR/webxr-depth-sensing-1/)) |
| LiDAR ToF | Rear of iPhone Pro (12 Pro+) / iPad Pro (2020+) only | No — same reason; also rear-facing, wrong side for self try-on |
| ARCore depth / WebXR depth-sensing | Select Android phones in Chrome | Yes, but Chromium-only and requires immersive-ar session; iOS excluded |
| Depth from desktop/laptop webcams | None shipped | N/A — colour frames only |

Additional deployment limits found: ARKit delivers face-depth at 15 FPS inside the tracking loop ([PMC10181530](https://pmc.ncbi.nlm.nih.gov/articles/PMC10181530/)); Apple exposes no raw depth from either sensor — output is ML-fused ([KIT](https://isas.iar.kit.edu/pdf/JAIF22_Zea.pdf), [Aalto](https://aaltodoc.aalto.fi/items/ef2b2645-1c16-461b-a3b4-e65780cce472)).

### Q4: Distance ranges and accuracy at varying poses

- TrueDepth usable band: 25–50 cm (Apple), hard floor ~150–170 mm minimum working distance (texture-dependent), stable ≥300 mm; error grows with distance and is worse for shiny/textured surfaces; worst above-head poses. Sources as in Q1 ([Apple](https://support.apple.com/en-us/102381), [Springer 2025](https://link.springer.com/article/10.1007/s00170-025-15968-z), [PMC10181530](https://pmc.ncbi.nlm.nih.gov/articles/PMC10181530/)).
- Pose sensitivity (ARKit study): errors 0.88%–9.07% across head positions; best 300–400 mm slightly below centre; degraded >500 mm. Same source.
- LiDAR: 0.2–5 m effective range; best 1–2 m; static vs dynamic acquisition differ by ~an order of magnitude (<1 mm plane-fit vs ~1 cm). Sources as in Q1 ([ScienceDirect](https://www.sciencedirect.com/science/article/pii/S2666165923000510), [T&F](https://www.tandfonline.com/doi/full/10.1080/16874048.2024.2408839)).

### Q5: Cross-reference F003

- **F003 does not exist in the vault** (`Obsidian Vault/Projects/VTO-Agents/Findings/` contains F001, F002, F011*, F012–F016, T036 notes — no F003). The BiSeNet 3-class (frame/lens/face) + LaMa content lives in:
  - `Findings/20260823-221835-T036-frame-detection-removal.md` — BiSeNet fine-tuned 3-class, synthetic-data pipeline (Lyu et al. CVPR 2022); LaMa-only ~198 MB ONNX; both flagged "requires external verification".
  - [[F002-fittingbox-performance]] — stage timings: BiSeNet ~30–50 ms, LaMa ~100–200 ms; deferred engine ~200–223 MB.
  - [[F016-competitor-teardown]] — texture-imprint baseline validated; ProPainter/E2FGVI confirmed dead end.
- Relevance here: depth sensors would not feed these 2D stages. BiSeNet/LaMa operate on RGB webcam frames; adding depth would change the pipeline class entirely (native app), which is out of scope for the current web-only D3 plan.

### Unanswered / boundaries

- No public Apple spec states a numeric depth-accuracy figure for TrueDepth or LiDAR; all numbers above come from third-party measurements of specific devices (iPhone X, iPhone 12/13 Pro, iPad Pro 2020/2021). Newer hardware may differ.
- PMC12526706 (iPhone LiDAR mapping accuracy) returned a reCAPTCHA wall on search fetch — not read; other sources cover the same question.
- No published pipeline segments *glasses* directly from a point cloud; all depth-based eyewear work reconstructs the face and places known frame geometry onto it. If true glasses-from-depth segmentation exists, it was not surfaced by public search.
- WebXR depth-sensing on Chrome Android could not be hands-on verified here (no ARCore device in this environment); support claims rest on W3C/caniuse tables.

## Evidence

| Claim | Source | Retrieved |
|---|---|---|
| Face ID/TrueDepth operating band 25–50 cm; dot-projector depth map | https://support.apple.com/en-us/102381 | 2026-08-24 |
| >30,000 IR dots; 0.104 mm mean plane error ≤250 mm; dispersion 0.291→0.739 mm @175→450 mm; hemisphere profile error 1.55–4.69 mm; "not industrial-grade" | https://link.springer.com/article/10.1007/s00170-025-15968-z | 2026-08-24 |
| iPhone X TrueDepth ≤5% of target distance error; stable ≥300 mm (matte) / 500 mm (shiny) | https://www.researchgate.net/publication/335876093_Measurement_accuracy_and_dependence_on_external_influences_of_the_iPhone_X_TrueDepth_sensor | 2026-08-24 |
| ARKit eye-to-phone error 0.88–9.07% by pose; 15 FPS depth in ARKit | https://pmc.ncbi.nlm.nih.gov/articles/PMC10181530/ | 2026-08-24 |
| iPad LiDAR static <1 mm plane-fit ≤1.5 m; σ<2 mm to 4.5 m; dynamic ~1 cm; recommend 1–1.5 m | https://www.sciencedirect.com/science/article/pii/S2666165923000510 | 2026-08-24 |
| iPad LiDAR static RMS 2.84 cm, dynamic RMS 16.17 cm; 5 m max range; 2 m ideal | https://www.tandfonline.com/doi/full/10.1080/16874048.2024.2408839 | 2026-08-24 |
| Depth stream ML-extrapolated from ~576 real points; bias −1–2%; curvature flattened; confidence 0 beyond 5 m | https://isas.iar.kit.edu/pdf/JAIF22_Zea.pdf | 2026-08-24 |
| iPad flash-LiDAR std <0.5 cm in 0.2–5 m; edge artifacts from colour fusion; no raw depth access | https://aaltodoc.aalto.fi/items/ef2b2645-1c16-461b-a3b4-e65780cce472 | 2026-08-24 |
| WebXR depth-sensing: Chromium-only (90+), no Safari/Firefox; needs immersive-ar + ARCore | https://www.w3.org/TR/webxr-depth-sensing-1/ ; https://caniuse.com/wf-webxr-depth-sensing | 2026-08-24 |
| Android XR Chrome supports stereo depth-sensing in WebXR | https://developer.android.com/develop/xr/web | 2026-08-24 |
| BiSeNet 3-class + LaMa status/timings | vault: Findings/20260823-221835-T036-frame-detection-removal.md ; F002-fittingbox-performance.md ; F016-competitor-teardown.md | 2026-08-24 |
| FaceMesh z relative, scale ≈ x, head-centre origin | https://developers.google.com/edge/api/mediapipe/js/tasks-vision.normalizedlandmark ; https://mediapipe.readthedocs.io/en/latest/solutions/face_mesh.html | 2026-08-24 |
| FaceGeometry metric space = canonical-face constant scale; "we sacrifice the scale"; iris transfer amplifies error | https://developers.googleblog.com/en/mediapipe-3d-face-transform/ ; https://github.com/google/mediapipe/issues/1868 | 2026-08-24 |
| Real-world z needs camera intrinsics getUserMedia doesn't give | https://github.com/google/mediapipe/issues/2043 | 2026-08-24 |
| Depth-camera glasses try-on: multi-view registration (−30°/0°/+30°), overlap 85→94%, 3-point alignment, occlusion culling | http://www.txxb.com.cn/EN/Y2023/V44/I5/988 | 2026-08-24 |
| Stereo/scan → point cloud → contact points fit pipeline (US 10,685,457) | https://exa.ai/library/legal/patent/zjx4504tcqqgj057ddy9wn | 2026-08-24 |
| Single-image glasses 3D reconstruction: U-Net 21 landmarks + mask, frontalization + Laplacian deformation | https://www.ecva.net/papers/eccv_2020/papers/123700375.pdf | 2026-08-24 |
| Web VTO app using single-image 3D face recon + iris-diameter size prior (11.71 mm / 2r); RGBD noted as extra-hardware path | https://www.mdpi.com/1424-8220/22/10/3832 | 2026-08-24 |

## Implications for VTO

1. **Depth sensors are a native-app feature, not a browser feature.** The current web-only D3 plan cannot touch TrueDepth or LiDAR on iOS at all; on Android the only web surface is WebXR depth-sensing inside an immersive-ar session (Chromium-only, ARCore hardware required). Any ±2mm accuracy story premised on device depth hardware does not apply to the browser product.
2. **±2mm PD via TrueDepth only holds inside its lab envelope** (<~300 mm, benign surface, native pipeline, near-frontal pose). Real selfie distances (40–50 cm) plus pose variation push errors into the mm-to-cm band (up to ~5–9%). Design target should treat ±2mm as *native-app best case*, not web baseline.
3. **LiDAR is the wrong tool for faces anyway**: rear-facing, cm-class on natural scenes, ML-extrapolated from ~576 points, and its documented curvature-flattening artifact degrades exactly the geometry (nose bridge, cheek curvature) that matters for frame fit.
4. **Browser reality = monocular estimation.** MediaPipe FaceMesh gives non-metric z; its metric mode assumes constant face size. The viable browser accuracy levers remain what F001 already records: iris prior as rough scale, card-calibration opt-in for precision. This finding adds independent confirmation from MediaPipe's own engineers (#1868).
5. **If a native/companion path is ever funded**, the literature pattern is: multi-view capture (±30° sweeps) → coarse+fine point-cloud registration → key-point alignment → occlusion culling ([txxb 2023](http://www.txxb.com.cn/EN/Y2023/V44/I5/988)) — and TrueDepth at ≤300 mm stand-off beats LiDAR for face detail. But this is a different product class (app store distribution, App Store review, no instant-web reach) and contradicts the video-only raw-webcam-frame constraint.
6. **No action items for the current pipeline.** BiSeNet/LaMa stack stays RGB-only; nothing in this finding reopens dead ends (Android depth APIs, screen recordings untouched). The finding's value is defensive: it kills any future "just use the phone's depth sensor" proposal with cited numbers.

**Boundary statement**: All Method steps answered or explicitly bounded above. Numeric accuracies are third-party device measurements, not Apple specifications.
