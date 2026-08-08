# T020 — LaMa Two-Tier Inpainting

project: [[VTO]]
status: assigned
assigned_by: Hermes
assigned_on: 2026-08-04
worker: OpenClaw

## Goal

Create two new inpainting modules: `CalibrationInpainter.ts` for calibration-phase per-frame LaMa inpainting, and `GapFillInpainter.ts` for runtime gap-fill on uncovered atlas pixels.

## Context (from Hermes)

Per D3 §3: LaMa-only inpainting (~198 MB ONNX, calibration-tier). ProPainter/E2FGVI are dead ends. The current `LamaInpainter.ts` exists but needs to be split into calibration vs runtime roles.

**Architecture:**

**Tier 1 — `CalibrationInpainter.ts` (new, runs once per session):**
- During calibration, capture N frames from guided head-turn sequence
- Run segmenter on each frame → per-frame masks
- Run LaMa on each frame independently → inpainted clean-face frames
- Feed clean frames into texture-imprint atlas build
- ~50-200ms per frame (acceptable for one-time calibration of 100-200 frames = 5-40s)

**Tier 2 — `GapFillInpainter.ts` (new, runs per frame for uncovered pixels):**
- At runtime, identify atlas coverage gaps (pixels where UV atlas has no valid texel)
- Run LaMa on just the gap regions (≤10-15% of frame pixels)
- Small region = proportionally faster inference

**Keep/modify:** `LamaInpainter.ts` as shared LaMa runner, `InpaintingEngine.ts` add tier routing, `MaskGenerator.ts` simplify (segmenter provides primary mask)

**Repo:** `C:\Users\ankur.singh\shopify\nmg-vto\rkumar-vto\packages\vto-core\src\`

**Reference:** F003-software-lama-benchmark, F004-rendering-propainter-feasibility

## Definition of done
- [ ] `CalibrationInpainter.ts` created — per-frame LaMa on calibration sequence
- [ ] `GapFillInpainter.ts` created — LaMa on uncovered atlas regions only
- [ ] `InpaintingEngine.ts` updated with tier routing (calibration vs runtime)
- [ ] `MaskGenerator.ts` simplified (segmenter provides primary mask; keep dilate+feather for gap padding)
- [ ] tsc clean, eslint clean
- [ ] All existing tests pass

## Result & context returned (OpenClaw fills this)
- What was done:
- Artifacts / paths:
- Decisions made while executing:
- Problems / open questions:
- What Hermes should know for the next decision:

## Review (Hermes fills this)
- Verdict: done | rework
- Notes: