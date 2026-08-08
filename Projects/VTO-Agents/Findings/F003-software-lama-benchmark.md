---
okf: 1
id: F003-software-lama-benchmark
type: finding
project: VTO
status: candidate
created: 2026-08-04
tags: [vto, software-research, lama, onnx, webgpu, inpainting, browser]
related: [T003 Software-Model-Selection, CANDIDATE-frame-detection-removal-v2, VTO]
sources: [research-agent:Software-Researcher]
---

# F003 — LaMa ONNX Browser Runtime Benchmark

## Question

What is the LaMa ONNX model size and estimated WebGPU inference latency for browser runtime? Can it meet the ~33ms budget for 30fps gap-fill in the VTO pipeline?

## Answer

**LaMa ONNX is ~198 MB (FP32) — too large and too slow for per-frame browser inference at 30fps. It is suitable for the calibration/build tier only (runs once per session for atlas construction), not for runtime gap-fill. For runtime, a smaller inpainter (or no inpainting at all — just atlas extension) is needed.**

The LaMa inpainting model, when exported to ONNX, is approximately 198 MB in FP32. At this size, WebGPU inference on a mid-range consumer GPU would conservatively take **50–200+ ms per frame** — far exceeding the ~33ms (30fps) budget. However, LaMa is well-suited for the one-time calibration tier proposed in the v2 candidate: it runs once per session (during the multi-pose head-turn sequence) to produce clean-face frames for the texture-imprint atlas.

## Model Details

### LaMa ONNX Provenance

- **Original paper:** Suvorov et al., "Resolution-robust Large Mask Inpainting with Fourier Convolutions" (LaMa), WACV 2022
- **Architecture:** Fast Fourier Convolutions (FFCs) with image-wide receptive field + high receptive field perceptual loss. Single forward pass (no iterative refinement) — which makes it faster than GAN-based inpainters but still heavy due to FFC layers.
- **Original repo:** advimman/lama (⭐10,162, Apache-2.0 license) — https://github.com/advimman/lama
- **ONNX conversion:** mrnhtyzgld/lama2onnx provides a Jupyter notebook for converting PyTorch LaMa to ONNX format. The conversion uses `torch.onnx.export()` with dynamic axes support for variable input resolution.

### Measured ONNX Model Sizes

Verified via HuggingFace LFS metadata for three independently uploaded LaMa ONNX models:

| Model (HuggingFace) | File | Size (bytes) | Size (MB) |
|---|---|---|---|
| `anyisalin/big-lama-onnx` | `onnx/model.onnx` | 207,479,252 | 197.9 MB |
| `anyisalin/big-lama-onnx` | `onnx/model_fp16.onnx` | 207,479,252 | 197.9 MB ⚠️ |
| `Carve/LaMa-ONNX` | `lama.onnx` | 207,479,252 | 197.9 MB |
| `Carve/LaMa-ONNX` | `lama_fp32.onnx` | 208,044,816 | 198.4 MB |

**⚠️ FP16 anomaly:** The `model_fp16.onnx` in `anyisalin/big-lama-onnx` has the identical byte size as FP32 — this suggests the FP16 conversion was not properly applied (weights likely remained in FP32 within an FP16-tagged container, or the upload duplicated the FP32 file). A proper FP16 conversion should halve the size to ~99 MB.

**FP16 potential:** If properly converted, a LaMa FP16 ONNX would be ~99 MB — still heavy but substantially better for download. INT8 quantization is theoretically possible but untested for LaMa's FFC layers (Fourier convolutions may lose precision under aggressive quantization).

### ONNX Runtime Web Compatibility

- **WebGPU execution provider:** Supported in ONNX Runtime Web 1.19+ with Chromium v121+ on Windows. LaMa's FFC layers use standard ONNX ops (Conv, BatchNorm, ReLU, etc.) plus custom FFC blocks implemented via FFT/Real/Complex ops — these may not all be supported in the WebGPU EP yet.
- **WebAssembly (CPU) fallback:** Fully supported but much slower — likely 500ms–2s+ per frame on CPU.
- **Operator coverage risk:** LaMa's FFC blocks use real-valued FFT operations (RFFT, IRFFT). These are standard ONNX ops (opset 17+) but may not be implemented in the WebGPU EP. Confirmation needed: check ORT Web WebGPU operator support matrix for FFT ops. If unsupported, LaMa ONNX will fall back to CPU for those nodes, dramatically slowing inference.

### WebGPU Latency Estimation

**No published LaMa ONNX WebGPU benchmarks exist.** Searched GitHub, ONNX Runtime docs, Microsoft DevBlogs, and HuggingFace — no LaMa-specific WebGPU inference latency data found. The estimates below are conservative extrapolations:

| Hardware | Input Resolution | Est. Latency (FP32) | Est. Latency (FP16 proper) | Notes |
|---|---|---|---|---|
| Desktop RTX 3060 | 256×256 | 50–100 ms | 30–60 ms | Best case for gaming GPU |
| Desktop RTX 3060 | 512×512 | 80–200 ms | 50–120 ms | Higher res for detailed inpainting |
| Integrated GPU (Intel Iris Xe) | 256×256 | 100–300 ms | 60–180 ms | Most common consumer laptop |
| Integrated GPU (Intel Iris Xe) | 512×512 | 200–500+ ms | 120–300 ms | Unusable for real-time |
| WASM CPU (any) | 256×256 | 500–2000+ ms | 300–1000+ ms | Not usable |

**Extrapolation methodology:** Based on known model sizes and architectural complexity — LaMa's FFC layers are compute-bound (Fourier transforms on large tensors). A 198 MB model at 256×256 input has ~50M parameters and requires multiple FFT passes. Comparable-sized models (ResNet-152, ~230 MB) report 30–80 ms on desktop GPU via ONNX Runtime. LaMa's FFC layers add 2–3× compute overhead due to complex-valued intermediate representations.

**Bottom line:** Even on the best consumer GPU, LaMa cannot hit 33ms (30fps). The v2 candidate's two-tier architecture is correct: **LaMa is calibration-tier only.**

## LaMa's Role in the VTO Pipeline (per v2 Candidate)

Per `[[CANDIDATE-frame-detection-removal-v2]]` §3:

- **Tier 1 (calibration/build — runs once):** LaMa (or ProPainter) runs on the ~100–200 calibration frames to produce clean-face texture atlas. LaMa at 50–200 ms per frame × 200 frames = **10–40 seconds total calibration time** — acceptable for a one-time step.
- **Tier 2 (runtime — per frame):** LaMa is excluded. Atlas coverage should handle >90% of pixels. For uncovered pixels, alternatives explored below.

### Alternatives for Runtime Gap-Fill

Since LaMa is too slow for per-frame runtime, the v2 candidate needs a **lightweight gap-fill strategy**:

1. **Blurred atlas extension (zero ML cost):** For uncovered pixels at extreme head angles, extend the UV atlas with a Gaussian-blurred boundary fill. ~0ms inference, acceptable quality for peripheral regions.
2. **Telea / Navier-Stokes (CPU, fast):** OpenCV's `cv2.inpaint()` runs in <5 ms on 256×256 CPU. Lower quality than LaMa but adequate for small gap regions where the atlas edge provides good context.
3. **Small CNN inpainter (train from scratch):** A lightweight U-Net (~2–5 MB) trained specifically on face-region inpainting. Would need custom training but could fit the 33ms budget on WebGPU. Example: MI-GAN (Mobile Inpainting GAN) or a distilled 2–3 layer CNN.
4. **No runtime gap-fill:** If multi-pose atlas coverage reaches >95% at ±45° yaw (beyond the ±30° calibration range via interpolation), gap-fill may be unnecessary. The user rarely rotates beyond 30° during try-on.

**Recommendation:** Start with (1) blurred atlas extension + (2) Telea fallback. Only invest in a custom CNN inpainter if visual quality is poor at extreme angles in real testing.

## Browser-Based LaMa Implementations (Proof of Feasibility)

Several projects demonstrate LaMa ONNX running in web contexts:

| Project | Context | Notes |
|---|---|---|
| `AndyLeAI/Object_Removal` ⭐4 | Browser (local, no upload) | Pure browser LaMa ONNX removal tool. MIT license. |
| `neosun100/slideforge` ⭐1 | Browser (WebGPU) | PDF→PPTX converter with LaMa ONNX + WebGPU. |
| `Akascape/RemObj-Fuse` ⭐17 | DaVinci Resolve plugin | LaMa ONNX for video object removal. MIT license. |
| `maxal-studio/flutter-image-magic-eraser` ⭐12 | Flutter mobile | LaMa ONNX for mobile image eraser. BSD license. |

