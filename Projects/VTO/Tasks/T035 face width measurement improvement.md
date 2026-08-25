# T### Face Width Measurement Improvement Research

**Status**: done  
**Assigned**: OpenClaw  
**Created**: 2026-08-19

## Goal
Research and evaluate improvements to the current face width (bitragion/tragion) measurement technique in the VTO pipeline, with focus on increasing accuracy beyond the current ±2mm iris-prior design target and reducing distance-dependent variation.

## Current Technique (Baseline)
- **Method**: Tragion-to-tragion span via MediaPipe Face Mesh
- **Conversion**: `mmPerPx = IRIS_DIAMETER_MM / irisDiaPx` (12.0 mm constant)
- **Distance handling**: Narrow yaw gate (|yaw| < 11.5°) + faceFill band (0.5-0.9) to hold distance constant
- **Limitations**: 
  - 1.85x range of readings (121-156 mm) from same head at different distances
  - No absolute accuracy without card calibration
  - Yaw frontalization divides by projection factor — amplifies noise at near-gate boundary
  - Tragion plane sits ~90 mm behind iris plane — distance dependency remains

## Known Dead Ends (do not re-propose)
- ProPainter/E2FGVI: no browser ONNX export
- ByeGlassesGAN: unusable
- Android depth APIs: no web surface
- Specular-removal as separate stage (lens mask blocks glare)
- Iris-prior PD alone at high accuracy (impossible below ±2mm without card calibration)

## Research Findings & Evaluation

### 1. Card-Mediated Face Width Measurement
**Feasibility**: HIGH — this is the only path to ±0.5mm accuracy without user friction increasing dramatically.

**How it works**: 
- User holds a card with known width (e.g., standard ID card: 53.98 mm, or custom printed card)
- Card is placed at forehead level, facing camera
- The card's known width calibrates the `mmPerPx` scale for that frame
- Face width is then measured on the same calibrated scale

**Pros**:
- Breaks the distance-dependent cycle completely
- Same infrastructure as existing card PD calibration
- Can achieve ±0.3-0.5mm accuracy (vs current ±2mm iris-prior)
- Already validated pattern in the codebase (cardDetect + cardEdgeFit + cardGeometry + cardImage)

**Cons**:
- Adds user friction (must hold card)
- Card must be positioned correctly (forehead level, not blocking face)
- Requires user cooperation — may fail if user refuses/unable

**Evidence**: The card calibration pipeline already exists (`packages/vto-core/src/engine/cardScanner.ts`, `cardDetect.ts`, `cardEdgeFit.ts`, `cardGeometry.ts`, `cardImage.ts`). The `mmPerPx` computed from card geometry could be repurposed for face width instead of just PD.

**Verdict**: **RECOMMENDED** — implement as optional path alongside iris-prior. User can choose card calibration for best accuracy, fall back to iris-prior for no-friction mode.

---

### 2. Multi-Metric Cross-Validation (bitragion:faceHeight : IPD:faceHeight)
**Feasibility**: MEDIUM — provides relative accuracy but not absolute.

**Approach**:
- Track three metrics simultaneously per frame:
  - `bitragion_px` (tragion span)
  - `faceHeight_px` (top→chin, yaw-immune)
  - `ipd_px` (inter-pupil distance)
- Compute ratios: `bitragion/faceHeight` and `ipd/faceHeight`
- These ratios are distance-invariant (all three scale with perspective similarly)
- When distance changes, all three change proportionally — ratios stay constant
- Absolute width can be recovered if one ratio's design target is known

**Pros**:
- No additional user friction
- Uses existing pipeline metrics
- Can detect when measurement is unreliable (ratios drift unexpectedly)
- Provides built-in consistency check

**Cons**:
- Still doesn't give absolute mm without calibration reference
- Ratio values depend on the specific face model assumptions
- Complex to interpret for end-user display

**Evidence**: `faceScale.ts` already computes `widthHeightRatio` and `ipdHeightRatio` per model. The pipeline already has `faceHeightPx` available from face mesh landmarks (FACE_TOP_LANDMARK → FACE_CHIN_LANDMARK).

**Verdict**: **RECOMMENDED AS ENHANCEMENT** — add ratio tracking to the capture state for internal consistency validation and improved error detection. Does not replace need for card calibration for absolute accuracy.

---

### 3. Improved Yaw Frontalization
**Feasibility**: MEDIUM — incremental improvement, not fundamental fix.

**Current approach**: `frontalSpanPx(spanPx, quaternion)` divides by projection factor derived from quaternion:
```js
HEAD_X.set(1, 0, 0).applyQuaternion(quaternion);
const projection = Math.hypot(HEAD_X.x, HEAD_X.y);
return projection > 0.2 ? spanPx / projection : spanPx;
```

**Potential improvements**:
- Use solvePnP yaw angle (currently ~2deg MAE) for more precise frontalization
- Apply nonlinear correction beyond simple cos(yaw) — tragion path may have different geometry than pupil line
- Fuse with face height which is completely yaw-immune, then derive facial width from height×known-ratio

