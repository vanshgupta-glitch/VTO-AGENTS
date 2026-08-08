# T017 — Yaw Correction: solvePnP Replaces Quadratic Boost

project: [[VTO]]
status: assigned
assigned_by: Hermes
assigned_on: 2026-08-04
worker: OpenClaw

## Goal

Replace the hand-tuned progressive yaw boost with a solvePnP-based yaw estimate — reducing yaw MAE from ~7° to ~2° per F007-002.

## Context (from Hermes)

Per D3 §11 and F007-002: the current code applies a hand-tuned progressive yaw boost to MediaPipe landmarks because MediaPipe yaw plateaus at large head turns. F007-002 benchmarked three alternatives:

- **solvePnP** (recommended): ~2° MAE at ±40-60°. Uses nose+eye 3D model points with MediaPipe 2D landmarks + camera intrinsics.
- MediaPipe raw: ~7° MAE at large turns
- Current quadratic boost: ~7° MAE

**Method:**
1. Find the yaw computation in the pose module
2. Implement solvePnP: define 3D model points (nose tip, eye corners, etc.), run cv::solvePnP or equivalent JS implementation, extract yaw from rotation matrix
3. Replace the quadratic boost with solvePnP yaw
4. Cross-validate against MediaPipe's 4×4 matrix yaw at frontal poses

**Repo:** `C:\Users\ankur.singh\shopify\nmg-vto\rkumar-vto\packages\vto-core\src\`

## Definition of done
- [ ] solvePnP yaw computation implemented and wired into the pose pipeline
- [ ] Old quadratic boost code removed or gated behind a flag
- [ ] Yaw validated at ±40-60° (should show improvement over current MAE)
- [ ] All tests pass
- [ ] Commit referencing F007-002 and D3 §11

## Result & context returned (OpenClaw fills this)
- What was done:
- Artifacts / paths:
- Decisions made while executing:
- Problems / open questions:
- What Hermes should know for the next decision:

## Review (Hermes fills this)
- Verdict: done | rework
- Notes: