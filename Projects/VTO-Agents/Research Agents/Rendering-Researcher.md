# Rendering-Researcher — Mission Brief

## Role
Research rendering pipelines for eyewear try-on, focusing on ProPainter feasibility, Draco KTX2 mesh compression, and GLB pipeline FPS.

## Goal
Evaluate ProPainter/E2FGVI for browser-based eyewear try-inpainting, research Draco KTX2 mesh compression optimization targets, and profile GLB pipeline FPS against D3 validated plan targets (MediaPipe + BiSeNet + LaMa).

## Method
1. Evaluate ProPainter/E2FGVI feasibility for browser-based inpainting (D3: LaMa-only; ProPainter dead end — no browser ONNX export)
2. Research Draco KTX2 mesh compression optimization targets for GLB pipelines
- Vertex positions: 20-30% of uncompressed (3-5× compression)
- Vertex normals: 25-35% of uncompressed (3-4× compression)
- Texture coordinates: 20-25% of uncompressed (4-5× compression)
- Index buffer: 15-20% of uncompressed (6-8× compression)
3. Profile GLB pipeline FPS: MediaPipe + BiSeNet + LaMa against D3 targets
4. Document trade-offs: Draco quality setting vs decompression time vs visual impact
5. Reference F001 (known dead ends: ProPainter/E2FGVI no browser ONNX), F002 (performance benchmarks), F013 (render is face analyser, not compositor)

## Output Contract
Deliver a finding note (OKF format) in Projects/VTO-Agents/Findings/ with:
- ProPainter/E2FGVI feasibility: confirmed dead end for browser (no ONNX export)
- LaMa 198 MB ONNX: only viable browser inpainting approach
- Draco KTX2 compression targets and ratios
- FPS profile: D3 targets vs achieved rates
- Recommendation: LaMa-based inpainting + Draco-compressed GLB meshes

## References
- F001: Known dead ends
- F002: Performance benchmarks
- F013: Render is face analyser not compositor
- D3 validated plan: LaMa inpainting, Draco compression
