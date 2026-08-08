---
okf: 1
id: F001-fittingbox-runtime
type: finding
project: VTO
status: done
created: 2026-08-04
tags: [vto, fittingbox, teardown, runtime, wasm]
---

# F001 — FittingBox Runtime: Engine, Rendering Tech, FPS

**Project:** [[VTO]] · Source note: [[ra-fittingbox]] · Related: F001-fittingbox-summary

## Question
What runtime does FittingBox's try-on use — WebGL1/2/WebGPU, three.js/babylon/custom, Web Workers, and at what FPS?

## Answer
FittingBox uses a **custom, self-contained C/C++ engine compiled to WebAssembly via emscripten** (`FBxLive`). **No three.js, babylon, MediaPipe, TF.js, or ONNX Runtime** was found in the shipped JS — the loader (`FBxLive.js`, 648× `emscripten` references, 7× `wasmBinaryFile`) is an emscripten glue module, meaning the 3D renderer and any in-engine ML are compiled inside the `.wasm`. WebGL2 is available and rendering draws through WebGL (ANGLE/D3D11 on this Windows test machine). A Service Worker is registered. Web Workers were not confirmed active in the headless captures (the engine runs `FBxLive.wasm`).

### Framework signature scan (from shipped JS bundles: FBxLive.js, vto/demo chunks)
| Signature | Count in FBxLive.js | Notes |
|---|---|---|
| `three` / `THREE` / `WebGLRenderer` | 0 | no three.js |
| `babylon` / `BABYLON` | 0 | no babylon |
| `mediapipe` / `FaceMesh` | 0 | no MediaPipe |
| `tensorflow` / `tfjs` / `onnx` / `tflite` | 0 | no JS ML runtime |
| `emscripten` | 648 | emscripten WASM glue |
| `wasmBinaryFile` | 7 | WASM loader |

### Rendering
- `onCreateElement("canvas").getContext("webgl")` used for renderer string detection (WEBGL_debug_renderer_info) → WebGL path.
- Runtime detection in browser: WebGL1 and WebGL2 both `true`; renderer `ANGLE (Intel UHD Graphics 630) Direct3D11`; vendor "Google Inc. (Intel)" → D3D11/ANGLE under Chromium on Windows.
- `navigator.serviceWorker` present (`registeredSW: true`).

## Evidence
- Shipped JS: `FBxLive.js` (259,908 bytes) from `static.fittingbox.com/libs/FBxLive/11.4.0/` — emscripten glue; grep counts above.
- WebGL probe via Playwright `WEBGL_debug_renderer_info`: WebGL2=true, ANGLE/D3D11 renderer.
- FPS (requestAnimationFrame delta) on this machine:
  - demo home (idle catalog): ~33
  - list page: ~61
  - vto-advanced iframe (no active frame): ~61
  - Live camera try-on FPS could **not** be measured in headless (fake webcam produces no WebGL frames; see Limitations). These are idle-RAF values, not try-on FPS.

## Limitations / honesty
- Headless Chromium with `--use-fake-device-for-media-stream` did not render live frames, so real-time FPS on a mid-range device is **unmeasured**. Only engine-load and idle frame rates were captured. A device-farm test (real webcam / GPU) is needed for a true FPS number.

## Implications for VTO
- FittingBox's client-side live path is a **closed WASM monolith** — they did not pick an off-the-shelf web-ML/runtime stack. Their 2.8 MB WASM + 1.3 MB data is far beyond our 250 KB gz budget, which is exactly why they push photo/removal to the server (F001-fittingbox-frame-removal).
- For our **client-side** VTO (MediaPipe + three.js), keeping a sub-250 KB entry + small landmark model is a genuine edge — but it means staying client-side for the real-time path, matching their live model (they keep live local, only still/removal server-side).

## Sources
- https://static.fittingbox.com/libs/FBxLive/11.4.0/FBxLive.js (signature grep)
- https://demo.fittingbox.com/home, https://vto-advanced.fittingbox.com (Playwright captures)
