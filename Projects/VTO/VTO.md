# VTO (project hub)

**VTO = Virtual Try-On for eyewear on Shopify** (confirmed from the repo `C:\Users\ankur.singh\shopify\nmg-vto` — client-side try-on: MediaPipe FaceLandmarker + three.js + GLB, sold as a subscription app to premium eyewear brands).

**Ultimate goal (drafted from the repo's own framing — Rohit may refine):** Ship a Shopify eyewear try-on that beats Fittingbox (~$59/mo) on quality-per-dollar: premium-looking placement, materials, and frame removal, fully client-side, at $19–149/mo.

## How this project is run

This project is executed **collaboratively by two agents** — see [[VTO Agent Architecture]]:

- 🧠 **Hermes — the Orchestrator.** Owns the goal, makes decisions, breaks work into tasks, assigns them, reviews results, and updates this hub.
- 🔧 **OpenClaw — the Worker.** Executes assigned tasks with its tools (files, shell, web, browser), then writes results + context back for Hermes.

All shared state lives in this vault — it is the project's memory:

- [[VTO Agent Architecture]] — roles, task protocol, handoff format
- [[VTO Task Log]] — every task: assigned → in progress → done, with returned context
- `Projects/VTO/Tasks/` — one note per task (created from the template in the Task Log)

## The swarm

Souls + 11 ready research-agent missions + findings live in [[VTO-Agents]] (`Projects/VTO-Agents/`, all in [[OKF-FORMAT]] — GitHub-ready).

**Output quality:** nothing becomes truth in this hub without passing the validation gate ([[LOOP-ENGINEER]]) — Catalyst adversarial review (cheap model) + Claude final verdict (Opus).

## Status

- 2026-08-03 — project memory structure created.
- 2026-08-03 — nmg-vto repo digested; goal drafted; swarm knowledge base built: [[SOUL-Hermes]], [[SOUL-OpenClaw]], 11 research agents in [[VTO-Agents]]. Next: Hermes picks the first 2-4 research missions and assigns tasks.
- 2026-08-04 — Loop Engineer validation gate installed ([[LOOP-ENGINEER]]): Imbue Catalyst (Windows-patched, CLI-skills mode) reviews candidate outputs on Haiku; Claude (Opus) is the ultimate validator. Hermes/OpenClaw souls updated to route all final outputs through it.
- 2026-08-04 — Research swarm launched: [[T001 FittingBox-Teardown]] (competitive teardown — bundle analysis, runtime, frame removal, scale/fit, privacy) and [[T002 Patent-IP-Mapping]] (patent families, claim analysis, prior art, FTO risk table). Both running in parallel via delegate_task subagents. Findings expected in `Projects/VTO-Agents/Findings/`.
- 2026-08-04 — **T001 + T002 DONE**; Hermes compiled [[CANDIDATE-frame-detection-removal]] and it **PASSED the validation gate (deep) → APPROVED** (verdict: `catalyst-env\\vto\\validation-reports\\20260804-CANDIDATE-frame-detection-removal.verdict.md`; theory T_20260804_131603_55b953; review R_20260804_133555_961ac0; Haiku adherence review + Opus adjudication; both findings minor/non-blocking). See Decisions below.
- 2026-08-04 — [[CANDIDATE-frame-detection-removal-v2]] compiled (post D2 pivot) → validation gate returned **REWORK** (3 items: PD accuracy speculation, >90% coverage as fact, staged-adoption note). Rework queued; not yet applied.
- 2026-08-04 — Wave 2 swarm launched: **T003** (Software-Researcher: segmentation models + LaMa benchmarks) and **T004** (Rendering-Researcher: ProPainter feasibility + pipeline FPS + GLB pipeline) assigned. These directly feed the v2 candidate's open questions.
- 2026-08-04 — Full research swarm deployed: all 11 research agents now assigned or completed. **T001–T002 done.** **T003–T010 running** (8 active subagents across 3 parallel batches). **T011 done** (Orchestration — cron/heartbeat configs, context hygiene, adversarial review, failure modes, metrics). Findings streaming into `Projects/VTO-Agents/Findings/`.
- 2026-08-04 — **ALL 11 RESEARCH AGENTS COMPLETE.** Swarm findings F001–F011 now in Findings/. v2 candidate REWORK applied (PD accuracy → design targets, ProPainter dead-end integrated, staged-adoption added, Open Questions resolved from swarm). Candidate re-submitted to validation gate as `T_20260804_181351_a651bc` — Stage 1b deep review running (Haiku, background). Verdict pending.
- 2026-08-04 — **[[CANDIDATE-frame-detection-removal-v2]] APPROVED** (verdict: `catalyst-env\\vto\\validation-reports\\20260804-120108-CANDIDATE-frame-detection-removal-v2-FINAL.verdict.md`; theory T_20260804_181351_a651bc; Opus adjudication — all 3 prior-verdict rework items confirmed applied). This is now the project's validated technical plan. See D3.
- 2026-08-04 — Implementation phase launched. **T016–T018 BUILD dispatched** (IRIS constant fix, solvePnP yaw, MediaPipe Worker). **T012–T014 MEASURE dispatched** (pipeline FPS, PD parallax, GLB profiling). **T015 DONE** (specular-removal: SKIP — unnecessary). 12/18 complete, 6 running. See D3 for the full validated build plan.
- 2026-08-04 — **T016 DONE** (IRIS 11.7→12.0 committed, 249 tests pass). **T017 REWORK** (solvePnP 443 lines implemented, sign ambiguity → T017b dispatched). **T012–T015 DONE** (FPS instrumentation ready; PD depth-parallax VERIFIED — 0.0–0.8mm residual; GLB catalog profiled; specular-removal SKIP). **T018 RUNNING** (MediaPipe Worker). 16/19 complete, 2 running, 1 rework.

## Decisions (validated)

**D2 — Personal-project pivot (Rohit, 2026-08-04) — SUPERSEDES D1.** The project is now **personal / non-commercial**, optimized for **maximum quality + UX**, not commercial constraints. Rohit's seven overrides (map 1:1 onto D1):
1. **Switch TO a learned per-pixel glasses segmenter** (patent avoidance dropped — personal use).
2. Frame/face cover — **whatever gives best quality** (segmenter+video-inpaint vs texture-imprint vs hybrid; Hermes to recommend).
3. **May drop LaMa+Telea "standard-only"** — use best inpainting even if novel/heavy (e.g. SOTA video inpainting).
4. PD/scale — **whatever gives best user experience** (accuracy + zero friction).
5. **NO size cap.** Drop the ≤250 KB entry budget. Heavy models fine; "a slow loader but better experience still wins." Strong loading UX instead.
6. **Video only.** No photo/still mode — every feature runs on the live webcam stream.
7. Drop attorney/FTO/patent gating — optimize purely for quality + UX.

Revised plan compiled as [[CANDIDATE-frame-detection-removal-v2]] → **APPROVED 2026-08-04** after three validation-gate passes (verdict: `catalyst-env\\vto\\validation-reports\\20260804-120108-CANDIDATE-frame-detection-removal-v2-FINAL.verdict.md`). See D3 for the validated technical decisions.\n\n---\n\n**D3 — Frame detection & removal validated plan (APPROVED 2026-08-04).** Synthesized from all 11 research-agent findings (F001–F011), validated through the Loop Engineer gate (3 passes: initial → Haiku deep-review REWORK → Opus final APPROVED). The approved approach:\n\n1. **Segmentation: BiSeNet fine-tuned for 3-class glasses** (frame/lens/face), Lyu et al. CVPR 2022 synthetic data pipeline, U-Net+MobileNetV3 fallback. Keep `FrameDetector.ts` as warm-start/fallback. (F003)\n2. **Frame cover: Texture-imprint baseline (single-pose calibration + per-frame LaMa).** Multi-pose enhancement adopted only if Q5 demonstrates perceptible gain. Segmenter mask integration + specular-removal (Q9, deferred). (F004)\n3. **Inpainting: LaMa-only** (~198 MB ONNX, calibration-tier per F003). ProPainter/E2FGVI dead ends — no browser ONNX export (F004). Runtime gap-fill for uncovered atlas pixels only.\n4. **PD: Auto-iris default (~±2 mm design target, needs verification) + optional card calibration with depth-parallax correction.** IRIS_DIAMETER_MM: 11.7 → 12.0 mm (F008-01). No specific mm figure presented to users until measured (F010 protocol). Card-at-forehead depth-parallax correction applied at pupil plane. (F007-001, F008-01)\n5. **Engine delivery: ~208–223 MB** (MediaPipe + BiSeNet + LaMa), first-visit load ~33–36 s at 6.25 MB/s, cached <2 s. No size cap — progressive loading UX. (F003, F004)\n6. **Video only — no photo/still mode.** All features run on live `getUserMedia` webcam stream. Remove photo capture and server-side render endpoints.\n7. **No patent/attorney/FTO gating** (personal project per D2).\n8. **Pipeline FPS: 4–11 full, 17–43 mesh-only** (estimated). **MediaPipe main-thread detection is #1 bottleneck** — Worker+OffscreenCanvas migration higher priority than any new model. (F004)\n9. **Competitive landscape: 1 credible Shopify competitor** (FittingBox). Their server-side selfie upload is a privacy vulnerability we exploit client-side. Market wide open. (F006)\n10. **Fresnel reflectance (#1 lens effect) + PBR materials zero-cost** — implement first for \"premium\" quality. (F005)\n11. **Yaw correction: solvePnP (~2° MAE) replaces current quadratic boost (~7°).** (F007-002)\n12. **Texturing: rigid-only UV basis → 60% drift improvement at near-zero cost.** (F007-004)

---

**D1 — Frame detection & removal improvement plan (APPROVED 2026-08-04) — ⚠ SUPERSEDED by D2.** Kept for history. The [[CANDIDATE-frame-detection-removal]] synthesis (patent-constrained, commercial framing):
1. **Keep the hybrid detector** (geometric contour-tracing seeded by MediaPipe + CLIP type-classifier) — do NOT swap to a learned per-pixel glasses segmenter; that walks into FittingBox Family A (US 9,892,561). Improve contour robustness instead (FaceLandmarker v2 seeds, temporal hysteresis, edge-linking fallback).
2. **Invest in the texture-imprint cover** (`coverImprint.ts`/`CoverageAtlas.ts`) — our strongest FTO differentiator (builds a clean-face model vs "erase glasses per frame"); add specular-removal + multi-pose capture.
3. **Default PD to iris-prior only**; ship card-calibration as a *dynamically-loaded opt-in module* (not a base-bundle flag) — closest to Family H (~2044) / Ditto (~2041).
4. **Keep inpainting standard** (LaMa + Telea) — no novel method (novelty would strengthen, not dodge, a claim).
5. **Small-shell / deferred-engine delivery** — entry ≤250 KB gz, lazy-load MediaPipe+LaMa+CLIP models at try-on, cache in IndexedDB/SW (FittingBox proves the pattern with its ~79 KB shell + ~12 MB deferred engine).
6. **Privacy differentiator** — keep photo mode fully client-side (FittingBox uploads the selfie server-side).
7. **Attorney-gated before launch** — granted-claim element-mapping for the frame-removal + webcam-PD patent cluster; the webcam-PD cluster is the newest/longest-lived risk, ahead of frame removal.

⚠ Not legal advice — a licensed patent attorney must run the formal FTO before launch (carried through from F002).

## Related

- [[memory]] — vault conventions · [[Agent OS]] — the platform both agents run on
