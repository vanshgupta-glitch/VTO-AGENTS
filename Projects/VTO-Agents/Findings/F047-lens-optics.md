---
okf: 1
id: F047-lens-optics
type: finding
project: VTO
status: draft
created: 2026-08-24
updated: 2026-08-24
tags: [finding, lens-optics, physics, refractive-index, distortion]
source_agent: Physics-Researcher
source_task: T043
---

# T043 — Lens Optics & Ray Tracing for Eyewear Try-On

## Question

Model lens optics and ray tracing for real-time browser eyewear try-on rendering:
1. Refractive index model for common lens materials (CR-36, CR-39, high-index 1.56 / 1.67 / 1.74)
2. Distortion correction model (spherical, cylindrical, prism) that fits a 4–11 FPS full-pipeline budget
3. Interface specification: how BiSeNet 3-class segmentation output (frame/lens/face) feeds an optics model

## Answer

### 1. Refractive index model for common lens materials

**Scope note on "CR-36":** no standard ophthalmic material named "CR-36" exists in public sources (searches across EyeWiki, OpticiansFriend, Laramy-K-cited trade literature return no such designation; the Columbia Resin series entry used in eyewear is CR-39). Treated here as a mission-brief typo for CR-39 or an unnamed variant; the model below is fully parameterized by `n`, so any such material plugs in without structural change.

The physically grounded model has three layers:

**(a) Base index n_d.** Per-material values at the sodium d-line (587.6 nm):

| Material | n_d | Abbe V_d | Density (g/cm³) |
|---|---|---|---|
| CR-39 (ADC) | 1.498 | 56–59 | 1.32 |
| Trivex | 1.53 | 43–45 | 1.11 |
| Polycarbonate | 1.586 | 30 | 1.20 |
| Mid-index 1.56 (e.g. Ormex/Sunsensors class) | 1.56 | ~37 | ~1.17–1.36 |
| Mid-index 1.60 (MR-8) | 1.60 | 41–42 | 1.30 |
| High-index 1.67 (MR-7/MR-10) | 1.661–1.67 | 31–32 | 1.35–1.37 |
| Ultra-high-index 1.74 (MR-174) | 1.73–1.74 | 32–33 | 1.47 |

Sources: optogrid material table [E1], Mitsui Chemicals MR-series product pages [E2], OpticiansFriend index table [E3], EyeWiki [E4].

**(b) Dispersion via Abbe number.** The Abbe number V_d = (n_d − 1)/(n_F − n_C) quantifies dispersion across F (486.1 nm), d (587.6 nm), C (656.3 nm) lines [E4]. For per-channel rendering indices, use Cauchy's equation n(λ) ≈ A + B/λ² with B derived from V_d (derivation inferred from the Abbe definition [E4] and Cauchy's equation [E5]):

`B = (n_d − 1) / (V_d · (λ_F⁻² − λ_C⁻²))`, λ in µm ⇒ λ_F⁻² − λ_C⁻² ≈ 1.912 µm⁻²

Worked values: CR-39 B ≈ 0.00449 (V=58); poly B ≈ 0.00976 (V=30); 1.67 B ≈ 0.0108 (V=31). Rendered as R/G/B indices this yields visible edge fringing for high-index lenses and near-none for CR-39 — matching the clinical observation that lateral chromatic aberration is imperceptible below ±2 D even at Abbe 30, but noticeable above ±3–4 D [E1].

**(c) Fresnel reflectance.** Front-surface reflectance at normal incidence R = ((n−1)/(n+1))² (standard Fresnel equations; see [E4]/[E5] for the underlying physics). Computed per material: CR-39 ≈ 4.0%, Trivex ≈ 4.4%, 1.56 ≈ 4.8%, poly ≈ 5.1%, 1.60 ≈ 5.3%, 1.67 ≈ 6.2%, 1.74 ≈ 7.2%. Trade literature quotes ~4% (CR-39) rising to ~7–8% (1.67) including both surfaces, which drives mandatory AR coatings at ≥1.60 [E1]. For rendering: specular highlight intensity and ghost-reflection strength scale with these values; high-index virtual lenses need visibly stronger surface reflections to read as realistic.

