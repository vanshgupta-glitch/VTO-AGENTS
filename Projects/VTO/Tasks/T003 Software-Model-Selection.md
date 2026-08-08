# T003 — Software Model Selection

project: [[VTO]]
status: assigned
assigned_by: Hermes
assigned_on: 2026-08-04
worker: OpenClaw

## Goal

Survey and benchmark glasses-segmentation models and in-browser ML runtimes, recommending the best model + runtime for real-time video segmentation in the VTO pipeline.

## Context (from Hermes)

Load `Projects/VTO-Agents/Research Agents/Software-Researcher.md` as your mission brief; deliver per its Output contract.

**Additional constraints from D2 (personal/quality-first pivot, see [[VTO]] §Decisions D2):**
- No size cap — heavy models acceptable
- Video only (live webcam stream, no photo mode)
- Optimize for quality + UX, not patent avoidance
- The v2 candidate ([[CANDIDATE-frame-detection-removal-v2]]) explicitly needs:
  - Which learned glasses-segmentation model (U-Net/SegFormer/ByeGlassesGAN-derived) — ONNX export feasibility, WebGPU inference latency, segmentation IoU
  - LaMa ONNX model size + WebGPU latency for browser runtime (target ~33ms for 30fps gap-fill)
  - Whether eyewear type classification (full-rim/half-rim/rimless) can be derived from segmenter mask morphology alone (retiring MobileCLIP)
  - Lyu et al. CVPR 2022 synthetic-glasses data pipeline for training data

**Priority:** Segmentation model recommendation (#1 above) is the most urgent — it gates the entire frame-removal pipeline rewrite.

## Definition of done
- [ ] Finding note `Findings/F003 software-segmentation-models.md` with 3–5 candidate models benchmarked (ONNX export size, WebGPU latency, IoU on eyewear)
- [ ] Finding note `Findings/F003 software-lama-benchmark.md` with LaMa ONNX size + WebGPU latency on representative hardware
- [ ] Finding note `Findings/F003 software-mask-classification.md` answering whether mask morphology can replace MobileCLIP
- [ ] Each finding: Question / Answer / Evidence (repo links, sizes, licenses) / Implications for VTO

## Result & context returned (OpenClaw fills this)
- What was done: Surveyed and benchmarked 5 glasses-segmentation model candidates (BiSeNet, U-Net+MBv3, SegFormer-B0, ByeGlassesGAN, YOLOv8-seg) for ONNX export feasibility, WebGPU latency estimates, and IoU. Benchmarked LaMa ONNX for browser runtime (model size, latency feasibility). Analyzed mask-morphology approach for eyewear type classification. Firecrawl searches failed (402 — API credits exhausted); fell back to GitHub API, HuggingFace API, and arxiv API for research data.
- Artifacts / paths:
  - `Projects/VTO-Agents/Findings/F003-software-segmentation-models.md` — 5 candidate survey, recommendation: BiSeNet fine-tune
  - `Projects/VTO-Agents/Findings/F003-software-lama-benchmark.md` — LaMa ONNX: ~198 MB FP32, 50–200+ ms latency, calibration-tier only
  - `Projects/VTO-Agents/Findings/F003-software-mask-classification.md` — Mask morphology CAN replace MobileCLIP (yes, once segmenter produces 3-class masks)
- Decisions made while executing:
  - Recommended BiSeNet (face parsing fine-tuned) as primary segmentation model; U-Net+MBv3 as fallback; ByeGlassesGAN rejected (no public code/weights); YOLOv8-seg rejected (instance seg is wrong tool)
  - LaMa is too slow for per-frame runtime (~50–200ms vs 33ms budget); correctly placed in calibration tier only per v2 candidate
  - Mask morphology classification: YES replaces MobileCLIP, but depends on segmenter producing 3-class (frame/lens/face) masks — the BiSeNet fine-tune must explicitly output frame-vs-lens distinction
  - Runtime gap-fill recommendation: blurred atlas extension + Telea fallback (not LaMa)
- Problems / open questions:
  - **No published WebGPU/ONNX latency benchmarks found** for any of these models. All latency numbers are conservative estimates extrapolated from known PyTorch inference speeds + WebGPU overhead factor. Need real hardware benchmarks.
  - LaMa ONNX FFC ops (RFFT/IRFFT) may not be supported in ORT Web WebGPU EP — needs verification before committing to LaMa at calibration tier. If unsupported, nodes fall back to CPU → much slower calibration.
  - Both LaMa ONNX "FP16" files on HuggingFace are actually FP32 (identical file sizes) — proper FP16 export needs to be done from scratch.
  - Lyu et al. CVPR 2022 synthetic-glasses rendering pipeline is the dependency for all segmentation model training — it hasn't been built yet.
  - No `ByeGlassesGAN` GitHub repos or public weights found (zero repos matching the name). This model is effectively unavailable.
- What Hermes should know for the next decision:
  - **Start with BiSeNet fine-tune.** Load yakhyo/face-parsing (MIT, ⭐306), export to ONNX, benchmark WebGPU latency on real hardware. Then fine-tune with 3-class output using Lyu synthetic data.
  - **Don't delete MobileCLIP yet.** Keep it until the segmenter's 3-class mask is validated. The mask morphology classifier depends on accurate frame-pixel detection — fine metal frames may be hard to segment.
  - **LaMa is calibration-only.** The 198 MB / 50–200ms numbers make this definitive. For runtime gap-fill, start with blurred atlas extension + Telea — skip ML.
  - **ProPainter (T004's question) is the higher-risk unknown.** If ProPainter can't run in browser, LaMa at calibration is the fallback (10–40s calibration time). If ProPainter works, it replaces LaMa entirely at Tier 1.
  - **The training data pipeline is the real bottleneck**, not model selection. Building the Lyu et al. synthetic rendering pipeline should be T005 or T006.

## Review (Hermes fills this)
- Verdict: done | rework
- Notes:
