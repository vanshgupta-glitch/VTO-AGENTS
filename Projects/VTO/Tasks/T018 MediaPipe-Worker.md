# T018 — MediaPipe Worker + OffscreenCanvas Migration

project: [[VTO]]
status: assigned
assigned_by: Hermes
assigned_on: 2026-08-04
worker: OpenClaw

## Goal

Move MediaPipe FaceLandmarker detection off the main thread to a Web Worker with OffscreenCanvas — the #1 pipeline bottleneck per F004.

## Context (from Hermes)

Per D3 §8 and F004-rendering-pipeline-fps: **MediaPipe main-thread detection (20–47 ms) is the #1 bottleneck** in the pipeline. Moving to Worker+OffscreenCanvas is higher priority than adding any new model.

FittingBox already uses this pattern (Worker + OffscreenCanvas per F001-fittingbox-runtime-engine).

**Method:**
1. Create a `FaceLandmarkerWorker` that instantiates MediaPipe FaceLandmarker in a Web Worker
2. Use `OffscreenCanvas` transferred from the main thread for the video frame
3. Post landmark results back to the main thread via `postMessage`
4. Main thread receives landmarks and feeds them to the render loop without blocking
5. Ensure the WASM model is loadable in Worker context

**Repo:** `C:\Users\ankur.singh\shopify\nmg-vto\rkumar-vto\packages\vto-core\src\`

## Definition of done
- [ ] FaceLandmarker runs in a Web Worker (not main thread)
- [ ] OffscreenCanvas used for frame transfer (no main-thread canvas readback)
- [ ] Main-thread render loop does not block on face detection
- [ ] PipeClean FPS measurably improved (compare pre/post on same hardware)
- [ ] All existing tests pass
- [ ] Commit referencing F004 and D3 §8

## Result & context returned (OpenClaw fills this)
- What was done: Added OffscreenCanvas pipeline to the existing FaceTracker Web Worker. Worker now receives a GPU-backed OffscreenCanvas (transferred once at startup, sized to video dimensions), draws each ImageBitmap onto it, and passes the canvas to MediaPipe's `detectForVideo` — avoiding any main-thread canvas readback. Added deferred transfer via `setCanvas()` to handle the case where video dimensions aren't known at init time.
- Artifacts / paths:
  - `packages/vto-core/src/tracking/messages.ts` — added `offscreen?: OffscreenCanvas` to init message, added `canvas` message type for deferred transfer
  - `packages/vto-core/src/tracking/tracker.worker.ts` — receives OffscreenCanvas at init or via `canvas` message, draws ImageBitmap onto it in `handleFrame`, passes canvas to `detectForVideo`
  - `packages/vto-core/src/tracking/tracker-client.ts` — added `videoWidth`/`videoHeight` config options, sends OffscreenCanvas at init, added `setCanvas()` method for deferred transfer
  - `packages/vto-core/src/engine/landmark-debug-engine.ts` — passes video dimensions to FaceTracker, calls `setCanvas()` on first frame with non-zero dimensions, tracks `workerCanvasSent` flag
  - `extensions/vto/assets/vto-widget.worker-Ca_1LEIN.js` — rebuilt worker chunk (2.13 kB)
- Decisions made while executing:
  - Used deferred OffscreenCanvas transfer pattern: dimensions aren't known at `init()` time (videoWidth/videoHeight are 0), so a `canvas` message type sends the OffscreenCanvas once dimensions arrive in the first `update()` call
  - Kept backward compatibility: worker gracefully falls back to raw ImageBitmap detection when no OffscreenCanvas is available
  - Left `?vtoWorker` opt-in as-is (not making worker default yet — cross-origin classic-worker blob path on Shopify CDN is the constraint)
  - The existing `createImageBitmap(videoElement)` in the engine's worker path already avoids main-thread canvas drawImage — the OffscreenCanvas adds GPU-texture-direct access inside the worker
- Problems / open questions:
  - FPS improvement can only be verified on real hardware with `?vtoWorker` flag — the render loop measured `detectMsEma` tracks round-trip latency, not main-thread blocking
  - Worker path still not the default — cross-origin limitation (see header comment in tracker.worker.ts re: Shopify CDN / module workers / importScripts)
- What Hermes should know for the next decision:
  - The pipeline is ready: main thread creates ImageBitmap from video, transfers to worker, worker draws to OffscreenCanvas, worker detects, results come back
  - To make this the default path, the Shopify CDN cross-origin worker constraint needs to be addressed or the widget needs to be served same-origin
  - Next: measure real-world FPS on a live device with `?vtoWorker` enabled

## Review (Hermes fills this)
- Verdict: done | rework
- Notes: