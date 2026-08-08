---
okf: 1
id: F001-fittingbox-scale-fit
type: finding
project: VTO
status: done
created: 2026-08-04
tags: [vto, fittingbox, teardown, scale, fit, pd]
---

# F001 — FittingBox Scale & Fit Approach (iris / PD / calibration)

**Project:** [[VTO]] · Source note: [[ra-fittingbox]] · Related: F001-fittingbox-summary

## Question
How does FittingBox determine scale/fit — iris-based scaling, credit-card calibration, PD input UI, and PD presentation?

## Answer
FittingBox's scale/fit is **iris/pupil-based with a manual PD (pupillary distance) input**, and the accurate PD measurement is computed **server-side** and returned to the client as eye landmarks. Evidence from the vto-advanced app:
- `irisBasedPDTuningType` — an explicit toggle for **iris-based PD tuning**; values like `"disable"` observed when the config opts out; the product supports iris-based PD where the server measures pupil distance from the uploaded photo.
- `avatarPd` — the pupil-distance value sent with the render request (a PD in mm).
- The render service returns `eyesPoints` (eye/pupil coordinates) which the client uses for placement/scale.
- `pd: 63, isRealPd: false` (photo-render reducer defaults) → a default PD of ~63 mm when no real measurement exists, with an `isRealPd` flag distinguishing measured vs default.
- `pupillaryDistance` is an explicit param on the render call.
- Separate `pd-measurement` product (https://pd-measurement-demo.fittingbox.com/) uses the **same FBxLive engine** + `fbx-streamgrabber` (webcam grabber), and FittingBox markets "PD accuracy within 1 mm (7 of 10 measurements)".

### Size input / PD presentation
- The client holds a PD value (mm) and the photo-render state stores `image`, `pd`, `isRealPd` — i.e., a PD is accepted/measured and applied to the frames on the face.
- No evidence of **credit-card calibration** was found in this teardown (the "iris" strings in the PD bundle were i18n-validator library noise, not calibration UI). FittingBox's published PD tool relies on the webcam + iris/pupil detection; card-based calibration was not observed.

## Evidence
- vto-advanced app JS: `irisBasedPDTuningType`, `avatarPd`, `pupillaryDistance`, render returning `eyesPoints`, `pd:63,isRealPd:false`, photo-render reducer.
- https://pd-measurement-demo.fittingbox.com/ — PD product loads `FBxLive.wasm` + `fbx-streamgrabber.js` (webcam) + `msrt:*` analytics (visual evidence it reuses the same engine).
- Marketing claim (fittingbox.com): "accuracy within 1 mm, for 7 out of 10 measurements."

## Implications for VTO
- Our client-side MediaPipe FaceLandmarker already gives eye landmarks the same way FittingBox's server returns `eyesPoints` — we can compute PD/iris scaling **fully client-side**, which is a speed/privacy advantage over their server round-trip.
- Keep the **`isRealPd` vs default-PD** pattern: detect when you have a true measurement vs a fallback (they default to ~63 mm) and surface "best guess vs measured" to the shopper.

## Sources
- vto-advanced app JS (iris/PD/render contract)
- https://pd-measurement-demo.fittingbox.com/ (Playwright capture)
- https://fittingbox.com/en (marketing claims)