### 2. Distortion correction model within the 4–11 FPS pipeline

**What physically needs modelling** (what a webcam observer sees of a real wearer's lenses):

- **Spherical power F (D):** plus lenses magnify the eye/face behind them, minus lenses minify — the dominant visible cue that a lens has power [E8]. Thin-lens lateral magnification m ≈ 1/(1 − s·F_v), s = vertex distance (~12 mm); at −5.00 D this is ≈ 6% minification *(formula inferred from standard thin-lens optics; qualitative effect cited [E8])*.
- **Cylinder (astigmatism):** power exists only in specific meridians; prism/distortion effects must be evaluated per-meridian using the power along the decentration direction — there is no prismatic effect along a meridian carrying no power [E7].
- **Prism:** induced when the line of sight passes off the optical centre. **Prentice's rule:** P = c × F (P in prism diopters Δ, c in cm, F in D in the measured meridian); bench form P = (mm × D)/10. Base direction: plus lens base points toward the optical centre, minus away [E6][E7][E9]. A pure prism produces **image displacement with no magnification and no vergence change** [E9] — i.e., in rendering terms, a constant pixel shift, not a warp.

**Real-time rendering model (three costed tiers, all browser-compatible):**

1. **Tier A — static UV-displacement map (recommended).** Precompute, per lens SKU (shape + power), a UV-offset texture: offset(u,v) = radial function whose magnitude grows toward the rim (∝ curve strength), plus a constant vector for prescribed/decentration prism (Prentice: shift_px ∝ c × F). Fragment shader samples the webcam/background texture at uv + offset, optionally with per-channel R/G/B offsets scaled by the Cauchy B value from Q1 for chromatic fringing. This exact architecture (SDF-derived normals → edge-weighted displacement → per-channel offsets) is published working web code [E10][E11]; Lettier's screen-space-refraction reference shows the UV map can be fully precomputed to a framebuffer texture and applied later [E12].
2. **Tier B — dynamic screen-space refraction.** Refract the view ray per-pixel against rendered backface normals (`refract(I, N, 1/ior)`) with two render passes (opaque pass + backface-normals pass + composite) [E13][E12]. Physically richer (true Snell bending, handles pose change continuously) but costs 2–3 extra scene passes — affordable for mesh-only mode, risky inside 4–11 FPS full pipeline alongside LaMa.
3. **Tier C — fake blob refraction.** 2D sprite displacing the backdrop, no geometry/normals [E10]. Cheapest; acceptable fallback on low-end devices.

**Budget fit (full pipeline 4–11 FPS ⇒ 90–250 ms/frame):** from [[F002-fittingbox-performance|F002]], BiSeNet ≈ 30–50 ms, LaMa inpaint ≈ 100–200 ms, GLB render ≈ 20–40 ms. The Tier-A optics pass adds **one masked texture fetch per lens pixel** — a single fragment-shader pass over typically <2% of frame pixels; GPU cost well under 1–2 ms even integrated. Mesh-only budget (17–43 FPS ⇒ 23–58 ms) comfortably admits Tier B. Critically, Tier-A displacement maps are **static per SKU**: recompute only on lens change, not per frame; only the mask and pose transform update per frame.

### 3. BiSeNet 3-class → optics model interface specification

**Segmentation side (what BiSeNet provides).** BiSeNet pairs a Spatial Path (three stride-2 convs ⇒ features at 1/8 input resolution, preserving boundaries) with a Context Path (fast downsampling to 1/32 + Attention Refinement Modules) fused by a Feature Fusion Module; output is a dense per-pixel class map, upsampled back toward input resolution [E14]. On desktop GPU it is strongly real-time (Xception39 backbone: ~5 ms @ 640×360, ~12 ms @ 1280×720 on Titan XP) [E14] — consistent with the 30–50 ms budgeted in [[F002-fittingbox-performance|F002]] including pre/post-processing overhead. Our fine-tuned variant predicts exactly 3 classes: **frame / lens / face**; its current measured state is mIoU ≈ 33.3% (chance level) on synthetic data with confidence-stability ≈ 0.89, and boundary quality already adequate for erasure-region definition even while per-class discrimination is poor (`20260823-221835-T036-frame-detection-removal.md` in this folder, lines 28–55) [E16].

**Interface contract (mask → renderer), six stages:**

1. **Acquisition** — raw webcam frames only (video-only mode per D2/D3; screen recordings are a listed dead end).
2. **Stabilization** — exponential moving average on the lens/frame masks plus hysteresis; gate the optics effect on mean class confidence ≥ 0.80 (the T036 `confidence_stability` threshold) so a degraded mask disables refraction instead of flickering it (flicker budget: `flicker_score` < 5.0) [E16].
3. **Geometry binding** — MediaPipe Face Mesh landmarks (468 points; eyewear anchors = nose bridge, temple points, pupil centres) supply pose transform T(pose) placing the lens optical centre at each pupil [E15]. The optics model consumes: lens power F_sph / F_cyl×axis (SKU metadata), n and Abbe (Q1 table), decentration c = |pupil − optical centre| projected to cm.
4. **Stencil routing by class** — *lens* pixels ⇒ refraction pass (sample background at uv + D(uv) where D is the Tier-A displacement map transformed by T(pose)); *frame* pixels ⇒ opaque GLB frame drawn over the face (occludes both face and lens effects); *face* pixels ⇒ untouched webcam content.
5. **Edge treatment** — feather 1–2 px at the lens-mask boundary (bilinear sampling of the uploaded single-channel mask texture gives this for free) to hide the seam between distorted and undistorted regions; BiSeNet's 1/8-resolution Spatial Path means boundaries are already soft at pixel level [E14].
6. **Ordering with inpainting** — pipeline order is segment → LaMa erase of detected old eyewear → composite new frame + lens optics on top; the optics pass therefore reads the *post-inpaint* background texture, not raw camera pixels, whenever the wearer's own glasses were removed [E16].

**Cost accounting:** BiSeNet runs off the render thread inside the existing 30–50 ms slot [F002]; the optics pass itself is one masked fragment-shader pass (<1–2 ms GPU). Interface adds no new per-frame CPU allocations if the displacement map is cached per SKU (Q2, Tier A).

## Evidence

- [E1] Optogrid, "Lens Material Comparison: CR-39 vs Polycarbonate vs Trivex vs High-Index" (2026-05-12) — material table: CR-39 n=1.498/V58/1.32; Trivex 1.532/43–44/1.11; PC 1.586/30/1.20; MR-8 1.60/41; MR-7 1.67/31; MR-174 1.74/32; reflectance-vs-index discussion (~4% CR-39 → ~7–8% at 1.67); chromatic-aberration perceptibility thresholds (<±2 D imperceptible even at Abbe 30). https://www.optogrid.com/blog/lens-material-comparison/ — accessed 2026-08-24.
- [E2] Mitsui Chemicals, "MR™ Series" product page — R.I. tiers: 1.60 (MR-8™), 1.67 (MR-7™/MR-10™), 1.74 (MR-174™); "20–40% thinner" claims; FDA drop-ball compliance. https://us.mitsuichemicals.com/service/product/mr-series/index.htm and history page https://jp.mitsuichemicals.com/en/special/mr/history — accessed 2026-08-24.
- [E3] OpticiansFriend, "Refractive Indices & Lens Materials" — index table incl. CR-39 1.50(1.498)/Abbe ~57, crown glass 1.523, Ormex 1.56/Abbe 37, PC 1.586/30, Seiko 1.67 (MR-10 resin), Hyper/Fusio 1.74. https://www.opticiansfriend.com/refractive-indices-and-lens-materials/ — accessed 2026-08-24.
- [E4] EyeWiki (AAO), "Lens Material Properties" — Snell's law definition of refractive index; Abbe number V_d = (n_d−1)/(n_F−n_C) with F/d/C wavelengths 486.1/589.2/656.3 nm; inverse relation of Abbe to chromatic aberration. https://eyewiki.aao.org/Lens_Material_Properties — accessed 2026-08-24.
- [E5] Cauchy's equation n(λ) = A + B/λ² — standard dispersion formula used to convert Abbe number into per-wavelength indices. Reference: Wikipedia, "Cauchy's equation", https://en.wikipedia.org/wiki/Cauchy%27s_equation — derivation of the B-from-V_d step is my own (inferred from [E4] Abbe definition + this formula).
- Note: "CR-36" — no public source found for any ophthalmic lens material of that name (searches on 2026-08-24 across eyewiki.org, opticiansfriend.com, optogrid.com returned only CR-39 and MR series); treated as probable typo for CR-39.
- [E6] Optogrid, "Prentice's Rule: How a PD or Centration Error Induces Prism" (2026-06-10) and calculator page (2026-06-20) — P = c×F; bench form P=(mm×D)/10; base-direction table (plus→base toward optical centre, minus→away); meridian-specific power rule; worked examples (−4.00 D @ 2 mm ⇒ 0.8Δ). https://www.optogrid.com/blog/prentices-rule-induced-prism and https://www.optogrid.com/tools/prentice-rule-calculator — accessed 2026-08-24.
- [E7] Laramy-K, "Prism by Decentration" (2019-10-30) — Prentice's rule Δ=cD; plus lens as two prisms base-to-base, minus apex-to-apex; prism by decentration used when power suffices. https://www.laramyk.com/resources/education/lens-form-and-theory/prism-by-decentration — accessed 2026-08-24.
- [E8] Overnight Glasses, "Eyeglass lens materials: Overview and Comparison" (updated 2024-02-20) — "Plus lenses will magnify your eyes… while minus lenses will minify your eyes". https://www.overnightglasses.com/blog/eyeglasses-lens-materials — accessed 2026-08-24.
- [E9] StatPearls (NCBI Bookshelf), "Prisms" (2023-06-11) — prism properties: no magnification/minification, no change in vergence, disperses light, virtual erect image deviated toward apex; Prentice's rule D=cF; prism diopter definition (1 cm deviation at 1 m). https://www.ncbi.nlm.nih.gov/books/NBK580488/ — accessed 2026-08-24.
- [E10] Offscreen Canvas (Daniel Velasquez), "WebGL Glass and Refraction" — survey of real-time web refraction techniques incl. one-line `refract()` + `texture2D(tMap, uv + refracted.xy)` sampling, "fake blob refraction" (2D displacement, no geometry), multi-pass cube approaches; links to Codrops multiside-refraction tutorial. https://offscreencanvas.com/issues/webgl-glass-and-refraction — accessed 2026-08-24.
- [E11] zenn.dev (orectic), "Creating 'Refractive Glass' with WebGL Shaders" (2026-06-16) — SDF gradient as refraction direction; edge-weighted displacement `disp = grad * curve * uRefraction * maxDisp` ("bends more strongly near the edges—behaving just like a real lens"); chromatic aberration via per-channel R/G/B offsets. https://zenn.dev/orectic/articles/liquid-glass-webgl-refraction?locale=en — accessed 2026-08-24. Related architecture: DeepWiki on nkzw-tech/liquid-glass Shader Displacement Generator (canvas-computed displacement maps from SDFs), https://deepwiki.com/nkzw-tech/liquid-glass/2.4-shader-displacement-generator — accessed 2026-08-24.
- [E12] Lettier, "3D Game Shaders For Beginners — Screen Space Refraction" — refracted-vector SSR; precomputed refracted-UV map saved to framebuffer texture ("It can instead calculate what UV coordinate each screen pixel will eventually use"); relative IOR parameter; artifact-driven choice of non-physical IOR values ("the distortion only has to be believable—not realistic"). https://lettier.github.io/3d-game-shaders-for-beginners/screen-space-refraction.html — accessed 2026-08-24.
- [E13] VaultCG, "Screen Space Refraction in WebGL" (2025-03-29) — three-pass pipeline: opaque scene pass (+depth), view-space backface-normals pass, refractive-object composite pass. https://www.vaultcg.com/blog/screen-space-refraction-with-webgl/ — accessed 2026-08-24.
- [E14] Yu et al., "BiSeNet: Bilateral Segmentation Network for Real-time Semantic Segmentation", ECCV 2018 — Spatial Path = 3 stride-2 conv layers ⇒ 1/8-resolution features; Context Path downsample + ARM; FFM fusion; speed table (Xception39: 5 ms/203.5 FPS @640×360, 12 ms/82.3 FPS @1280×720, 105 FPS @2048×1024 on Titan XP). https://openaccess.thecvf.com/content_ECCV_2018/papers/Changqian_Yu_BiSeNet_Bilateral_Segmentation_ECCV_2018_paper.pdf and arXiv:1808.00897 — accessed 2026-08-24.
- [E15] Eyebrowse, "How AR Virtual Try-On Works" (2026-04) — MediaPipe Face Mesh 468 landmarks with 3D positions; eyewear anchor points = nose bridge, temple attachment points, ear tops, pupil centers; per-frame pose matrix update; transparent-canvas compositing over `<video>`. https://www.eyebrowse.ai/blog/how-ar-virtual-try-on-works — accessed 2026-08-24.
- [E16] Local finding, `C:\Users\ankur.singh\Obsidian Vault\Projects\VTO-Agents\Findings\20260823-221835-T036-frame-detection-removal.md` (F003-related frame-removal foundation) — BiSeNet fine-tune for 3 classes (frame/lens/face); metric definitions incl. `confidence_stability` >0.80 gate and `flicker_score` <5.0; measured mIoU ≈33.32% (chance) on synthetic frames, confidence stability avg 0.89; mask-boundary adequate for erasure region despite chance-level classes; LaMa-only ~198 MB ONNX inpainting; video-only mode. — read 2026-08-24.

## Implications for VTO

1. **Optics realism is nearly free inside the validated budget.** A per-SKU static UV-displacement map applied through a masked fragment pass adds <1–2 ms GPU against a 90–250 ms full-pipeline frame (4–11 FPS), leaving the BiSeNet (30–50 ms) and LaMa (100–200 ms) slots untouched [F002]. Tier-B dynamic SSR stays available for mesh-only mode (17–43 FPS).
2. **The material table becomes SKU metadata.** Each frame/lens SKU carries `{n_d, Abbe V_d}` (Q1 table); from those two numbers the renderer derives refraction strength (Snell/Cauchy), chromatic fringing (B coefficient), and surface reflectance (Fresnel). No per-material art assets required.
3. **Prescription-aware rendering is a differentiator.** Modelling Prentice-rule prism shift and minus/plus minification/magnification means an Rx customer sees their actual face-image change through their power — mainstream try-ons render plano lenses only. Requires pupil-landmark-to-optical-centre distance (already available from MediaPipe landmarks [E15]) plus Rx fields on the SKU/order object.
4. **Segmentation quality gates the optics, not the other way round.** With lens-class mIoU at chance level [E16], ship with the confidence gate (≥0.80) so refraction silently disables rather than flickers; prioritize improving *lens-class* IoU specifically — T036 showed mask-boundary adequacy suffices for LaMa erasure, but refraction needs tighter lens masks to look right. The 33.3% chance-level segmenter must improve before optics effects go default-on.
5. **Open items for the next iteration** (recorded honestly): (a) the thin-lens magnification formula is inferred, not page-cited — verify against an ophthalmic optics text; (b) the displacement-map pass cost is estimated, not yet measured on target browser hardware (onnxruntime-web/WebGPU + three.js) — add to the accuracy/video harness; (c) "CR-36" remains unidentified in public sources — confirm intended material with the mission author; (d) academic VTO literature on prescription-simulation was not surveyed this pass.

Related: [[VTO]] · [[Physics-Researcher]] · [[F002-fittingbox-performance]]
