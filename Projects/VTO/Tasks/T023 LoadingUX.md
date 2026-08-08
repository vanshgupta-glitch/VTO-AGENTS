# T023 — LoadingUX Progressive Loader

project: [[VTO]]
status: assigned
assigned_by: Hermes
assigned_on: 2026-08-04
worker: OpenClaw

## Goal

Implement progressive loading UX with component-level progress, IndexedDB caching, and hover preload.

## Context (from Hermes)

Per D3 §5: engine is ~208–223 MB, first load ~33–36s. Progressive rendering during load is the UX strategy.

**Spec:**
1. Progress bar with component-level detail:
   - "Loading face tracker…" (MediaPipe ~5–10 MB)
   - "Loading glasses detection…" (segmenter ~5–15 MB ONNX)
   - "Loading clean-face builder…" (LaMa ONNX)
   - Each step: MB loaded / total + ETA
2. Progressive rendering: show face mesh + frame as soon as MediaPipe loads (before removal models)
3. IndexedDB caching with content-hash versioned keys
4. Service Worker for offline return visits (<2s from cache)
5. Hover/touch-down preload on "Try On" button (starts MediaPipe fetch)

**Repo:** `C:\Users\ankur.singh\shopify\nmg-vto`

## Definition of done
- [ ] `LoadingUX.ts` module created with progress tracking per model component
- [ ] IndexedDB cache with content-hash keys
- [ ] Service Worker intercepts model fetches (or SW registration stub)
- [ ] Hover preload on Try On button
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