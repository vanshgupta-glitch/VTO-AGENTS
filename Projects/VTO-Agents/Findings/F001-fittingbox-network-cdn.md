---
okf: 1
id: f001-fittingbox-network-cdn
type: finding
project: VTO
status: done
created: 2026-08-04
updated: 2026-08-04
tags: [vto, fittingbox, teardown, network, cdn, bundle]
---

# F001 — FittingBox Network Waterfall & CDN Layout

Status: done (accurate sizes captured via CDP loadingFinished).

## Question
What ships to the shopper's browser on a FittingBox-powered virtual try-on, in what layout, and at what size?

## Answer
FittingBox demo (`https://demo.fittingbox.com/home`) is an Angular SPA that mounts the real try-on engine as an **iframe** to `https://vto-advanced.fittingbox.com/?htmlContainerId=fitmix-container&apiKey=...`. The architecture is two parts: an **Angular + NgRx app** (webpack chunk-*.js) plus the proprietary **FBxLive SDK** (static.fittingbox.com/libs/FBxLive/11.4.0/) — a custom C++→WASM + WebGL rendering/ML engine. See [[F001-fittingbox-runtime-engine]].

### CDN / domain layout
| Domain | Role |
|---|---|
| `demo.fittingbox.com` | demo store SPA (angular chunks, main-HKASO5AD.js, styles, assets) |
| `vto-advanced.fittingbox.com` | main VTO engine app (main-A2NLOH5O.js + chunk-*.js) in an iframe |
| `vto-advanced-feature.fittingbox.com/config.json` | feature-flag config (minimal log flags) |
| `static.fittingbox.com/libs/FBxLive/<ver>/` | FBxLive runtime: FBxLive.js, FBxLive.data, FBxLive.wasm, fbx-streamgrabber.js |
| `images.fittingbox.com/images/glasses/<uuid>.png?width=500` | frame thumbnails (PNG, 500px) |
| `s3.eu-west-1.amazonaws.com/static.youarethemodel.com-*/glasses/fitsource/` | 3D frame source/geometry (fetched on demand) |
| `product-api.fittingbox.com` | glasses-metadata/availability + license check (apiKey in query) |
| `analytics-api.fittingbox.com/analytics/track/fitmix:*` | product analytics (init, ready, license:check, glassesCatalog, liveCompatibility…) |
| `lens-simulation-colors.s3.eu-west-1.amazonaws.com/*.zip` | per-lens-color simulation material zips (gradients/tints) |
| `eu-assets.i.posthog.com`, `eu.i.posthog.com` | PostHog analytics (EU region) — web-vitals, surveys, autocapture |

### Accurate bundle/model sizes (Chrome CDP, loadingFinished / getResponseBody)
| Asset | raw | transferred (gz) | format |
|---|---|---|---|
| FBxLive.wasm  11.4.0 | 10,750 KB (10.5 MB) | 2,809 KB | wasm (Fetch) |
| FBxLive.data  11.4.0 | 1,426 KB | 1,378 KB | binary blob (octet-stream) |
| FBxLive.js  11.4.0 | 254 KB | 57 KB | JS (Emscripten glue) |
| fbx-streamgrabber.js | 25 KB | 5 KB | JS |
| vto-advanced main-A2NLOH5O.js | 79 KB | 80 KB | JS (angular) |
| vto-advanced chunk-BPYZF72V.js | 625 KB | 626 KB | JS (try-on UI) |
| vto-advanced chunk-TDW6KIIV.js | 593 KB | 594 KB | JS |
| demo main-HKASO5AD.js | 12 KB | 12 KB | JS |
| demo chunk-BZX2UZOC.js | 339 KB | 339 KB | JS |
| demo chunk-BDINM53S.js / B5RI6YGG.js | ~147 KB each | ~146-148 KB | JS |

**Total transferred on initial demo load: ~10,021 KB (≈10 MB) across 102 responses** — dominated by the FBxLive.wasm (2.8 MB transferred / 10.5 MB uncompressed). The heavy ML engine downloads at page/engine init; the small app entry stays small.

## Evidence
- Live Chrome-headless CDP captures: `C:\Users\ankur.singh\.openclaw\workspace\vto-t001\network-*.json`, `capture2-*.json` (URL, mime, type, accurate size).
- Demo: https://demo.fittingbox.com/home · engine iframe: https://vto-advanced.fittingbox.com/?htmlContainerId=fitmix-container&apiKey=...

## Implications for VTO
- FittingBox does **not** keep its ML small. They ship a ~10.5 MB WASM engine (2.8 MB gz transfer) plus ~1.4 MB data — downloaded at engine activation, NOT on first paint. Their **entry** bundle is tiny (demo main 12 KB; engine main 79 KB); the heavy footprint is deferred to the point the user engages the try-on. This is how they sidestep a small "entry" budget.
- Everything is lazy/code-split and CDN-delivered: frames, lens materials, geometry. Contrast with our 250 KB gz entry + in-browser ML constraint: we must decide whether to match their "small entry + heavy deferred engine" model or truly keep ML small.
- Their per-frame delivery is on-demand from S3 (`/glasses/fitsource/`) — frames are NOT shipped pre-bundled.

## Related
[[VTO]] · [[T001 FittingBox-Teardown]] · [[F001-fittingbox-runtime-engine]] · [[F001-fittingbox-pipeline-scale-fit]] · [[F001-fittingbox-privacy]]