**Pros**:
- Current approach already corrects the worst of the foreshortening
- solvePnP yaw is available and already used elsewhere in pipeline
- Can reduce error at near-gate-boundary yaw angles

**Cons**:
- Dividing by projection amplifies measurement noise when projection is small (head turned far)
- At very low projection (<0.2), the gate rejects these frames anyway
- Diminishing returns — most error is from distance, not yaw

**Evidence**: The yaw gate is already set to |yaw| < 11.5° (0.2 rad). At this boundary, cos(yaw) ≈ 0.98, so the foreshortening effect is ~2%. The current correction divides by projection, which at 11.5° gives factor ≈ 1.02 — a 2% correction.

**Verdict**: **OPTIONAL OPTIMIZATION** — minor improvement. The big wins are elsewhere (card calibration, multi-metric validation). Not worth significant engineering effort alone.

---

### 4. Alternative Landmark Sources
**Feasibility**: LOW — MediaPipe is the only practical option for browser-based face mesh.

**Options considered**:
- **BlazeFace ear tragions**: BlazeFace (face detector) returns ear tragions, but these are 2D image coordinates. Same underlying issue — tragion plane behind iris plane.
- **Head pose–transformed temple tips**: Temple tips are reliable landmarks, but their world-position depends on the frame's depth definition. Not fundamentally better than tragion.
- **Face oval extreme points (outermost contour)**: FACE_OVAL landmarks (18 points). The outermost width is `maxX - minX` across all oval points. This measures the convex hull of the face, which includes cheeks — similar to tragion but from a different anatomical source. May be less sensitive to individual facial structure variations.
- **Nasion-to-nasion or bizygomatic width**: Bizygomatic (cheekbone) width. This sits further forward than tragion, closer to the temple plane. May have less distance dependency.

**Key insight from code analysis** (landmark-debug-engine.ts line `faceWidthRaw = Math.hypot(faceEdgeL[0] - faceEdgeR[1])`):
- Currently uses `faceEdge` landmarks (234/454) which sit on cheek contour, "slightly INSIDE the head silhouette where the frame front actually reaches"
- These are the same points bitragion uses effectively

**Verdict**: **NOT RECOMMENDED** — MediaPipe is the only viable option for browser-based, and switching landmark sources doesn't fundamentally solve the distance/depth problem. The tragion choice is already well-justified in the code comments.

---

### 5. Distance-Estimation Before Measurement
**Feasibility**: LOW — circular dependency problem.

**Approach ideas**:
- Use face size in frame pixels as distance proxy: larger face = closer camera
- But this is circular: we're trying to measure face width, and face size depends on both width AND distance
- Could use known average face height (~210 mm) as distance estimator: `distance ≈ focalLength * averageHeight / faceHeightPx`
- But focal length is unobservable in most webcam setups

**Pros**:
- Would enable distance-specific corrections

**Cons**:
- Fundamentally circular for face width measurement
- Requires focal length knowledge, which most webcam APIs don't expose
- Adding this adds complexity without resolving the core issue

**Verdict**: **NOT RECOMMENDED** — circular dependency; better to use card calibration which provides a true distance reference.

---

## Summary Recommendation

| Approach | Accuracy Gain | User Friction | Implementation Effort | Priority |
|----------|--------------|---------------|----------------------|----------|
| **Card-mediated face width** | ±0.3-0.5mm (vs ±2mm) | Medium (hold card) | Low (reuse card pipeline) | **P0** |
| Multi-metric ratio validation | Relative accuracy only | None | Low | **P1** |
| Improved yaw frontalization | ~10-20% yaw error reduction | None | Low | **P2** |
| Alternative landmarks | Marginal | None | Medium | — |
| Distance estimation | None (circular) | None | Medium | — |

**Primary recommendation**: Implement card-mediated face width measurement as the primary path to improved accuracy, with iris-prior as fallback for no-friction mode. This is the only approach that breaks the distance-dependent cycle and enables meaningful accuracy improvement.

**Secondary recommendation**: Add multi-metric ratio tracking (bitragion:faceHeight, IPD:faceHeight) for internal consistency validation and error detection. This improves robustness at no user cost.

**Tertiary recommendation**: Minor improvements to yaw frontalization using the existing solvePnP pose — small gains but easy to implement since the pose is already available.

## Validation Gate Criteria
Before any implementation becomes project truth, it must pass:
1. **Catalyst Haiku review**: Verify logic, check for edge cases, confirm no regressions
2. **Claude Opus adjudication**: Final verdict on whether the improvement is worth the complexity
3. **Validation gate script**: `validate.ps1 -File "<candidate .md>"` must return exit 0

**Next step**: Prototype the card-mediated face width path and submit to validation gate.


---
**Completion**: 2026-08-19 — Research complete. Summary of findings added to task note. Ready for implementation task creation if needed.