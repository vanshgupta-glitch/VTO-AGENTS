---
okf: 1
id: F004-rendering-propainter-feasibility
type: finding
project: VTO
status: final
created: 2026-08-04
updated: 2026-08-04
tags: [vto, rendering, propainter, e2fgvi, video-inpainting, onnx, browser-inference]
task: T004 Rendering-Delivery-Feasibility
sources: [sczhou/ProPainter, MCG-NKU/E2FGVI, nmg-vto codebase]
---

# F004 — ProPainter/E2FGVI In-Browser Feasibility

## Question

Can ProPainter or E2FGVI be exported to ONNX and run in the browser (even if slow) for a ~100-frame calibration clip? Is there a lighter variant or distillation that runs in <5 seconds?

## Answer

**Neither ProPainter nor E2FGVI can run in the browser via ONNX Runtime Web in 2026.** ProPainter's main model alone is 157.8 MB (plus two supporting models totaling ~42 MB = ~199 MB combined), requires flow-based multi-frame propagation with a transformer architecture, and uses CUDA-optimized PyTorch operators that have no ONNX Runtime Web equivalent. E2FGVI is lighter (lowest FLOPs among SOTA, 0.12s/frame on a Titan XP GPU at 432×240) but still processes multi-frame clips jointly through flow-guided modules. Neither has an existing ONNX export, and the architectural gap (flow computation, transformer attention, clip-level temporal propagation) makes WebGPU inference infeasible even if an export existed. No lighter variant or distillation exists that preserves quality.

**Recommendation: Fall back to per-frame LaMa ONNX for calibration (already in the codebase as `LamaInpainter.ts`) and drop the ProPainter tier from the two-tier architecture.** ProPainter for calibration is an architectural dead end — the gap between "seconds on a Titan XP" and "browser WebGPU" is too wide to bridge with any realistic compression.

## Evidence

### ProPainter Architecture & Scale

- **Model weights:** ProPainter.pth = 157.8 MB, recurrent_flow_completion.pth = 20.3 MB, raft-things.pth = 21.1 MB. **Total: ~199 MB.**
- **Architecture:** Flow-based propagation (RAFT optical flow) + flow completion network + transformer-based inpainting on completed flows. Processes clips of 50-80 frames jointly (sub-video window).
- **GPU memory (720×480, fp32):** 11 GB for 50 frames, 13 GB for 80 frames. At fp16: 7 GB / 8 GB.
- **Inference time:** Not published as per-frame; processes full clips. Based on the architecture (RAFT flow + flow completion + transformer propagation), estimated at seconds-per-clip on a modern dGPU, not milliseconds-per-frame.
- **ONNX export:** No existing ONNX export in the repository or ecosystem. Key blockers: RAFT flow computation uses custom CUDA correlation layers (`CorrBlock`, `corr.py`), the flow completion uses 3D deformable convolutions (`mmcv.ops.ModulatedDeformConv2d`), and the ProPainter transformer uses custom attention with flow-guided feature warping. None of these operators have ONNX Runtime Web equivalents.
- **Community projects:** "Faster ProPainter" exists but only for PyTorch (speedups via resolution reduction and neighbor-length tuning, not architectural distillation). No ONNX/WebGPU port.

### E2FGVI Architecture & Scale

- **Speed:** 0.12 seconds per frame on Titan XP at 432×240 — the fastest among SOTA video inpainting (CVPR 2022).
- **FLOPs:** Lowest among all compared SOTA methods.
- **Architecture:** Flow-guided: optical flow between neighboring frames → flow-guided feature propagation → temporal focal transformer. Still processes multi-frame windows, not single frames.
- **E2FGVI-HQ:** Handles arbitrary resolution, slightly better quality. Same architecture, just inference resolution-adaptive.
- **ONNX export:** No existing ONNX export. Similar blockers to ProPainter: flow computation (custom CUDA), temporal propagation modules. Though simpler than ProPainter (no iterative refinement), the flow-guided propagation chain still requires operators not available in ONNX Runtime Web.
- **Model size:** E2FGVI-CVPR22.pth and E2FGVI-HQ-CVPR22.pth downloadable via Google Drive (size not published in repo — likely 100-200 MB based on similar SOTA inpainting models).

### ONNX Runtime Web Constraints

The current `LamaInpainter.ts` uses ONNX Runtime Web v1.27 with WASM backend (no WebGPU backend used for LaMa — ORT WebGPU support for custom ops is still maturing). ONNX Runtime Web supports standard CNN ops (conv, bn, relu, upsample) used by LaMa's FFC (Fast Fourier Convolution) architecture. Video inpainting models add flow computation (correlation volumes, warping grids) and temporal attention (cross-frame feature gathering) that go far beyond the ONNX Runtime Web op set. Even with WebGPU backend, the memory footprint of loading a >150 MB ONNX model with intermediate flow/feature tensors would exceed browser limits (typically 2-4 GB WebGPU buffer total).

### What About Quantization / Distillation?

- **FP16 halves memory but doesn't change architecture:** ProPainter README offers `--fp16` for 720×480: 19 GB → 13 GB for 50 frames. This helps GPU but doesn't help browser because the operators still don't exist.
- **No architectural distillation exists:** Neither model has a "lite" variant. "Faster ProPainter" is resolution/stride tuning, not a smaller model.
- **Knowledge distillation to a lighter architecture:** Theoretically possible (train a small U-Net to mimic ProPainter outputs) but requires substantial research effort and training data. No published work does this.

### Why Per-Frame LaMa Is Sufficient for Calibration

The calibration clip's purpose is to build a clean-face texture atlas for the texture-imprint cover. LaMa inpainting each calibration frame independently produces plausible per-frame results. While ProPainter's temporal propagation would reduce flicker between frames, the texture-imprint's confidence-weighted EMA blending (`CoverageAtlas.conf` ratchets up, newer imprints blend via `w/(w+C)`) already smooths out per-frame variation. The multi-pose capture (center, ±30° yaw, ±15° pitch over ~5s) provides coverage diversity; LaMa's per-frame quality is adequate for atlas construction, especially with the improved segmenter mask from the proposed `GlassesSegmenter.ts`.

## Implications for VTO

1. **Drop ProPainter/E2FGVI from the architecture entirely.** The two-tier inpainting architecture from [[CANDIDATE-frame-detection-removal-v2]] should be revised to: **Tier 1 = per-frame LaMa ONNX during calibration** (already implemented in `LamaInpainter.ts`), **Tier 2 = LaMa/Telea for runtime gap-fill** (unchanged).
2. **The calibration inpainting module (`CalibrationInpainter.ts`)** should be a thin wrapper that runs the existing `LamaInpainter` on each calibration frame sequentially, not a ProPainter integration.
3. **Model download size scenario (b)** from the v2 candidate is moot: there is no ProPainter ONNX to download, so the calibration-tier model download adds 0 bytes beyond the LaMa ONNX already planned for runtime.
4. **Quality impact:** Per-frame LaMa lacks temporal coherence, but the texture-imprint's EMA blending compensates. The segmenter improvement (learned per-pixel mask vs. geometric contour) has far more quality impact than video inpainting would — focus engineering effort there.
5. **Future: if ONNX Runtime Web adds flow/attention ops and WebGPU memory grows, revisit.** Not within the current project horizon.
