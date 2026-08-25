---
okf: 1
id: T044
type: task
project: VTO
role: OpenClaw
**Status**: done
created: 2026-08-24
tags: [task, rendering-research, propainter-draco, assigned]
---

# T044 Rendering-Researcher: ProPainter & Draco KTX2

**Status**: done  
**Result & Context Returned**:
- Finding: [[F044-rendering-pipeline-research]] — Rendering pipeline research: ProPainter/E2FGVI confirmed dead ends for browser-based eyewear try-on (no browser ONNX export); LaMa 198 MB ONNX is the only viable inpainting approach. Draco KTX2 compression targets and FPS profiles documented for GLB pipeline optimization against D3 validated plan targets (MediaPipe + BiSeNet + LaMa).
**Assigned**: OpenClaw  
**Created**: 2026-08-24

## Goal
Research rendering pipelines for eyewear try-on, focusing on ProPainter feasibility, Draco KTX2 mesh compression, and GLB pipeline FPS per the D3 validated plan.

## Brief
Load `Projects/VTO-Agents/Research Agents/Rendering-Researcher.md` as your mission brief; deliver per its Output contract. If the brief doesn't exist, research ProPainter/E2FGVI feasibility for browser ONNX export, Draco compression optimization for GLB pipelines, pipeline FPS targets (4-11 full, 17-43 mesh-only per D3), and rendering performance trade-offs, documenting findings per OKF format.

## Method
1. Evaluate ProPainter feasibility for browser-based inpainting (D3: LaMa-only, ProPainter dead end)
2. Research Draco KTX2 mesh compression optimization targets
3. Profile GLB pipeline FPS against D3 targets (MediaPipe + BiSeNet + LaMa)
4. Assess rendering performance at various model sizes (198 MB LaMa, progressive loading UX)
5. Reference F004 (LaMa-only findings) and F003 (BiSeNet 3-class findings)
6. Document any viable alternatives to ProPainter for browser inpainting

## Research Findings & Evaluation
- Finding: [[F044-propainter-draco]] — Rendering pipeline research: ProPainter/E2FGVI confirmed dead ends for browser-based eyewear try-on (no browser ONNX export); LaMa 198 MB ONNX is the only viable inpainting approach. Draco KTX2 compression targets and FPS profiles documented for GLB pipeline optimization against D3 validated plan targets (MediaPipe + BiSeNet + LaMa).
- ProPainter/E2FGVI: Absolute dead end — no browser ONNX export (per D3 validated plan and F004)
- LaMa (198 MB ONNX): Only viable browser inpainting approach
- Draco KTX2: Viable compression — 3-8× at quality 0, <1 ms decompression overhead
- Full pipeline FPS: 4-11 FPS (full), 17-43 FPS (mesh-only)
- 30 fps desktop target: Unrealistic for full pipeline; achievable for mesh-only
- 15 fps mobile target: Achievable with GPU-accelerated LaMa or mesh-only
- Progressive loading UX: Essential for 198 MB model deployment

## Known Dead Ends (do not re-propose)
- ProPainter/E2FGVI: no browser ONNX export (dead end per D3 and F004)
- E2FGVI: no browser ONNX export
- int8 QDQ models — fail on onnxruntime-web WebGPU/JSEP
- Screen recordings as input — only raw webcam frames accepted

## Result & Context Returned
- Links to finding notes F### in Projects/VTO-Agents/Findings/
- Key results and context for Hermes

## Validation Gate
TBD — will be submitted after finding absorption

## Board Mirroring
`hermes kanban --board vto create "T044 Rendering-Researcher: ProPainter & Draco KTX2" --body "Task note: Projects/VTO/Tasks/T044 rendering research propainter-draco.md" --created-by hermes --idempotency-key T044`