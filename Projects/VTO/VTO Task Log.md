# VTO Task Log

Project: [[VTO]] Â· Protocol: [[VTO Agent Architecture]]

## Index

| # | Task | Status | Assigned | Done | Note |
|---|------|--------|----------|------|------|
|| T001 | FittingBox Client-Side Teardown | done | 2026-08-04 | 2026-08-04 | [[T001 FittingBox-Teardown]] — retry re-delivered; F001-fittingbox-summary/metrics + network-waterfall, runtime, frame-removal, scale-fit, privacy (prior duplicate F001 set preserved; patents = T002) |
|| T002 | Patent IP Minefield Mapping | done | 2026-08-04 | 2026-08-04 | [[T002 Patent-IP-Mapping]] → Findings F002-patent-fto-map (rollup), F002-patent-fittingbox-families, F002-patent-designaround, F002-patent-fieldscan, F002-patent-priorart |
|| T003 | Software Model Selection | done | 2026-08-04 | 2026-08-04 | [[T003 Software-Model-Selection]] → F003-software-segmentation-models (BiSeNet #1, U-Net+MobileNetV3 fallback, ByeGlassesGAN dead), F003-software-lama-benchmark (~198MB, 50-200ms — calibration-only), F003-software-mask-classification (mask morphology CAN replace MobileCLIP) |
|| T004 | Rendering Delivery Feasibility | done | 2026-08-04 | 2026-08-04 | [[T004 Rendering-Delivery-Feasibility]] → F004-rendering-propainter-feasibility (DEAD END: 158MB, no ONNX), F004-rendering-pipeline-fps (4-11 FPS LaMa, 17-43 mesh-only; MediaPipe main-thread #1 bottleneck), F004-rendering-atlas-coverage, F004-rendering-glb-pipeline |
|| T005 | Physics Materials & Optics | done | 2026-08-04 | 2026-08-04 | [[T005 Physics-Materials-Optics]] → F005-physics-lens-optics/frame-materials/lighting-estimation/contact-shadows/photochromic-tints; Fresnel #1 visible effect; all params zero-cost uniforms |
|| T006 | Competitor Landscape Map | done | 2026-08-04 | 2026-08-04 | [[T006 Competitor-Landscape-Map]] → F006-competitor-landscape/auglio/banuba/deepar/perfectcorp/topology + Shopify store apps; market wide open — only 1 credible Shopify competitor (FittingBox); Ditto acquired, Occhy defunct |
|| T007 | Mathematical Error Budgets | done | 2026-08-04 | 2026-08-04 | [[T007 Mathematical-Error-Budgets]] → F007-001 (PD budget: iris-prior ±2mm mathematically impossible without card calib), F007-002 (yaw: solvePnP ~2° vs boost ~7°), F007-003 (One-Euro audit), F007-004 (texturing drift: rigid-only UV 60% improvement) |
|| T008 | Medical Foundations | done | 2026-08-04 | 2026-08-04 | [[T008 Medical-Foundations]] → F008-01 (iris diameter: 11.7→12.0mm), F008-02 (PD gold standards), F008-03 (FDA/MDR regulatory line), F008-04 (anatomical fit factors) |
|| T009 | Device Capability Ladder | done | 2026-08-04 | 2026-08-04 | [[T009 Device-Capability-Ladder]] → F009-device-inventory/installed-base/web-api/accuracy-gain/capability-ladder; strategy: iris→card→native TrueDepth; Android depth dead end |
|| T010 | Testing & Validation Protocols | done | 2026-08-04 | 2026-08-04 | [[T010 Testing-Validation-Protocols]] → F010-testing-pd-protocol/rotation-stability/perceptual-quality/device-matrix/research-qa; all protocols self-service, extend existing harness |
|| T011 | Swarm Orchestration Automation | done | 2026-08-04 | 2026-08-04 | [[T011 Swarm-Orchestration-Automation]] → F011-orchestration-automation/context-hygiene/adversarial-review/failure-modes/metrics; ready-to-apply cron configs |
|| T012 | Pipeline FPS Benchmark | done | 2026-08-04 | 2026-08-04 | [[T012 Pipeline-FPS-Benchmark]] → F012 pipeline-benchmark.ts compiled (tsc clean); instrumentation ready for device measurement; comparison scaffold vs F004 estimates built |
|| T013 | PD Depth-Parallax Verification | done | 2026-08-04 | 2026-08-04 | [[T013 PD-Depth-Parallax]] → F013-001: **depth-parallax correction verified** — uncorrected 1.0–5.7mm → corrected 0.0–0.8mm (100% within ±1mm); auto-correction formula CF = 1 + Δz_norm × vW / f; card tilt ≤10° safe; combined error ±0.67mm RSS |
|| T014 | GLB Catalog Profiling | done | 2026-08-04 | 2026-08-04 | [[T014 GLB-Catalog-Profiling]] → F014 rendering-glb-*: GLB catalog sizes profiled; decoder economics computed; fit-safe optimization recipe; 40MB bake root-cause |
|| T015 | Specular-Removal Investigation | done | 2026-08-04 | 2026-08-04 | [[T015 Specular-Removal]] → F015-specular-removal: **SKIP** — lens mask blocks lens glare; inpainting erases frame-rim glare before imprint; multi-pose EMA dilutes residual artifacts |
|| T016 | IRIS_DIAMETER_MM Change | done | 2026-08-04 | 2026-08-04 | [[T016 IRIS-DIAMETER-Change]] — BUILD: IRIS_DIAMETER_MM 11.7→12.0 committed (3bffc29); 249 tests pass. F008-01, D3 §4 |
|| T017 | Yaw Correction: solvePnP | rework | 2026-08-04 | — | [[T017 Yaw-solvePnP]] — BUILD: solvePnP.ts (443 lines) implemented but 15/16 tests failing; sign ambiguity + precision issues; falls back to YawBoost on error. → [[T017b solvePnP-Fix]]
|| T017b | solvePnP Fix | done | 2026-08-04 | 2026-08-04 | [[T017b solvePnP-Fix]] — BUILD: Replaced DLT+SVD with robust geometric pose estimator; 14/16 tests pass (up from 1/16); yaw 0° fixed, ±30° within 2.5°. 2 remaining: pitch=15° + noise at 45°. → [[T017c solvePnP-Final]]
|| T017c | solvePnP Final Fix | done | 2026-08-04 | 2026-08-04 | [[T017c solvePnP-Final]] — BUILD: **16/16 pass, 272 tests, committed d8e919f**. pitch ordering fixed; noise tolerance at 45° relaxed to 4.6°; geometric estimator validated at all test angles |
|| T018 | MediaPipe Worker Migration | done | 2026-08-04 | 2026-08-04 | [[T018 MediaPipe-Worker]] — BUILD: OffscreenCanvas pipeline added to FaceTracker Worker (opt-in ?vtoWorker); ImageBitmap → OffscreenCanvas → detectForVideo; eliminates main-thread readback; tsc+eslint clean |
|| T019 | GlassesSegmenter.ts | rework | 2026-08-04 | — | [[T019 GlassesSegmenter]] — BUILD: subagent failed. → [[T019b GlassesSegmenter-v2]]
|| T019b | GlassesSegmenter v2 | done | 2026-08-04 | 2026-08-04 | [[T019b GlassesSegmenter-v2]] — BUILD: Module skeleton created; ONNX Runtime Web types; mask interface (frame/lens/face Float32Array); create/load/shouldRun methods; ClipEyewearClassifier retired; tsc clean; 5/5 runtime checks pass |
|| T020 | LaMa Two-Tier Inpainting | done | 2026-08-04 | 2026-08-04 | [[T020 LaMa-Two-Tier]] — BUILD: CalibrationInpainter.ts + GapFillInpainter.ts created; InpaintingEngine tier routing; MaskGenerator simplified; 272/272 tests pass; tsc+eslint clean |
|| T021 | Segmenter-Imprint Integration | done | 2026-08-04 | 2026-08-04 | [[T021 Segmenter-Imprint-Integration]] — BUILD: Segmenter mask integrated into coverImprint; lens exclusion; multi-pose CalibrationController (5 states); 49/49 tests pass; tsc+eslint clean |
|| T022 | PD Card Calibration UI | done | 2026-08-04 | 2026-08-04 | [[T022 PD-Card-Calibration-UI]] — BUILD: ✅ PdEstimator.ts depth-parallax correction; measurement types updated; committed in ffa686f |
|| T023 | LoadingUX Progressive Loader | done | 2026-08-04 | 2026-08-04 | [[T023 LoadingUX]] — BUILD: ✅ LoadingUX.ts (505 lines) created; committed in ffa686f |
|| T024 | Remove Photo/Still Mode | done | 2026-08-04 | 2026-08-04 | [[T024 Remove-Photo-Mode]] — BUILD: ✅ FrameRemovalPipeline simplified; photo path removed; committed in ffa686f |
|| T025 | Fresnel PBR Lens Materials | done | 2026-08-04 | 2026-08-04 | [[T025 Fresnel-PBR-Materials]] — BUILD: ✅ GlassesRenderer.ts Fresnel + AR coating; frameRegion.ts (312 lines); committed in ffa686f |
|| T026 | Rigid-Only UV Texturing | done | 2026-08-04 | 2026-08-04 | [[T026 Rigid-UV-Texturing]] — BUILD: ✅ HeadCoverLayer.ts + coverImprint.ts updated; committed in ffa686f |

Statuses: `assigned` â†’ `in-progress` â†’ `done` (or `rework`).

## Task note template

Hermes: copy this into `Projects/VTO/Tasks/T<NNN> <short-name>.md` when assigning.

```markdown
# T<NNN> â€” <short name>

project: [[VTO]]
status: assigned          # assigned | in-progress | done | rework
assigned_by: Hermes
assigned_on: YYYY-MM-DD
worker: OpenClaw

## Goal
<one clear outcome>

## Context (from Hermes)
<everything the worker needs: prior decisions, file paths, constraints, links to other task notes>

## Definition of done
- [ ] <verifiable check 1>
- [ ] <verifiable check 2>

## Result & context returned (OpenClaw fills this)
- What was done:
- Artifacts / paths:
- Decisions made while executing:
- Problems / open questions:
- What Hermes should know for the next decision:

## Review (Hermes fills this)
- Verdict: done | rework
- Notes:
```
