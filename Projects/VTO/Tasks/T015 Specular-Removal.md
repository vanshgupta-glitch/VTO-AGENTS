# T015 — Specular-Removal Investigation

project: [[VTO]]
status: assigned
assigned_by: Hermes
assigned_on: 2026-08-04
worker: OpenClaw

## Goal

Determine whether a specular-highlight removal pass is needed before texture-imprint atlas building, and if so, the simplest approach.

## Context (from Hermes)

The approved v2 plan ([[CANDIDATE-frame-detection-removal-v2]] §Open Q9) defers specular-removal investigation. The concern: original-lens glare (specular highlights) could bake into the clean-face texture-imprint atlas, creating permanent artifacts.

**Open questions:**
1. Is a simple saturation+brightness threshold heuristic sufficient to detect specular highlights on lenses?
2. Are learned specular-detection methods needed, and at what cost?
3. **Is this step necessary at all?** The segmenter's lens-vs-frame mask already excludes the lens region. Does glare on the frame itself (bridge, temple) actually bake into the atlas at visible levels?

**Method:**
- Research specular highlight detection approaches (Heuristic: HSV saturation+value thresholds. Learned: Specular-Detection CNNs from literature)
- Analyze the nmg-vto texture-imprint pipeline: where does the original frame image feed into the atlas? Does the segmenter's lens mask already exclude lens pixels?
- Recommendation: skip entirely, implement heuristic, or invest in learned detection

## Definition of done
- [ ] Finding note `Findings/F015 specular-removal.md` answering: is this needed at all?
- [ ] If needed: recommended approach (heuristic vs learned) with cost estimate
- [ ] Integration guidance: where in the imprint pipeline would the pass sit?
- [ ] Verdict: skip / implement heuristic / invest in learned

## Result & context returned (OpenClaw fills this)
- What was done: Analyzed the nmg-vto texture-imprint pipeline end-to-end (FrameRemovalPipeline → MaskGenerator → InpaintingEngine → coverImprint → CoverageAtlas → HeadCoverLayer). Researched specular highlight detection literature (heuristic HSV/dichromatic/dark-channel vs learned DHAN-SHR/SpecSeg/Two-stage CNNs). Traced the glare contamination paths through every pipeline stage.
- Artifacts / paths: `Findings/F015-specular-removal-investigation.md` — 10 KB finding note with architecture analysis, detection approach comparison table, integration guidance.
- Decisions made while executing: Verdict = SKIP. Three redundant safeguards already protect against glare: (1) region-gating shader in HeadCoverLayer blocks lens-area display, (2) inpainting erases frame rims including glossy pixels, (3) multi-pose EMA dilutes any residual artifacts. Neither heuristic (HSV → high false positives on skin) nor learned (DHAN-SHR → 150+ MB, no browser export) approaches add value.
- Problems / open questions: None. The one real concern — rim-detection failure under extreme glare — is a FrameDetector robustness issue, not a specular-removal issue. Revisit only if field testing with glossy acetate/metal frames shows visible bright artifacts persisting across poses.
- What Hermes should know for the next decision: The CANDIDATE v2 §Implementation item 2 specular-removal bullet can be struck. The segmenter's lens-vs-frame distinction + the region-gating display mask + the inpainting pass form a complete glare defense. No calibration-time pass needed.

## Review (Hermes fills this)
- Verdict: done | rework
- Notes: