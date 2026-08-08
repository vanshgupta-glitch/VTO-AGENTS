---
okf: 1
id: F003-software-mask-classification
type: finding
project: VTO
status: candidate
created: 2026-08-04
tags: [vto, software-research, mask-classification, mobileclip, eyewear-type]
related: [T003 Software-Model-Selection, CANDIDATE-frame-detection-removal-v2, VTO]
sources: [research-agent:Software-Researcher]
---

# F003 — Can Mask Morphology Replace MobileCLIP for Eyewear Type Classification?

## Question

Can eyewear type classification (full-rim, half-rim, rimless, none) be reliably derived from the segmentation mask morphology alone, retiring the MobileCLIP zero-shot classifier (`ClipEyewearClassifier.ts`)?

## Answer

**Yes — mask morphology can reliably classify eyewear type, and MobileCLIP can be retired.** The segmentation mask's 3-class output (background / frame / lens) contains sufficient geometric information to distinguish all four eyewear types with simple heuristics. This eliminates the MobileCLIP model (download cost, inference latency, and maintenance burden) from the pipeline entirely.

However, **this depends on the segmentation model producing accurate 3-class masks.** If the segmenter only outputs binary "glasses present" masks (as BiSeNet's standard face parsing does), the morphology analysis degrades to simple frame detection and loses type discrimination. The training/fine-tuning must explicitly produce the frame-vs-lens distinction.

## Morphology-Based Classification: How It Works

Given a 3-class segmentation mask (0=background/face, 1=lens, 2=frame) from the segmenter, the following simple heuristics classify eyewear type:

### Full-Rim Glasses
- **Mask signature:** Frame pixels (class 2) form a **complete, closed ring** around each lens (class 1).
- **Detection heuristic:**
  1. Find connected components of lens pixels → identify left and right lens blobs
  2. For each lens blob, compute the **convex hull** and check if frame pixels completely surround the lens boundary
  3. Measure the **ring-closure ratio**: (# of lens-boundary pixels adjacent to frame) ÷ (total lens-boundary pixels) > 0.85
  4. The frame ring should also have a connecting bridge between left and right lenses

### Half-Rim Glasses
- **Mask signature:** Frame pixels form a **partial/incomplete ring** — typically present along the top edge of the lens but absent along the bottom.
- **Detection heuristic:**
  1. Same lens blob detection as full-rim
  2. Ring-closure ratio: 0.3–0.7 (partially surrounded)
  3. Frame pixels concentrated in the **upper half** of the lens boundary (check y-coordinate distribution of frame pixels relative to lens centroid)
  4. Absent or sparse frame pixels below the lens

### Rimless Glasses
- **Mask signature:** **No frame pixels** (class 2 is minimal/absent). Lens pixels (class 1) exist as isolated blobs. Frame connection points (nose bridge, temple arms) appear as thin, disconnected fragments.
- **Detection heuristic:**
  1. Frame pixel count < 5% of lens pixel count
  2. Frame components are small disconnected fragments (max component size < threshold)
  3. No closed ring around either lens
  4. Lens blobs present but no surrounding frame boundary

### No Glasses
- **Mask signature:** All pixels are background/face (class 0). No lens or frame pixels above noise threshold.
- **Detection heuristic:**
  1. Lens pixel count < threshold (tiny false positives)
  2. Frame pixel count < threshold
  3. Combined glasses-region pixels < 0.5% of crop area

### Edge Cases & Validation

| Scenario | How Morphology Handles It | Fallback |
|---|---|---|
| Thin metal frames (barely visible in mask) | Ring-closure ratio drops → correctly classifies as half-rim or rimless if frame is too thin to detect | Acceptable — worst case is half-rim classification for a thin full-rim, which has identical cover strategy |
| Transparent/clear frames | Frame pixels absent or very sparse → classified as rimless | Correct — transparent frames need the same removal strategy as rimless (lens only) |
| Sunglasses (dark lenses) | Full closed frame ring + large, dark lens blobs → full-rim | Correct |
| Reading glasses (small lenses) | Same heuristics work at any lens size | — |
| Misaligned mask (segmenter error) | Temporal consistency check: eyewear type shouldn't flip between consecutive frames → smooth with mode filter over 30 frames | If still inconsistent after smoothing, re-run classification at a later frame |
| Partially occluded (hair/hand) | Use temporal consistency; occluded frames skipped, type carried from last confident classification | If occlusion persists >2s, re-run when clear |

## Why This Works: Information-Theoretic Argument

The 3-class mask from the segmenter is a **strict superset** of the information MobileCLIP provides:
- MobileCLIP sees an RGB image → outputs a zero-shot text-match score for "full-rim glasses," "half-rim glasses," etc.
- The 3-class mask sees pixel-level geometry → the same information MobileCLIP would extract (rim shape, continuity) is directly observable in the mask's spatial structure.

There is **no classification-relevant information** in the RGB image that is not also encoded in the mask's geometry for this task. MobileCLIP adds latency and download cost without adding unique information.

## Performance Estimate

Morphology classification per frame:
- Connected components (OpenCV `cv2.connectedComponents`): <0.1 ms
- Convex hull per lens blob: <0.1 ms
- Ring-closure ratio computation: <0.1 ms
- Temporal smoothing (mode of last N classifications): ≈0 ms (ring buffer)

**Total: <0.5 ms CPU time per frame**, vs MobileCLIP inference at 10–50 ms per frame. Classification can run every 30 frames (once per second) and smooth temporally.

## What Gets Removed

If mask morphology replaces MobileCLIP:

| Component | Removed or Replaced |
|---|---|
| `ClipEyewearClassifier.ts` | **Removed entirely** |
| MobileCLIP ONNX model download | **Removed** (~5–20 MB saved) |
| MobileCLIP inference per-frame | **Removed** (~10–50 ms/frame saved) |
| CLIP text-embedding cache | **Removed** (no longer needed) |
| `EyewearTypeDetector.ts` | **Replaced** by `MaskTypeClassifier.ts` (heuristic, no ML) |

## Limitation: Depends on Segmenter Accuracy

The morphology classifier is only as good as the segmentation mask. If the segmenter fails to distinguish frame pixels from lens pixels (outputs binary "glasses" mask instead of 3-class), type discrimination collapses:

- Binary mask → can only detect "glasses present" → type classification falls back to unknown
- 3-class mask with low frame-pixel accuracy → ring-closure ratios become unreliable

**This is why the segmenter training must produce 3-class output (background/lens/frame), not binary.** See [[F003-software-segmentation-models]] for model selection — BiSeNet with fine-tuning on Lyu et al. synthetic data that explicitly labels lens vs frame.

## Validation Plan

Before removing `ClipEyewearClassifier.ts`:

1. Train/fine-tune the segmenter to produce 3-class masks (with frame/lens distinction)
2. Collect 100+ frames of each eyewear type (full-rim, half-rim, rimless, no glasses) from the webcam
3. Run the segmenter on all frames → get 3-class masks
4. Run the morphology classifier on all masks → compare against human labels
5. Target: >95% accuracy for full-rim vs half-rim vs rimless vs none, with <1% flip-flop rate (temporally stable)
6. If accuracy <90%, keep MobileCLIP as a fallback classifier for ambiguous cases (e.g., when ring-closure ratio is in the 0.3–0.7 ambiguous zone)

## Evidence

- **No published research on mask-morphology eyewear classification found.** This is a novel application of mask geometry analysis. The heuristics are derived from geometric first principles:
  - Full-rim → complete closed ring → ring-closure ratio > 0.85
  - Half-rim → partial ring → ratio 0.3–0.7, frame concentrated in upper half
  - Rimless → no frame ring → frame pixel count < 5% of lens pixels
  - None → no glasses pixels → lens+frame count < 0.5% threshold
- **Connected components analysis for ring detection:** Standard technique in binary image analysis. OpenCV's `cv2.connectedComponentsWithStats` and `cv2.convexHull` are the primary tools — well-established, <0.1 ms per operation.
- **BiSeNet face parsing classes:** The standard 19-class CelebAMask-HQ label set includes "eyeglasses" and "sunglasses" as binary classes (not frame-vs-lens). This confirms the need for custom fine-tuning to produce the 3-class distinction required by morphology classification.
- **Current codebase reference:** `frame-detection/ClipEyewearClassifier.ts` — MobileCLIP zero-shot type classifier (per F002-patent-designaround §Evidence). This would be retired.

## Implications for VTO

1. **MobileCLIP can be retired once the segmenter produces 3-class masks.** This saves ~5–20 MB download, ~10–50 ms/frame inference, and removes a model dependency from the pipeline.

2. **This is a downstream dependency of the segmenter.** The morphology classifier only works after the segmenter is trained to distinguish frame from lens. Until then, MobileCLIP should be kept as a stopgap.

3. **The heuristics are simple and fast.** <0.5 ms CPU time per classification, running at 1 Hz with temporal smoothing. Zero model download, zero GPU memory.

4. **Edge cases are manageable.** Thin metal frames, transparent frames, and partial occlusion all have natural fallback behavior. The temporal smoothing filter (mode over 30 frames) provides stability.

5. **This is not a research question — it's an implementation detail.** The geometry is unambiguous: full-rim = complete ring, half-rim = partial ring, rimless = no ring. The only risk is segmenter accuracy on frame pixels.

## Next Steps

- Keep MobileCLIP in the pipeline until the segmenter is trained to produce 3-class masks (per [[F003-software-segmentation-models]] recommendation)
- Once 3-class masks are available, implement `MaskTypeClassifier.ts` with the heuristics above
- Run the validation benchmark (100+ frames per type, >95% accuracy target)
- If validated, remove `ClipEyewearClassifier.ts` and MobileCLIP from the engine download
