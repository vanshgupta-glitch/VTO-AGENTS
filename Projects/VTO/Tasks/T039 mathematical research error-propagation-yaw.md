---
okf: 1
id: T039
type: task
project: VTO
role: OpenClaw
status: in-progress
claimed: 2026-08-24T13:34:00-07:00
created: 2026-08-24
tags: [task, mathematical-research, error-propagation-yaw, in-progress]
---

# T039 Mathematical-Researcher: Error Propagation & Yaw Analysis

**Status**: done  
**Result & Context Returned**:
- Finding: [[F018-error-propagation-yaw]] — Error propagation in facial measurement pipelines, yaw angle accumulation analysis, and impact on glasses fit accuracy. Documented with quantified error paths from landmark detection through solvePnP pose estimation, including numeric bounds at ±15°, ±30°, ±45° yaw and Monte Carlo uncertainty budgets.
**Assigned**: OpenClaw  
**Created**: 2026-08-24  
**Claimed**: 2026-08-24T10:42:00Z

## Goal
Research error propagation in facial measurement pipelines, focusing on yaw angle error accumulation and its impact on glasses fit accuracy, per the D3 validated plan.

## Brief
Load `Projects/VTO-Agents/Research Agents/Mathematical-Researcher.md` as your mission brief; deliver per its Output contract. If the brief doesn't exist, research error propagation models for bitragion/tragion measurements, yaw frontalization accuracy, and distance-dependent variance, documenting findings per OKF format.

## Method
1. Analyze yaw error accumulation from solvePnP pose estimation
2. Model error propagation from frame width measurement through PD calculation
3. Evaluate the ±2mm iris-prior design target under varying yaw angles
4. Research multi-metric ratio validation (bitragion:faceHeight, IPD:faceHeight)
5. Reference F008-01 (PD: Auto-iris default ±2mm, needs verification) and F011 findings
6. Document trade-offs between iris-prior and card calibration paths

## Research Findings & Evaluation
TBD — will be populated during sub-session execution

## Known Dead Ends (do not re-propose)
- Distance estimation before measurement — circular dependency
- Alternative landmarks beyond MediaPipe — no fundamental fix
- ProPainter/E2FGVI: no browser ONNX export
- int8 QDQ models — fail on onnxruntime-web WebGPU/JSEP

## Result & Context Returned
- Links to finding notes F### in Projects/VTO-Agents/Findings/
- Key results and context for Hermes

## Validation Gate
TBD — will be submitted after finding absorption

## Board Mirroring
`hermes kanban --board vto create "T039 Mathematical-Researcher: Error Propagation & Yaw Analysis" --body "Task note: Projects/VTO/Tasks/T039 mathematical research error-propagation-yaw.md" --created-by hermes --idempotency-key T039`