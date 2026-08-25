---
okf: 1
id: learnings-frame-removal
type: learnings
project: VTO
status: active
created: 2026-08-22
updated: 2026-08-22
tags: [vto, frame-removal, learnings, post-mortem, scrapped]
---

# LEARNINGS — frame removal v1 (scrapped 2026-08-22)

On 2026-08-22 the operator scrapped all frame-removal code and restarted the feature from scratch through the swarm. **Nothing is lost**: every commit survives on `origin/distributed-swarm` (tip `4b6d5b0`) and `origin/main`. The working tree moved to `origin/card-face-width` — Vansh's latest branch (2026-08-17), which branched from the 3d-gui tip `a6e021e` **before** any frame-removal code landed and adds card-referenced face-width measurement.

This document is the required reading for the rebuild. The plan itself ([[VTO]] D3) was validated and is NOT scrapped — the *execution* is what failed.

## What was built (git-verified timeline)

1. **Gen 0 — vibe-coded MVP** (pre-2026-07-24). Removal "visible end to end" but heavy face smearing under "Frames removed — locked". Preserved as a reference video (`tools/video-test/videos/_references/currentFrameRemovalFeatureState` on the old branch) — a *what-not-to-ship* exhibit, never a harness input.
2. **Gen 1 — Phase-3 pipeline** (07-24 → 07-30): mask generation `f0445b4` → Telea `64df586` → lens transparency `c51275e` → face cleaning `34d425a` → integration `5667570` → dynamic contour detection `d79cc25` → LaMa ONNX `2748fe3`. Then a two-week **fix cascade**: edge crawl / patch lag / frame residue `7570063`, EMA + tint smoothing + deadbands `a28def4`, pose-gated temple tracing `aabda0a`, eyebrow protection `6ccc391`, hidden-eye override reverted after field false-positives `a60a1c9`, honesty fixes ("`applied` must mean pixels changed" `bee132e`).
3. **Gen 2 — research + validated plan** (08-03 → 08-05): D2 personal-quality pivot, D3 approved plan (BiSeNet 3-class / texture-imprint + LaMa / no size cap / video-only), progressive head-cover `083bf9b`, learned segmenter made primary `9113b22`.
4. **Gen 3 — swarm era** (08-05 → 08-18): real BiSeNet ONNX inference wired (`?vtoModel=`), W001 sunglasses block-flicker fix (validated +0.246 sunglasses), Stage-1 smear re-bake, harness resurrection (`?vtoForceCapture` re-added test-only), pipeline summary comment `4b6d5b0`.

## What went wrong — the learnings

**L1 — The strongest signal decorated the pipeline instead of driving it.**
Removal stayed *gated on the weak contour detector's* `hasGlasses` while the trained segmenter only powered a cosmetic cover region — so with the model loaded, nothing visible happened. Weeks passed before the segmenter became primary (`9113b22`).
**Apply:** the best detector drives detect → mask → removal from day one, per [[primary-not-additive]]. A validated replacement is the PRIMARY path, never an off-by-default add-on.

**L2 — The interim 1-class model forced permanent-feeling hacks.**
D3 specified 3-class (frame/lens/face); what shipped was whole-glasses class-6, so a frame *band* had to be derived (rim = 5% of ROI, `MIN_SEG_ON_FRACTION` 0.004 — magic numbers needing on-device tuning), because erasing the whole mask would hit the eyes.
**Apply:** train/export the 3-class segmenter FIRST. If an interim asset doesn't match the plan's contract, that's a blocker to surface, not a shim to engineer around.

**L3 — Verification lagged construction; for weeks nothing was actually measured.**
The video-test harness was DEAD against the engine (`?vtoForceCapture` had been refactored out; the 5s oval-hold gate is unsatisfiable by a fake camera) → **zero verdict lines while everyone believed testing existed**. The 0.7166 "baseline" was measured on a pre-refactor path and comparable to nothing. The corpus mixed webcam inputs with widget/competitor **screen recordings**, which were mis-scored as inputs.
**Apply:** the harness is part of the feature. **Rebuild step 1 is proving the measurement path** (harness runs, verdict lines appear, one honest baseline number) before any removal code is written. Only raw webcam face clips are inputs; screen recordings live in `_references/`.

