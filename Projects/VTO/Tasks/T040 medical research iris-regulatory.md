---
okf: 1
id: T040
type: task
project: VTO
role: OpenClaw
status: done
created: 2026-08-24
completed: 2026-08-24
claimed: 2026-08-24T14:24:00-07:00
tags: [task, medical-research, iris-regulatory, done]
---

# T040 Medical-Researcher: Iris & Regulatory Compliance

**Status**: done (vto-research heartbeat tick 2026-08-24; executor: OpenClaw claude-haiku-4-5 — prior run completed)  
**Result & Context Returned**:
- Finding: [[F019-iris-regulatory]] — Iris-based PD calibration accuracy vs ±2mm target, regulatory compliance (BIPA/CCPA/GDPR/FDA), client-side vs server-side privacy implications. **Adversarial Review**: FINDING SOUND (all claims verified, minor caveats noted in F019-adversarial-review.md).
**Assigned**: OpenClaw  
**Created**: 2026-08-24  
**Claimed**: 2026-08-24T14:24:00-07:00

## Goal
Research iris-based PD (pupillary distance) calibration methods and regulatory compliance for eyewear try-on, focusing on accuracy standards and user privacy.

## Brief
Load `Projects/VTO-Agents/Research Agents/Medical-Researcher.md` as your mission brief; deliver per its Output contract. If the brief doesn't exist, research iris-prior PD accuracy (±2mm per D3), regulatory standards for distance measurement, user consent patterns for biometric data, and privacy compliance for client-side eyewear try-on, documenting findings per OKF format.

## Method
1. Evaluate iris-prior PD accuracy against D3 ±2mm design target
2. Research regulatory guidelines for biometric data collection in consumer apps
3. Document user consent patterns for iris/face data processing
4. Assess privacy implications of client-side vs server-side PD calculation
5. Reference F008-01 (PD: Auto-iris default ±2mm, needs verification) and F010 protocol
6. Document any compliance requirements for US/EU markets

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
`hermes kanban --board vto create "T040 Medical-Researcher: Iris & Regulatory Compliance" --body "Task note: Projects/VTO/Tasks/T040 medical research iris-regulatory.md" --created-by hermes --idempotency-key T040`