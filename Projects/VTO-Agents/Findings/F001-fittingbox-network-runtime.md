---
okf: 1
id: F001-fittingbox-network-runtime
type: finding
project: VTO
status: done
created: 2026-08-04
updated: 2026-08-04
tags: [vto, fittingbox, teardown, network, runtime, wasm]
related: ["[[F001-fittingbox-frame-removal]]", "[[F001-fittingbox-scale-fit]]", "[[F001-fittingbox-privacy]]", "[[F001-fittingbox-metrics]]"]
---

# F001 — FittingBox: Network Waterfall & Runtime

## Question
Exactly what ships to the shopper's browser to run FittingBox virtual try-on? Bundle names/sizes, model formats, CDN layout, runtimes, total bytes before first render, FPS.

## Answer
FittingBox is a **fully custom C++ engine compiled to WASM via Emscripten** (`FBxLive` 11.4.0), wrapped in an **Angular** iframe widget (`vto-advanced`). There is **no three.js, no Babylon, no separate ONNX/TFLite/MediaPipe** — the ML models and rendering are compiled directly **into the WASM binary** and shipped with it. WebGL **2.0**. No separate model download at feature activation: the ~11 MB engine is (re)downloaded once at widget init and reused for the whole session.

### Network waterfall (from live capture of demo.fittingbox.com + iframe vto-advanced.fittingbox.com)
| Resource | Host | Bytes (raw) | Notes |
|---|---|---|---|
| FBxLive.wasm | static.fittingbox.com/libs/FBxLive/11.4.0/ | **11,008,865 (~10.5 MiB)** | Emscripten engine: CV detection + PBR renderer + all ML compiled in |
| FBxLive.data | static.fittingbox.com | 1,409,085 (~1.34 MiB) | Emscripten FS: embedded models, stashes, envmaps, structures |
| FBxLive.js | static.fittingbox.com | 259,908 (~254 KB) | Emscripten glue (pthreads enabled) |
| fbx-streamgrabber.js | static.fittingbox.com | 25,354 | Local camera stream grabber, NO network calls |
| main-A2NLOH5O.js | vto-advanced.fittingbox.com | 81,089 | Angular app entry |
| chunk-BPYZF72V.js | vto-advanced | 639,580 | Vendor/feature chunk |
| chunk-TDW6KIIV.js | vto-advanced | 607,295 | Feature chunk |
| styles-3YAHB5IG.css | vto-advanced | ~40,151 | Angular styles (Tailwind) |
| demo chunks (BZX2UZOC etc.) | demo.fittingbox.com | ~346K / 150K / 148K each | Merchant storefront app |
| lens-simulation-colors zips | lens-simulation-colors.s3.eu-west-1.amazonaws.com | 11K–178K each, ~8 files | Lens tint color packs (per merchant, public bucket) |

**Engine total ≈ 12.4 MB raw** (wasm 10.5 + data 1.4 + js 0.25 + streamgrabber 0.03). Widget app adds ~1.35 MB JS/CSS. The **10.5 MB `FBxLive.wasm` is the single dominant cost** and the true "in-browser ML size" number to compare against our 250 KB gz entry.

### CDN layout
- `static.fittingbox.com/libs/FBxLive/<version>/` — versioned engine (served via CloudFront → S3, `x-amz-version-id` present, gzip on .data). Version pinned at widget build (11.4.0; widget build 11.0.9-0, Env prod).
- `assets.fittingbox.com/glasses/fitsource/` — digitized 3D frame binaries (proprietary "fitsource" format, encrypted, see frame-removal finding).
- `images.fittingbox.com/images/glasses/` — 2D packshot PNGs (thumbnails, ~35–110 KB @ width=500).
- `lens-simulation-colors.s3.eu-west-1.amazonaws.com` — lens color data (public).
- `product-api.fittingbox.com` — license + `glasses-metadata/findByApiKey` (returns frame binary path/key/3dFormat).
- `analytics-api.fittingbox.com` — event telemetry (160+ POSTs) ; PostHog on `eu.i.posthog.com` (EU-hosted).

### First render / initialization
- Widget is an **iframe**: `vto-advanced.fittingbox.com/?htmlContainerId=fitmix-container&apiKey=…&productName=vto-advanced`.
- On load: fetch `config.json` (feature flags) → license check (`POST analytics fitmix:license:check` + `GET product-api/license/<apiKey>`) → load FBxLive.js+wasm+data → `FBxLive_setDetectionAutoParams(10,10)` + `FBxLive_initialize` → catalog.
- "Total bytes before first render": dominated by the **~10.5 MB wasm + ~1.4 MB data** (≈11.9 MB) delivered over CloudFront before the engine is usable. This is their answer to our 250 KB gz problem: **they just ship a big monolithic engine and cache it per-page; no dynamic model download at feature activation.**

## Evidence
- Live Playwright network capture `f001-scratch/waterfall.json`, `tryon.json`, `tryon2.json` (exec session, chromium-1228, headless desktop).
- Console: `FBX-Version : 11.4.0`, `Version : 11.0.9-0`, `Env : prod` (vto-advanced console.log).
- `f001-scratch/FBxLive.js` glue string analysis: `ENVIRONMENT_IS_PTHREAD`, `FBxLive.wasm`, embedded file table `/data/DENSE_5_PERCENT/dataMM.bin`, `/data/GGX-DFG-LUT.ktx`, `/data/envmaps/*.zip`, `/data/*.stash` etc.
- HTTP HEAD `FBxLive.data` → `Content-Length: 1409085`, `Server: AmazonS3`, `Via: CloudFront`.
- Widget JS source (`w_main.js`, `w_chunk1.js`, `w_chunk2.js`) → glasses binary base `https://assets.fittingbox.com/glasses/fitsource/`, envmap `envmaps/pixar_campus_legacy.bin`.

## Implications for VTO
- FittingBox **didn't shrink in-browser ML to <250KB — they shipped a ~12 MB monolithic WASM** (models compiled in, cached, no lazy dynamic model). Our constraint is different (Shopify Theme App Extension entry cap), so we can't just copy them; we must keep the *entry* lean and lazy-load the ML/model chunk only at try-on activation.
- Their whole pipeline is a **single-purpose WASM renderer (custom)** — no heavyweight generic WebGL framework. Copy: dense compiled-in models, PBR via GGX/IBL. Beat: we use three.js + MediaPipe which is modular but heavier per-feature.
- CDN layout is versioned + CloudFront+S3 + pinned engine version — a clean, cacheable delivery model worth mirroring.

## Links
[[VTO]] · [[FittingBox-Researcher]] · [[F001-fittingbox-metrics]]
