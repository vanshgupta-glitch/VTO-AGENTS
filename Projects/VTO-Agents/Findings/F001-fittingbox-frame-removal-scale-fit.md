---
okf: 1
id: f001-fittingbox-frame-removal-scale-fit
type: finding
project: VTO
status: done
created: 2026-08-04
updated: 2026-08-04
tags: [vto, fittingbox, teardown, frame-removal, scaling, fit, pd]
---

# F001 — FittingBox Frame Removal, Scale & Fit Method

Status: done (inference-level in places; flagged).

## Question
Is FittingBox's frame removal computed client-side or server-side? How do they scale/fit the frame (iris, credit-card, size UI, PD)?

## Answer

### Frame removal pipeline — MIXED, feature/managed.
- Marketing (https://fittingbox.com/en/glasses-virtual-try-on/advanced-website/frame-removal): "Diminished Reality", 3 steps (1 detect user's real glasses, 2 virtually remove, 3 place new frame), "in real time", backed by **16 patents**, CES 2022 premiere.
- Implementation is a **feature-gated add-on**: bundles reference `addon_frameRemoval` (reducer `selectIsRemovalAvailable` from `...addon_frameRemoval`), a `glassesRemovalActive` config option, and a dedicated "**removal component**" dispatching store actions (`removal compute action`, `removal switch to tryon`, `removal is positioning succeed`, `removal clear state`). So frame removal is licensed/managed per-deployment, not always on.
- The actual "compute" runs through the **FBxLive WASM engine with the webcam stream (fbx-streamgrabber) live and locally** — real-time diminished reality, consistent with client-side compute. **No network image POST was observed during the engine's live path** (the only `toDataURL`/`toBlob` uses were internal canvas captures, e.g. viewer background / getImageSize dispatched locally).
- **Separate server-side PHOTO path exists**: a "try-on from a photo" flow stores `imageBase64`, uses an `uploadStatus` state machine (`START … error:{apiError, faceNotDetected}`, `READY`), `eyesPosition[]`, and FormData/upload/XMLHttpRequest references. That flow sends a user photo to FittingBox's API for face/eyes analysis and returns frames — clearly **server-side**, separate from the live webcam path.

### Scale / fit method — PD-based, statistical default; NO credit-card calibration.
- PD model in the store defaults to `pupillaryDistance:{pd:63, pdType:"statistic_pd"}` — i.e. **default PD = 63 mm statistical average when unknown**; there is a `setPupillaryDistance`/`set pupillary distance` action and a dedicated "online PD measurement tool" product.
- A search for "creditCard"/"card" scale calibration matched **only PostHog's PII-aware form-field redaction regex** (field names like `ccnum`, `creditcard`, `cvv`) — NOT an actual credit-card calibration feature. So this build has **no credit-card calibration**.
- Scale therefore rides on face/iris geometry tracked in the WASM plus PD (default statistical 63 mm, or measured). Iris/pupillary terms appear in the try-on UI chunk (Scale-And-Position / face-shape service), i.e. **iris/PD-based scaling**, not object-calibration.
- Frame real-size scale: frames are served from `.../glasses/fitsource/` on S3; the app applies an Angular "Scale & Position" flow on placement.

### Latency of first frame removal
- Not directly measured here (would need a live session + timing of `removal compute action`→result). Flag as TO-VERIFY. Client-side WASM suggests sub-second; the photo path latency is server round-trip dependent.

## Evidence
- Bundle strings (vto-advanced chunk-BPYZF72V.js, chunk-TDW6KIIV.js): `addon_frameRemoval`, `removal compute action`, `glassesRemovalActive`, photo `uploadStatus`/`imageBase64`/`faceNotDetected`, `pupillaryDistance:{pd:63,pdType:"statistic_pd"}`, fitsource S3 path; PostHog `cardnum|cvv|creditcard` redaction regex (rules out credit-card calibration). Bodies removed post-analysis; evidence in `capture2-*.json` log + this note.
- Marketing: https://fittingbox.com/en/glasses-virtual-try-on/advanced-website/frame-removal
- PD product: https://fittingbox.com/en/optical-fit/online-pd-measurement-tool

## Implications for VTO
- **Copy/beat**: PD-based scaling with a statistical default (63 mm) is a cheap way to get "good enough" scale without per-user measurement — we can adopt a similar default IPD/PD strategy to avoid needing credit-card calibration UI.
- **Frame removal is both our competitive edge and a patent minefield** — it's a gated, patented (16 patents), partially client (live) / partially server (photo) feature. See [[T002 Patent-IP-Mapping]] (T002) for FTO risk; do not blindly clone the "diminished reality" pipeline without an IP review.
- The **photo path proves they DO accept server-side processing for uploads** — a relevant fact if we compare "privacy-first client-side" messaging.

## Related
[[VTO]] · [[T001 FittingBox-Teardown]] · [[F001-fittingbox-runtime-engine]] · [[F001-fittingbox-privacy]]
