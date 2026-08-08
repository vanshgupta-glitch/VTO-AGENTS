# T021 — Segmenter Mask → Imprint Pipeline Integration

project: [[VTO]]
status: assigned
assigned_by: Hermes
assigned_on: 2026-08-04
worker: OpenClaw

## Goal

Integrate the learned segmenter's per-pixel 3-class mask into the texture-imprint pipeline, replacing the contour-tracer's approximate mask. Add multi-pose calibration support.

## Context (from Hermes)

Per D3 §2: The texture-imprint baseline uses single-pose calibration + per-frame LaMa. The segmenter (T019) produces precise per-pixel masks distinguishing frame/lens/face. This task wires them together.

**Changes:**

1. **Replace mask source in imprint pipeline:** Point `coverImprint.ts` and `CoverageAtlas.ts` at the segmenter's mask instead of the contour-tracer's mask. The segmenter's lens-vs-frame distinction prevents lens-tint contamination.

2. **Multi-pose calibration:** Extend `CalibrationController.ts` to guide user through head-turn sequence (center → left 30° → right 30° → up 15° → down 15°) over ~5-10s. Capture and imprint frames at each pose.

3. **Coverage-aware imprint:** Track which atlas texels receive coverage from each calibration pose. The `CoverageAtlas.ts` confidence ratchet already makes coverage monotonic.

**Files to modify:** `coverImprint.ts`, `CoverageAtlas.ts`, `CalibrationController.ts`, `FacePatchLayer.ts`

**Repo:** `C:\Users\ankur.singh\shopify\nmg-vto\rkumar-vto\packages\vto-core\src\`

**Reference:** F004-rendering-atlas-coverage

## Definition of done — SLICE 1 done; multi-pose split to T021b
- [x] Segmenter mask **fed into the cover REGION** (`FrameRegionMask.imprint`, unioned with the contour trace) — the learned mask now drives what the cover erases
- [x] Exact registration (segmenter runs on the SAME ROI pixels, SAME pass as the contour mask)
- [x] tsc clean, eslint clean, all existing tests pass (+3 adapter tests)
- [ ] Lens-vs-frame distinction — N/A on the interim 19-class model (no split); adapter unions frame+lens so the F003 3-class model needs no code change → **T021b**
- [ ] `CalibrationController.ts` multi-pose guided head-turn UI → **T021b**
- [ ] Coverage atlas from multiple poses → **T021b**

## Result & context returned (Claude, 2026-08-05 — SLICE 1 shipped, gated)
- What was done: Wired the learned segmenter's mask into the head-cover REGION path (the correct integration point — the interim model marks the WHOLE glasses region with no frame/lens split, so it drives the cover-region gate, NOT the rim-erase mask which would erase the eyes). Added a pure, tested adapter `glassesMaskToRegionSource()` (GlassesMask float channels → `RegionMaskSource` 0..255, unions frame+lens). In the async removal pass, when enabled, the segmenter runs on the **same ROI pixels the contour pass used** (exact registration) and its region is unioned into `coverRegionMask.imprint()` alongside `removal.feathered`. **Gated behind `?vtoSegMask=on` (default OFF)** — the working contour cover is untouched unless explicitly enabled, so this is a safe on-device A/B toggle.
- Artifacts / paths: `frame-removal/frameRegion.ts` (adapter + export), `frame-removal/index.ts` (export), `engine/landmark-debug-engine.ts` (`?vtoSegMask` flag, `imprintCover` `segRegion` param + union block ~L2490, async-pass segmenter run ~L2810), `test/glasses-region-source.unit.test.ts` (3 tests).
- Decisions: REGION path not rim-erase path (interim model has no frame/lens split). Union (not replace) with the contour trace — `FrameRegionMask`'s union-with-decay means both sources grow the covered area; safe. Default OFF because the whole-glasses region is BIGGER than the contour's frame-band, and `frameRegion.ts`'s own history warns a too-large region reintroduced the "huge pale patch" — so whether the learned region looks better is an **on-device judgement**, hence the A/B flag.
- Problems / open questions: (1) whole-glasses vs frame-band region tradeoff needs on-device eval; (2) async segmenter (~87 ms) runs per throttled removal pass when enabled — fine for A/B, may need caching for default-on; (3) multi-pose calibration not started.
- What Hermes should know next: **T021b** = multi-pose calibration + on-device tuning of the segmenter-cover (and, once the F003 3-class model lands, the frame/lens split flows through the adapter automatically). To see it live: `?vtoModel=<url>&vtoSegMask=on`.

## Review (Hermes fills this)
- Verdict: done (slice 1) · T021b opened for multi-pose
- Notes:
- Notes: