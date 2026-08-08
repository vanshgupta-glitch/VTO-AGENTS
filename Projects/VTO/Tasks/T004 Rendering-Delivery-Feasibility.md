# T004 — Rendering Delivery Feasibility

project: [[VTO]]
status: assigned
assigned_by: Hermes
assigned_on: 2026-08-04
worker: OpenClaw

## Goal

Determine in-browser feasibility of ProPainter/E2FGVI for calibration-phase video inpainting, benchmark the full live-webcam pipeline FPS, and resolve the GLB compression contradiction.

## Context (from Hermes)

Load `Projects/VTO-Agents/Research Agents/Rendering-Researcher.md` as your mission brief; deliver per its Output contract.

**Additional constraints from D2 (personal/quality-first pivot, see [[VTO]] §Decisions D2):**
- No size cap — heavy models acceptable
- Video only (live webcam stream, no photo mode)
- Optimize for quality + UX

**The v2 candidate ([[CANDIDATE-frame-detection-removal-v2]]) explicitly needs:**
- ProPainter/E2FGVI ONNX export feasibility and in-browser inference time for a ~100-frame calibration clip
- Whether a lighter variant/distillation exists that runs in <5 seconds
- Multi-pose atlas coverage quality at extreme angles (beyond ±30° yaw calibration range)
- Full pipeline FPS benchmark on a real device (MediaPipe + three.js + segmenter + texture-imprint + optional LaMa gap-fill)

**Priority:** ProPainter feasibility (#1) → FPS benchmark (#2) → atlas quality (#3) → GLB pipeline (from the brief). The ProPainter question gates whether we ship the two-tier inpainting architecture or fall back to pure LaMa.

## Definition of done
- [ ] Finding note `Findings/F004 rendering-propainter-feasibility.md` — ONNX export + browser inference time for ProPainter/E2FGVI, lighter variant options
- [ ] Finding note `Findings/F004 rendering-pipeline-fps.md` — full pipeline benchmark on a real device with live webcam (MediaPipe + three.js + segmenter + texture-imprint + LaMa gap-fill)
- [ ] Finding note `Findings/F004 rendering-atlas-coverage.md` — coverage estimates at extreme angles, seam visibility analysis
- [ ] Finding note `Findings/F004 rendering-glb-pipeline.md` — decoder economics (Draco/Meshopt), fit-safe optimization recipe, 40 MB bake root-cause
- [ ] Each finding: Question / Answer / Evidence / Implications for VTO

## Result & context returned (OpenClaw fills this)
- What was done:
  - Researched ProPainter (sczhou/ProPainter, ICCV 2023) and E2FGVI (MCG-NKU/E2FGVI, CVPR 2022) architectures, model sizes, GPU requirements, and ONNX export feasibility via GitHub API
  - Analyzed the nmg-vto codebase: `GlassesRenderer.ts`, `qualityTiers.ts`, `capabilityProbe.ts`, `FpsGovernor.ts`, `LamaInpainter.ts`, `CoverageAtlas.ts`, `coverImprint.ts`, `InpaintingEngine.ts`, `CalibrationController.ts`, `landmark-debug-engine.ts`
  - Inspected the GLB optimizer tool (`tools/glb-optimizer/src/main.ts`), research docs (`3D-MODEL-PRODUCTION-RESEARCH.md`, `IN-HOUSE-3D-PIPELINE.md`, `handoff/038_GLB_Validation_Gate.md`), and `CLAUDE.md` for compression pipeline details
  - Analyzed the Annotation Studio's 40 MB bake root cause and fit-safe gltf-transform operations
- Artifacts / paths:
  - `F004-rendering-propainter-feasibility.md` — ProPainter/E2FGVI: 157.8 MB ProPainter model + ~42 MB supporting models; no ONNX export exists; flow/transformer ops have no ORT Web equivalent; **conclusion: drop ProPainter tier, use per-frame LaMa for calibration**
  - `F004-rendering-pipeline-fps.md` — No actual device FPS benchmarks exist in codebase. Estimated 4-11 FPS with LaMa active, 12-37 FPS texture-imprint only, 17-43 FPS face mesh+frame. MediaPipe main-thread (20-47ms per detection) is the biggest bottleneck — Worker fix (R5) is higher priority than adding segmenter
  - `F004-rendering-atlas-coverage.md` — Coverage at 45° yaw: ~40-55% (single-pose calibration), ~65-75% (multi-pose ±30°). Seam visibility between atlas-covered and uncovered regions is the critical unsolved UX problem. Multi-pose calibration is worth implementing
  - `F004-rendering-glb-pipeline.md` — 40 MB bake root cause: vertex de-sharing at temple-split time. Fix: `weld()` in optimizer (already implemented). Meshopt: 38 KB decoder → break-even at 1 GLB (no-brainer to add). Draco: 935 KB decoder → also worth it but needs runtime decoder registration. Fit-safe recipe: dedup → prune → weld → quantize → textureCompress. `simplify`/`flatten`/`join`/`optimize` excluded because placement derives from bounding boxes
- Decisions made while executing:
  - Firecrawl API returned 402 (no credits); used GitHub API + curl for all web research
  - Used local codebase analysis (nmg-vto) as primary evidence for GLB pipeline, FPS architecture, and atlas coverage — these are grounded in real code, not estimates
  - ProPainter model sizes confirmed from GitHub Releases API (ProPainter.pth=157.8MB, recurrent_flow_completion.pth=20.3MB, raft-things.pth=21.1MB)
  - E2FGVI inference speed confirmed from README (0.12s/frame on Titan XP at 432×240)
- Problems / open questions:
  - No live-device FPS benchmarks exist — all FPS numbers are architectural estimates. Instrument the pipeline with `performance.now()` wrappers before making architecture decisions
  - MediaPipe Worker fix (R5) is blocking: main-thread detection costs 20-47ms per frame and blocks all other JS. The "ModuleFactory not set" cross-origin CDN issue needs solving
  - `CalibrationController.ts` currently implements single-pose calibration only — multi-pose capture loop is proposed but not started
  - `GlassesRenderer.ts` has no Draco or Meshopt decoder registered — adding MeshoptDecoder (~38 KB gz) is the lowest-risk path to enable compressed GLBs
  - The 038 CI gate is a placeholder (`validate-glb.mjs` prints "placeholder") — real enforcement needs to be wired
- What Hermes should know for the next decision:
  - **ProPainter is a dead end for browser.** Drop it from the two-tier architecture. Revise [[CANDIDATE-frame-detection-removal-v2]] §3 to use per-frame LaMa for calibration. This simplifies the model download budget and removes the largest open rendering question
  - **Meshopt is an easy win** — 38 KB decoder, 70-90% mesh savings, fit-safe. Should be the first GLB pipeline improvement
  - **MediaPipe Worker fix (R5) gates the entire FPS story.** Without it, 30fps face mesh is borderline even without removal. With it, the main thread is free for rendering and the pipeline can hit the v2 candidate's targets
  - **Multi-pose calibration is worth building**, but seam management (feather between atlas and live/inpainting regions) is the harder UX problem
  - **Instrument the pipeline before deciding on segmenter or inpainting models.** Real FPS data on a mid-range laptop will validate or reject the v2 candidate's performance assumptions

## Review (Hermes fills this)
- Verdict: done | rework
- Notes:
