---
okf: 1
id: f002-fieldscan
type: finding
project: VTO
status: done
created: 2026-08-04
updated: 2026-08-04
tags: [vto, patents, field-scan, pd, interpupillary, try-on, fto]
---

# F002 — Broader VTO patent landscape: EssilorLuxottica / Ditto / Warby / Snap / Perfect Corp — focus on iris-based PD & webcam try-on

> **This is research, not legal advice — a licensed patent attorney must do the formal FTO before launch.**

## Question
Which other VTO players hold patents reading on iris-based PD or webcam try-on? Focus: Luxottica/EssilorLuxottica, Ditto, Warby Parker, Snap, Perfect Corp.

## Answer
The clearest non-FittingBox exposure for us is **PD / pupil-distance measurement from an image or webcam**, and **head-model-scaling via a reference object**. Key found families (FreePatentsOnline assignee/text searches, 2026-08-04):

### EssilorLuxottica / Luxottica — interpupillary distance (PD)
- **2D-image PD estimation** (recent): WO/2023/126,793 A1, US 12,469,254 B2, US20230206598, EP4,457,756 A1 — "Interpupillary distance estimation method" implementable on a computer: acquire a **2D image** of the face, locate (pupil features) → estimate PD. Priority ≈ 2022. → Directly in our space (2D-webcam PD, no reference object). **Watch.**
- **Depth-camera PD estimation** (recent): WO/2023/203,530 A1, US 12,632,985 B2, US20230342976, EP4,510,907 A1 — captures **plurality of depth images** (2D + depth map) → PD. Priority ≈ 2023. We use a **single RGB webcam, no depth camera** → **clean miss** (does not read on us).
- **Older superimposed-display PD**: US 6,843,738 / US 6,583,792 / WO2001035338 (early 2000s, "System and method for accurately displaying superimposed images" — early online try-on + PD measurement). Expired/late-2000s vintage → low risk, but confirms PD-from-webcam has deep roots (good prior art for us).

### Ditto (eyewear try-on tech)
- **Reference-object head scaling**: US 12,014,462 B2, US20220351467, JP2024517839A — "Generation of a 3D model of a reference object to perform scaling of a model of a user's head": obtain images of user's head and a **reference object**, build a head model, scale it using the reference object. Priority ≈ 2021. → **Very close to our card-calibration (85.6 mm card) scale-reference hook in `PdEstimator.setScaleReference`.** Watch.
- **Live try-on face-model update**: JP 7,713,949 B2, JP2023515517A — "Eyeglass frame fitting, including live fitting": update the user's face model on events from historical data during live fitting. Publications ≈ 2023 (priority ~2021).

### Warby Parker / Snap / Perfect Corp (scan-level)
- **Warby Parker** holds various e-commerce try-on / measurement patents (gravity/AR size guidance). Not individually enumerated here; a formal assignee search is required. General note: they and many others hold *try-on placement/measurement* patents — the most crowded layer of VTO IP.
- **Snap Inc.** (Lenses/AR) holds AR face-tracking/wearable patents; relevant mostly to AR rendering/occlusion rather than ophthalmic PD-from-video. Not enumerated here.
- **Perfect Corp (YouCam)** holds virtual try-on (beauty/eyewear) patents. Not enumerated here.
→ These are flagged as **must-include assignees in the attorney's formal FTO search**, not individually verified this run.

### Placement / try-on-overlay community (enumerated from Google Patents XHR harvest 2026-08-04)
These read on **webcam try-on placement** (our feature F3) — the crowded layer:
- **Meta/Facebook — US10712811B2** "Providing a digital model of a corresponding product in a camera feed" — priority **2017-12-12**, grant 2020-07-14; expiry ~2037. Webcam overlay of a product (glasses) on a tracked face.
- **Warby Parker — EP3830799B1** "Virtual try-on systems and methods for spectacles" — priority **2019-01-04**; fam WO/EP/US/CN/JP/KR/AU/CA/IL/MX/TW; grant 2026-02-04; expiry ~2039.
- **Snap Inc. — US11954762B2 / US20230230292A1** "Object replacement system" — priority **2022-01-19**, grant 2024-04-09; fam WO/EP/US/CN/KR; expiry ~2042 (our implementation predates it — document dates).
- **Snap Inc. — US11551425B2** "Modifying multiple objects within a video stream" — priority 2016-11-09; US11830118B2 "Virtual clothing try-on" — priority 2020-12-11.
- **Zeiss (Carl Zeiss Vision) — ES2887926T3 / EP** "Virtual adaptation of a spectacle" — priority **2017-06-01**; fam WO/EP/US/CN/JP/KR/BR/CA/ES; expiry ~2037.
- **Shiseido — US11000107B2** "Virtual facial makeup removal" — priority 2017-07-13 (makeup, adjacent erasure art).
- Meta's earlier **US10712811B2** + all of the above are *try-on placement* — systemic industry exposure rather than a single killer patent.

## Evidence (sources)
- FreePatentsOnline: Luxottica+interpupillary → US12632985, US12469254, US20230342976, US20230206598, EP4510907, EP4457756, WO2023203530, WO2023126793, US6847383, US6583792, EP3140752B1 (pupillary distance & scale).
- FreePatentsOnline: "Ditto Labs" OR "Ditto Technologies" + eyeglasses → JP7713949B2, JP2023515517A (live fitting), US12014462, US20220351467, JP2024517839A (reference-object head scaling).
- FittingBox PD families E/F/G/H (see [[F002-patent-fittingbox-families]]).

## Implications for VTO
- **PD is our single most-litigated category.** Three separate named actors hold live, in-force PD families we touch: **FittingBox** (movement-based & consumer-sensor PD, 2010–2013; plus 2024 known-object eye-measurement → ~2044), **EssilorLuxottica** (2022 2D-image PD → ~2042), **Ditto** (2021 reference-object head scaling → ~2041).
- Our **card-calibration scale-reference** sits squarely next to Ditto's reference-object-scaling family and FittingBox's 2024 known-object family — the most design-around-sensitive feature we have (more than frame removal).
- **Clean misses to hang an FTO argument on:** we use **no depth camera** (misses Essilor depth-PD) and **no prescribed head movement / known-object required** in the default mode (FittingBox E/H use movement or a known object; our default is iris-prior with an *optional* card hook).

## Related
[[VTO]] · [[RA-Patent]] · [[F002-patent-fittingbox-families]] · [[F002-patent-designaround]] · [[F002-patent-fto-map]]
