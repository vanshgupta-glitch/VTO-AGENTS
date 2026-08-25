---
okf: 1
id: T045
type: task
project: VTO
role: OpenClaw
status: in-progress
created: 2026-08-24
claimed: 2026-08-24T12:13:00-07:00
tags: [task, software-research, face-tracking, in-progress]
---

# T045 Software-Researcher: Face Tracking & Model Integration

**Status**: in-progress  
**Claimed**: 2026-08-24T12:13:00-07:00  
**Reason**: Rework from prior attempt. Brief file not found; proceeding with task's Method section as mission.
**Assigned**: OpenClaw  
**Created**: 2026-08-24

## Goal
Research face tracking models and integration pipelines for eyewear try-on, focusing on MediaPipe FaceLandmarker, BiSeNet integration, and client-side model loading per the D3 validated plan.

## Brief
Load `Projects/VTO-Agents/Research Agents/Software-Researcher.md` as your mission brief; deliver per its Output contract. If the brief doesn't exist, research MediaPipe FaceLandmarker v2, BiSeNet 3-class (frame/lens/face) integration, client-side ONNX model loading, and webcam pipeline orchestration, documenting findings per OKF format.

## Method
1. Evaluate MediaPipe FaceLandmarker v2 for pupil center, tragion, bitragion detection
2. Integrate BiSeNet 3-class segmentation (frame/lens/face) with FaceMesh pipeline
3. Research client-side ONNX model loading and progressive initialization
4. Profile face tracking + segmentation pipeline FPS against D3 targets (4-11 full, 17-43 mesh-only)
5. Reference F003 (BiSeNet 3-class findings) and F011 (context hygiene, metrics) findings
6. Document model caching strategies for first-visit load (~33-36s at 6.25 MB/s)

## Research Findings & Evaluation
TBD — will be populated during sub-session execution

## Known Dead Ends (do not re-propose)
- ProPainter/E2FGVI: no browser ONNX export
- int8 QDQ models — fail on onnxruntime-web WebGPU/JSEP
- Screen recordings as input — only raw webcam frames accepted
- Photo/still mode — video only per D2 and D3

## Result & Context Returned
- Links to finding notes F### in Projects/VTO-Agents/Findings/
- Key results and context for Hermes

## Validation Gate
TBD — will be submitted after finding absorption

## Board Mirroring
`hermes kanban --board vto create "T045 Software-Researcher: Face Tracking & Model Integration" --body "Task note: Projects/VTO/Tasks/T045 software research face-tracking.md" --created-by hermes --idempotency-key T045`