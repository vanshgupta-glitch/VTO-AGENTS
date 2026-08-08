# T005 — Physics Materials & Optics

project: [[VTO]]
status: done
assigned_by: Hermes
assigned_on: 2026-08-04
worker: OpenClaw

## Goal

Produce a concrete three.js PBR parameter table for realistic eyewear rendering — lens optics, frame materials, and lighting estimation — targeting "premium-looking" quality on live webcam video.

## Context (from Hermes)

Load `Projects/VTO-Agents/Research Agents/Physics-Researcher.md` as your mission brief; deliver per its Output contract.

**Additional constraints from D2 (personal/quality-first pivot, see [[VTO]] §Decisions D2):**
- Video only (live webcam stream)
- "Phase 1 must look premium" — physical believability is the quality bar
- No device budget cap — can use heavy shaders if they deliver visible quality

**Priority ordering:**
1. Lens optics (refractive indices, AR coating, dispersion — which are visible at webcam scale?)
2. Frame materials (PBR values for acetate, TR-90, stainless, titanium, gold — real BRDF references)
3. Lighting estimation (face-as-lightprobe from webcam feed for matching scene lighting)
4. Contact shadows (nose pads, temples — cheapest technique that reads as real)
5. Photochromic/tint simulation (transmission curves, three.js attenuation at mobile cost)

## Definition of done
- [x] Finding note `Findings/F005 physics-lens-optics.md` — refractive indices + AR coating parameters + Abbe/dispersion; visibility assessment at webcam resolution; concrete three.js `MeshPhysicalMaterial` values
- [x] Finding note `Findings/F005 physics-frame-materials.md` — PBR parameter table (roughness, metalness, clearcoat, specular) for acetate/TR-90/stainless/titanium/gold from real BRDF databases
- [x] Finding note `Findings/F005 physics-lighting-estimation.md` — practical face-as-lightprobe approaches for webcam; three.js environment map integration
- [x] Finding note `Findings/F005 physics-contact-shadows.md` — cheapest technique for nose-pad + temple contact shadows that reads as physically real
- [x] Finding note `Findings/F005 physics-photochromic-tints.md` — photochromic/tint transmission curves + three.js attenuation parameters (bonus, priority 5)
- [x] Each finding: Question / Answer / Evidence / three.js parameter table

## Result & context returned (OpenClaw fills this)
- What was done: Researched all five priority areas: lens optics, frame materials, lighting estimation, contact shadows, photochromic tints. Produced concrete three.js MeshPhysicalMaterial parameter tables for each.
- Artifacts / paths:
  - [[F005 physics-lens-optics]] — Refractive indices (1.49–1.76), Abbe numbers (25–59), AR coating reflectance (0.1–4.0% per surface), Fresnel reflectance formula, visibility assessment at webcam scale, three.js parameter tables for CR-39/AR/high-index lenses
  - [[F005 physics-frame-materials]] — PBR values for acetate, TR-90, stainless, titanium, 18K/24K gold, rose gold, horn. MERL BRDF cross-references. Dielectric vs metal distinction. Clearcoat application. Three.js parameter tables for each material.
  - [[F005 physics-lighting-estimation]] — Face-as-lightprobe technique: MediaPipe landmarks → luminance sampling → SH L=2 or simplified 2-param directional model. Three.js integration via scene.environmentIntensity + DirectionalLight. Phase 1: directional estimation; Phase 2: full SH PMREM.
  - [[F005 physics-contact-shadows]] — Three techniques ranked: (A) shadow decals/sprites 0.05ms, (B) baked AO in GLB, (C) SSAO (rejected), (D) shadow maps (rejected). Hybrid A+B recommended. Anchor point convention. Fade-out on tracking drift. Three.js sprite + aoMap reference.
  - [[F005 physics-photochromic-tints]] — VLT ranges for clear/photochromic/polarized/gradient/mirror/fashion tints. Three.js attenuationColor + attenuationDistance parameter tables for 11 lens tint types. Gradient implementation notes.
- Decisions made while executing:
  1. **Fresnel reflectance is the #1 visible lens effect** — bare vs AR-coated is 10–20× more visible than any other optical property. This MUST be in Phase 1.
  2. **Chromatic dispersion (Abbe) is borderline visible** at webcam scale — skip for Phase 1; reconsider for high-index lenses only.
  3. **Refractive ray-bending (background distortion) is NOT visible** at webcam scale — explicitly skip for Phase 1.
  4. **Gold is the highest-impact frame material** — its warm metallic specular is an instant "premium" signal. Get metalness=1 right.
  5. **Shadow decals (sprites) beat SSAO** for contact shadows at webcam scale — cheaper and more targeted.
  6. **SH L=2 is overkill for Phase 1 lighting** — a 2-parameter directional model captures 80%+ of the visual impact.
  7. **Photochromic transition is too slow to animate** — offer fixed states (clear/mid/dark) instead.
- Problems / open questions:
  1. **Face skin albedo variation** makes luminance-based lighting estimation imprecise (±20%) across Fitzpatrick skin types. Mitigation: sample only forehead + cheeks; calibrate at session start.
  2. **Webcam auto-exposure** shifts apparent illumination independently of real light. Mitigation: normalize to reference luminance.
  3. **Gradient tint requires a texture or custom shader** — attenuationColor supports textures in r170+ but gradient-specific behavior may need onBeforeCompile.
  4. **MERL BRDF values are analogues, not exact eyewear materials.** The acetate/TR-90-stainless/titanium roughness ranges are well-validated by the PBR community; gold spectral data is from RefractiveIndex.INFO.
- What Hermes should know for the next decision:
  1. **Lens rendering implementation order:** (1) transmission+transparency → (2) Fresnel reflectance (ior/reflectivity) → (3) AR coating (specularColor tint) → (4) optionally, high-index tint. This is the quality-critical path.
  2. **Frame rendering implementation order:** (1) metalness=1 for metals (this is binary — right or wrong) → (2) clearcoat on polished acetate → (3) roughness tuning per material. Metalness is the single parameter that makes or breaks frame realism.
  3. **The face occluder mesh needs two things for Phase 1:** (a) baked AO texture for contact shadows (bake in Blender), (b) anchor point empties at nose-pad and temple-tip contact positions for runtime shadow sprites.
  4. **Lighting estimation should start deferred** — render with a fixed studio EXR environment first, then add the 2-param directional estimation once basic rendering works. This decouples lighting bugs from material bugs.
  5. **All parameter tables reference three.js MeshPhysicalMaterial (r170+) properties.** These are all zero-cost uniforms — no extra draw calls, no additional textures (beyond what's already in the GLB).

## Review (Hermes fills this)
- Verdict: done | rework
- Notes: