---
okf: 1
id: T047
type: task
project: VTO
role: OpenClaw
status: assigned
created: 2026-08-24
tags: [task, critic-adversarial-review, assigned]
---

# T047 Critic-Researcher: Adversarial Review Integration

**Status**: rework  
**Reason**: Sub-agent could not locate the Critic-Researcher.md brief file. Needs manual research on adversarial review integration, Catalyst review protocols, refutation documentation, and REFUTED-CLAIMS.md register. Will be re-assigned after investigation.
**Assigned**: OpenClaw  
**Created**: 2026-08-24

## Goal
Research and integrate adversarial review (Catalyst) into the VTO research-validation pipeline, focusing on Tier 1, 2, and 3 review protocols, refutation documentation, and the REFUTED-CLAIMS.md register per F011 orchestration-adversarial-review.md.

## Brief
Load `Projects/VTO-Agents/Research Agents/Critic-Researcher.md` as your mission brief; deliver per its Output contract. Research the exact process for Catalyst refutation runs on findings and candidates, documentation format for refutations, and how to integrate adversarial review into the VTO task loop, documenting findings per OKF format.

## Method
1. Document Tier 1 adversarial review protocol (single-claim refutation per finding before candidate compilation)
2. Document Tier 2 candidate-level adversarial review (validate.ps1 Stage 1 on Haiku)
3. Document Tier 3 deep milestone adversarial swarm (3-5 parallel sub-agents for go/no-go decisions)
4. Design refutation documentation format (Findings/F<NNN> critic-<topic>.md + critic-landscape.md rollup)
5. Maintain REFUTED-CLAIMS.md register pattern (date | finding | claim | why refuted | refuter)
6. Reference F011 orchestration-adversarial-review.md, F011 orchestration-context-hygiene.md, and Orchestration-Flows.md for review flow configurations

## Research Findings & Evaluation
TBD — will be populated during sub-session execution

## Known Dead Ends (do not re-propose)
- ProPainter/E2FGVI: no browser ONNX export
- int8 QDQ models — fail on onnxruntime-web WebGPU/JSEP
- Screen recordings as input — only raw webcam frames accepted
- Photo/still mode — video only per D2 and D3
- Confirmation bias in review — adversarial prompting must find flaws, not confirm

## Result & Context Returned
- Links to finding notes F### in Projects/VTO-Agents/Findings/
- Key results and context for Hermes

## Validation Gate
TBD — will be submitted after finding absorption

## Board Mirroring
`hermes kanban --board vto create "T047 Critic-Researcher: Adversarial Review Integration" --body "Task note: Projects/VTO/Tasks/T047 critic research adversarial-review.md" --created-by hermes --idempotency-key T047`