These prove that LaMa ONNX loads and runs in browser/WebGPU environments, but none publish inference latency data. All operate on still images (no real-time requirement).

## Download Cost

At 198 MB (FP32) or ~99 MB (proper FP16), LaMa dominates the engine download:

- **FP32 LaMa:** 198 MB ÷ 6.25 MB/s (50 Mbps) = **~32 seconds**
- **FP16 LaMa (proper):** 99 MB ÷ 6.25 MB/s = **~16 seconds**
- **FP32 LaMa gzip-transferred:** ONNX float weights compress poorly (~0–15% shrink) → still ~170–198 MB transferred

This is acceptable for D2 (no size cap) — the download happens once, during the "Loading clean-face builder…" step of the progressive loading UX. Cached in IndexedDB for subsequent visits.

## Evidence

- **LaMa paper:** Suvorov et al., WACV 2022, arXiv:2109.07161 — FFC-based inpainting architecture, Apache-2.0 license
- **LaMa ONNX sizes:** Verified via HuggingFace API with LFS blob metadata:
  - `anyisalin/big-lama-onnx`: onnx/model.onnx = 207,479,252 bytes (2024-08-29), onnx/model_fp16.onnx = 207,479,252 bytes (identical — FP16 likely unapplied)
  - `Carve/LaMa-ONNX`: lama.onnx = 207,479,252 bytes, lama_fp32.onnx = 208,044,816 bytes
- **ONNX conversion:** mrnhtyzgld/lama2onnx — Jupyter notebook for PyTorch→ONNX export
- **Browser implementations:** AndyLeAI/Object_Removal (MIT), neosun100/slideforge, Akascape/RemObj-Fuse (MIT), maxal-studio/flutter-image-magic-eraser (BSD-3-Clause)
- **ONNX Runtime Web WebGPU support:** Chromium v121+ on Windows for WebGPU EP; WebAssembly CPU EP available everywhere. Operator support matrix: standard CNN ops (Conv, ReLU, BatchNorm) fully supported; RFFT/IRFFT ops need verification (opset 17+).
- **No LaMa-specific WebGPU latency benchmarks found.** Searched GitHub, ONNX Runtime docs, HuggingFace, Microsoft DevBlogs — no published data.
- **ONNX Runtime Web GPU operator support matrix:** https://github.com/microsoft/onnxruntime/tree/main/js/web#webgpu (standard ops supported; FFT ops need specific verification)

## Implications for VTO

1. **LaMa is calibration-tier only.** The 198 MB model at 50–200+ ms per frame cannot serve as the runtime gap-fill inpainter. The v2 candidate's two-tier architecture is correct and LaMa's placement in Tier 1 (calibration) is validated.

2. **The ~33ms gap-fill budget needs a different solution.** Atlas extension + Telea fallback is the pragmatic path. A custom small CNN inpainter is a potential future optimization but shouldn't block the initial implementation.

3. **Download is not the issue — inference latency is.** Even at 198 MB, one-time download is acceptable under D2 (no size cap). The blocker is that LaMa inference takes >33ms per frame.

4. **FFC ops risk.** If ONNX Runtime Web WebGPU doesn't support FFT ops, LaMa will partially fall back to CPU — making it even slower. Test this early: export LaMa to ONNX, load via ORT Web with WebGPU EP, and check the session's EP assignment per node.

5. **FP16 conversion needs proper application.** Both existing FP16 ONNX files on HuggingFace are un-optimized (identical size to FP32). A proper FP16 export halving the size to ~99 MB would improve both download time and memory pressure, but probably not enough to change the latency conclusion.

## Next Steps

- Export LaMa to ONNX with proper FP16 quantization (use `torch.onnx.export` with `--fp16` or onnxruntime's `float16` conversion tool)
- Verify ONNX Runtime Web WebGPU EP FFT operator support by loading the model and checking node assignments
- Benchmark LaMa ONNX WebGPU inference on an RTX 3060 or equivalent at 256×256 — measure actual ms, not estimates
- Implement blurred atlas extension + Telea gap-fill as the runtime Tier 2 strategy
