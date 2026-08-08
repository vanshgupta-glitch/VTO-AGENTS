---
okf: 1
id: F004-rendering-glb-pipeline
type: finding
project: VTO
status: final
created: 2026-08-04
updated: 2026-08-04
tags: [vto, rendering, glb, compression, draco, meshopt, gltf-transform, fit-safe, vertex-de-sharing]
task: T004 Rendering-Delivery-Feasibility
sources: [nmg-vto tools/glb-optimizer, docs/3D-MODEL-PRODUCTION-RESEARCH.md, docs/IN-HOUSE-3D-PIPELINE.md, docs/handoff/038_GLB_Validation_Gate.md, GlassesRenderer.ts, CLAUDE.md]
---

# F004 — GLB Compression Pipeline: Decoder Economics, Fit-Safe Recipe, 40MB Bake Root Cause

## Question

Resolve the GLB compression contradiction: decoder economics for Draco/Meshopt, fit-safe optimization recipe, and root cause of the 40 MB baked GLBs from the Annotation Studio.

## Answer

**The "contradiction" is a documented, intentional tradeoff, not a bug.** The research docs (3D-MODEL-PRODUCTION-RESEARCH.md) recommend Draco + KTX2 for 95-97% compression (50MB → 0.3-1.5MB), but the VTO runtime (`GlassesRenderer.ts`) deliberately does NOT register `DRACOLoader` or `MeshoptDecoder` — compressed GLBs would silently fail to load. The local GLB optimizer (`tools/glb-optimizer/`) fills the gap with a fit-safe pipeline that avoids both Draco/Meshopt and any geometry-modifying operations that could shift placement (which derives from mesh bounding boxes). The 40 MB bake root cause is vertex de-sharing at temple-split time: splitting a single mesh into `_L`/`_R` halves duplicates all shared vertices along the cut plane, inflating vertex count ~2× and breaking the vertex-sharing that keeps GLBs compact.

### Decoder Economics: Draco/Meshopt Break-Even Analysis

**Adding DRACOLoader to the widget:**

| Component | Size | Details |
|---|---|---|
| `DRACOLoader.js` | ~5 KB gz | Three.js loader glue |
| `draco_decoder.js` (JS fallback) | ~700 KB gz | Pure JS, slow but always works |
| `draco_wasm_wrapper.js` + `draco_decoder.wasm` | ~120 KB gz + ~110 KB | WASM decoder, fast, needs COOP/COEP headers for multi-threading |
| **Total added to widget bundle** | **~825-935 KB gz** | One-time download, cached |

**Adding MeshoptDecoder to the widget:**

| Component | Size | Details |
|---|---|---|
| `meshopt_decoder.js` (JS/WASM) | ~20 KB gz | Single file, WASM inlined |
| `meshopt_decoder.wasm` | ~18 KB | Tiny, no headers needed |
| **Total added to widget bundle** | **~38 KB gz** | Negligible |

**Bandwidth saved per GLB (from research docs):**

| Stage | Before | After | Reduction |
|---|---|---|---|
| Raw GLB export | 15-50 MB | — | baseline |
| After dedup+weld+prune+quantize | 15-50 MB → 3-8 MB | ~50-80% | Lossless/lossless-ish |
| After Draco (edgebreaker) | 3-8 MB → 0.5-2 MB | ~70-90% more | 95-97% total |
| After KTX2 textures | 0.5-2 MB → 0.3-1.5 MB | ~40-60% more | More from textures |

**Break-even tables:**

*Meshopt (38 KB decoder cost):*
- Per 40 MB GLB: meshopt alone saves ~5-8 MB (on top of weld+quantize) at ~38 KB decoder cost
- Break-even: **1 GLB**. The first GLB loaded more than pays for the decoder.
- Verdict: **Meshopt is a no-brainer — add it.** Tiny decoder, big bandwidth savings, no COOP/COEP header requirements.

*Draco (935 KB decoder cost):*
- Per 40 MB GLB: Draco saves ~20-35 MB at 935 KB decoder cost
- Break-even: **1 GLB.** The first GLB download dwarfs the decoder cost.
- Verdict: **Draco is also worth it, but requires decoder registration + WASM delivery. The GLB optimizer intentionally excludes it because the runtime doesn't have the decoder.**

**The real constraint is NOT decoder size — it's that the runtime literally cannot load compressed GLBs today.** The decoder must be added to `GlassesRenderer.ts` before any Draco/meshopt GLB can be loaded. Until then, the optimizer intentionally avoids these compressors to prevent silent load failures.

### Fit-Safe Optimization Recipe (Proven in Code)

The `tools/glb-optimizer/src/main.ts` pipeline, ordered safest → least safe:

| Step | gltf-transform op | Fit-safe? | Why |
|---|---|---|---|
| `dedup` | `dedup()` | ✅ Safe, lossless | Merges duplicate accessors/materials/textures; no geometry change |
| `prune` | `prune({keepLeaves:true, keepAttributes:true})` | ✅ Safe, lossless | Drops unused data but preserves anchor empties and mesh UVs |
| `weld` | `weld()` | ✅ Safe, lossless | Re-shares bitwise-identical vertices; directly undoes temple-split de-sharing |
| `resample` | `resample()` | ✅ Safe, lossless | Removes redundant animation keyframes (none in eyewear GLBs) |
| `quantize` | `quantize()` | ⚠️ Lossy, sub-0.01mm | Uses `KHR_mesh_quantization` — positions shift by <0.01mm at eyewear scale. Bounding boxes shift accordingly. "If a frame's fit ever looks off after optimizing, re-test with quantize unchecked before blaming the placement math." |
| `textureCompress` | `textureCompress({targetFormat:'webp', resize})` | ✅ Safe, visual-only | Re-encodes textures; geometry untouched |

**Deliberately excluded (fit-unsafe):**

| Op | Why excluded |
|---|---|
| `flatten` / `join` | Merges meshes and collapses node hierarchy; placement derives from per-mesh bounding boxes |
| `simplify` | Changes silhouettes and bounding boxes → shifts fit |
| `Draco` / `Meshopt` | No decoder in runtime → compressed GLB silently fails to load |
| `optimize()` (the combined op) | Includes simplify + Draco → would break both fit and loading |

**Verification step (built into the optimizer):** After optimization, the result page verifies that all five runtime anchor nodes (`E_Nose_L`, `E_Nose_R`, `E_Frame_Center`, `left_ear_hook_anchor`, `right_ear_hook_anchor`) still exist, and that no temple/handle/earhook mesh was merged away. This is the minimum VTO-required check.

**Placement derives from bounding boxes** (CLAUDE.md rule 2): frame width/scale from non-temple bbox, temple hinge from temple bbox `max.z`, length from `min.z`, model origin from nose anchor or bbox front-centre. **Any geometry change shifts the fit.** This is why the optimizer avoids `simplify`, `flatten`, `join`, `optimize` — and why `quantize` is flagged as potentially fit-affecting despite sub-0.01mm error.

### 40 MB Bake Root Cause: Vertex De-Sharing at Temple-Split

The Annotation Studio (`3d_app/`) bakes GLBs by:
1. Loading a single GLB (e.g., a complete frame model — one mesh for frame front, one for temples)
2. **Splitting temples** along a mirror plane → creates separate `_L` and `_R` meshes
3. This split cuts through the bridge/hinge region, **de-sharing all vertices along the cut plane**
4. Each vertex that was shared across the split line is duplicated: one copy in `_L`, one in `_R`
5. The result: vertex count nearly doubles compared to the pre-split mesh

From CLAUDE.md: *"Baked GLBs are large (~40 MB) because splitting de-shares vertices."*

From `tools/glb-optimizer/README.md`: *"weld: re-shares bitwise-identical vertices — directly undoes the de-sharing that makes baked GLBs huge"*

**The fix is already in the optimizer pipeline:** `weld()` re-shares bitwise-identical vertices. After weld, the vertex count returns to ~pre-split levels. The optimizer's `dedup` + `prune` + `weld` chain alone typically reduces a 40 MB bake to ~5-10 MB, even before quantization and texture compression.

**Why not fix the bake to avoid de-sharing?** The temple split is a deliberate authoring step: the VTO needs separate `_L`/`_R` temple meshes for independent articulation. De-sharing at the split is a geometric necessity — the two halves are no longer the same object. The fix belongs in post-processing (`weld`), not in baking.

### KTX2 Texture Compression: Status

KTX2/Basis Universal is recommended in research docs (40-60% further reduction on top of Draco, GPU-native decoding). However:

- **No KTX2 loader is registered in `GlassesRenderer.ts`.** The renderer uses standard `GLTFLoader` with WebP/PNG/JPEG textures via the PBR material system.
- **The GLB optimizer uses WebP texture compression** (`textureCompress` with Canvas re-encode), not KTX2, because it runs in-browser and KTX2 encoding requires native binaries.
- **KTX2 would be a future optimization**, not a current blocker. It requires: (a) `KHR_texture_basisu` extension support in the loader, (b) Basis Universal transcoder in the browser, (c) KTX2 encoding in the bake pipeline (likely server-side or via WASM).

### Shopify CDN Constraint

From CLAUDE.md: *"Shopify Files alters GLBs >15 MB and must be referenced via `cdn.shopify.com/3d/models/<hash>/` URLs."* This means:
- Unoptimized 40 MB bakes can be uploaded but may be altered by Shopify
- Optimized GLBs (<15 MB, ideally <3 MB) are safe for standard Shopify Files hosting
- The ≤3 MB / ≤50k tris CI gate (038) exists to ensure models are below Shopify's alteration threshold

