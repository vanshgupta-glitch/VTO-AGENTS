---
okf: 1
id: f001-fittingbox-runtime-engine
type: finding
project: VTO
status: done
created: 2026-08-04
updated: 2026-08-04
tags: [vto, fittingbox, teardown, runtime, webgl, wasm, angular]
---

# F001 — FittingBox Runtime & Render Engine

Status: done.

## Question
What runtime tech drives the FittingBox try-on in the browser (WebGL/WebGPU, three.js/Babylon/custom, workers)? What FPS?

## Answer
- **Renderer = FBxLive, a custom C++ → Emscripten WASM + WebGL engine.** The `FBxLive.js` glue is unmistakably Emscripten (Module, wasmBinary, HEAP32, GL.registerContext, `locateFile`). It is **NOT three.js and NOT Babylon** — a global scan found no `THREE`/`BABYLON` symbols in the bundles.
- **WebGL2 preferred, WebGL1 fallback.** Context attrs captured: `{antialias:false, alpha:false, majorVersion: typeof WebGL2RenderingContext!="undefined"?2:1, ...premultipliedAlpha, preserveDrawingBuffer…}`. So: antialias off (they do their own shading/AA), premultiplied-alpha on; likely MSAA internally. No WebGPU path seen.
- **Rendering/processing runs off the main thread**: FBxLive.js creates `new Worker` and uses **OffscreenCanvas**; the page's own `<canvas>` may be absent because the GL surface is created offscreen/main via a worker-rendered canvas. This is why the try-on stays smooth — heavy per-frame work is isolated from the UI thread/catalog.
- **Frame capture**: `fbx-streamgrabber.js` (25 KB) + `getUserMedia` — webcam stream is grabbed and fed into FBxLive. No visible TensorFlow.js / MediaPipe / ONNX / TFLite model files on the network. All ML/geometry appears compiled into the WASM (self-contained).
- **App framework**: the VTO engine app (`vto-advanced.fittingbox.com`) is **Angular + NgRx** (the `\u0275fac` component factories and `store.dispatch/select` store actions in chunk-*.js). The 3D engine is separate (FBxLive WASM).
- **FPS: not empirically measured in this pass** (a live camera session + requestAnimationFrame counter was not completed in headless). Basis for an estimate: WebGL2 off-main-thread renderer, `setMouseCameraRotationSpeedFast/normal` tuning, marketed as "real time"; a cited mid-range figure is unverified — flag as TO-VERIFY on a real device.

## Evidence
- `FBxLive.js` glue strings: webgl2/webgl context build, OffscreenCanvas, `new Worker`, Emscripten `Module`/`wasmBinary`/`HEAP32` — `C:\Users\ankur.singh\.openclaw\workspace\vto-t001\` (bodies removed after analysis; see capture2-*.json for the request log).
- Runtime probe + frame-tree snapshot showing the engine iframe `[fitmixWidgetIframeContainer]`.
- No tfjs/mediapipe/onnx/tflite assets in the network log (initial-load + engine load).

## Implications for VTO
- FittingBox solved "in-browser ML + 3D quality" with a **compiled WASM engine they wrote themselves**, keeping the screen-visible budget small by deferring the 10 MB download to activation. This is the incumbent's answer to the 250 KB-entry problem: don't make ML tiny — make it deferred and off-main-thread.
- Off-main-thread rendering (worker + OffscreenCanvas) is a likely contributor to their smoothness. Our MediaPipe + three.js + GLB stack could adopt the same trick (run face ML + rendering in a worker / OffscreenCanvas) to keep FPS high.
- Heavy WASM on first render (10 MB deferred) vs our philosophy is a strategic decision point, not just a tech one.

## Related
[[VTO]] · [[T001 FittingBox-Teardown]] · [[F001-fittingbox-network-cdn]] · [[F001-fittingbox-pipeline-scale-fit]]
