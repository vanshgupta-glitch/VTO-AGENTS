---
okf: 1
id: f002-fittingbox-families
type: finding
project: VTO
status: done
created: 2026-08-04
updated: 2026-08-04
tags: [vto, patents, fittingbox, fto, families, frame-removal]
---

# F002 — FittingBox patent families (assignee enumeration)

> **This is research, not legal advice — a licensed patent attorney must do the formal FTO before launch.** Verbatim independent-claim text must be pulled by the attorney (available on FreePatentsOnline / WIPO PATENTSCOPE per patent listed below).

## Question
Enumerate FittingBox's patent families: numbers, titles, claim summaries, jurisdictions, priority/expiry.

## Answer — family-by-family
Sources: WIPO PATENTSCOPE (FP:Fittingbox) + FreePatentsOnline (assignee=Fittingbox); Google Patents XHR metadata (harvested 2026-08-04). Cross-checked with Google Patents metadata (US9747719B2, US11494989B2, US9569890B2, US9892561B2 etc.).

**Family A — Conceal / hide an object worn on the face (THE frame-removal family).** Most relevant to us. Priority ≈ **2016-06-30**.
- WO/2018/002533 A1 "Method for concealing an object in an image or a video" — PCT/FR2017/051744, inv. CHOUKROUN, pub 2018-01-04.
- US 9,892,561 B2 "Method of hiding an object in an image or video" (granted; US20180005448 A1).
- EP 3,479,344 A1/B1.
- **Claim gist (plain English):** detect a wearable object (e.g. glasses) in the image → superimpose a first overlay containing a mask that *at least partially covers* the object → modify the appearance of at least part of the mask to conceal it. Broadly: detect-then-mask-then-alter to hide an on-face object.
- **Reads on:** our frame-removal / glasses-eraser (inpainting the face behind frames). **Expiry ≈ US ~2036, EP ~2037.**

**Family B — Realistic (photorealistic) virtual try-on of glasses.** Priority ≈ 2015-02-23.
- WO/2016/135078 A1 "Process and method for real-time physically accurate … glasses try-on" + EP 3,262,617 + US20160246078; also **CN107408315B**. Expiry ≈ ~2035.
- **Claim gist:** generate a real-time realistic image of a *virtual* pair of glasses positioned on a real user face from a single image/video — physically accurate rendering of the virtual frame onto the face → try-on placement.

**Family C — Realistic virtual try-on incl. ophthalmic lens rendering.** Priority ≈ 2017-05-30.
- WO/2018/234004 A1 — PCT/EP2018/064291, inv. DEHAIS, pub 2018-12-27.
- EP 3,631,770; **US 11,494,989 B2**; US20210142566. Expiry ≈ ~2037.
- **Claim gist:** detect face → position virtual frame realistically → generate overlay (projection of virtual frame) → merge with initial image; also renders the ophthalmic lens per its refraction + depth map.

**Family D — AR integration of a pair of spectacles into an image of a face.** Priority ≈ 2010-01-18.
- WO/2011/086199 A1 — PCT/EP2011/050596, inv. CHOUKROUN.
- US 9,079,209 B2; **US 9,317,973 B2**; EP 2,526,510. Expiry ≈ ~2030.
- **Claim gist:** detect placement area → characteristic points + 3D orientation → select texture by view angle → layered rendering. Old AR-overlay try-on.

**Family E — Interpupillary distance (PD) measurement via movement, no reference object.** Priority ≈ 2010/11.
- WO/2011/113936 A1 — PCT/EP2011/054138, inv. CHOUKROUN.
- **US 9,628,697 B2**; US20130076884; **EP 2,547,248 B1**. Expiry ≈ ~2030/31.
- **Claim gist:** data-acquisition phase using a *predetermined movement* of the person facing a camera; calculation phase derives PD. **PD-from-webcam — direct relevance to our iris-based PD.**

**Family F — Ocular & optical measurements (3D eye-system reconstruction).** Priority ≈ 2011/12.
- WO/2013/045531 A1 — PCT/EP2012/069044, inv. LE GALLOU.
- **US 10,120,207 B2**; EP 2,760,329 B1. Expiry ≈ ~2031/32.

**Family G — Ocular measurements using a consumer sensor (no test object).** Priority ≈ 2013.
- WO/2015/007784 A1; **US 10,201,273 B2**; EP 2,999,393 B1. Expiry ≈ ~2033.
- **Highly relevant to iris-based PD from a webcam.**