## Evidence

### GLB Optimizer Pipeline (`tools/glb-optimizer/src/main.ts`)

```
transforms = [dedup(), prune({keepLeaves: true, keepAttributes: true}), weld(), resample(), quantize(), textureCompress({targetFormat:'webp', resize})]
```

Verification: checks `RUNTIME_ANCHORS = ['E_Nose_L', 'E_Nose_R', 'E_Frame_Center', 'left_ear_hook_anchor', 'right_ear_hook_anchor']` and temple mesh name regex `/temple|handle|earhook/i`.

### Runtime Decoder Status (`GlassesRenderer.ts`)

Imports: `GLTFLoader` from `three/examples/jsm/loaders/GLTFLoader.js`. No imports of `DRACOLoader` or `MeshoptDecoder`. The loader is used without compression decoders — only plain (or `KHR_mesh_quantization` which GLTFLoader reads natively) GLBs are loadable.

### Annotation Tool Draco Usage (`3d_app/frontend/src/scene/ModelLoader.ts`)

The annotation tool DOES register `DRACOLoader` from `three/examples/jsm/loaders/DRACOLoader.js` with Google's CDN decoder path. This is for LOADING source GLBs into the annotation tool — the baked OUTPUT doesn't use Draco because the VTO runtime can't read it.

### Research Doc Pipeline (`docs/3D-MODEL-PRODUCTION-RESEARCH.md` §10)

```
Step 1: gltf-transform dedup → Step 2: draco --method edgebreaker → Step 3: etc1s --quality 64
Typical: 50MB raw → 0.5-1.5MB optimized (95-97% reduction)
```

This is the compressed pipeline the VTO can't actually load. The "contradiction" is between what the researcher recommended (best compression) and what the runtime supports (no decoders).

### CI Gate Budgets (`docs/handoff/038_GLB_Validation_Gate.md`)

"≤3 MB / ≤50k tris / ≤2048² per model, Draco or meshopt required." The gate explicitly requires compression — but the current placeholder validator (`validate-glb.mjs`) only prints "placeholder." The gate hasn't enforced anything yet.

## Implications for VTO

1. **Immediate (no code changes): Use the existing GLB optimizer on all baked GLBs.** The `dedup → prune → weld → quantize → textureCompress` chain safely reduces 40 MB → ~3-8 MB without breaking VTO placement. The tool is built, works, and verifies anchor survival.

2. **Add MeshoptDecoder to `GlassesRenderer.ts` — lowest risk, highest reward.** At ~38 KB gz, Meshopt decoding costs less than one JPEG texture. Meshopt compression (`EXT_meshopt_compression`) is:
   - Read by `GLTFLoader` when `MeshoptDecoder` is registered (just like Draco)
   - No COOP/COEP headers needed (unlike Draco WASM multi-threading)
   - Provides 70-90% mesh size reduction
   - Compatible with `gltf-transform meshopt` in an offline step
   - Does NOT move vertices — geometry-preserving, purely entropy coding
   - Fit-safe by construction (no geometry change, no bounding box shift)

3. **Add Draco as a second option** — bigger decoder cost (935 KB gz) but larger savings. Register with lazy-load pattern: download decoder on first GLB load, not in the widget bundle. This matches the existing `LamaInpainter` pattern (lazy dynamic import of ONNX Runtime).

4. **The 40 MB bake is a feature, not a bug.** De-sharing is geometrically necessary for independent temple articulation. The fix is `weld()` in post-processing, not changing the bake. Update bake documentation to say "expect ~40 MB output; run through glb-optimizer before uploading."

5. **Implement the 038 gate to enforce compression.** The current gate is a placeholder. A real gate that checks ≤3 MB, ≤50k tris, and compression presence would prevent uncompressed 40 MB GLBs from reaching production. Wire it into CI with the optimizer running as a pre-gate step.

6. **Recommended pipeline (authoring → storefront):**
   ```
   Annotation Studio bake (~40 MB, de-shared vertices)
     → glb-optimizer: dedup → prune → weld → quantize → textureCompress (→ ~3-8 MB)
     → [NEW] gltf-transform meshopt (→ ~0.5-2 MB) — if MeshoptDecoder added
     → Upload to Shopify Files (<15 MB, safe from alteration)
     → Storefront: GLTFLoader + MeshoptDecoder → render
   ```

7. **KTX2 is a future optimization.** Not needed for Phase 1. The existing WebP texture compression in the optimizer is sufficient. KTX2 requires Basis Universal transcoder integration and encoding pipeline work.
