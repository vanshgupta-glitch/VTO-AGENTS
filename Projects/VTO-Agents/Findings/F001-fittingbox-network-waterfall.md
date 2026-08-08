---
okf: 1
id: F001-fittingbox-network-waterfall
type: finding
project: VTO
status: done
created: 2026-08-04
tags: [vto, fittingbox, teardown, network, bundles]
---

# F001 — FittingBox Network Waterfall & Bundle Sizes

**Project:** [[VTO]] · Source note: [[ra-fittingbox]] · Related: F001-fittingbox-summary

## Question
What ships to the shopper's browser for FittingBox's virtual try-on — JS bundle names/sizes, WASM/ML models, 3D asset format + per-frame size, CDN layout, and total bytes before first render?

## Answer
FittingBox's try-on is built as a **lazy-loaded, proprietary compiled WASM engine**, not as framework JS. The client shell (Angular, hosted on `*.fittingbox.com`) downloads a small app, and the heavyweight render engine (`FBxLive`) is a **custom C/C++→WebAssembly (emscripten) binary** that pulls in a ~2.8 MB WASM plus a ~1.3 MB data file on feature activation. Their 3D glasses are **not GLB/glTF** — they are proprietary "fitsource" binaries fetched from `assets.fittingbox.com/glasses/fitsource/`, and their environment/reflection maps are encrypted `.bin` files.

Observed CDN/asset hosts:
- `static.fittingbox.com/libs/FBxLive/<ver>/` — the WASM engine (FBxLive.wasm, FBxLive.data, FBxLive.js, fbx-streamgrabber.js)
- `*.fittingbox.com` (demo / vto-advanced / vto-advanced-feature / pd-measurement) — app JS/CSS/i18n
- `assets.fittingbox.com/glasses/fitsource/` — 3D frame binaries (per frame)
- `lens-simulation-colors.s3.eu-west-1.amazonaws.com` — lens-tint simulation textures (zip, ~160–175 KB each)
- `images.fittingbox.com` — frame PNG thumbnails (~60–130 KB, `?width=500`)
- `product-api.fittingbox.com` — license check + `glasses-metadata/availability` (barcodes)
- `analytics-api.fittingbox.com` + `eu-assets.i.posthog.com` — analytics/tracking
- `vto-customer-application-detectionservice-v11.fittingbox.com`, `faceshapeservice.fittingbox.com` — server-side face shape / detection services (see privacy note)

## Evidence (measured via Playwright network capture of public demos)

### CDN bundle size table (home / demo store, first load)
| Asset | URL | Size (KB) |
|---|---|---|
| FBxLive.wasm | static.fittingbox.com/libs/FBxLive/11.4.0/FBxLive.wasm | **2,805** (2.74 MB) |
| FBxLive.data | static.fittingbox.com/libs/FBxLive/11.4.0/FBxLive.data | **1,376** (1.31 MB) |
| FBxLive.js | static.fittingbox.com/libs/FBxLive/11.4.0/FBxLive.js | 254 |
| fbx-streamgrabber.js | static.fittingbox.com/libs/FBxLive/11.4.0/fbx-streamgrabber.js | 25 |
| chunk-BPYZF72V.js | vto-advanced.fittingbox.com | 625 |
| chunk-TDW6KIIV.js | vto-advanced.fittingbox.com | 593 |
| main-A2NLOH5O.js | vto-advanced.fittingbox.com | 79 |
| chunk-BZX2UZOC.js | demo.fittingbox.com | 339 |
| styles CSS | vto-advanced.fittingbox.com | 39 |
| lens-tint zips | lens-simulation-colors.s3.eu-west-1.amazonaws.com (per gradient) | 161–175 each |

### Totals observed
- **Demo store `/home`:** ~9.85 MB, 145 requests, `load` ≈ 1.35 s (this machine), FBxLive engine pulled eagerly on home.
- **`/list?type=eyeglasses` with a try-on kick-off:** ~13.5 MB, 190 requests (includes per-frame PNGs + lens zips + FBxLive).
- **vto-advanced iframe alone (no frame active):** ~1.4 MB (app shell only; FBxLive WASM NOT fetched until startVto).

### 3D asset format
- Config constant (app code): `glassesBinaryUrl: "https://assets.fittingbox.com/glasses/fitsource/"`.
- Env maps: `envMapData3v8: "envmaps/pixar_campus_legacy.bin"`, `envMapData4: "envmaps/schadowplatz_desat_V1.bin"` + `decryptKeyEnvMap` → **encrypted binary environment maps** (proprietary `.bin`).
- Lens simulation: `lensesMaterialUrl: "https://lens-simulation-colors.s3.eu-west-1.amazonaws.com"` → `.zip` textures.
- **No `.glb`/`.gltf`/`.obj`/`.fbx` mesh was observed**; per-frame size of the glasses binary could not be measured in this teardown (see Limitations), but the live engine always targets `assets.fittingbox.com/glasses/fitsource/`.

## Implications for VTO
- We use **MediaPipe FaceLandmarker + three.js + GLB**; FittingBox uses a **custom monolithic WASM engine + proprietary binary assets + encrypted env maps**. Their "solution" to the ML-size problem is architectural, not a small model: they offload the expensive photo/removal path to the **server** (see F001-fittingbox-frame-removal) and keep only the real-time webcam path client-side.
- The FBxLive wasm+data (~4.1 MB compressed-transferred ≈ 2.74 MB wasm + 1.31 MB data) would blow past our 250 KB gz entry constraint — strong signal that **client-side ML at that quality does not fit a 250 KB entry**; FittingBox dodges it by server-side rendering for the still/removal flow.
- **What to copy:** lazy-load the engine only at feature activation (FBxLive WASM fetch deferred until startVto), which reduces perceived load.
- **What to beat:** our GLB pipeline is open/standard vs their proprietary `.bin`+encrypted envmap format; but they trade that for a self-contained engine that does not expose 3D assets to scraping.

## Sources
- https://demo.fittingbox.com/home (Playwright capture, 2026-08-04)
- https://demo.fittingbox.com/list?type=eyeglasses
- https://vto-advanced.fittingbox.com/?htmlContainerId=fitmix-container&apiKey=... (iframe capture)
- vto-advanced app JS: chunk-BPYZF72V.js / chunk-TDW6KIIV.js (config constants quoted above)
