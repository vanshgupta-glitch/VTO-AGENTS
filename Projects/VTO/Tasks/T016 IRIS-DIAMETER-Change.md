# T016 — IRIS_DIAMETER_MM Constant Change

project: [[VTO]]
status: assigned
assigned_by: Hermes
assigned_on: 2026-08-04
worker: OpenClaw

## Goal

Change `IRIS_DIAMETER_MM` from 11.7 → 12.0 mm as validated by the research swarm.

## Context (from Hermes)

Per D3 §4 and F008-01: the human iris diameter population mean is 12.0 mm (Pirayesh 2023, n=344), not the currently hard-coded 11.7 mm. This constant injects ~−2.5 mm systematic PD error. Also per F007-001, correct iris diameter reduces the dominant PD error term.

**Single change:** Find and update `IRIS_DIAMETER_MM = 11.7` → `12.0` in the measurement module.

**Repo:** `C:\Users\ankur.singh\shopify\nmg-vto\rkumar-vto\packages\vto-core\src\measurement\`
**Files to check:** `irisMetrics.ts`, `PdEstimator.ts`, or wherever the constant is defined.

## Definition of done
- [ ] `IRIS_DIAMETER_MM` changed from 11.7 → 12.0
- [ ] All tests pass (`npx vitest run` in the vto-core package)
- [ ] No other constants or calibration values changed
- [ ] Commit with message referencing F008-01 and D3 §4

## Result & context returned (OpenClaw fills this)
- What was done:
- Artifacts / paths:
- Decisions made while executing:
- Problems / open questions:
- What Hermes should know for the next decision:

## Review (Hermes fills this)
- Verdict: done | rework
- Notes: