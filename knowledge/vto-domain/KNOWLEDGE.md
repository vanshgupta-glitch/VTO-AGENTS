---
okf: 1
id: knowledge-vto-domain
type: knowledge-pack
name: vto-domain
version: 1.0.0
applies_to: [vto-widget]
status: active
created: 2026-08-08
updated: 2026-08-08
tags: [knowledge, vto, domain]
---

# vto-domain v1.0.0

Durable facts about the eyewear virtual try-on product. Facts, not procedures — how to do things lives in skills.

Source of record for decisions: `Projects/VTO/VTO.md` §Decisions (D2, D3). Where this pack and that file disagree, **that file wins** and this pack is stale.

---

## What the product is

A **client-side** eyewear try-on for Shopify. Nothing about a customer's face leaves their device — that is a deliberate differentiator against FittingBox, which uploads the selfie server-side.

Stack: **MediaPipe FaceLandmarker** for tracking · **three.js** for rendering · **GLB** frame assets · TypeScript monorepo delivered as a **Theme App Extension**.

Roughly 19,900 lines, 187 source files, 26 test files. `packages/vto-core` decomposes into `camera`, `engine`, `measurement`, `occlusion`, `pose`, `positioning`, `renderer`, `smoothing`, `tracking`.

---

## The validated plan (D3)

Approved after three validation passes. These are settled unless a new decision supersedes them.

| # | Decision |
|---|---|
| 1 | **Segmentation: BiSeNet** fine-tuned for 3-class glasses (frame / lens / face). U-Net + MobileNetV3 as fallback. Keep the geometric detector as warm-start. |
| 2 | **Frame cover: texture-imprint baseline** — single-pose calibration plus per-frame LaMa. Multi-pose only if it shows perceptible gain. |
| 3 | **Inpainting: LaMa only** (~198 MB ONNX, calibration tier). ProPainter and E2FGVI are dead ends — no browser ONNX export. |
| 4 | **PD: auto-iris by default** (~±2 mm design target) plus optional card calibration with depth-parallax correction. |
| 5 | **Engine ~208–223 MB.** First visit ~33–36 s at 6.25 MB/s, cached under 2 s. **No size cap** — progressive loading UX instead. |
| 6 | **Video only.** No photo or still mode. Everything runs on the live `getUserMedia` stream. |
| 7 | **No patent or FTO gating.** Personal project (D2). |
| 8 | **MediaPipe main-thread detection is the #1 bottleneck.** Worker + OffscreenCanvas outranks any new model. |
| 9 | **One credible Shopify competitor: FittingBox.** |
| 10 | **Fresnel reflectance is the #1 visible lens effect**, and PBR materials are zero-cost uniforms. Do these first. |
| 11 | **Yaw: solvePnP (~2° MAE)** replaces the quadratic boost (~7°). |
| 12 | **Texturing: rigid-only UV basis** — 60% drift improvement at near-zero cost. |

**D2 context:** the project pivoted to personal / non-commercial, optimising for maximum quality and UX rather than commercial constraints. The ≤250 KB entry budget was dropped; heavy models are acceptable.

---

## Constants and measured values

| Quantity | Value | Note |
|---|---|---|
| `IRIS_DIAMETER_MM` | **12.0** | Changed from 11.7 |
| Yaw error — solvePnP | ~2° MAE | vs ~7° for the old boost |
| Pipeline FPS | 4–11 full · 17–43 mesh-only | Estimated, not measured on device |
| Depth-parallax residual | 0.0–0.8 mm corrected | From 1.0–5.7 mm uncorrected |
| Combined PD error | ±0.67 mm RSS | |
| LaMa inference | 50–200 ms | Calibration tier only |
| Segmenter first load | ~16 s | Single-threaded WASM |
| Segmenter threshold | 0.5 | Bare face peaks ≤0.45; worn glasses ~0.98 |

---

## The accuracy score

Composite, 0–1, target **≥ 0.98**:

| Term | Weight | Measures |
|---|---|---|
| Verdict correctness | 30% | clear→remove · sunglasses→block · no_glasses→neither |
| Fit geometry | 25% | Position, scale, roll error vs reference |
| Perceptual | 35% | LPIPS + SSIM over the eye/frame region |
| Stability | 10% | Temporal jitter and flicker penalty |

**Two terms are currently inactive.** Fit and perceptual require FittingBox reference frames that have not been captured. Until then the score runs on verdict and stability only, renormalised.

**Never report a score without naming its active terms.** 0.94 with all four active means something entirely different from 0.94 with two. The threshold is a calibrated proxy validated by human spot-check — not a guarantee that a human cannot tell.

---

## Test clips

Three fake-camera clips: **clear** · **no_glasses** · **sunglasses**.

Last known state: clear → applied (74%) ✅ · no_glasses → no removal (84%) ✅ · **sunglasses → block/remove flicker at ~43% block** ⚠️. The occlusion remove-versus-block decision is noisy and pre-existing; it needs darkness thresholds plus sticky-block hysteresis.

---

## Vocabulary

| Term | Meaning |
|---|---|
| **Frame removal** | Erasing the customer's existing glasses before rendering new ones |
| **Texture imprint** | Building a clean-face texture during calibration, then projecting it per frame |
| **Coverage atlas** | The accumulated clean-face texture across poses |
| **Verdict** | Per-frame decision: applied · blocked · no specs |
| **Blocked** | Removal deliberately suppressed — typically opaque sunglasses |
| **PD** | Pupillary distance, in millimetres |
| **Warm-up** | Frames before the segmenter is ready; excluded from scoring |
| **Fit-safe** | An optimisation that does not change measured geometry |

---

## Hard constraints

1. **Client-side only.** No face data leaves the device. This is the privacy differentiator.
2. **Video only.** No photo path exists; do not reintroduce one.
3. **GLB assets are fit-critical.** An optimisation that changes geometry changes the measurement.
4. **Camera tests run locally.** No cloud farm injects a webcam.
5. **All product code lives in the widget repo.** Orchestration infrastructure does not.

---

## Known dead ends

Do not re-propose these without new evidence:

- **ProPainter / E2FGVI** video inpainting — no browser ONNX export
- **ByeGlassesGAN** — unusable in this pipeline
- **Android depth APIs** — no usable web surface
- **Specular removal as a separate stage** — the lens mask already blocks lens glare, and inpainting erases rim glare before imprint
- **Iris-prior PD alone at high accuracy** — mathematically impossible below roughly ±2 mm without card calibration

---

## Competitive position

FittingBox is the only credible Shopify competitor. Their approach uploads the selfie server-side; ours does not. Ditto was acquired; Occhy is defunct. The market is otherwise open.

Detailed competitor behaviour lives in `competitor-landscape`.
