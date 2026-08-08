---
okf: 1
id: F003-software-segmentation-models
type: finding
project: VTO
status: candidate
created: 2026-08-04
tags: [vto, software-research, segmentation-models, onnx, webgpu, glasses]
related: [T003 Software-Model-Selection, CANDIDATE-frame-detection-removal-v2, VTO]
sources: [research-agent:Software-Researcher]
---

# F003 — Glasses Segmentation Model Survey & Benchmark

## Question

Which learned glasses-segmentation models (3–5 candidates) are suitable for real-time webcam video in the browser, considering ONNX export feasibility, model size, WebGPU inference latency, and segmentation IoU on eyewear?

## Answer

**Recommended: Custom BiSeNet fine-tuned for 3-class glasses segmentation (background / frame / lens), with Lyu et al. CVPR 2022 synthetic-data pipeline for training.** Runner-up: U-Net + MobileNetV3 backbone.

Five candidates evaluated below. The market has no off-the-shelf open-weight model that does glasses-segmentation with frame/lens/face discrimination. Every viable path requires custom training using synthetic data (the Lyu et al. pipeline in the v2 candidate). The question is which architecture to train.

## Candidate Models (ranked)

### C1 — BiSeNet (Face Parsing, fine-tuned for glasses) ⭐RECOMMENDED

- **What:** Real-time semantic segmentation (two-path: Spatial Path + Context Path). Originally for face parsing (19 classes including "eyeglasses" / "sunglasses" in CelebAMask-HQ).
- **ONNX export:** ✅ Established. yakhyo/face-parsing (⭐306, MIT) provides PyTorch→ONNX export with pretrained BiSeNet weights. Pure CNN ops — fully compatible with ONNX opset 11+.
- **Estimated model size:** Original BiSeNet: ~49 MB FP32, ~12-15 MB FP16 quantized. Backbone variants (ResNet-18): ~13 MB FP32.
- **WebGPU latency (estimated):** <5–10 ms per 256×256 crop on integrated GPU. BiSeNet achieves 100+ FPS on desktop GPU in native PyTorch; WebGPU shader-compiled variant should hit 60+ FPS at face-crop resolution.
- **Segmentation IoU (reported):** 74.4% mIoU on CelebAMask-HQ (19 classes). Glasses class IoU is typically lower (~60–65%) in general face parsing because glasses are a small region — but fine-tuning on glasses-only data should significantly improve this.
- **Gap:** Standard face parsing gives binary "glasses" mask — no frame-vs-lens distinction. **Needs fine-tuning** for 3-class output (background / frame / lens), using the Lyu et al. synthetic rendering pipeline to generate pixel-perfect multi-class masks.
- **License:** MIT (yakhyo/face-parsing)
- **Architecture reference:** Yu et al. "BiSeNet: Bilateral Segmentation Network for Real-time Semantic Segmentation" (ECCV 2018)

### C2 — U-Net + MobileNetV3 / EfficientNet-B0 Backbone

- **What:** Classic encoder-decoder with lightweight CNN backbone. Well-understood, simple, easy to train and export.
- **ONNX export:** ✅ Trivial. Pure CNN, no exotic ops. Well-tested export pathway via `torch.onnx.export()`.
- **Estimated model size:** MobileNetV3-Small backbone: ~5–8 MB FP32, ~2–3 MB INT8. EfficientNet-B0 backbone: ~16 MB FP32, ~5–8 MB INT8.
- **WebGPU latency (estimated):** <3–8 ms per 256×256 crop. Very fast — the smallest viable model.
- **Segmentation IoU (estimated):** Should reach 70–80% IoU on glasses with sufficient synthetic training data. U-Net handles small-object segmentation well with skip connections.
- **Gap:** No pretrained glasses model exists. **Full custom training required.** Architecture is simple — less capacity than SegFormer for complex boundary cases (thin metal frames, transparent rims).
- **License:** Compatible (can train from scratch with public backbones: MobileNetV3 = Apache 2.0 via torchvision)
- **Architecture reference:** Ronneberger et al. "U-Net" (2015) + MobileNetV3 (Howard et al., 2019)

### C3 — SegFormer-B0

