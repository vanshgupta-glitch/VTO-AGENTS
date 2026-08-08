# T019b â€” GlassesSegmenter.ts (Module Skeleton + ONNX Pipeline)

project: [[VTO]]
status: done
assigned_by: Hermes
assigned_on: 2026-08-04
worker: OpenClaw

## Goal

Create the `GlassesSegmenter.ts` module skeleton with ONNX Runtime Web pipeline, mask output interface, and fallback to FrameDetector. Retire ClipEyewearClassifier.

## Context (from Hermes)

T019 failed (subagent context overflow). This retry is scoped tighter.

**What to build:**
1. `GlassesSegmenter.ts` â€” module skeleton in `src/frame-detection/`
2. ONNX Runtime Web import + `InferenceSession.create()` with WebGPU backend preference
3. Method: `segment(frame: ImageBitmap | VideoFrame): GlassesMask` â€” returns `{frame: Float32Array, lens: Float32Array, face: Float32Array}` at input resolution
4. Method: `load(modelPath: string): Promise<void>` â€” loads ONNX model
5. Static factory: `GlassesSegmenter.create()` that tries ONNX, falls back to null on failure
6. Strided inference: `shouldRun(frameIndex: number): boolean` â€” every 3rd frame
7. The caller (not this module) handles mask interpolation and fallback wiring

**What to retire:**
- Remove `ClipEyewearClassifier.ts` imports and usage. Mask morphology replaces it per F003.

**Important:** No trained BiSeNet ONNX model exists. The module should compile and export the correct API surface. Use ONNX Runtime Web types. The `load()` method should handle the case where no model file exists gracefully.

**Repo:** `C:\Users\ankur.singh\shopify\nmg-vto\rkumar-vto\packages\vto-core\src\frame-detection\`

## Definition of done
- [ ] `GlassesSegmenter.ts` created â€” compiles with tsc
- [ ] ONNX Runtime Web imported, InferenceSession API used
- [ ] Mask output interface defined (frame/lens/face Float32Arrays)
- [ ] `load()` + `create()` factory + `shouldRun()` methods
- [ ] `ClipEyewearClassifier.ts` retired (remove imports, drop the file or mark deprecated)
- [ ] tsc clean on the vto-core package

## Result & context returned (Claude, 2026-08-05 â€” REAL model integrated)
- What was done: Rohit's trained BiSeNet model (`bisenet_glasses.onnx`, 12.6 MB int8) is now integrated with **real ONNX inference** (not a stub). Rewrote `GlassesSegmenter.ts` end-to-end (bilinear downscale â†’ 32-multiple grid â†’ /255 + ImageNet normalize â†’ NCHW f32 â†’ `session.run` â†’ per-pixel argmax â†’ nearest-upsample â†’ `GlassesMask`), mirroring the proven `LamaInpainter` ORT pattern (dynamic import, `wasmPaths`, webgpuâ†’wasm providers, injectable `createSession` test seam). Multi-threaded WASM enabled (`ort.env.wasm.numThreads`, gated on `crossOriginIsolated`). Interim class-6 (`eye_g`) â†’ `frame` channel; `lens` stays empty (no frame/lens split in this 19-class model â€” the header + `classMapToMask()` flag exactly where the F003 3-class model slots in). Wired `GlassesSegmenter.create()` into `ensureRemovalPipeline()` behind `?vtoModel=<onnx-url>` (reuses `?vtoOrtWasm=`), **non-blocking + fallback-safe** (any failure â†’ empty mask â†’ contour FrameDetector path, try-on never breaks). Model copied to `extensions/vto/assets/bisenet_glasses.onnx` (gitignored). Rewrote the T019 test to the real async API with a fake session verifying argmaxâ†’mask mapping + fallback.
- Artifacts / paths: `packages/vto-core/src/frame-detection/GlassesSegmenter.ts` (real impl), `.../index.ts` (barrel + SegSession/Options exports), `src/engine/landmark-debug-engine.ts` `ensureRemovalPipeline()` (~L2013, `?vtoModel=` wiring + `glassesSegmenter` state), `test/hermes-verify-t019.unit.test.ts` (6 tests), `extensions/vto/assets/bisenet_glasses.onnx`.
- Decisions: input = `RgbaFrame` (canonical CPU frame; avoids a frame-detectionâ†’frame-removal import cycle â†’ local bilinear/nearest helpers). Inference long side 256 (~4Ã— faster than 512). Model URL-driven like `?vtoLama=` (opt-in; no param = today's behaviour). Did NOT commit the 12.6 MB binary (gitignored; served as an extension asset / host on CDN).
- Verified: `tsc -b` 0 errors, eslint 0 errors, **278/278 tests pass**, widget build succeeds (1 shell chunk). I/O contract matches Rohit's spec field-for-field. **NOT yet run in a browser** â€” ORT/WASM can't execute in node (tests use the injected fake session).
- What Hermes should know next: consuming the mask (segmenter â†’ imprint/removal) is **T021** â€” the segmenter is created + health-logged only right now, contour FrameDetector remains the mask source. On-device browser verification pending (see VTO.md status).

## Definition of done â€” all met
- [x] GlassesSegmenter.ts created â€” compiles with tsc
- [x] ONNX Runtime Web imported, InferenceSession API used (real inference)
- [x] Mask output interface (frame/lens/face Float32Arrays)
- [x] load() + create() factory + shouldRun() + segment() (real)
- [x] ClipEyewearClassifier retired from barrel (mask morphology replaces it)
- [x] tsc clean on vto-core

## Review (Hermes fills this)
- Verdict: done | rework
- Notes:
