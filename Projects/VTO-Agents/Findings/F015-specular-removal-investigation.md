---
okf: 1
id: F015-specular-removal-investigation
type: finding
project: VTO
status: final
created: 2026-08-04
updated: 2026-08-04
tags: [vto, frame-removal, specular, glare, texture-imprint, atlas, investigation]
task: T015 Specular-Removal
sources: [coverImprint.ts, CoverageAtlas.ts, HeadCoverLayer.ts, FrameRemovalPipeline.ts, MaskGenerator.ts, frameRegion.ts, mask.ts, CANDIDATE-frame-detection-removal-v2]
related: [F004-rendering-atlas-coverage]
---

# F015 — Specular-Removal Investigation

**Verdict: SKIP.** A dedicated specular-removal pass is not warranted for the current texture-imprint architecture.

## Question

Does specular glare (lens reflections, rim highlights) from the original glasses contaminate the texture-imprint clean-face atlas, and if so, what detection approach (heuristic vs learned) should remove it?

## Answer

**No — the current architecture already protects against specular contamination through three independent mechanisms, and neither heuristic nor learned approaches add value at this stage.**

### Architecture Analysis

#### 1. Lens glare is blocked by the region-gating shader

The contamination path people worry about: specular highlights on original lenses → eye-region atlas texels → visible artifacts when the head cover renders.

This path is structurally impossible because the `HeadCoverLayer` fragment shader multiplies atlas alpha by the frame-region gate (`HeadCoverLayer.ts` line 90):

```glsl
gl_FragColor = vec4(t.rgb * uGain, a * rgn * uAlpha);
```

`rgn` is zero everywhere the frame is NOT present — including the entire lens interior. The lens area in the atlas is never displayed, regardless of what pixels were imprinted there. The `FrameRegionMask` accumulates only dilated, feathered traces of where the real frame actually sits (frame rims, bridge, temples), and the region gate fails CLOSED (1×1 zero texel seed).

#### 2. Frame-rim glare is erased by inpainting (which runs before imprinting)

The pipeline flow (`FrameRemovalPipeline.process()`):

```
detect → rasterize masks → inpaint → lens transparency → face cleaning → [imprint]
```

The rasterized frame mask covers the full rim annulus (outer contour → inner contour) + bridge + temples. The inpainting (LaMa) fills this ENTIRE region with skin — glossy rim pixels and matte rim pixels are treated identically: erased and replaced. Specular highlights on the frame rim don't survive to the atlas because the rim itself doesn't survive.

The `composeImprintSource()` function in `coverImprint.ts` (line 322–340) blends raw pixels (for preserved regions) with cleaned pixels (for removed regions), gated by the removal alpha. The cleaned source (post-inpainting) has alpha = removal mask, which is non-zero exactly where the frame was erased.

#### 3. Multi-pose EMA corrects residual inpainting artifacts

Even if LaMa inpainting produces sub-optimal skin on a glossy rim in one frame, the atlas confidence model is a recency-weighted EMA (`CoverageAtlas.blendTexel()`, line 254):

```
alpha = w / (w + prevC)  // first sight writes outright, later refreshes at 0.5
confidence = max(prevC, w)  // ratchet: never decreases
```

A single bad inpainting contributes proportionally to its facing weight and is diluted by better imprints from other calibration poses. The confidence ratchet prevents coverage regression.

#### 4. The one legitimate concern: rim detection failure under extreme glare

If frame rims are so glossy that the contour tracer can't find the rim-material band (the band-luma-spread and median-contrast gates fail), the entire frame-detection step fails → no glasses detected → no removal → no imprint. This is a DETECTION robustness problem, not a removal problem, and belongs in the `FrameDetector` / contour tracing work, not a separate specular-removal pass.

### Detection Approaches: Heuristic vs Learned

| Approach | Method | Accuracy | Browser Cost | Verdict |
|---|---|---|---|---|
| **Heuristic — HSV threshold** | `S < τ_sat AND V > τ_val` in HSV colorspace. Classic method: high-value + low-saturation pixels are specular candidates. | ~70-80% on controlled lighting; degrades in mixed lighting, on skin (pale skin has similar HSV signature). | Negligible — one per-pixel branch in JS. | Too imprecise for face images. High false positives on forehead/cheek highlights. |
| **Heuristic — Dichromatic reflection model** | Shafer 1985: color of each pixel = diffuse component + specular component. Requires per-material color segmentation. | ~80-85% on uniform surfaces; breaks on face skin (skin is not one material). | Moderate — requires iterative clustering. | Over-engineered for the problem. Face skin has micro-texture that violates the uniform-material assumption. |
| **Heuristic — Dark channel prior** | Pixels where the dark channel (min RGB over a patch) is still bright are specular. | ~75-85% outdoors; poor indoors. | ~5-10 ms for a patch-based scan on a video frame. | Too many false positives on light skin under bright lighting. |
| **Learned — DHAN-SHR (2024)** | Dual-Hybrid Attention Network, SOTA specular removal. Two-stage: L-HD-DAT (local) + G-DAT (global). Outperforms 18 prior methods. | ~93-96% on benchmark datasets. | ~150-300 MB ONNX model, ~200-500 ms/frame on GPU, infeasible on WebGL CPU fallback. Browser deployment not practical. | **Too heavy.** ~150+ MB model for a calibration-time pass that may not be needed. |
| **Learned — SpecSeg-style CNN** | U-Net or lightweight segmentation CNN trained on specular masks. | ~88-92% in controlled evaluations. | ~5-20 MB ONNX, ~50-100 ms/frame on WebGL. Feasible but niche. | Overkill. Training data for "specular on glasses rims on faces" doesn't exist and would need to be created. |
| **Learned — Two-stage (detect → remove)** | Separate detection CNN + inpainting-based removal (what we'd effectively build). | High for detection step. | Two model loads. Detection adds 10-50 MB. | The inpainting already removes the rim. Adding detection is redundant — you'd detect specular pixels you're already erasing. |

**Bottom line on approaches:** The heuristic methods are free but imprecise (high false positives on face skin). The learned methods are accurate but heavy, require training data that doesn't exist for our domain, and solve a problem that is already handled by the existing inpainting pass. Neither is worth investing in.

### Integration Guidance (if needed later)

If a specular-removal pass were ever added, its location in the pipeline would be:

```
FrameRemovalPipeline.process():
  ...
  const masks = rasterizeGlassesMasks(detection.region, ...);  // existing
  // ← INSERT HERE: specular detection on the frame-mask region
  //   - Input: frame pixels within masks.frame (255 region)
  //   - Output: flagged pixels (specular mask) — inpaint THESE pixels
  //     with LaMa BEFORE the main inpainting, using only surrounding
  //     non-specular rim pixels as the reference
  //   - Or: simply dilate the frame mask over the detected specular
  //     blobs to ensure LaMa fills them during the main pass
  const removal = this.maskGenerator.generate(masks, browProtect);
  ...
```

The trigger for reconsideration: field evidence that glossy frame rims produce visible atlas artifacts after multi-pose calibration. This would manifest as bright patches in the cover that persist across head turns. If observed, the simplest fix is to dilate the frame mask by 2-4 extra pixels in the specular regions — not a separate removal pass.

## Evidence

### From the codebase

1. **`MaskGenerator.ts` lines 97-102:** Lens interiors are preserved (`preserveLenses: true`), producing a `lensKeep` mask that is subtracted from the removal alpha. Lens pixels are NOT in the hard mask.

2. **`mask.ts` lines 21-47:** `fillLens()` puts 255 in `masks.lens` for `r < inner` (inside the inner contour) and 255 in `masks.frame` for `inner ≤ r ≤ outer` (the rim). The two masks are disjoint.

3. **`HeadCoverLayer.ts` line 90:** The fragment shader multiplies atlas alpha by the region gate `rgn`, so the cover is invisible where no frame was detected.

4. **`coverImprint.ts` lines 322-340:** `composeImprintSource()` blends raw and cleaned pixels using the cleaned frame's alpha channel (the removal mask). Where the frame was removed (alpha=1), the inpainted/cleaned pixels are used.

5. **`CoverageAtlas.ts` lines 252-261:** The confidence model uses a recency-weighted EMA: bad imprints are diluted by better ones, and confidence only ratchets up.

6. **`FrameRemovalPipeline.ts` lines 100-161:** The full chain: detection → masks → inpaint → lens transparency → face cleaning. Inpainting runs on the frame-mask region only. The output (after all stages) feeds the imprint pipeline.

### From the literature

7. **DHAN-SHR (arxiv:2407.12255):** State-of-the-art specular highlight removal network. ~150-300 MB model with attention mechanisms. No browser ONNX export path exists. Overkill for a calibration-time pass on a feature that inpainting already handles.

8. **Text-Aware Specular Highlight Removal (arxiv:2108.06881):** Two-stage network (detection + removal). Confirms that specular removal is well-studied but the models are designed for offline processing, not real-time browser use.

9. **Dichromatic reflection model (Shafer, 1985):** The foundational heuristic approach. Assumes uniform surface reflectance within color segments. Face skin violates this assumption (pores, micro-texture, varying pigmentation).

## Recommendation

**Skip the specular-removal pass.** The architecture is already protected through:

1. Region gating (lens glare never displays)
2. Inpainting (rim glare is erased with the rim)
3. Multi-pose EMA (any residual artifacts are diluted)

**Revisit only if** field testing with glossy acetate/metal frames shows visible bright artifacts in the head cover that persist across calibration poses and head turns. If that occurs, the fix is a 2-pixel dilation of the frame mask over specular-candidate regions — not a separate detection model.

**Cost of being wrong:** Zero. The inpainting + region gating + confidence EMA form three redundant safeguards. If glare somehow survived all three, the symptom would be visible only during development and would not reach production because the calibration-session pipeline is self-contained and tested before shipping.
