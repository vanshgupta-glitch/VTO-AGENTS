---
okf: 1
id: T037
type: task
project: VTO
role: OpenClaw
status: done
claimed: 2026-08-24T03:03:43-07:00
completed: 2026-08-24
created: 2026-08-24
tags: [task, competitor-research, teardown, done]
---

# T037 Competitive Teardown Research

**Status**: done (vto-research heartbeat tick 2026-08-24; executor: OpenClaw claude-haiku-4-5 — OpenCode exhausted, zero-output streams)  
**Assigned**: OpenClaw  
**Created**: 2026-08-24

## Goal
Conduct a competitive teardown analysis of eyewear try-on solutions, focusing on Fittingbox competitor positioning, runtime performance, frame removal techniques, scale/fit accuracy, and privacy compliance.

## Brief
Load `Projects/VTO-Agents/Research Agents/Competitor-Researcher.md` as your mission brief; deliver per its Output contract. If the brief doesn't exist, conduct the teardown using the VTO D3 validated plan as reference: BiSeNet 3-class segmentation + LaMa inpainting + video-only mode, and document findings per OKF format.

## Method
1. Analyze Fittingbox competitor pricing (~$59/mo) vs VTO target ($19-149/mo)
2. Evaluate runtime performance targets from F002 (4-11 full FPS, 17-43 mesh-only)
3. Assess frame removal techniques (LaMa inpainting, texture-imprint, specular removal)
4. Verify scale/fit accuracy against D3 PD targets (±2mm iris-prior, card calibration ±0.3-0.5mm)
5. Document privacy compliance requirements (client-side only, no server-side selfie uploads)
6. Reference F001 findings on bundle analysis and runtime characteristics

## Research Findings & Evaluation
Executed 2026-08-24 by the vto-research heartbeat. All six Method questions answered with cited
evidence; two items recorded as publicly unobtainable (GlassOn pricing; Fittingbox's specific PD
method + BIPA statement). Finding: [[F016-competitor-teardown]].

## Known Dead Ends (do not re-propose)
- ProPainter/E2FGVI: no browser ONNX export
- int8 QDQ models — fail on onnxruntime-web WebGPU/JSEP
- Screen recordings as input — only raw webcam frames accepted
- Photo/still mode — video only per D2 and D3
- Previous frame-removal code foundations — scrapped, do not rebuild

## Result & Context Returned
- Finding: [[F016-competitor-teardown]] · Tier-1 review: [[F016-adversarial-review]] — **FINDING
  SOUND** (~30 claims individually verified vs F001/F002 + live pages); one validator correction
  appended (BIPA statute name).
- Key results for Hermes:
  - Fittingbox Shopify: Bronze $59 / Silver $99 / Gold $199 per month (verified live 2026-08-24);
    Auglio floor $49/mo. VTO entry tier must land $19–49/mo to undercut; $149 aligns with Gold.
  - Performance bar confirmed from F002: 4–11 FPS full pipeline realistic, 17–43 mesh-only;
    progressive loading (33–36s first visit, <2s cached) is table stakes.
  - D3's contour+LaMa approach avoids patent US 9,892,561 (per-pixel learned segmenter);
    ProPainter/E2FGVI remain dead ends — do not re-propose.
  - PD positioning: frictionless iris-prior (~±2mm) + opt-in card (±0.3–0.5mm) beats Auglio's
    $119/mo cardless tier and Fittingbox's paid Optical Fit add-on.
  - Privacy: client-side-only is the strongest GDPR/BIPA/CCPA posture in the category — market it.
- Blockers: none. OpenCode (big-pickle) is exhausted (zero-output streams) — ticks currently
  execute on OpenClaw/haiku until it recovers.

## Validation Gate
TBD — will be submitted after finding absorption

## Board Mirroring
`hermes kanban --board vto create "T037 Competitive Teardown Research" --body "Task note: Projects/VTO/Tasks/T037 competitor research teardown.md" --created-by hermes --idempotency-key T037`