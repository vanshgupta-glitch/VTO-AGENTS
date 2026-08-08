---
okf: 1
id: F016-training-data-glasses-segmentation
type: finding
project: VTO
status: active
created: 2026-08-06
updated: 2026-08-06
tags: [vto, training-data, glasses-segmentation, synthetic-data, clear-frames, sam2]
related: [F003-software-segmentation-models, CANDIDATE-frame-detection-removal-v2, VTO]
sources: [research-agent:Software-Researcher, web:verified]
---

# F016 — Training data for a 3-class glasses model (frame / lens / face)

## Question

How do we obtain labeled training data for the 3-class glasses-segmentation
model (0=face/bg, 1=frame, 2=lens) that replaces the interim 19-class BiSeNet,
given the weak case is **clear / rimless / thin** frames?

## Answer

**Synthetic-first — and the generator already exists in-repo.** The VTO owns
eyewear GLBs and a GLB→face renderer (`GlassesRenderer` + the 3d_app annotation
tool), so the render *is* the label: frame pixels = alpha of the frame material,
lens pixels = alpha of the lens material. This is `custom-glasses-model.md` §2
Approach A and matches the Lyu et al. CVPR 2022 pipeline that F003 already
recommended. Externally, four verified sources are useful as bulk / realism
mix-ins, but none alone gives the frame/lens split with the clear-frame
distribution we need:

1. **Lyu et al. CVPR 2022 synthetic dataset** — downloadable, ~29k-sample
   corpus (438 subjects × 21 glasses models × 4 HDR illuminations). Filenames
   encode glass/subject/expression/node/HDR/rotation; per-sample variants give
   glasses+shadow, glasses+no-shadow, no-glasses+shadow, no-glasses+no-shadow,
   plus **glasses mask and shadow mask**. NOTE: the glasses mask is
   whole-glasses (frame+lens combined) — no native frame/lens split. Deriving
   lens-from-frame is straightforward (HiGlass does exactly this).
2. **HiGlass Dataset (WACV 2026)** — built on the Lyu base data. First
   large-scale synthetic set with explicit **flow-based supervision for
   refractive warping** (high-prescription distortion). 29,071 paired samples of
   `(I, M, F, D, O)` where `M` is a **binary eyeglass-frame mask**. Confirms the
   Lyu base is reusable and that frame masks are separately segmentable. Its
   lens-warp emphasis is an edge case for us (we *remove* lenses, not re-project
   them), but its data structure is the model.
3. **MeGlass (CCBR 2018)** — 1,710 identities / 47,917 **real** images,
   14,832 with black eyeglasses. Labels are binary only
   (black-eyeglass vs no-eyeglass) — **no masks**, no eyewear-type diversity.
   Useful only as a real-image pool for sim-to-real mixing or auto-annotation.
4. **Diff-SemiER (CVPR 2026)** — semi-transparent sunglasses removal. Annotates
   lens/frame regions on FFHQ and trains a segmentation model to extract
   eyeglass/frame/lens masks, then synthesizes transmittance-controlled paired
   data (25k samples). Validates the frame/lens segmentation + compositing
   approach on real faces; relevant for a semi-transparent-lens edge case, but
   it is a diffusion removal method, not a training-data source we'd consume.

**Real-data path (optional, for realism): SAM 2 auto-annotation.** The doc's
Approach B (hand-label a few hundred real webcam photos) can be done cheaply
with SAM 2 point-prompted auto-annotation on real MeGlass/webcam frames — fast
enough to be practical for the sim-to-real mix.

## Evidence

- **Lyu et al. CVPR 2022** — "Portrait Eyeglasses and Shadow Removal by
  Leveraging 3D Synthetic Data", CVPR 2022.
  Repo: https://github.com/StoryMY/take-off-eyeglasses — dataset on Google Drive
  (id `1X1qkozQbVyz5lUA8xd-lYfy1jauOji46`), filename format
  `img-[Glass]-[Subject]-[Expression]-[Node Type]-[HDR]-[HDR Rotation]-[Image Type]`,
  shadow labels via `generate_shadow_label.py`. Pretrained ckpt on Drive
  (id `1Ea8Swdajz2J5VOkaXIw_-pVJk9EWYrpx`).
- **HiGlassRM / HiGlass Dataset** — WACV 2026. Project:
  https://higlassrm.github.io/ — uses the Lyu base data (438 subjects, 73
  identities × 20 scans, 21 glasses models, 4 HDRs → 29,200 samples); emits
  binary eyeglass-frame mask `M`, flowmap `F`, shadow-free `D`, eyeglass-free `O`.
- **MeGlass** — https://github.com/cleardusk/MeGlass — 1,710 / 47,917 /
  14,832 black-eyeglass / 33,085 no-eyeglass; binary `meta.txt` labels only.
- **Diff-SemiER** — CVPR 2026, https://github.com/JiahaoLi03/Diff-SemiER —
  transmittance-based synthesis, 25,000 paired samples, soft-mask adaptive fusion.

## Implications for VTO

1. **No external dataset is strictly required.** The in-repo GLBs + renderer +
   the widget's own placement math are the only path that guarantees (a) exact
   frame/lens separation, (b) heavy clear/rimless sampling (we control the
   distribution), and (c) training distribution == inference distribution.
2. **Lyu's public set is a free bulk shortcut** for frame+shadow masks but needs
   lens-split derivation; best used as pretraining / auxiliary supervision or a
   sanity dataset, not as the final frame/lens source.
3. **HiGlass proves the lens-from-frame-mask split is easy** (segment lens from
   the whole-glasses/frame mask) — relevant if we lean on Lyu's masks.
4. **MeGlass is not directly labelable** — binary only; use it (or webcam
   captures) as the real pool for SAM 2 auto-annotation, which the doc's §2
   Approach B mix benefits from.
5. **Recommended mix:** bulk Lyu (or own-rendered) synthetic + own clear-frame
   renders + a modest SAM 2-labeled real set (70/30 synthetic/real per the doc).

## Next Steps

- Download the Lyu synthetic dataset (Drive id above); inspect glasses/shadow
  masks; assess the lens-split effort and whether clear/rimless frames are
  represented.
- Generate a first batch of in-repo synthetic renders (frame/lens/face) with
  clear-frame oversampling using the widget placement math.
- Optionally SAM 2 auto-annotate MeGlass/webcam real frames for the mix.
- Then follow `custom-glasses-model.md` §3 training recipe (BiSeNet 3-class head,
  class weights `[0.5, 3.0, 1.5]`, 512×512, watch clear-frame frame-IoU).
