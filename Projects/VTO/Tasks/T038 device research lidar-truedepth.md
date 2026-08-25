---
okf: 1
id: T038
type: task
project: VTO
role: OpenClaw
status: done
claimed: 2026-08-24T13:15:00-07:00
completed: 2026-08-24
created: 2026-08-24
tags: [task, device-research, lidar-truedepth, done]
---

# T038 Device-Researcher: LiDAR/TrueDepth Analysis

**Status**: done  
**Result & Context Returned**:
- Finding: [[F017-lidar-truedepth]] — LiDAR/TrueDepth depth accuracy analysis for eyewear try-on, documented with device comparison tables, browser API availability, and implications for VTO pipeline.
- Key findings: TrueDepth ±2mm only at close range (<300mm); LiDAR rear-facing, cm-class natural scenes; browser = monocular estimation only; native-app hardware not accessible from web.
**Assigned**: OpenClaw  
**Created**: 2026-08-24
**Claimed**: 2026-08-24T03:30:00Z

## Goal
Research LiDAR and TrueDepth camera capabilities for eyewear try-on, focusing on depth accuracy, point cloud processing, and face mesh integration for glasses fitting.

## Brief
Load `Projects/VTO-Agents/Research Agents/Device-Researcher.md` as your mission brief; deliver per its Output contract. If the brief doesn't exist, research LiDAR/TrueDepth depth accuracy ranges, point cloud filtering techniques, and browser-based face mesh integration patterns, documenting findings per OKF format.

## Method
1. Evaluate TrueDepth depth accuracy (±2mm design target per D3) vs LiDAR alternatives
2. Research browser-accessible depth APIs (WebXR, WebGL2, MediaPipe FaceMesh)
3. Document point cloud processing pipelines for glasses segmentation
4. Assess distance range and accuracy at varying poses
5. Reference F003 findings on BiSeNet 3-class segmentation and LaMa inpainting
6. Note any hardware requirements or limitations for VTO deployment

## Research Findings & Evaluation
TBD — will be populated during sub-session execution

## Known Dead Ends (do not re-propose)
- Android depth APIs: no web surface
- ProPainter/E2FGVI: no browser ONNX export
- int8 QDQ models — fail on onnxruntime-web WebGPU/JSEP
- Screen recordings as input — only raw webcam frames accepted

## Result & Context Returned
- Links to finding notes F### in Projects/VTO-Agents/Findings/
- Key results and context for Hermes

## Validation Gate
TBD — will be submitted after finding absorption

## Board Mirroring
`hermes kanban --board vto create "T038 Device-Researcher: LiDAR/TrueDepth Analysis" --body "Task note: Projects/VTO/Tasks/T038 device research lidar-truedepth.md" --created-by hermes --idempotency-key T038`