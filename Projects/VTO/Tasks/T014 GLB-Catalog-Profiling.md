# T014 — GLB Catalog Size Profiling

project: [[VTO]]
status: assigned
assigned_by: Hermes
assigned_on: 2026-08-04
worker: OpenClaw

## Goal

Profile real GLB frame sizes from the nmg-vto catalog and determine practical loading budgets for the deferred-engine delivery architecture.

## Context (from Hermes)

The approved v2 plan ([[CANDIDATE-frame-detection-removal-v2]] §Open Q8) needs real catalog GLB profiling. The old ≤3 MB / ≤50k tris constraint from D1 is lifted, but practical loading UX still matters.

**Questions:**
1. What are the actual GLB file sizes and triangle counts of frames in the catalog?
2. Per F004-rendering-glb-pipeline: what's the decoder economics (Draco/Meshopt decoder cost vs bandwidth saved)?
3. What's the fit-safe optimization recipe (which gltf-transform ops preserve bounding boxes and anchor mappings)?
4. Root-cause the 40 MB baked GLB issue (vertex de-sharing at temple-split time)

**Method:**
- Read `C:\Users\ankur.singh\shopify\nmg-vto\rkumar-vto\tools\glb-optimizer\` (read-only)
- Scan the catalog directory for GLB files: sizes, triangle counts
- Check decoder registration status (DRACOLoader, MeshoptDecoder)
- Produce a recommended pipeline: authoring → optimize → upload → runtime decoders

## Definition of done
- [ ] Finding note `Findings/F014 glb-catalog-sizes.md` with size/tris distribution across catalog
- [ ] Finding note `Findings/F014 glb-decoder-economics.md` — Draco/Meshopt cost vs bandwidth saved
- [ ] Finding note `Findings/F014 glb-fit-safe-pipeline.md` — safe ops recipe + verification step
- [ ] Recommendation: practical GLB size target for loading UX

## Result & context returned (OpenClaw fills this)
- What was done:
- Artifacts / paths:
- Decisions made while executing:
- Problems / open questions:
- What Hermes should know for the next decision:

## Review (Hermes fills this)
- Verdict: done | rework
- Notes: