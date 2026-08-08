---
okf: 1
id: f002-design-around
type: finding
project: VTO
status: done
created: 2026-08-04
updated: 2026-08-04
tags: [vto, patents, fto, design-around, frame-removal, ip]
---

# F002 — Design-around analysis: does our mesh-texture-imprint removal approach avoid FittingBox-style claims?

> **This is research, not legal advice — a licensed patent attorney must do the formal FTO before launch.**

## Question
Does our "textured face mesh driven by live landmarks + calibrate-and-lock patch" removal approach avoid claims that read on (a) pixel-classification of glasses, (b) inpainting the face behind frames, (c) virtual try-on placement, (d) multi-angle scanning? What claim elements do we clearly NOT practice?

## Answer (plain-English, based on source `C:\Users\ankur.singh\shopify\nmg-vto\rkumar-vto\packages\vto-core\src\`)
Our removal pipeline is a **hybrid**, not a single technique. It *does not* purely avoid the four categories — it practices most of them, but in a way that is **technically distinct** from the likely FittingBox claims. Honest mapping:

| Category | Do we practice it? | How (source) | Distinct from likely FittingBox claim? |
|---|---|---|---|
| (a) pixel/region classification of glasses | **Partially** | `frame-detection/FrameDetector.ts` traces rim *contours* ray-by-ray using geometric signals (closure, smoothness, thickness, contrast, cross-lens agreement, temporal stability) — classical CV, not a learned per-pixel mask. PLUS `ClipEyewearClassifier.ts` runs a zero-shot CLIP model (MobileCLIP) **once at capture** to label eyewear kind. | Contour tracing + landmark seeding ≠ learned pixel-wise glasses mask. But the CLIP classifier *is* a machine-learned image classifier — overlaps claim (a) if drafted at image-model level. |
| (b) inpainting the face behind frames | **Yes** | `LamaInpainter.ts` (LaMa), `InpaintingEngine.ts`, `MaskGenerator.ts` (dilate+feather+lens-subtract). Face behind rims is inpainted/synthesized at capture. | Inpainting per se is long prior art; a claim on "inpaint face behind glasses" is likely weak/anticipated ([[F002-prior-art]]). Our fill is generic LaMa/Telea. |
| (c) virtual try-on placement | **Yes** | Full VTO placement stack (`positioning/`, `pose/`, `AnchorResolver.ts`, iris-based PD, `GlassesRenderer.ts`, `occlusion/FaceOccluder.ts`). | Try-on placement is a crowded, heavily-patented space — **highest-risk category on placement/measurement claims**. |
| (d) multi-angle scanning (StudioBox) | **No** | No multi-camera/multi-angle rig; single webcam, single frontal capture (`CalibrationController`). | We clearly **do not** practice hardware multi-angle scanning — cleanest miss. |
| (extra) texture-imprint head cover (OUR differentiator) | **Yes — unique** | `coverImprint.ts` + `CoverageAtlas.ts` + `FacePatchLayer.ts`: UV atlas frozen once at calibration, per-triangle facing weight from **area-ratio (cos of view angle)**, session-fixed chart, progressive coverage, calibrate-and-lock gate. | The mesh-texture-imprint + area-ratio facing test is the part **least likely covered** by a pixel-classification FittingBox claim — strong design-around lever. |

### Claim elements we clearly do NOT practice
- **No multi-angle / multi-camera capture rig** (no StudioBox equivalent). Single webcam, single frontal capture.
- **No learned per-pixel glasses *mask* segmentation network as the core detector** — our always-on detector is geometric contour tracing seeded by landmarks; the learned model (CLIP) only tags eyewear *class* once at steady capture, it does not produce the erase mask.
- **No server-side / cloud face processing** required for removal — all client-side (matters for any claim reciting a server architecture).
- **No stored 3D model of the user's bare face pulled from a database** — our patch is built incrementally by re-imprinting cleaned video, not pulled from a stored true-face model in the form a claim may recite.

### Where design-around is weakest (be honest)
1. **Iris-based PD + measurement** — `measurement/PdEstimator.ts`, `irisMetrics.ts`. PD-from-webcam is a crowded claim-space; here we are **more exposed** than on removal.
2. **The CLIP classifier "once at capture"** — any claim reciting "a trained model classifies eyewear in the image" could reach it (it runs once, classifies *type*, not per-pixel mask).
3. **Inpaint-then-overlay-frame composite** is what most legacy VTO patents describe; our differentiators to foreground are the **texture-imprint progressive cover** and the **area-ratio facing test**.

## Evidence
- `frame-detection/FrameDetector.ts` — contour ray tracing, geometric signal product, hysteresis.
- `frame-detection/ClipEyewearClassifier.ts` — MobileCLIP zero-shot, ONNX Runtime Web, once per session at capture.
- `frame-removal/FrameRemovalPipeline.ts` — composition detector+mask+inpaint+lens+faceclean.
- `frame-removal/MaskGenerator.ts` — dilate 4px, feather 6px, lens-subtract, brow-protect.
- `frame-removal/coverImprint.ts` — session-fixed UV chart, area-ratio facing weight, skirt push, frame/temple band.
- `frame-removal/CalibrationController.ts` — hold-still gate, calibrate-and-lock, ratios-of-face-height (not px).
- `measurement/PdEstimator.ts` — iris-prior mm-per-px + card-calibration (85.6 mm) hook, PD disclaimer.
- `measurement/irisMetrics.ts` — iris-based PD.

## Implications for VTO
- Strongest FTO talking points: **single-webcam contour-trace + texture-imprint progressive cover + area-ratio facing** — none is a learned per-pixel glasses-segmentation pipeline or a multi-angle rig.
- **Highest residual exposure is webcam PD measurement and virtual try-on placement** (broader field), not FittingBox frame-removal per se.
- Before launch the attorney should check claims reciting (i) a *trained image classifier of eyewear*, (ii) *webcam-derived PD*, (iii) *inpaint-then-overlay-frame* composites.

## Related
[[VTO]] · [[RA-Patent]] · [[F002-patent-fto-map]] · [[F002-patent-fittingbox-family]] · [[F002-broader-field]] · [[F002-prior-art]]
