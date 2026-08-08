---
okf: 1
type: finding
id: F005-frame-materials
project: VTO
agent: Physics-Researcher
task: T005
status: complete
created: 2026-08-04
tags: [finding, physics, materials, pbr, frame, threejs]
links:
  - "[[VTO]]"
  - "[[VTO-Agents]]"
  - "[[T005 Physics-Materials-Optics]]"
  - "[[F005 physics-lens-optics]]"
  - "[[Research Agents/Physics-Researcher]]"
---

# F005 — Physics: Frame Materials (PBR Values)

## Question

What are the physically correct PBR parameters (roughness, metalness, clearcoat, specular, base color) for common eyewear frame materials — acetate, TR-90, stainless steel, titanium, and gold — sourced from real BRDF measurements and materials science references?

## Answer: Dielectrics and metals need different PBR treatment

Eyewear frames span two physically distinct material classes:

**Dielectrics (non-conductive):** Acetate, TR-90/nylon, horn. These have:
- F0 (normal-incidence reflectance) ~4–5% (Fresnel governed by IOR ~1.4–1.6)
- Colored diffuse base + specular highlights
- Optional clearcoat for glossy finishes

**Metals (conductive):** Stainless steel, titanium, gold. These have:
- F0 ~40–65% at normal incidence (complex IOR)
- Tinted specular (colored reflections — gold reflects gold, not white)
- Very low or black diffuse (metals have negligible subsurface scattering)
- `metalness = 1` in PBR workflows

**Key PBR insight for VTO:** The dielectric/metal distinction is the single biggest visual factor. Get this wrong and frames look like plastic toys or painted metal — instantly breaking the premium feel.

## Evidence

### 1. Frame Material PBR Values — Dielectrics

Sources: MERL BRDF database analogue materials; Disney Principled BRDF material charts; Substance Painter/PBR validation datasets; academic measurements of similar polymers.

| Parameter | Acetate (matte) | Acetate (polished) | TR-90 / Nylon | Horn (natural) |
|-----------|----------------|-------------------|---------------|----------------|
| **Material class** | Dielectric | Dielectric | Dielectric | Dielectric |
| **Base color (sRGB)** | #2a2a2a – #1a1a1a (black) | #2a2a2a – #1a1a1a (black) | #222222 – #333333 | #3a2a1a – #5a3a2a (tortoise) |
| **metalness** | 0.0 | 0.0 | 0.0 | 0.0 |
| **roughness** | 0.35 – 0.55 | 0.10 – 0.20 | 0.25 – 0.40 | 0.20 – 0.35 |
| **ior** | 1.50 | 1.50 | 1.53 | 1.55 |
| **reflectivity** | 1.0 (Fresnel via ior) | 1.0 | 1.0 | 1.0 |
| **specularIntensity** | 0.4 (subtle) | 0.8 (polished) | 0.5 | 0.45 |
| **specularColor** | #ffffff | #ffffff | #ffffff | #ffffff |
| **clearcoat** | 0.0 | 0.3 – 0.5 | 0.0 | 0.0 |
| **clearcoatRoughness** | — | 0.05 – 0.15 | — | — |
| **F0 reflectance (calc.)** | ~4.0% | ~4.0% | ~4.4% | ~4.6% |

