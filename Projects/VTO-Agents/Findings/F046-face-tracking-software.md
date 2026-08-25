---
okf: 1
id: F046-face-tracking-software
type: finding
project: VTO
status: draft
created: 2026-08-24
updated: 2026-08-24
tags: [finding, face-tracking, software, mediapipe, bisenet, onnx]
source_agent: Software-Researcher
source_task: T045
---

# T045 Software-Researcher: Face Tracking & Model Integration

## Question

Evaluate MediaPipe FaceLandmarker v2, BiSeNet 3-class integration, client-side ONNX model loading, and webcam pipeline orchestration for eyewear try-on:

1. What is MediaPipe FaceLandmarker accuracy for pupil center, tragion, bitragion, and iris landmarks?
2. How does BiSeNet 3-class segmentation (frame/lens/face) integrate with the MediaPipe face mesh, and at what cost?
3. Is client-side ONNX loading feasible today — what is the real WebGPU/WebNN execution status?
4. How should the full webcam pipeline be orchestrated: capture → segmentation → inpainting → render with occlusion culling?
5. Does the FPS profile match the D3 validated plan targets?

## Answer

### Q1 — MediaPipe FaceLandmarker landmark accuracy (ANSWERED)

- **Output shape**: FaceLandmarker outputs **478 3D landmarks** per face (468 mesh + 10 iris), optional 52 blendshapes, and a facial transformation matrix. It is a three-model cascade: detector → mesh → blendshapes ([Google AI Edge guide](https://developers.google.com/edge/mediapipe/solutions/vision/face_landmarker)).
- **Pupil/iris centers**: iris center indices are **468** and **473**, each surrounded by a 4-point ring (469–472 and 474–477) ([tasks connections source](https://github.com/google/mediapipe/blob/master/mediapipe/tasks/web/vision/face_landmarker/face_landmarks_connections.ts)). Note: which index is anatomically left vs right differs across MediaPipe code surfaces due to mirroring conventions — the Tasks API labels ring 474–477 LEFT_IRIS while the legacy C++ graph labels 468–472 kLeftIrisLandmarksIndicesMapping ([tensors_to_face_landmarks_graph.cc](https://github.com/google-ai-edge/mediapipe/blob/e14840d7/mediapipe/tasks/cc/vision/face_landmarker/tensors_to_face_landmarks_graph.cc)). Pin one convention in code and test against a mirrored capture.
- **Accuracy numbers**: the Attention Mesh model that FaceLandmarker's mesh descends from reports NME ≈ **3.11% overall / 6.04% eye region** (unified attention) vs 2.99%/6.28% cascaded — i.e. ~1.4–1.5× human inter-annotator noise ([Attention Mesh paper, arXiv:2006.10962](https://arxiv.org/abs/2006.10962), summarized in [emergentmind topic page](https://www.emergentmind.com/topics/mediapipe-face-mesh)).
- **Depth-from-iris**: metric camera-distance error mean **4.3%** (σ 2.4%); **with eyeglasses worn it degrades only slightly to 4.8%** (σ 3.1%) — directly measured by Google on 200+ participants vs iPhone depth ([MediaPipe Iris announcement](https://research.google/blog/mediapipe-iris-real-time-iris-tracking-depth-estimation/)).
- **Caution for PD**: an independent study found iris-diameter-based mm conversion had RMSE 4.84 mm / 10.01% relative error against ruler ground truth, with large session-to-session variance (σ 3.24 mm) — supports D3's card-calibration fallback rather than iris-prior-only PD ([ACM Modality.AI study](https://dl.acm.org/doi/fullHtml/10.1145/3536220.3558071)).
- **Tragion/bitragion do NOT exist in the 478 mesh.** Google confirmed there is "no anatomical naming scheme" for the 468 landmarks ([issue #3799](https://github.com/google-ai-edge/mediapipe/issues/3799), [issue #1615](https://github.com/google-ai-edge/mediapipe/issues/1615)). Approximations used in practice: **234 / 454** ("left/right cheek", commonly used for face width) or face-oval points 127 / 356 ([landmark index reference](https://www.sanderdesnaijer.com/blog/mediapipe-face-mesh-landmarks)). However, **MediaPipe Face Detection (BlazeFace) does output explicit tragion keypoints**: its 6 key points are "right eye, left eye, nose tip, mouth center, right ear tragion, and left ear tragion" ([issue #2435 quoting Android API](https://github.com/google-ai-edge/mediapipe/issues/2435)) — so bitragion breadth can come from the detector stage, not the mesh.
- **Regression watch**: a user-reported regression of FaceLandmarker iris quality vs legacy `FaceMesh(refine_landmarks=True)` at low resolution was filed and partially retracted by the reporter, but maintainers acknowledged and pointed to ongoing Task-API improvement ([issue #5210](https://github.com/google-ai-edge/mediapipe/issues/5210)). Validate iris quality at the widget's actual camera resolution before trusting it.

### Q2 — BiSeNet 3-class integration (IN PROGRESS)

Research ongoing — will be filled in this session.

## Evidence

Per-claim citations are inline in Answer above (URL form). Vault-local references:

- F002 timings (BiSeNet ~30-50 ms, LaMa ~100-200 ms, deferred engine ~200-223 MB): `Projects/VTO-Agents/Findings/F002-fittingbox-performance.md`
- Frame-removal foundation + dead ends (ProPainter, int8 QDQ): `Projects/VTO/LEARNINGS-frame-removal.md` (L2, L7). NOTE: the brief's "F003" does not exist as a file in this vault — confirmed non-existent by the adversarial review in `Projects/VTO-Agents/Findings/F017-lidar-truedepth.md` §Q5; its content lives in T036 notes (`Projects/VTO-Agents/Findings/20260823-221835-T036-frame-detection-removal.md`), F002, and LEARNINGS-frame-removal.md.
- D3 validated plan: `knowledge/vto-domain/KNOWLEDGE.md` §The validated plan (D3)

## Implications for VTO

To be completed after all questions answered.

---

[[VTO]] · Research-agent brief: `Projects/VTO-Agents/Research Agents/Software-Researcher.md`
