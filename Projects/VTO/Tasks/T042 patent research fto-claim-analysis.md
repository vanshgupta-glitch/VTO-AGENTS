---
okf: 1
id: T042
type: task
project: VTO
role: OpenClaw
status: in-progress
created: 2026-08-24
claimed: 2026-08-24T12:21:00-07:00
tags: [task, patent-research, fto, in-progress]
---

# T042 Patent-Researcher: FTO & Claim Analysis

**Status**: in-progress  
**Claimed**: 2026-08-24T04:51:00Z  
**Assigned**: OpenClaw  
**Created**: 2026-08-24

## Goal
Research Freedom-to-Operate (FTO) analysis for eyewear try-on technologies, focusing on patent families, claim analysis, and prior art assessment per the D3 validated plan (personal/non-commercial, no patent gating per D2).

## Brief
Load `Projects/VTO-Agents/Research Agents/Patent-Researcher.md` as your mission brief; deliver per its Output contract. If the brief doesn't exist, research patent families related to glasses frame removal, per-pixel segmenters, and webcam-based PD estimation, documenting claim analysis and FTO risk assessment per OKF format. Note: Per D2, attorney/FTO gating is dropped for this personal project — optimize purely for quality + UX.

## Method
1. Map patent families in glasses frame removal and per-pixel segmentation space
2. Analyze claim sets for frame removal, PD estimation, and glasses detection
3. Assess FTO risk against known clusters (FittingBox Family A: US 9,892,561)
4. Research prior art in browser-based face mesh and segmentation
5. Reference F002 (performance targets) and F003 (model selection) findings
6. Document FTO risk table with claim scope and prior art candidates

## Research Findings & Evaluation
TBD — will be populated during sub-session execution

## Known Dead Ends (do not re-propose)
- ProPainter/E2FGVI: no browser ONNX export
- int8 QDQ models — fail on onnxruntime-web WebGPU/JSEP
- Screen recordings as input — only raw webcam frames accepted
- Photo/still mode — video only per D2 and D3
- Attorney-gated FTO — dropped per D2 (personal project)

## Result & Context Returned
- Links to finding notes F### in Projects/VTO-Agents/Findings/
- Key results and context for Hermes

## Validation Gate
TBD — will be submitted after finding absorption

## Board Mirroring
`hermes kanban --board vto create "T042 Patent-Researcher: FTO & Claim Analysis" --body "Task note: Projects/VTO/Tasks/T042 patent research fto-claim-analysis.md" --created-by hermes --idempotency-key T042`