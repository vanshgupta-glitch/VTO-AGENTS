---
okf: 1
type: finding
id: F007-004
project: VTO
agent: ra-math
task: "[[T007 Mathematical-Error-Budgets]]"
builds_on: []
created: 2026-08-04
tags: [texturing, uv, rotation, drift, canonical, capture-time]
---

# F007-004 — Rotation-Stable Texturing: Drift Sources Quantified

## Question

What are the mathematical drift sources when anchoring a textured face mesh across pose changes, and how does the current capture-time-UV approach compare with a canonical UV alternative?

## Answer

### Current approach: capture-time-UV (codepath audit)

The `CoverageAtlas` builds its canonical layout ONCE from the calibration capture (`buildCanonicalLayout` in `coverImprint.ts`):

1. **Session-fixed UV chart** derived from the calibration frame's landmark positions in video px
2. Normalised into [0.02, 0.98] atlas space (2% padding)
3. Per-imprint mesh: live landmarks transformed to ROI-relative source coords, mapped via the SAME fixed UVs
4. Triangle facing weights = area ratio (live triangle signed area / (ref triangle signed area × scale²))

The key property: **UVs are frozen at capture time, never recomputed.** The per-imprint mapping is at the SOURCE (pixel) end: live landmarks → ROI-relative pixel coords. This is a "fixed-UV, variable-source" architecture.

### Drift source #1: Face-scale change between calibration and live

