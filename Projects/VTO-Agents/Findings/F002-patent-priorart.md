---
okf: 1
id: f002-prior-art
type: finding
project: VTO
status: done
created: 2026-08-04
updated: 2026-08-04
tags: [vto, patents, prior-art, frame-removal, glasses-segmentation, inpaint, fto]
---

# F002 — Prior-art harvest: glasses removal / segmentation / inpainting (academic + product)

> **This is research, not legal advice — a licensed patent attorney must do the formal FTO before launch.**

## Question
Harvest pre-priority-date publications for glasses removal / segmentation that weaken the broadest FittingBox claims (esp. Family A: conceal/hide object, priority **2016-06-30**), plus the well-known inpainting/segmentation field.

## Answer
Date-split rule is critical: only art **pre-dating 2016-06-30** can invalidate Family A; post-2016 art (below) weakens the *newer* families (N 2021, J 2023, O 2024) and shows the field is crowded.

### Published academic art on eyeglasses removal (verified via arXiv)
1. **ERGAN — "Unsupervised Eyeglasses Removal in the Wild"**, Hu, Zheng, Liu, Yang, Ren. arXiv:1909.06989, pub **2019-09-16**. GAN removing different glasses types from in-the-wild face images without dense annotation. → **NOT prior art vs 2016 Family A** (postdates); useful for newer families + crowding.
2. **ByeGlassesGAN — "Identity Preserving Eyeglasses Removal for Face Images"**, Lee & Lai. arXiv:2008.11042, pub **2020-08-25**. Auto-detects eyeglass position and removes them; a *segmentation decoder* predicts glasses/face masks. Post-2016.
3. **"Generative Landmarks Guided Eyeglasses Removal 3D Face Reconstruction"**, arXiv:2412.19848, pub **2024-12-25**. Removes glasses during single-view 3D face reconstruction; estimates 2D glasses region to build 3D texture — conceptually close to our 3D mesh-texture-imprint cover. Very recent.

### Classic / widely-known prior art (pre- and around 2016, weakens "inpaint behind frames")
- **LaMa (Resolution-robust Large Mask Inpainting)**, Suvorov et al., **2021** — basis of our `LamaInpainter`.
- **DeepFillv2**, Yu et al., CVPR **2019** — free-form inpainting.
- **PatchMatch**, Barnes et al., SIGGRAPH **2009** — structural inpainting.
- **Exemplar-based inpainting**, Criminisi et al., IEEE TPAMI **2004**.
- **Telea inpainting**, Telea, J. Graphics Tools **2004** (our `telea.ts`).
- **Bertalmio Navier-Stokes inpainting**, **2000**.
- All establish that "fill a masked region from surrounding pixels" is decades-old and cannot, by itself, support a novel claim.

### Older glasses-specific occlusion/removal (face-recognition context, pre-2016)
- Eyeglasses-frame removal and glasses-as-occlusion were studied in **face-recognition literature from the early-to-mid 2000s** — **pre-2016**, predates Family A's 2016 priority. The strongest anticipation attack for Family A lives here + product prior art (specific citations to be pulled by the attorney; the field's vintage is well established).

### Product prior art (public, ~pre-2016)
- Mirror/camera-based eyeglasses try-on products existed before 2016 and offered "remove the glasses you're wearing and try a new frame" — Family A's Background describes this as unsolved; an attorney should test whether any product/publication anticipates.
- General photo-editing glasses removal (healing-style tools) predates 2016.

### Known lead from project brief (to verify)
- **Lyu et al., CVPR 2022** — synthetic glasses rendering used to generate segmentation labels (per project brief). **DO NOT rely on it as invalidating art for Family A** — it is **2022**, i.e. AFTER FittingBox's 2016-06-30 priority; it only confirms glasses segmentation is published/mainstream. Exact citation not independently re-confirmed in this run (arXiv query did not surface it under "eyeglasses removal"/"segmentation"); attorney to pull it.
- **TRELLIS** (AI GLB generation) — **confirmed MIT** (per project brief) → Phase-2 GLB gen via TRELLIS has no license-driven FTO exposure.

## Evidence (sources)
- arXiv API queries (export.arxiv.org): "eyeglasses removal" → ERGAN (1909.06989), ByeGlassesGAN (2008.11042), 3D-recon (2412.19848). Fetched 2026-08-04.
- Project brief cites Lyu et al. CVPR 2022 as the known lead; TRELLIS MIT per brief.
- Project source `LamaInpainter.ts`, `telea.ts` show our inpainting is standard (LaMa/Telea), built on public prior art.

## Implications for VTO
- Our inpainting stage rests on **decades-old public techniques** (LaMa/Telea/PatchMatch/Criminisi) → "inpaint behind the frames" is unlikely a valid patent novelty point for FittingBox.
- The **field of automatic eyeglasses removal is demonstrably active and published since ~2019** (ERGAN) — any broad claim to "removing glasses from a face image" swims against published art.
- For **Family A (2016 priority) specifically**, the strongest anticipation attack comes from **pre-2016** material (glasses-removal-for-recognition, product try-on that removes worn frames, general inpainting) — the attorney must locate it; ERGAN/ByeGlassesGAN are for the newer families, not Family A.

## Related
[[VTO]] · [[RA-Patent]] · [[F002-patent-fto-map]] · [[F002-patent-fittingbox-family]] · [[F002-design-around]] · [[F002-broader-field]]