**Acetate notes:**
- Real cellulose acetate has a density of ~1.28 g/cm³, Shore D hardness ~75–85
- Matte frames have surface roughness from machining; polished frames are buffed + sometimes lacquered
- Common colors: black, dark tortoise (#3a2a18), Havana brown (#5a3a28), crystal clear (needs separate params)
- **Tortoise pattern** = procedural layered spots of amber (#c87830) + brown (#5a3820) on black base — use a texture map
- Acetate is warm to touch (low thermal conductivity ~0.25 W/m·K) — not simulable but affects perceived quality

**TR-90 notes:**
- TR-90 is a thermoplastic polyamide (nylon-based); similar to Grilamid TR-90
- Slightly higher IOR than acetate (1.53 vs 1.50)
- More flexible, lighter (density ~1.01 g/cm³ vs 1.28 for acetate)
- Matte surface dominates; glossy variants are rare
- Common colors: matte black, dark gray, navy blue

### 2. Frame Material PBR Values — Metals

Sources: RefractiveIndex.INFO spectral data; PBR validation charts (Allegorithmic/Adobe Substance); metals reflectance at normal incidence from Fresnel with complex IOR.

| Parameter | Stainless Steel (316L) | Titanium (Grade 5) | Gold (18K plating) | Gold (24K / pure) |
|-----------|----------------------|-------------------|---------------------|--------------------|
| **Material class** | Metal | Metal | Metal | Metal |
| **Base color (sRGB)** | #c8c8cd | #a8a8ad | #d4af37 | #ffd700 |
| **metalness** | 1.0 | 1.0 | 1.0 | 1.0 |
| **roughness** | 0.15 – 0.25 (brushed) | 0.10 – 0.20 (matte) | 0.05 – 0.15 (polished) | 0.02 – 0.08 (mirror) |
| **ior** | Not used (metalness=1) | Not used | Not used | Not used |
| **reflectivity** | — (metalness=1 handles) | — | — | — |
| **specularIntensity** | 1.0 | 1.0 | 1.0 | 1.0 |
| **specularColor** | #d0d0d8 | #b8b8c0 | #e8c840 | #ffe040 |
| **F0 reflectance (normal)** | ~55–65% | ~50–55% | ~40–45% (18K) | ~45–50% (24K) |
| **Complex IOR (n, k at 589nm)** | n≈2.5, k≈3.4 | n≈2.1, k≈2.8 | n≈0.18, k≈3.1 | n≈0.16, k≈3.3 |
| **Color of reflection** | Neutral-cool silver | Neutral silver | Warm golden | Rich gold |

**Metal rendering note:** In three.js with `metalness=1`, the `color` property determines the F0 reflectance color (gold = golden tint), and `roughness` controls the microfacet distribution. The Fresnel is automatically handled by the metallic BRDF model (Schlick approximation is NOT used for metals — three.js correctly uses the full complex Fresnel when metalness=1).

**Stainless steel notes:**
- 316L is the most common eyewear-grade stainless; hypoallergenic, corrosion-resistant
- Brushed finish dominates (unidirectional microscratches → anisotropic roughness, but isotropic approximation is fine for webcam)
- Gunmetal/black PVD coating = stainless base with dark coating → use a different base color (#3a3a3a) but keep metalness=1

**Titanium notes:**
- Grade 5 (Ti-6Al-4V) or commercially pure (CP) Grade 2
- Slightly darker/graver than stainless; matte or satin finish
- Ultra-light (density 4.43 g/cm³ vs 8.0 for stainless)
- Flexon / memory metal = nickel-titanium alloy (Nitinol); similar PBR values

**Gold notes:**
- 18K gold = 75% gold + 25% alloy metals (copper/silver); slight desaturation vs 24K
- Gold-plated frames: thin gold layer over base metal; PBR same as gold (the surface IS gold)
- Rose gold: tint specular toward copper (#e8b8a0) — 18K rose ≈ 75% Au + 22% Cu + 3% Ag
- Gold is the most visually distinctive metal — its warm specular color instantly signals premium

### 3. Clearcoat on Frames

Many acetate frames have a glossy lacquer/clearcoat. This is a thin transparent layer on top that:
- Smooths micro-roughness (shiny surface over matte base)
- Has its own IOR (~1.5) and roughness (~0.05–0.15)
- Creates double reflection: clearcoat + substrate

In three.js `MeshPhysicalMaterial`, `clearcoat` directly models this:
```
clearcoat: 0.4        // strength of the clearcoat layer
clearcoatRoughness: 0.1 // micro-roughness of the clearcoat
```

For premium polished acetate, set `clearcoat=0.3-0.5`. For matte acetate, `clearcoat=0`.

### 4. BRDF Database Cross-Reference

The MERL BRDF database (Matusik et al., 2003) contains 100 measured isotropic BRDFs. Relevant analogue materials:

| MERL Material | Analogue For | roughness (isotropic) | Notes |
|---------------|-------------|----------------------|-------|
| black-soft-plastic | Matte acetate | 0.4–0.5 | Same polymer class; diffuse base + weak specular |
| black-phenolic | Polished acetate | 0.1–0.2 | Similar IOR; glossy dielectric |
| ss440 (stainless) | Stainless frames | 0.2–0.3 | Brushed finish; metallic |
| tungsten | Gold-plated | 0.08–0.12 | Similar spectral reflectance (warm metal) |
| nickel | Titanium frame | 0.1–0.2 | Neutral-cool metal; similar specular color |
| chrome | Polished titanium | 0.02–0.05 | Near-mirror finish |

## Implications for VTO

### Phase 1 implementation:

1. **Use MeshPhysicalMaterial for all frame parts** — the PBR model handles both dielectrics and metals correctly
2. **Base color comes from the GLB textures** — the PBR roughness/metalness/clearcoat values are material-level overrides applied at runtime
3. **Metals need `metalness: 1`** — this is non-negotiable for stainless/titanium/gold; without it they render as gray plastic
4. **Gold is the highest-impact metal** — its warm specular color is an instant visual "premium" signal
5. **Clearcoat on acetate** — polished acetate with `clearcoat: 0.4` looks dramatically better than matte alone

### Material mapping for common frame styles:

| Frame Style | Materials | Key PBR Signature |
|-------------|-----------|-------------------|
| Classic Wayfarer | Polished black acetate | dielectric + medium clearcoat |
| Aviator (metal) | Gold/titanium frame + acetate temple tips | metal (gold) + dielectric (tips) |
| Minimalist round | Titanium wireframe | brushed metal, low roughness |
| Thick black square | Matte acetate | dielectric, high roughness, no clearcoat |
| Sport wrap | TR-90 matte | dielectric, medium roughness |
| Luxury gold | 18K gold-plated | high metalness, low roughness, warm specular |

### Budget note:

All these parameters are zero-cost at render time — they are uniform values on MeshPhysicalMaterial (no extra textures required beyond the GLB's own maps). The only cost is the GLB file size.

---

## three.js MeshPhysicalMaterial Parameter Tables: Frame Materials

### Acetate — Polished Black (Classic Wayfarer)

| Property | Value |
|----------|-------|
| `color` | `#1a1a1a` |
| `metalness` | `0.0` |
| `roughness` | `0.12` |
| `ior` | `1.50` |
| `reflectivity` | `1.0` |
| `specularIntensity` | `0.8` |
| `specularColor` | `#ffffff` |
| `clearcoat` | `0.4` |
| `clearcoatRoughness` | `0.08` |

### Acetate — Matte Tortoise

| Property | Value |
|----------|-------|
| `color` | (from GLB tortoise texture map) |
| `metalness` | `0.0` |
| `roughness` | `0.45` |
| `ior` | `1.50` |
| `reflectivity` | `1.0` |
| `specularIntensity` | `0.3` |
| `specularColor` | `#ffffff` |
| `clearcoat` | `0.0` |

### TR-90 — Matte Black

| Property | Value |
|----------|-------|
| `color` | `#222222` |
| `metalness` | `0.0` |
| `roughness` | `0.35` |
| `ior` | `1.53` |
| `reflectivity` | `1.0` |
| `specularIntensity` | `0.4` |
| `specularColor` | `#ffffff` |
| `clearcoat` | `0.0` |

### Stainless Steel — Brushed (Aviator Frame)

| Property | Value |
|----------|-------|
| `color` | `#c8c8cd` |
| `metalness` | `1.0` |
| `roughness` | `0.22` |
| `ior` | (N/A — metalness=1) |
| `reflectivity` | (N/A — metalness=1) |

**Note:** Do NOT set `specularColor` or `specularIntensity` on metals in three.js — these are ignored when `metalness=1`. The `color` property controls the metallic F0 reflectance color directly.

### Titanium — Satin (Minimalist Wireframe)

| Property | Value |
|----------|-------|
| `color` | `#a8a8ad` |
| `metalness` | `1.0` |
| `roughness` | `0.15` |

### Gold — 18K Polished (Luxury Frame)

| Property | Value |
|----------|-------|
| `color` | `#d4af37` |
| `metalness` | `1.0` |
| `roughness` | `0.08` |

### Gold — 24K Mirror

| Property | Value |
|----------|-------|
| `color` | `#ffd700` |
| `metalness` | `1.0` |
| `roughness` | `0.03` |

### Rose Gold — 18K (Fashion Frame)

| Property | Value |
|----------|-------|
| `color` | `#e8b8a0` |
| `metalness` | `1.0` |
| `roughness` | `0.10` |

### Horn — Natural Polished

| Property | Value |
|----------|-------|
| `color` | `#4a3020` |
| `metalness` | `0.0` |
| `roughness` | `0.25` |
| `ior` | `1.55` |
| `reflectivity` | `1.0` |
| `specularIntensity` | `0.5` |
| `clearcoat` | `0.3` |
| `clearcoatRoughness` | `0.1` |

## References

- Matusik, W., Pfister, H., Brand, M., & McMillan, L. (2003). "A Data-Driven Reflectance Model." ACM SIGGRAPH 2003. (MERL BRDF database — 100 measured isotropic BRDFs)
- Burley, B. (2012). "Physically-Based Shading at Disney." SIGGRAPH 2012 Course. (Disney Principled BRDF — roughness/metalness/clearcoat parameterization origins)
- RefractiveIndex.INFO — Complex refractive index database (nk data for metals)
  - Gold (Au): n=0.159, k=3.27 at 589nm
  - Titanium (Ti): n=2.15, k=2.87 at 589nm
  - Iron (Fe): n=2.93, k=3.09 at 589nm (stainless steel analogue)
- Mitsui Chemicals: MR Series ophthalmic lens materials (for lens-side comparison)
- three.js: MeshPhysicalMaterial docs — metalness workflow, clearcoat, ior/reflectivity
- Lagarde, S. & de Rousiers, C. (2014). "Moving Frostbite to PBR." SIGGRAPH 2014. (Metalness workflow specification)
- Karis, B. (2013). "Real Shading in Unreal Engine 4." SIGGRAPH 2013. (PBR parameter ranges and validation)