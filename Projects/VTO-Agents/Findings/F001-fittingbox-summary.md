---
okf: 1
id: F001-fittingbox-summary
type: finding
project: VTO
status: done
created: 2026-08-04
tags: [vto, fittingbox, teardown, summary, metrics]
---

# F001 — FittingBox Client-Side Teardown: Summary & Key Metrics

**Project:** [[VTO]] · Source note: [[ra-fittingbox]] · Task: [[T001 FittingBox-Teardown]]

## One-line takeaway
FittingBox is **not a lightweight client-side ML app** — it is a closed WASM engine for real-time webcam try-on whose **frame-removal and still/photo rendering run on their servers** (the browser uploads the photo), which is precisely how they survive a spec that would never fit a 250 KB gz client bundle.

## Architecture (as observed)
- Client shell: Angular app on `*.fittingbox.com`, communicates with the try-on **iframe** (`vto-advanced.fittingbox.com/?htmlContainerId=fitmix-container&apiKey=...`) via `postMessage` (methods: `getOptions`, `setInitializeOptions`, `startVto`, `setFrame`, `computeRender`).
- Live webcam try-on: **FBxLive** — custom C/C++→WASM (emscripten) engine (`static.fittingbox.com/libs/FBxLive/11.4.0/`), lazy-loaded at `startVto`.
- 3D glasses: proprietary **"fitsource" binaries** at `assets.fittingbox.com/glasses/fitsource/` + **encrypted `.bin` env maps** + lens-tint `.zip` textures on S3. **No GLB/glTF.**
- Frame removal / photo render / face-shape: **server-side** (`POST {restApiUrl}render` with `imageB64Data` → `outputImageB64`+`eyesPoints`; `detectionservice` + `faceshapeservice` hosts).
- Scale/fit: **iris/pupil-based PD** with manual PD input; `irisBasedPDTuningType`, `avatarPd`, `isRealPd` flag, default ~63 mm.

## Key metrics table
| Metric                              | Value                                                                               | Source                |
| ----------------------------------- | ----------------------------------------------------------------------------------- | --------------------- |
| Total first-load bytes (demo home)  | ~9.85 MB / 145 req                                                                  | Playwright capture    |
| Total bytes (list + try-on kickoff) | ~13.5 MB / 190 req                                                                  | Playwright capture    |
| FBxLive.wasm                        | **2,805 KB** (2.74 MB)                                                              | static.fittingbox.com |
| FBxLive.data                        | **1,376 KB** (1.31 MB)                                                              | static.fittingbox.com |
| FBxLive.js (emscripten glue)        | 254 KB                                                                              | static.fittingbox.com |
| fbx-streamgrabber.js                | 25 KB                                                                               | static.fittingbox.com |
| 3D frame asset format               | proprietary "fitsource" binary (no GLB), encrypted .bin envmaps                     | app config            |
| Lens-tint texture                   | ~160–175 KB .zip each (S3)                                                          | network               |
| Engine load time (home `load`)      | ~1.35 s (this machine)                                                              | capture               |
| Runtime / frameworks                | **custom WASM** (no three/babylon/mp/tf/onnx); WebGL2/ANGLE; worker+SW              | JS signature scan     |
| FPS (live try-on)                   | **unmeasured (headless)** — idle RAF 33–61                                          | capture               |
| Frame-removal                       | **server-side** (photo upload → render → return)                                    | source + network      |
| Frame-removal latency               | network RTT + server infer (not measured)                                           | structure             |
| Scale/fit                           | iris-based PD + manual PD input; server returns eyesPoints                          | source                |
| Privacy                             | live path local; **photo/removal path uploads face (base64) to server** + analytics | source + network      |

## What to copy / beat / avoid
- **Copy:** eager-vs-lazy split (engine only fetched at activation); frame placement/lighting quality bar; PD treatment (measured vs default ~63 mm) and `isRealPd` transparency.
- **Beat:** ship **real client-side** removal/PD (face never leaves device); open GLB pipeline; no server inference cost; no encrypted-asset lock-in. Our sub-250 KB client bundle is a genuine, defensible differentiator **if** we can fit real-time face/eye ML.
- **Avoid / risk:** server-side photo uploads hurt privacy & add latency/cost; the proprietary binary+encrypted-envmap format is a lock-in we should not replicate. Coordinate claims with [[Patent-Researcher]] on the "background/lenses/frame" pixel classification regardless of client/server placement.

## Limitations (be honest for [[VTO Task Log]] & Hermes)
1. **Live webcam FPS not measured** — headless Chromium's fake webcam produced no WebGL frames, so real-time try-on FPS and first-removal latency on a real device are **unquantified**. Needs a device-farm / real-camera follow-up.
2. **Per-frame 3D binary size not measured** — engine only fetches `fitsource` after a valid started try-on (not reachable headless).
3. Merchant-storefront embed (clearly.ca / glasses.com) not captured — was superseded by the richer official demo captures; the iframe+postMessage pattern generalizes.
4. No auth bypass, no bulk asset download — observation only (public demos + shipped JS signature analysis).

## File index
- F001-fittingbox-network-waterfall · F001-fittingbox-runtime · F001-fittingbox-frame-removal · F001-fittingbox-scale-fit · F001-fittingbox-privacy (this file)
