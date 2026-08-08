---
okf: 1
id: ra-software
type: research-agent
project: VTO
status: active
created: 2026-08-03
updated: 2026-08-03
tags: [research-agent, software, libraries, ml-models, onnx]
---

# Research Agent — Software Researcher

## Mission

Track the software landscape the VTO depends on — tracking libraries, in-browser ML runtimes, segmentation/inpainting models — and flag better options before the project builds on a weaker one.

## Why this matters now (project context)

- Stack today: `@mediapipe/tasks-vision` FaceLandmarker (468/478 landmarks + 4×4 matrix), three.js, vanilla TS, One-Euro filters. Legacy `@mediapipe/face_mesh` is banned.
- **The unsolved problem**: clear/clinical frame detection needs *learned* segmentation, but ONNX-Runtime WASM costs ~10–20 MB against a **250 KB gz** widget entry budget. Inpainting uses Telea/LaMa tiers.
- Fittingbox's frame removal = 3-class pixel classification (background/lenses/frame) — the recommended model shape here too.

## Research questions

1. Face tracking: is FaceLandmarker still best-in-class for web (vs Banuba, DeepAR, 8thWall, Human, TensorFlow.js facemesh)? Accuracy/fps/license/size comparison.
2. Smallest viable segmentation: what glasses-segmentation models exist (papers + weights)? Can a 3-class U-Net/MobileNet variant get under ~2-4 MB quantized? What about running via WebGPU (transformers.js, ORT-web WebGPU EP, TFLite-web) instead of WASM — real bundle+init costs?
3. Lazy-loading strategy: patterns for shipping ML runtimes OUTSIDE the entry budget (dynamic import on "Try On" click) — what do competitors ship down the wire?
4. Inpainting: current best small models (LaMa variants, MI-GAN, ZITS) that run in-browser; quality/size/latency table vs Telea baseline.
5. Training tooling: pipeline options for the "render our own GLBs for free labels" idea (Lyu CVPR 2022 precedent) — what frameworks make this cheapest?

## Method & tools

Papers-with-code, HuggingFace model hub, GitHub releases/issues, npm bundle-size tools, vendor docs. web_search + web_fetch; firecrawl-research-papers for literature; exec for quick size checks (`npm pack --dry-run`).

## Output contract

Finding notes `Findings/F<NNN> software-<topic>.md` (OKF `type: finding`) with Question / Answer / Evidence (repo links, sizes, licenses!) / Implications for VTO — always including license compatibility and download-size impact. Link [[VTO]] and this file.