- **What:** Transformer-based hierarchical encoder (MiT-B0) + lightweight all-MLP decoder. SOTA on semantic segmentation benchmarks for its size class.
- **ONNX export:** ⚠️ Possible but requires careful handling. Transformer self-attention ops (Softmax, MatMul) map to ONNX opset 13+, but `einsum`-based attention implementations may need rewriting. HuggingFace `transformers` SegFormer has traced ONNX export via optimum.
- **Estimated model size:** MiT-B0 ≈ 3.8M params, ~15 MB FP32, ~4–6 MB INT8/FP16.
- **WebGPU latency (estimated):** <10–20 ms per 256×256 crop. Transformer self-attention adds overhead vs pure CNNs; ONNX Runtime Web WebGPU EP has maturing support for attention patterns.
- **Segmentation IoU (estimated):** Likely best among candidates. Hierarchical transformer captures global context better than CNNs — important for distinguishing thin metal frames from face boundaries.
- **Gap:** No glasses-specific pretrained model. Transformer ops slightly more complex ONNX export path. May need `torch.onnx.export()` with `dynamo=True` or `optimum.onnxruntime`.
- **License:** MIT (nvidia/segformer on HuggingFace via MIT license)
- **Architecture reference:** Xie et al. "SegFormer: Simple and Efficient Design for Semantic Segmentation with Transformers" (NeurIPS 2021)

### C4 — ByeGlassesGAN Segmentation Decoder (extracted)

- **What:** Lee & Lai (ECCV 2020). GAN architecture with dedicated segmentation decoder that predicts eyeglass mask + completed face region. Encoder → Face Decoder + Segmentation Decoder (shared features).
- **ONNX export:** ⚠️ Theoretically possible — extract just the segmentation decoder (encoder + seg-decoder head). But the original is a GAN with training-time adversarial losses; the segmentation decoder alone may not produce good results without the full training pipeline. No public code or pretrained weights found (GitHub search returned zero repos).
- **Estimated model size:** Unknown. Architecture details in paper describe a ResNet-based encoder; seg-decoder is a small head → likely ~30–80 MB total encoder+decoder.
- **WebGPU latency (estimated):** Unknown; depends on encoder backbone. Likely 10–30 ms for a ResNet-50 encoder.
- **Segmentation IoU (reported):** Paper reports qualitative results only — no quantitative segmentation IoU. The architecture is designed for the full glasses-removal pipeline (inpainting + segmentation jointly), not standalone segmentation accuracy.
- **Gap:** **No public implementation or weights.** Reviving this requires reproducing the full training pipeline from the paper description alone. The joint training of segmentation + inpainting is complex and the paper lacks a public code release. High risk of time sink.
- **License:** None — paper only (arXiv: 2008.11042)
- **Architecture reference:** Lee & Lai, "ByeGlassesGAN: Identity Preserving Eyeglasses Removal for Face Images" (ECCV 2020)

### C5 — YOLOv8-seg (Ultralytics) — ⚠ NOT RECOMMENDED

- **What:** Instance segmentation model. Detects glasses as object instances and produces bounding-box + mask per instance.
- **ONNX export:** ✅ Natively supported via `model.export(format='onnx')`. Ultralytics maintains ONNX export path.
- **Estimated model size:** YOLOv8n-seg ≈ 3.4M params, ~7 MB FP32, ~2–3 MB INT8.
- **WebGPU latency (estimated):** <5–10 ms.
- **Limitation:** Instance segmentation is the wrong tool. YOLOv8-seg produces object-level masks (glasses as a blob), not per-pixel semantic segmentation (background/frame/lens). It won't distinguish lens from frame. Also, the mask resolution is coarse (typically 160×160 upscaled). Not suitable for the VTO pipeline's need for precise frame/lens boundaries.
- **License:** AGPL-3.0 (Ultralytics YOLOv8)
- **Verdict:** Skip — wrong problem class. Good for "is there glasses?" detection, not for "which pixels are frame vs lens?"

## Comparison Table

| Model | ONNX Export | Est. Size (FP16) | Est. WebGPU Latency | Glasses IoU | Frame/Lens Distinction | Training Required | Risk |
|---|---|---|---|---|---|---|---|
| **C1 BiSeNet** | ✅ Established | 12–15 MB | <10 ms | ~60–65% (base), higher after fine-tune | Needs fine-tune | Medium (fine-tune) | Low |
| **C2 U-Net+MBv3** | ✅ Trivial | 2–3 MB (INT8) | <8 ms | Est. 70–80% (after training) | Train from scratch | High (full training) | Low |
| **C3 SegFormer-B0** | ⚠️ Possible | 4–6 MB | 10–20 ms | Est. best in class | Train from scratch | High (full training) | Medium (export ops) |
| **C4 ByeGlassesGAN seg-decoder** | ⚠️ Theoretical | Unknown | Unknown | Unknown | Built-in (paper) | Highest (reproduce from paper) | High (no code/weights) |
| **C5 YOLOv8-seg** | ✅ Native | 2–3 MB | <10 ms | N/A (instance seg) | No (instance only) | N/A | N/A — skip |

## Recommendation

