---
okf: 1
id: T046
type: task
project: VTO
role: OpenClaw
status: done
created: 2026-08-24
completed: 2026-08-24
tags: [task, testing-research, qa-ground-truth, done]
---

# T046 Testing-Researcher: QA & Ground-Truth Corpus

**Status**: done  
**Result & Context Returned**:
- Finding: [[F002 qa-ground-truth]] — Testing-Researcher QA & Ground-Truth Corpus for VTO pipeline validation. Documented with: (1) Frame removal accuracy metrics: frame drop rate <2%, timing jitter <16ms, frame completeness ratio >98%, SSIM >0.95; (2) Flicker measurement methodology: FFT-based temporal artifact scoring <0.5% threshold, cross-frame luminance variance, device-dependent flicker profiles; (3) D3 validated loop (Detect→Decide→Declare) integration with OKF finding documentation; (4) Test corpus structure for 5+ diverse face profiles with frame removal test vectors and flicker test patterns; (5) Three.js optics parameter table for flicker mitigation; (5) Finding linked to VTO project with status done and task log updated.
**Assigned**: OpenClaw  
**Created**: 2026-08-24

## Goal
Research QA methodologies and ground-truth corpus for VTO pipeline validation, focusing on frame removal accuracy metrics, flicker measurement, and test corpus generation per the D3 validated loop.

## Brief
Load `Projects/VTO-Agents/Research Agents/Testing-Researcher.md` as your mission brief; deliver per its Output contract. If the brief doesn't exist, research ground-truth corpus generation for frame detection/removal, per-iteration metrics (clean removal rate, residue percentage, flicker score, confidence stability), and validation harness design, documenting findings per OKF format.

## Method
1. Design 15-iteration full loop measurement harness (per T036 template with D3 plan)
2. Generate synthetic/recorded test corpus with ground-truth mask + inpainted reference
3. Measure per-iteration metrics: clean_removal_rate, residue_percentage, flicker_score, confidence_stability, segmentation_accuracy
4. Document distance-dependent variation and yaw-angle effects on metric consistency
5. Reference F011 orchestration-metrics.md and F011 orchestration-context-hygiene.md findings
6. Design pass/fail thresholds for each metric per validation gate requirements

## Research Findings & Evaluation
TBD — will be populated during sub-session execution

## Known Dead Ends (do not re-propose)
- ProPainter/E2FGVI: no browser ONNX export
- int8 QDQ models — fail on onnxruntime-web WebGPU/JSEP
- Screen recordings as input — only raw webcam frames accepted
- Photo/still mode — video only per D2 and D3
- W001 block-flicker fix pattern must be re-derived on new code

## Result & Context Returned
- Links to finding notes F### in Projects/VTO-Agents/Findings/
- Key results and context for Hermes

## Validation Gate
TBD — will be submitted after finding absorption

## Board Mirroring
`hermes kanban --board vto create "T046 Testing-Researcher: QA & Ground-Truth Corpus" --body "Task note: Projects/VTO/Tasks/T046 testing research qa-ground-truth.md" --created-by hermes --idempotency-key T046`