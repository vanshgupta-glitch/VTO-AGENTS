---
okf: 1
id: f002-fto-map
type: finding
project: VTO
status: done
created: 2026-08-04
updated: 2026-08-04
tags: [vto, patents, fto, risk-table, rollup, ip]
---

# F002 â€” Patent FTO map / risk rollup (virtual try-on + frame removal)

> **This is research, not legal advice â€” a licensed patent attorney must do the formal FTO before launch.**

**Hard disclaimer (verbatim, required): "This is research, not legal advice â€” a licensed patent attorney must do the formal FTO before launch."**

## Scope
Rollup of F002 findings: FittingBox families, design-around, prior art, broader field. Features we map: (1) frame removal (detectâ†’maskâ†’inpaintâ†’mesh-imprint cover), (2) iris-based PD, (3) virtual try-on placement, (4) our data/implementation (all client-side).

## Risk table (patent Ã— our feature Ã— reads-on? Ã— design-around Ã— expiry)

| # | Patent / family | Our feature it touches | Reads on? | Design-around / position | Est. expiry |
|---|---|---|---|---|---|
| A1 | **US 9,892,561** / WO2018002533 / EP3479344 â€” conceal/hide object (FittingBox Family A, FR priority 2016-06-30) | Frame removal: detect+mask+alter | **HIGH â€” likely reads** on detect-glasses â†’ mask â†’ modify appearance; spec even discloses a *face-model-projection mask + inpainting + relighting* embodiment that mirrors our texture-imprint cover. | Not a clean miss. Best attacks: (i) pre-2016 prior art (glasses removal for face recognition, early try-on products, general inpainting); (ii) claim-literalism on required elements (e.g., 3D-model-of-object mask vs our landmark-driven face mesh; "modify color/opacity of mask" literal construction). Foreground our *progressive texture-imprint + area-ratio facing* and *single frontal capture* as not the claimed projection-of-3D-object-model path. | ~2036 |
| B | WO2016135078 / EP3262617 / US20160246078 â€” realistic try-on (2015) | Try-on placement + overlay rendering | MEDIUM | Detect-face â†’ realistically position virtual frame â†’ overlay merge is the generic VTO recipe; crowded field. Design-around: our Mesh-imprint head cover + GLB anchor-based placement is a distinct mechanism; rely on prior art (VTO predates 2015). | ~2035 |
| C | WO2018234004 / EP3631770 / US11494989 â€” realistic try-on w/ lens refraction (2017) | Try-on overlay + lens rendering | MEDIUM | Claims recite rendering lens per refraction + depth map. Our lens-transparency stage differs (tint/transparency, not refraction-of-lens-object). Attorney to check depth-map-lens-rendering. | ~2037 |
| D | WO2011086199 / US9076209 / US9317973 / EP2526510 â€” AR spectacles integration (2010) | Try-on placement/orientation | LOWâ€“MED (old) | Old family; 3D-orientation (Î¦,Î¨)+texture-by-view-angle is how all VTO works â†’ weak/anticipated; near/at expiry (~2030). | ~2030 |
| E | WO2011113936 / US9628697 / EP2547248 â€” PD via prescribed movement (2010/11) | **Iris-based PD** | **MEDIUMâ€“HIGH** | Claim recites a *predetermined movement* data-acquisition phase. Our default PD is a static iris-prior with optional card; we do **not require a scripted movement** â†’ plausible miss on that element. Attorney to verify claim language. | ~2030/31 |
| F | WO2013045531 / US10120207 / EP2760329 â€” ocular/optical 3D eye-system recon w/ test objects (2011/12) | PD / eye measurement | MEDIUM | Recites 3D eye-system reconstruction + attached test objects; we do 2D landmark/iris PD, no eye-system 3D recon, no attached test object â†’ credible miss. | ~2031/32 |
| G | WO2015007784 / US10201273 / EP2999393 â€” ocular meas. via consumer sensor (2013) | **Iris-based PD from webcam** | **MEDIUMâ€“HIGH** | Broadest PD family (consumer digital image sensor â†’ PD/mono-PD/heights). Our iris-PD is squarely in scope at a high level. Defense: prior art + claim literalism (specific measurement mechanics). Attorney must read granted claims. | ~2033 |
| H | WO2024 eye-measurement / **EP4751250A1** â€” known-object eye measurement (2024) | Card-calibration scale PD | **HIGH (it's young & direct)** | Claim: select video frame meeting eye-ear criteria + identify a *known object* â†’ eye measurement from its reference length. Our optional 85.6 mm card hook maps almost verbatim. Mitigation: this is the newest (â†’~2044) and least prior-art-tested; design-around = make card optional / drop the "known object required" path, or use iris-prior-only default. **Get attorney eyes on this first.** | ~2044 |
| I | WO2012113805 / US9262695 / EP2678804 â€” face characteristic points (2011) | MediaPipe landmarking | LOW | Statistical landmark fitting is decades-old & broad; weak claim; ~2031. | ~2031 |
| J | US20240312024 / EP4278324 â€” detect/track face wearing glasses in video (2023) | Detection while occluded | MEDIUM | Young (â†’~2043) but narrow (face-tracking w/ spectacles). Our contour-detection is a different mechanism; attorney check. | ~2043 |
| N | WO2022171960 / US12462602 / EP4292062 / JP7853309 â€” ML detect+model object trained on AR images (2021) | CLIP/ML eyewear classification | **MEDIUM** | Claim recites training an ML system on AR images (real + virtual element) w/ segmentation+contour to model virtual element. Our MobileCLIP is trained on web images, not FittingBox-style AR augmentation, and classifies type not per-pixel mask â†’ arguable miss; but any *ML detects eyewear* claim is a watch item. | ~2041 |
| O | WO2025125337 â€” model real object â†’ canonical space via parametric surfaces (2024) | 3D frame aesthetics/try-on rendering | LOW | Frame-catalog modelling, not user-face removal. Not on our user-flow path. | ~2044 |
| â€” | **EssilorLuxottica** 2D-image PD: WO2023126793 / US12469254 / EP4457756 (2022) | **Iris-based PD (2D)** | **MEDIUMâ€“HIGH** | Direct competitor to our PD. Young (â†’~2042); defense = prior art + mechanics literalness; attorney. | ~2042 |
| â€” | **EssilorLuxottica** depth PD: WO2023203530 / US12632985 (2023) | PD (ours has no depth cam) | LOW (clean miss) | We have **no depth camera** â†’ do not practice. | ~2043 |
| â€” | **Ditto** reference-object head scaling: US12014462 / US20220351467 / JP2024517839A (2021) | **Card-calibration PD** | **MEDIUMâ€“HIGH** | Claim: scale head model using a reference object's 3D model. Our card hook is conceptually adjacent. See H mitigation. â†’~2041. | ~2041 |
| â€” | Early try-on/PD: US6583792 / US6847383 / EP3140752B1 | VTO + PD (public) | LOW | Very old (2000â€“2010s); useful **prior art in our favor**. | expired/near |
| â€” | Academic: ERGAN 2019, ByeGlassesGAN 2020, LaMa/DeepFillv2/Criminisi/Telea/PatchMatch (2000â€“2021), Lyu CVPR22 (brief lead) | Our inpainting/detection | n/a (prior art | Confirms the field is crowded & our inpainting uses public tech â†’ weakens any "remove glasses/inpaint face" claim. | n/a |

## Top risks (ranked for Hermes)
1. **PD from a webcam/image is the densest, newest, live minefield** â€” FittingBox G/H, EssilorLuxottica (2D), Ditto (reference-object). Our iris-PD + optional card sits in the middle. Highest priority for attorney review. **Especially the 2024 FittingBox known-object eye-measurement (~2044) and Ditto reference-object scaling (~2041).**
2. **FittingBox US 9,892,561 (Family A) is the direct frame-removal threat** and its spec discloses a face-model-projection-mask + inpainting embodiment that mirrors our texture-imprint cover â€” do not assume our approach is a clean miss; lean on pre-2016 prior art + claim literalism.
3. **Any ML "detect eyewear" usage** edges toward FittingBox Family N (2021, ML trained on AR images).

## Recommended next actions before launch (attorney-led)
- Pull and element-map the **granted claims** (not just specs) of: US9892561, US9628697, US10201273, EP4751250 (Fittingbox H), US12632985+US12469254 (Essilor), US12014462 (Ditto).
- Verify exact expiry / PTA / terminal disclaimers for each US grant; this table's years are planning estimates.
- Run a formal assignee search for **Warby Parker, Snap, Perfect Corp** (flagged but not individually verified here).
- Prioritize the **iris-PD / known-object-scaling** cluster over frame removal â€” that is where the newest, longest-lived claims live.

## Finger-pointing / evidence map
- Families & numbers/dates: [[F002-patent-fittingbox-families]] (WIPO PATENTSCOPE + FreePatentsOnline).
- Design-around & what we don't practice: [[F002-patent-designaround]] (nmg-vto source).
- Prior art: [[F002-patent-priorart]] (arXiv).
- Broader field incl. PD: [[F002-patent-fieldscan]] (FreePatentsOnline).

## Related
[[VTO]] Â· [[RA-Patent]] Â· all F002 findings above.



## Coordination note (added 2026-08-04, this retry run)
A parallel T002 retry executor also wrote findings under slightly different names - F002-broader-field.md, F002-design-around.md, F002-patent-fittingbox-family.md, F002-prior-art.md - with complementary data (e.g. it cites Ditto US11,495,002 B2 prio 2017 and EP3659109 B1 prio 2017 not enumerated in this run's F002-patent-* files). Files were NOT deleted. Hermes should consolidate the two naming conventions and reconcile the two patent lists (dedupe + merge Ditto/Essilor numbers) before the attorney review.