**Family H — Eye measurements using a known object as scale reference (recent 2024).**
- WO (PCT/EP2024/071158) "Method for determining eye measurements", inv. CHOUKROUN, pub 2025-01-30; **EP 4,751,250 A1**. Priority ≈ 2024 → **expiry ≈ ~2044 (long-lived!)**.
- **Claim gist:** pick an image in a video stream where face/length criteria are met; identify a *known object*; use its reference length to compute an eye measurement. **Overlaps our card-calibration (85.6 mm card) hook in `PdEstimator.setScaleReference` — high design-around sensitivity.**

**Family I — Detect a predefined set of characteristic points of a face (landmark detection).** Priority ≈ 2011.
- WO/2012/113805 A1 — PCT/EP2012/052958; US 9,262,695 B2; EP 2,678,804.

**Family J — Detect & track a face wearing spectacles in a video stream (recent).** Priority ≈ 2023.
- US20240312024; EP 4,278,324 A1. Expiry ≈ ~2043.

**Family K — Simplified geometric 3D model of a real pair of spectacles (StudioBox digitization).** Priority ≈ 2015.
- US20160232712; EP 3,367,307 A2.

**Family L — Photorealistic 3D models of a glasses lens / frame digitization.** Priority ≈ 2012-03-19.
- **US 9,357,204 B2**; EP 2,828,834; **US 9,747,719 B2**; EP 3,401,879. StudioBox/adapter.

**Family M — Hierarchical compression of a 3D mesh (geometry format, E. Mammou = Draco author).** Priority ≈ 2011.
- WO/2012/001070 A1 — US20130114910. **Not face/removal — geometry format only; irrelevant to our client renderer.**

**Family N — Machine learning to detect & model an object (trained on AR images).** Priority ≈ 2021.
- WO/2022/171960 A1 — PCT/FR2022/050240; US 12,462,602 B2; EP 4,292,062; JP 7,853,309 B2. Expiry ≈ ~2041.
- **Claim gist:** train an ML system on augmented-reality images with segmentation+contour parameterization to detect/model the virtual element. **Relevant if we ship ML-based frame detection.**

**Family O — Modelling a real object into canonical space from 2D/3D data (recent).** Priority ≈ 2023/24.
- WO/2025/125337 A1 — PCT/EP2024/085697. Expiry ≈ ~2044.

## Jurisdictions seen
US (many granted), EP (many), WO (PCT), JP (JP7853309B2), CN (CN107408315B, CN109983501B), plus FR originals.

## Expiry (ESTIMATES — verify with attorney; US term ≈ priority/filing + 20 yr)
A ≈2036 · B ≈2035 · C ≈2037 · D ≈2030 · E ≈2030/31 · F ≈2031/32 · G ≈2033 · **H ≈2044** · I ≈2031 · J ≈2043 · N ≈2041 · O ≈2044. Exact expiry per granted patent requires filing date/PTA/terminal disclaimer review.

## Evidence (sources / links)
- WIPO PATENTSCOPE FP:Fittingbox — https://patentscope.wipo.int/search/en/result.jsf?query=FP%3AFittingbox (fetched 2026-08-04).
- FreePatentsOnline assignee=Fittingbox — https://www.freepatentsonline.com/result.html?query_txt=Fittingbox&patents=on (50 results; /9892561.html, /10120207.html, /9628697.html, /11494989.html, /12462602.html, /10201273.html carry full claims for attorney).
- Google Patents XHR metadata: `C:\Users\ankur.singh\.openclaw\workspace\vto\out\fittingbox_assignee.txt`, `fittingbox_glasses.txt`.

## Implications for VTO
- **Frame-removal core = Family A** (detect → mask → alter). Families B/C cover realistic try-on overlay. Families E/F/G/H cover **webcam PD/eye measurement — the single densest overlap for us.**
- **Young families H (2024→~2044), N (2021→~2041), O (2024→~2044)** are the ones likeliest still in force at launch.
- We do **not** practice multi-angle digitization (Families K/L).

## Related
[[VTO]] · [[RA-Patent]] · [[F002-patent-fto-map]] · [[F002-design-around]] · [[F002-broader-field]] · [[F002-prior-art]]