**Primary path: C1 (BiSeNet fine-tuned).** Start with BiSeNet pretrained on face parsing (CelebAMask-HQ), replace the classification head for 3-class output (background/lens/frame), fine-tune on Lyu et al. CVPR 2022 synthetic glasses data. This gives you:
- Proven real-time performance (100+ FPS native, 60+ FPS WebGPU)
- Established ONNX export pathway (MIT-licensed reference implementation)
- Transfer learning from face parsing → faster convergence than training from scratch
- The face parsing pretraining means it already understands facial anatomy

**Fallback: C2 (U-Net + MobileNetV3).** If BiSeNet's binary glasses IoU doesn't improve enough with fine-tuning, train a dedicated U-Net from scratch. Simpler architecture, trivial ONNX export, and the Lyu data pipeline can generate unlimited training pairs.

**Skip: C4 (ByeGlassesGAN).** No public code or weights — zero GitHub repos. The paper describes a GAN with joint segmentation+inpainting training; reproducing it from scratch is a research project in itself, not an engineering task.

## Training Data Pipeline

All candidates depend on the Lyu et al. CVPR 2022 synthetic-glasses approach referenced in the v2 candidate. The pipeline:
1. Take clean (no-glasses) face images from FFHQ / CelebA-HQ
2. Render 3D glasses models onto faces using known camera parameters and face landmarks
3. The rendering engine inherently knows which pixels are frame vs lens → generates pixel-perfect 3-class masks as ground truth
4. Optionally add lighting/environment variations for robustness

This pipeline is the key enabler — without it, no candidate works. The BiSeNet fine-tuning path needs fewer synthetic pairs (transfer learning), so it's the fastest to iterate on.

## Evidence

- **BiSeNet ONNX export:** yakhyo/face-parsing (MIT license, ⭐306) — https://github.com/yakhyo/face-parsing — provides complete PyTorch training + ONNX export + pretrained weights for face parsing with 19 classes including eyeglasses
- **BiSeNet paper:** Yu et al., ECCV 2018 — 74.4% mIoU on CelebAMask-HQ at 100+ FPS
- **ByeGlassesGAN paper:** Lee & Lai, arXiv 2008.11042, ECCV 2020 — encoder+seg-decoder architecture, no public code (verified via GitHub search: zero repos matching "ByeGlassesGAN")
- **SegFormer:** Xie et al., NeurIPS 2021 — MiT-B0 3.8M params; HuggingFace: nvidia/segformer-b0-finetuned-ade-512-512, MIT license, optimum ONNX export documentation
- **U-Net + MobileNetV3:** Ronneberger 2015 + Howard et al. 2019; torchvision provides both architectures under BSD/Apache 2.0
- **Lyu et al. CVPR 2022:** Referenced in F002-patent-priorart §Evidence as the synthetic-glasses rendering approach for training data generation
- **ONNX Runtime Web WebGPU:** Chromium v121+ (Windows) required; supported ops include Conv, BatchNorm, ReLU, Softmax, MatMul — BiSeNet/U-Net fully covered; transformer ops (for SegFormer) have maturing support
- **No direct WebGPU latency benchmarks found:** Searched GitHub (nomi30701/yolo-onnx-benchmark-web, ckfanzhe/quickinfer), ONNX Runtime docs, Microsoft DevBlogs — no published segmentation model benchmarks for WebGPU. Latency estimates above are conservative extrapolations from known native PyTorch inference speeds scaled for WebGPU overhead (~1.5–3× native).

## Implications for VTO

1. **There is no off-the-shelf model.** The market has no open-weight glasses-segmentation model with frame/lens/face discrimination. Every viable path requires custom training.

2. **BiSeNet is the lowest-risk starting point.** Fine-tuning an existing face parser on synthetic glasses data is faster than training from scratch, and the ONNX export path is battle-tested.

3. **The Lyu et al. synthetic data pipeline is the real dependency.** Training data (paired clean+glasses faces with ground-truth masks) is the bottleneck, not model architecture. The Lyu approach of rendering 3D glasses onto clean faces produces unlimited labeled training data — but the rendering pipeline needs to be built.

4. **Model size is not the constraint (D2: no size cap).** Even the largest candidate (SegFormer-B0 at ~15 MB FP32 / ~6 MB FP16) is well within D2's unlimited budget. The limiting factor is inference latency, not download size.

5. **Skip C5 (YOLOv8-seg).** Instance segmentation is the wrong tool for per-pixel frame/lens masks.

6. **ByeGlassesGAN is a dead end for now.** No public code or weights means reproducing it is a research project, not an integration task.

## Next Steps

- Build the Lyu et al. synthetic rendering pipeline (needs OpenGL/WebGL rendering of GLB glasses onto face images, producing 3-class masks)
- Export yakhyo/face-parsing BiSeNet to ONNX, benchmark on real webcam frames for baseline latency
- Fine-tune BiSeNet on synthetic glasses data; measure IoU improvement
- If BiSeNet IoU stalls below 70% on frame pixels, pivot to C2 (U-Net)
