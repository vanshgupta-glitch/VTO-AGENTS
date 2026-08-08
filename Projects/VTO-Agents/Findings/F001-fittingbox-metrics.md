---
okf: 1
id: F001-fittingbox-metrics
type: finding
project: VTO
status: done
created: 2026-08-04
updated: 2026-08-04
tags: [vto, fittingbox, teardown, metrics, summary]
related: ["[[F001-fittingbox-network-runtime]]", "[[F001-fittingbox-frame-removal]]", "[[F001-fittingbox-scale-fit]]", "[[F001-fittingbox-privacy]]", "[[VTO]]"] 
---

# F001 — FittingBox: Key Metrics Table (summary)

## Question
A single reference table of the decisive numbers for benchmarking our VTO against FittingBox (client-side teardown via public demo).

## Answer

### Metrics table
| Metric | Value | Source |
|---|---|---|
| Engine | FBxLive 11.4.0, custom C++ → Emscripten WASM | console + static.fittingbox.com |
| **Total engine bytes** | **≈ 12.4 MB** (wasm 10.5 + data 1.4 + js 0.25 + streamgrabber 0.03) | waterfall.json |
| JS bundle (widget) | main 81 KB + chunks 639 KB + 607 KB + css ~40 KB ≈ **1.35 MB** | waterfall.json |
| **Largest single asset** | **FBxLive.wasm = 11,008,865 B (~10.5 MiB)** | waterfall.json / HEAD |
| Model format | ML models **compiled into WASM** as `dataMM.bin` (embedded in `.data`); NO separate ONNX/TFLite | FBxLive.js file table |
| Per-frame 3D asset | Proprietary encrypted **`fitsource`** binary (assets.fittingbox.com/glasses/fitsource/), per-frame `key` | widget JS |
| 3D/render format | Custom PBR (GGX-DFG-LUT.ktx, IBL envmaps .zip/.bin, Material V1/V2) | FBxLive.js file table |
| Frame removal (live) | **Client-side** (WASM, camera local) — no uploads observed | tryon2.json |
| Frame removal (photo) | **Server-side** — selfie base64 POSTed to `/render` | w_chunk1.js |
| Scale/fit | PD-anchored; default **PD 63 mm `statistic_pd`**; iris PD tuning available but default off; no credit-card/size-input | w_chunk2.js |
| WebGL | **WebGL 2.0** | page fingerprint |
| 3D framework | **none** (three.js/babylon absent) — custom WASM renderer | fingerprint |
| FPS (headless, fake cam) | **~60 fps** (rAF count, capped vsync) on desktop Chrome | tryon2.js |
| Workers/multithread | Emscripten pthreads enabled (`ENVIRONMENT_IS_PTHREAD`) | FBxLive.js |
| First model download at activation | **None** — models ship inside the ~11 MB engine downloaded at widget init | waterfall.json |
| Privacy (live) | camera stays local, 0 media uploads | tryon2.json |
| Privacy (photo) | image uploaded to FittingBox server | w_chunk1.js |
| Analytics | ~160 POSTs/session to analytics-api.fittingbox.com + PostHog (eu) | tryon.json |

### Headline takeaways for VTO
1. **They solved the "ML size" problem by not shrinking it** — they ship a ~12 MB monolithic WASM with models compiled in and cache it. We can't (250 KB gz entry cap) → we must **lazy-load the model chunk only at try-on activation**.
2. **Live is client-side, photo is server-side.** Their photo try-on uploads the user's selfie. → our opportunity: keep photo mode client-side too (MediaPipe) for a real privacy differentiator.
3. **Quality derives from template-deformation "stash" + embedded models + PBR**, consistent with the internal digitization belief — not from shipping heavy per-frame meshes.
4. **Default PD 63 mm / statistic fallback** → zero-friction try-on w/o input; iris PD is opt-in. We can beat by auto-iris.
5. **Encrypted per-frame `fitsource` binaries** = their anti-scraping IP protection to know about.

## Evidence
- `f001-scratch/waterfall.json`, `tryon.json`, `tryon2.json`, `FBxLive.js`, `streamgrabber.js`, `w_main.js`, `w_chunk1.js`, `w_chunk2.js` (playwright network capture + public page JS string analysis).
- Live DePs: WebGL2 fingerprint, console version banners.

## Implications for VTO
Use this table as the baseline for the next design decision (entry size strategy, model delivery, photo-mode privacy, fit defaults). See companion F001 findings for detail on each area.

## Links
[[VTO]] · [[FittingBox-Researcher]] · [[F001-fittingbox-network-runtime]] · [[F001-fittingbox-frame-removal]] · [[F001-fittingbox-scale-fit]] · [[F001-fittingbox-privacy]]