**L4 — Status ran ahead of reality.**
Task notes + the hub claimed "16/19 done (~84%)" when git ground truth was ~35–40%. The D3 build wave left vto-core not compiling (three half-applied files, fixed 08-05).
**Apply:** trust git + filled Result sections, never `status:` fields. Every wave exits green (tsc, eslint, tests, widget build). The swarm's checkable definitions of done (D-005 critique + mechanically checkable criteria) exist precisely for this — use them, don't narrate progress.

**L5 — A fix cascade on one subsystem is an approach signal, not a tuning phase.**
Six stabilization patches in four days (edge crawl, patch lag, residue, EMA, deadbands, tracing) all treated symptoms of per-frame 2D compositing; the head-cover imprint then still needed a smear re-bake. Accuracy never crossed ~0.71 clean (target 0.98).
**Apply:** per [[WORKFLOWS]], below-target routes to ANALYSE carrying evidence — re-decide the approach; do not queue the seventh patch. Two fixes on the same symptom = stop and re-plan.

**L6 — Detection robustness, not removal quality, was the real ceiling.**
Cross-verification (08-12, 6 valid clips): clean removal ~0.71 consistent, but sunglasses BLOCK detection split 0.83 vs 0.33 across sunglasses types — lens-darkness-dependent, not robust. W001 fixed the flicker/latch, not the detect threshold.
**Apply:** budget for detection-robustness across eyewear types as its own workstream with its own corpus coverage, before polishing inpainting.

**L7 — Platform constraints ate cycles because they were discovered, not documented.**
`.onnx` is not an allowed Shopify extension asset type (hosted on Files CDN renamed `.wasm`; ORT loads by bytes); int8 QDQ models fail on onnxruntime-web WebGPU/JSEP ("DequantizeLinear rank") → WASM EP required; `?variant=` + `?vtoModel=` needs `&`; the store HTML caches the deployed asset URL for minutes after `shopify app deploy`; MediaPipe won't init in a module worker on Shopify's cross-origin CDN (main-thread bottleneck — F004's #1 issue — never resolved).
**Apply:** these go in the repo's `llm.md`/`CLAUDE.md` on day one of the rebuild so no agent rediscovers them.

**L8 — Validated wins sat uncommitted until they were scrapped wholesale.**
The GREEN build, the segmenter integration, and the A/B-validated W001 (+0.064 overall) lived uncommitted for one–two weeks awaiting review, creating version skew and making "scrap" the only clean move.
**Apply:** small changes, gated often. The human commit gate (D-008/D-034) needs a cadence — a validated win should reach the gate within a day, or the gate is a bottleneck to raise with the operator.

**L9 — Priority order was right and wasn't followed.**
D3 ranked the MediaPipe Worker migration above any new model; Fresnel/PBR was the cheapest "premium" win. Neither shipped; T020/T022–T026 never started while detection hacks consumed the effort.
**Apply:** the rebuild follows D3's order unless a measurement says otherwise — and then the deviation is a recorded decision, not drift.

## What is KEPT (not scrapped — reuse, do not rebuild)

- **[[VTO]] D2 + D3** — the validated plan. Research F001–F015 in `Projects/VTO-Agents/Findings/`.
- **FittingBox ground truth** — [[F014-fittingbox-visual-ui-test-stats]] reference stats + fixtures; [[fittingbox-removal-reference]] demo video as the visual bar.
- **The trained model** — `bisenet_glasses.onnx` (source: `C:\Users\ankur.singh\face-parsing.PyTorch\res\`; hosted: Shopify Files CDN as `bisenet_glasses.wasm`, verified CORS-clean). Interim 1-class — see L2 for what to do about it.
- **Harness knowledge** — the 6-clip valid corpus, the `--trigger` requirement, the test-only force-capture pattern, the screen-recording quarantine rule (code is on `distributed-swarm`; port it, don't rediscover it).
- **W001 insight** — a block-verdict needs clear-tolerance latching (~700ms); re-derive on the new code, keep the A/B methodology.
- **All platform gotchas in L7.**

## State at scrapping (the honest numbers)

Clean removal accuracy **~0.71** vs target **0.98** (force-capture path, n=1/clip). Sunglasses block detection inconsistent across types (0.83/0.33). MediaPipe main-thread = #1 bottleneck, unresolved. Code preserved at `origin/distributed-swarm@4b6d5b0`; new base `origin/card-face-width@58debab`.

---

[[VTO]] · [[vto-build-state]] · [[decision]] · [[WORKFLOWS]] · [[F014-fittingbox-visual-ui-test-stats]] · [[CONTEXT-HANDOFF]]
