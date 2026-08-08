---
okf: 1
id: ra-rendering
type: research-agent
project: VTO
status: active
created: 2026-08-03
updated: 2026-08-03
tags: [research-agent, rendering, glb, optimization, three-js]
---

# Research Agent — Rendering Software Researcher (optimized GLB)

## Mission

Find the best and most efficient path from heavy authored GLBs to premium-looking, fast-loading storefront rendering — and resolve the project's compression contradiction.

## Why this matters now (project context)

- **Live contradiction to resolve:** research docs recommend **Draco + KTX2/Basis** (70-90% + 40-60% reductions → 0.3-1.5 MB), but the storefront runtime registers **no DRACOLoader/MeshoptDecoder** — compressed GLBs would silently fail today. The local optimizer deliberately avoids `optimize()`, `simplify()`, Draco, Meshopt.
- Baked GLBs from the Annotation Studio hit ~40 MB (splitting de-shares vertices); budgets are ≤3 MB / ≤50k tris (CI-gated); Shopify Files alters GLBs >15 MB and must be referenced via `cdn.shopify.com/3d/models/<hash>/` URLs.
- Placement derives from mesh **bounding boxes** (any geometry change shifts fit) and trimming destroys UVs — optimization must be fit-safe.

## Research questions

1. Decoder economics: real cost of adding DRACOLoader (+WASM) and MeshoptDecoder to the widget (bytes, init ms on mid Android) vs bandwidth saved per GLB — produce the break-even table.
2. Fit-safe pipeline: which gltf-transform ops (weld, dedup, prune, quantize, meshopt, draco, KTX2) provably do NOT move bounding boxes or renumber in ways that break anchors/barycentric mappings? Define the safe recipe + verification step.
3. The 40 MB bake: root-cause vertex de-sharing at temple-split time — known gltf-transform patterns to re-share/weld after splitting without breaking the anchor regexes (`E_Nose_L/R`, `/lens/i` etc.).
4. Materials at budget: KTX2/BasisU for frame textures on mobile GPUs — quality/size sweet spots for acetate patterns; transmission-lens cost on low-end GPUs and cheaper fallbacks.
5. Horizon scan: three.js vs babylon.js loader perf 2026, WebGPU renderer maturity for this use case, and any Shopify CDN constraints on .ktx2/.bin sidecars.

## Method & tools

gltf-transform docs/source, three.js release notes + examples, Khronos KTX2/Draco specs, real measurements via exec (run gltf-transform on a sample GLB from the repo, record sizes; read-only on repo sources — write outputs to scratch). Read `tools/glb-optimizer/` first.

## Output contract

Finding notes `Findings/F<NNN> rendering-<topic>.md` (OKF `type: finding`) — must end with ONE recommended pipeline (authoring → optimize → upload → runtime decoders) with measured before/after sizes and an explicit fit-safety verification step. Link [[VTO]] and this file.
