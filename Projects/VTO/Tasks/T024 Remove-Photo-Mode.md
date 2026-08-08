# T024 — Remove Photo/Still Mode

project: [[VTO]]
status: assigned
assigned_by: Hermes
assigned_on: 2026-08-04
worker: OpenClaw

## Goal

Remove all photo capture, still-image processing, and server-side render endpoint stubs. Video-only per D2.

## Context (from Hermes)

Per D3 §6: "Video only — no photo/still mode. All features run on live `getUserMedia` webcam stream."

**Tasks:**
1. Search for photo capture components, still-image processing, `POST render` endpoint references
2. Remove or gate behind a disabled feature flag
3. Keep only live-webcam path (`getUserMedia` → MediaPipe → segmenter → imprint → inpainting → render)
4. Verify no photo path remains in the UI or pipeline

**Repo:** `C:\Users\ankur.singh\shopify\nmg-vto`

## Definition of done
- [ ] Photo capture UI components removed or disabled
- [ ] Still-image processing pipeline removed or gated
- [ ] Server-side render endpoint stubs removed
- [ ] Live webcam path verified intact
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