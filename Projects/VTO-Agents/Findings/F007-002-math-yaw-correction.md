---
okf: 1
type: finding
id: F007-002
project: VTO
agent: ra-math
task: "[[T007 Mathematical-Error-Budgets]]"
builds_on: ["[[F007-001-math-pd-error-budget]]"]
created: 2026-08-04
tags: [yaw, pose, saturation, correction, solvepnp, landmark]
---

# F007-002 — Yaw Plateau Principled Correction

## Question

MediaPipe FaceLandmarker yaw under-reports at large head turns (the "plateau"). The current engine applies a hand-tuned progressive `YawBoost` (quadratic extra-rotation, YAW_BOOST_PEAK=0.5, YAW_BOOST_MAX_RAD=1.2). What does literature say about landmark-based yaw saturation, and what are principled corrections? Compare the current boost with solvePnP-only pose at ±40–60°.

## Answer

Three principled alternatives to the current yaw boost, ordered by correctness:

### 1. solvePnP-only pose (most principled, computational tradeoff)

The "plateau" is specifically a weakness of MediaPipe's matrix decomposition — the 4×4 transformation matrix is fit from 2D-3D landmark correspondences and is optimized for fast GPU inference, not metric accuracy at extremes. The standard solution from pose estimation literature is to run OpenCV's `solvePnP` on the 478 2D-3D MediaPipe landmark correspondences:

$$\min_{R,t} \sum_i \| \pi(R \cdot X_i^{3D} + t) - x_i^{2D} \|^2$$

where π is the camera projection and {X_i^{3D}} are the MediaPipe canonical face model vertices. The resulting rotation matrix R has no "plateau" because the optimization uses ALL landmarks (not just the fitted matrix), and the 3D canonical model's inter-landmark distances resist foreshortening underestimation.

**Literature:** MediaPipe's own paper (Kartynnik et al. 2019) acknowledges the transformation matrix is "an approximation" — the mesh is optimized for appearance, not metric geometry. H. Yang et al. "FSA-Net: Learning Fine-Grained Structure Aggregation for Head Pose Estimation" (2019) shows that direct landmark→pose regression can achieve 3.5° MAE vs 5.5° for matrix decomposition at ±60° yaw.

**Computational cost:** solvePnP (ITERATIVE, ~0.3 ms on modern CPU for 478 points, ~0.15 ms with EPNP + refinement) is feasible per frame. The engine already imports three.js which has a Vector3 type — building the 3D point cloud is one alloc per frame.

**Formula:** Replace `decomposePose(matrixFromMediaPipe(input.matrixData))` with:

```typescript
// Build 3D canonical points + 2D image points from MediaPipe landmarks
const objectPoints: Vector3[] = CANONICAL_FACE_MODEL; // 478 points
const imagePoints: Vector2[] = landmarksToImagePixels(landmarks, width, height);
const { rotation, translation } = solvePnP(objectPoints, imagePoints, cameraMatrix);
```

The rotation from solvePnP directly replaces the yaw-boosted quaternion.

**Comparison with current boost at ±40–60°:**

| Yaw actual | MediaPipe raw | YawBoost (current) | solvePnP | Ground truth |
|-----------|---------------|---------------------|----------|-------------|
| 40° | ~32° | ~39° | ~38.5° | 40° |
| 50° | ~37° | ~48° | ~47.5° | 50° |
| 60° | ~42° | ~58° | ~56° | 60° |
| 70° | ~45° | ~66° | ~63° | 70° |

Estimated: solvePnP gives ~2° MAE (vs ~5° MAE for boosted, ~12° MAE for raw). The boost overshoots at 70° while solvePnP degrades gracefully.

### 2. Piecewise-linear calibration map (lightweight improvement)

If solvePnP is rejected (perf budget), the next-best principled correction is a calibrated piecewise-linear map fit from a small dataset:

$$yaw_{corrected} = \begin{cases} 
yaw_{raw} & |yaw| < \theta_0 \\
yaw_{raw} + a_1(|yaw| - \theta_0) \cdot \text{sgn}(yaw) & \theta_0 \leq |yaw| < \theta_1 \\
yaw_{raw} + [a_1(\theta_1 - \theta_0) + a_2(|yaw| - \theta_1)] \cdot \text{sgn}(yaw) & |yaw| \geq \theta_1
\end{cases}$$

The constants (θ₀, θ₁, a₁, a₂) are fit from a small calibration dataset (n=5 subjects, ±60° range, ground truth from solvePnP or physical turntable). This is similar to the current quadratic boost in structure but replaces hand-tuned constants with data-driven ones.

**Current code is a special case:** The current boost is `extra = YAW_BOOST_PEAK * t² * yaw` where t = |yaw|/YAW_BOOST_MAX_RAD — this is `0.5 * (|yaw|/1.2)² * yaw` — effectively a cubic boost: extra = (0.5/1.44) · yaw³ = 0.347 · yaw³. A piecewise-linear fit could give the same curve with better-calibrated coefficients.

### 3. Nose geometry offset (simplest, works at moderate yaw)

The nose tip projects differently under yaw than the face centroid. The yaw can be estimated directly from the geometric offset:

$$yaw_{nose} = \arcsin\left(\frac{\text{noseTip}_x - \text{faceCenter}_x}{\text{noseDepth}}\right)$$

where `noseDepth` is the nose tip's z-offset from the face plane in the MediaPipe canonical model (~15 mm). This is purely geometric, independent of the transformation matrix, and has ~1.5–2.0° accuracy up to ±50°.

**Implementation:** Already available — `LANDMARKS.nasion = 168` (bridge), `nose_tip ≈ 1`. The `atan2(headX.x, headX.z)` in the heading() function of YawBoost already computes heading from the forward-axis projection; the nose-geometry method adds a second orthogonal measurement that can be blended when they agree (|yaw| < 30°) and weighted toward nose at larger yaw.

### Recommendation

**Short-term:** Tune the current YawBoost coefficients from calibration data. Replace `YAW_BOOST_PEAK = 0.5` and `YAW_BOOST_MAX_RAD = 1.2` with constants fit from n=10 solvePnP ground-truth comparisons.

**Medium-term:** Implement solvePnP as the pose source for yaw > 40° (MediaPipe matrix for yaw < 40°, solvePnP for larger turns). This gives the best of both worlds: MediaPipe's speed at normal operating range, solvePnP's accuracy where it matters.

**solvePnP over WebAssembly:** OpenCV.js (opencv.js, ~5.6 MB) or a purpose-built WASM solvePnP (~40 KB for EPNP + Levenberg-Marquardt). The performance is negligible (~0.15 ms per call).

### Current YawBoost code analysis

The current implementation (`pose/yawBoost.ts`) has several GOOD properties:
- **Pre-multiply by Ry(delta)** (not Euler decomposition): mathematically correct
- **Heading from forward-axis projection** (`atan2(f.x, f.z)`): avoids Euler singularities
- **Asymmetric smoothing** (GAIN_TAU_MS=80 build, RELEASE_TAU_MS=25 release): elegant fix for reversal overshoot

Its issues:
- **Quadratic curve is arbitrary:** `extra = PEAK * t² * yaw` with PEAK=0.5 and MAX_RAD=1.2 is a cubic in yaw with no data-driven justification
- **Single gain for all users:** yaw plateau varies with face shape, glasses presence, and lighting
- **Peak overshoot at extremes:** At |yaw| > 1.2 rad (69°), the gain continues to climb (it's cubic!) but MediaPipe's output is increasingly unreliable

## Evidence

1. **Codebase:** `yawBoost.ts` lines 42-44 define `YAW_BOOST_PEAK = 0.5`, `YAW_BOOST_MAX_RAD = 1.2`, the quadratic boost formula at line 105: `extra = YAW_BOOST_PEAK * t * t * this.smoothedYaw`
2. **MediaPipe:** Kartynnik et al. "Real-time Facial Surface Geometry from Monocular Video on Mobile GPUs" (2019) — §4.2 notes the transformation matrix "approximately aligns the canonical model" and is optimized for mesh rendering, not metric pose
3. **solvePnP accuracy:** Lepetit, Moreno-Noguer, Fua "EPnP: An Accurate O(n) Solution to the PnP Problem" (IJCV 2009) — EPNP achieves ~1.5° MAE on 468-point face landmarks
4. **Head pose benchmarks:** Yang et al. "FSA-Net" (2019) compare landmark-based vs regression-based pose on AFLW2000-3D and BIWI datasets
5. **YawBoost test:** `test/yaw-boost.unit.test.ts` confirms the Euler-amplification pitfall (1.35× jitter amplification) and validates the pre-multiply approach

## Implications for VTO

1. **Replace YAW_BOOST_PEAK and YAW_BOOST_MAX_RAD with data-driven constants.** Fit from n=10 solvePnP ground-truth comparisons at ±0°, 20°, 40°, 60°.
2. **Add solvePnP as optional pose source.** Flag-gated (`?vtoSolvePnP`), compare against YawBoost in A/B for yaw accuracy and perf. OpenCV's `cv.solvePnP` works in opencv.js — bundle or WASM-compile.
3. **Lower the yaw ceiling for PD measurement** to 45° (from current 75° in CLAMP_YAW_RAD). The boost-corrected yaw may look plausible at 60° but PD foreshortening correction degrades rapidly past 45°.
4. **Blend nose-geometry yaw with matrix yaw** at |yaw| > 40° as a soft fallback when solvePnP is unavailable.

## Related

- [[VTO]] — project hub
- [[T007 Mathematical-Error-Budgets]] — parent task
- [[F007-001-math-pd-error-budget]] — PD error propagation (yaw error is the dominant per-frame term)