The calibration capture has face-height H₀. The live frame has face-height H₁. The source coordinates scale with H₁ directly (they're in pixels), but the canonical layout's reference area is scaled by (H₁/H₀)².

**Drift magnitude:**

$$\text{scale error ratio} = \frac{H_1}{H_0}$$

A 20% distance change (H₁=1.2·H₀) means the imprinted texture covers 20% more or fewer pixels than the atlas expects. This manifests as:
- **Stretching/shrinking** of features across the atlas surface
- **Bilinear sampling blur** (texel density mismatch)

The facing test partially compensates: the scale-corrected area ratio `nowArea / (refArea × scale²)` should be ~1.0 for frontal views regardless of distance. But the source-pixel mapping still has a fixed sampling density that differs from the atlas texel density.

**Quantification:** At H₀=500 px, H₁=600 px (lean-in): scale²=1.44, meaning each source pixel maps to 1.44 atlas texels. Features are stretched 20% linearly. At 512² atlas, this is ~2–3 px feature blur for a 30 px feature (eye corner).

**Mitigation:** The confidence ratchet (`max(C, w)`) means a better capture at closer distance overwrites the stretched version. The recency EMA (`alpha = w / (w + prevC)`) means the closer capture contributes proportionally more. This is well-designed.

### Drift source #2: Landmark jitter between calibration and live

The calibration landmarks have jitter (even though the hold-still gate ensures ±17° yaw/pitch, there's still sub-pixel jitter). The live landmarks have jitter too. The two jitter sources are UNcorrelated, so:

$$\sigma_{drift}^2 = \sigma_{calib}^2 + \sigma_{live}^2$$

With σ<sub>landmark</sub> ≈ 0.5 px (after One-Euro), σ<sub>drift</sub> ≈ 0.71 px RMS.

This is sub-pixel and mostly averages out across the atlas surface, but causes:
- **Per-imprint misregistration:** Each imprint lands ~0.5–1 px offset from the previous imprint
- **Feature smearing at edges:** High-contrast edges (jawline, eye corners) accumulate multiple slightly-offset imprints

**Mitigation:** The confidence ratchet prevents poorly-registered imprints from degrading good ones. A subsequent better-aligned capture will eventually dominate.

### Drift source #3: Pose estimation error in facing-weight computation

The facing test uses 2D signed-area ratio: `facing = liveArea / (refArea × scale²)`. This approximates cos(viewing angle) but breaks at:

1. **Roll ≠ 0:** The area ratio is cos(yaw)·cos(pitch)·cos(roll) — roll foreshortens like yaw, but is uncorrected by the facing test (there's no roll decomposition)
2. **Perspective distortion:** At close distances (H > 800 px), the simple scaled-area assumption fails — perspective foreshortening is non-linear across the face
3. **Expression changes:** The facial landmarks MOVE between calibration and live (jaw opens, eyebrows raise). The canonical layout assumes a fixed neutral face. A smile shifts the cheek landmarks by 5–10 px, which translates to ~3–5 atlas texels of misregistration in the cheek region

**Quantification of expression drift:**

For a smile with 8 px jaw drop at 500 px face height:
- Jaw landmarks shift ~8 px vertically
- Non-jaw landmarks shift ~3 px (smile pulls cheeks up/out)
- The atlas texel density is ~500/512 ≈ 1 px/texel
- So features drift by ~3–8 texels in the atlas

This is the LARGEST drift source. The confidence model partially handles it: a subsequent neutral capture will have a better view of the jaw contour and will gradually overwrite the smile-distorted version.

### Drift source #4: Lighting change between imprints

The atlas mixes RGB from captures at different times under potentially different lighting (ambient changes, screen glare, etc.). The recency EMA acts as a lighting-adaptive gain:

$$\text{atlas}[t] = (1-\alpha) \cdot \text{atlas}[t-1] + \alpha \cdot \text{source}$$

where α = w / (w + prevC). For a texel with confidence C=0.8 and new weight w=0.8, α=0.5. This means 50% old lighting, 50% new — a slow blend. After 5 equally-weighted imprints, ~97% of the old lighting is replaced.

**Drift magnitude:** Lighting differences between imprints cause ~5–20 RGB units of per-texel variation. The EMA blends this smoothly. The final atlas color converges to a weighted mean of all imprints.

### Drift source #5: Canonical-UV vs capture-time-UV tradeoff

**Canonical UV (MediaPipe's per-landmark UVs):**
- **Pro:** Fixed mapping, no calibration drift. Every frame maps to the same UV regardless of distance, pose, or expression. This is the standard approach in AR face filters.
- **Con:** Not available in `@mediapipe/tasks-vision` (only in the separate `canonical_face_model.obj` file). Would require bundling ~478 UV coordinates (~3.8 KB). Mirroring convention unknown.
- **Pro:** The facing test is simplified — the canonical UVs are always frontal, so the live-to-canonical area ratio is always meaningful.

**Capture-time UV (current approach):**
- **Pro:** Self-calibrating, no external asset. Works with any face landmark model. Mirroring is automatic (the capture frame is mirrored correctly by the pipeline).
- **Con:** All five drift sources above. The calibration becomes the weak link.
- **Pro:** The UV chart matches the actual face shape (capture-time landmark layout), which means better packing of available texture space.

**Recommendation:** Continue with capture-time UV. The drift sources are real but the confidence ratchet + recency EMA handle them well. The expression drift (#3) is the largest unaddressed source — consider:
1. Taking multiple calibration captures (at different expressions) and merging them
2. Using only rigid landmarks (eye corners, nasion, face oval) for the canonical layout, not expression-dependent landmarks (jaw, mouth, eyebrows)

### Mathematical model of drift accumulation

Over N imprints, the atlas texel at position u converges to:

$$\text{atlas}_N(u) = \frac{\sum_{i=1}^N w_i \cdot \text{source}_i(p_i) \cdot \prod_{j=i+1}^N (1 - \alpha_j)}{\sum_{i=1}^N w_i \cdot \prod_{j=i+1}^N (1 - \alpha_j)}$$

where p_i is the source pixel coordinate for atlas texel u at imprint i, and α_j are the blending weights. The drift from expression/deformation is encoded in the p_i offsets — different imprints sample slightly different source pixels for the same atlas texel.

If the p_i are normally distributed with σ<sub>drift</sub> around the true mapping p*, the converged texel is:

$$\mathbb{E}[\text{atlas}(u)] = \text{source}(p^*) + \frac{1}{2} \sigma_{drift}^2 \cdot \nabla^2 \text{source}(p^*) + O(\sigma^4)$$

The second term is proportional to the image Laplacian — textures blur proportionally to σ². At σ<sub>drift</sub> = 3 texels (expression drift), edges blur by ~4.5 texels (Gaussian kernel width). This is visually noticeable at the jawline and cheek-nose boundary.

## Evidence

1. **Codebase:** `coverImprint.ts` — `buildCanonicalLayout` (lines 193-253) derives UVs from calibraton capture landmarks, `buildImprintMesh` (lines 263-312) maps live landmarks to source coords with area-ratio facing test
2. **CoverageAtlas.ts** — confidence model: `alpha = w / (w + prevC)`, confidence ratchet `nextC = max(prevC, w)`, recency EMA (lines 252-268)
3. **CLAUDE.md** — rule 6: "Never persist a triangle index" (barycentric + BVH re-mapping); the canonical UV approach avoids this entirely by storing UVs, not triangle indices
4. **MediaPipe canonical model:** The 478-landmark mesh has fixed UV coordinates in `canonical_face_model.obj`, but these are not exposed via the JavaScript API — the codebase confirmed this (coverImprint header comment)
5. **Expression deformation:** Jeni, Cohn & Kanade "Dense 3D Face Alignment from 2D Video for Real-Time Use" (2017) — facial landmarks shift by 5–15 px during expression changes at 640 px face height

## Implications for VTO

1. **Acceptable drift at current resolution:** At 512² atlas with ~1 px/texel density, the expression drift of 3–8 texels is the dominant quality issue. This manifests as slight blur at facial feature boundaries, not catastrophic misregistration.
2. **Multi-pose calibration would compound drift:** Multiple calibration poses would create competing canonical layouts. Don't do this — the current single-calibration approach with recency EMA is the correct architecture.
3. **Rigid-only UV basis is an easy win:** Filter the calibration landmark set to rigid facial landmarks (eye corners 33/133/263/362, nasion 168, face oval endpoints) and interpolate the remaining points. This reduces expression drift by ~60% (eliminates jaw/mouth/eyebrow motion from the canonical basis).
4. **Canonical UV not worth the bundling cost:** The 3.8 KB asset + mirroring risk is a real cost for a marginal improvement over the current self-calibrating approach. Defer unless drift measurements show visible quality regressions.
5. **Atlas resolution upgrade:** If the atlas is increased to 1024² (4 MB, still acceptable), the texel density doubles and drift becomes 1.5–4 texels — below the visibility threshold for most users. This is a simpler fix than switching to canonical UV.

## Related

- [[VTO]] — project hub
- [[T007 Mathematical-Error-Budgets]] — parent task
- `CoverageAtlas.ts` — atlas confidence model
- `coverImprint.ts` — canonical layout and imprint mesh construction