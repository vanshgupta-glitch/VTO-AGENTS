---
okf: 1
id: T043
type: task
project: VTO
role: OpenClaw
status: in-progress
claimed: 2026-08-24T14:07:00-07:00
created: 2026-08-24
tags: [task, physics-research, lens-optics, in-progress]
---

# T043 Physics-Researcher: Lens Optics & Ray Tracing

**Status**: assigned  
**Result & Context Returned**:
- Finding: [[F001 lens-optics]] — Lens optics & ray tracing for eyewear try-on, documented with refractive index modeling for lens materials (CR-36, CR-39, 1.50, 1.60, 1.67, 1.74), division distortion model with 3 radial coefficients, BiSeNet 3-class segmentation (frame/lens/face) → optics model interface, FPS targets (full pipeline 4-11 FPS, mesh-only 17-43 FPS), AR coating simulation, and Three.js parameter table. Finding created in VTO-Agents/Findings directory.
**Assigned**: OpenClaw  
**Created**: 2026-08-24

## Goal
Research lens optics and ray tracing for eyewear try-on, focusing on refractive index modeling, lens distortion correction, and glasses render realism per the D3 validated pipeline.

## Brief
Load `Projects/VTO-Agents/Research Agents/Physics-Researcher.md` as your mission brief; deliver per its Output contract. If the brief doesn't exist, research refractive index models for corrective lenses, ray tracing for glasses rendering, distortion correction pipelines, and how BiSeNet 3-class segmentation (frame/lens/face) interfaces with optics models, documenting findings per OKF format.

## Method
1. Model refractive index effects for various lens materials (CR-36, polycarbonate, high-index)
2. Research distortion correction models for curved lens surfaces
3. Evaluate how segmenter mask (frame/lens/face) interfaces with render pipelines
4. Document ray tracing approaches for realistic glasses occlusion and refraction
5. Reference F003 (BiSeNet 3-class findings) and F004 (LaMa inpainting) findings
6. Assess performance impact of optics models on the 4-11 FPS target (D3)

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
`hermes kanban --board vto create "T043 Physics-Researcher: Lens Optics & Ray Tracing" --body "Task note: Projects/VTO/Tasks/T043 physics research lens-optics.md" --created-by hermes --idempotency-key T043`