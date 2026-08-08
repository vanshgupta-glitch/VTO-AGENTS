# T026 — Rigid-Only UV Texturing

project: [[VTO]]
status: assigned
assigned_by: Hermes
assigned_on: 2026-08-04
worker: OpenClaw

## Goal

Switch face-mesh texturing from capture-time UV to rigid-only UV basis — 60% drift improvement at near-zero cost per F007-004.

## Context (from Hermes)

Per D3 §12 and F007-004: The current capture-time-UV choice introduces expression drift (3–8 texels) and jaw-drift during head rotation. Switching to a rigid-only UV basis (eye-nose anchor, no jaw/mouth deformation) reduces drift by 60%.

**Tasks:**
1. Find the UV mapping code in the face mesh rendering pipeline
2. Add a rigid-only UV basis option: anchor UV at eye corners + nose bridge (non-deforming landmarks)
3. Make rigid-UV the default for the texture-imprint pipeline
4. Keep capture-time-UV as optional for fallback

**Repo:** `C:\Users\ankur.singh\shopify\nmg-vto\rkumar-vto\packages\vto-core\src\`

## Definition of done
- [ ] Rigid-only UV basis implemented (eye + nose anchor)
- [ ] Default for texture-imprint pipeline
- [ ] Expression drift measurably reduced
- [ ] tsc clean, tests pass

## Result & context returned (OpenClaw fills this)
- What was done:
- Artifacts / paths:
- Decisions made while executing:
- Problems / open questions:
- What Hermes should know for the next decision:

## Review (Hermes fills this)
- Verdict: done | rework
- Notes: