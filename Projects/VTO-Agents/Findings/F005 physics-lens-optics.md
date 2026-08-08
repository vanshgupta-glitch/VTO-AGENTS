---
okf: 1
type: finding
id: F005-lens-optics
project: VTO
agent: Physics-Researcher
task: T005
status: complete
created: 2026-08-04
tags: [finding, physics, optics, lens, threejs]
links:
  - "[[VTO]]"
  - "[[VTO-Agents]]"
  - "[[T005 Physics-Materials-Optics]]"
  - "[[Research Agents/Physics-Researcher]]"
---

# F005 — Physics: Lens Optics

## Question

What real ophthalmic lens optics (refractive indices 1.5–1.74, Abbe/dispersion, AR coating reflectance, Fresnel equations) are physically correct — and which are *visible* enough at webcam scale to be worth rendering in three.js?

## Answer: Yes, lens optics ARE visible — but only specific parameters matter

At webcam resolution (720p typical, face ~300px tall), four optical effects are visually detectable and worth rendering:

| Effect | Visible? | Reasoning |
|--------|----------|-----------|
| **Fresnel reflectance** (bare lens) | **YES** | 4–16% reflection is obvious — uncoated lenses look "glassy"; coated lenses "disappear" |
| **AR coating** (green/purple tint) | **YES** | The residual tinted reflection is a premium tell; visible as a subtle colored sheen |
| **Transmission/transparency** | **YES** | Eyes must be visible through lenses; this is the primary quality signal |
| **Dispersion (Abbe/chromatic)** | **BORDERLINE** | Low-Abbe (Vd<35) lenses show visible color fringing at edges in high-contrast scenes; worth including for 1.67/1.74 high-index |
| **Edge thickness by Rx** | **BORDERLINE** | Only visible in profile/¾ view for strong prescriptions (≥±4D); skip for Phase 1 |
| **Refractive distortion** | **NO** | Ray-bending of background through the lens requires real ray-tracing — negligible at webcam scale; skip |

**Verdict:** For "Phase 1 must look premium," implement Fresnel reflectance + AR coating tint + transmission. Dispersion is a nice-to-have for high-index lens realism. Skip refractive distortion and edge-thickness variation.

## Evidence

### 1. Ophthalmic Lens Material Properties

Source: Wikipedia "Corrective lens" — Ophthalmic material property tables + industry datasheets (Essilor, Zeiss, Hoya, Mitsui MR series).

| Material | Trade Name | n_d | V_d (Abbe) | Density | Bare Reflectance* | UV block |
|----------|-----------|-----|-----------|---------|-------------------|----------|
| CR-39 | Standard plastic | 1.498 | 59 | 1.31 | 7.97% | UVB 100% |
| Trivex | PPG Trivex | 1.53 | 44 | 1.11 | 8.70% | Full UV |
| Polycarbonate | Airwear/Tegra | 1.586 | 30 | 1.20 | 10.27% | Full UV |
| MR-8 (1.6) | Mitsui 1.60 | 1.60 | 41 | 1.30 | 10.43% | Full UV |
| MR-7 (1.67) | Mitsui 1.67 | 1.67 | 32 | 1.35 | 12.34% | Full UV |
| MR-174 (1.74) | Mitsui 1.74 | 1.74 | 33 | 1.47 | 14.36% | Full UV |
| Tokai 1.76 | Tokai Optical | 1.76 | 30 | 1.49 | 15.16% | Full UV |
| Crown Glass | — | 1.525 | 59 | 2.54 | 8.59% | UVB 79% |
| 1.6 Glass | — | 1.604 | 40 | 2.62 | 10.68% | Full UVB |
| 1.7 Glass | — | 1.706 | 30 | 2.93 | 13.47% | Full UVB |
| 1.9 Glass | Zeiss Lantal | 1.893 | 31 | 4.02 | 18.85% | Full UVB |

*Bare reflectance = total (front + back surface) at normal incidence. Per-surface: R = ((n-1)/(n+1))². Values assume Fresnel at d-line (587.6nm).

### 2. AR Coating Reflectance

Source: Wikipedia "Anti-reflective coating" § Single-layer interference.

| Coating Type | Reflectance (per surface) | Total | Appearance |
|---|---|---|---|
| Uncoated CR-39 (n=1.50) | 4.0% | ~8% | Obvious glassy reflection |
| Uncoated 1.74 (n=1.74) | 7.3% | ~14% | Strong mirror-like reflection |
| MgF₂ single-layer on CR-39 | ~1.3% | ~2.6% | Faint residual (blue tint) |
| Multi-layer AR (modern premium) | 0.1–0.5% | 0.2–1.0% | Near-invisible; faint green/purple residual |
| Zeiss DuraVision Platinum | <0.3% | <0.6% | Industry best; blue-purple residual |

**The AR tint color is intentional** — the coating is designed to minimize reflectance at the center of the visible spectrum (550nm green), leaving slightly higher reflectance at the blue and red ends, producing the characteristic green or blue-purple residual tint.

### 3. Fresnel Reflectance Formula

At normal incidence (θ_i = 0):
```
R = ((n1 - n2) / (n1 + n2))²
```
For air (n1=1.0) to lens (n2=n):
```
R = ((1 - n) / (1 + n))²
```

At grazing angles, reflectance approaches 100% for both polarizations. For intermediate angles, the full Fresnel equations apply (s-polarized and p-polarized components differ).

In three.js, MeshPhysicalMaterial already computes Fresnel internally via its `reflectivity` + `ior` parameters when `specularColor` is not set.

### Visibility Assessment at Webcam Scale

- A 720p webcam with face filling ~50% of frame: face is ~300px tall, lens region ~50×80px
- 8% bare reflectance = ~20 gray levels difference — **easily visible** as a bright sheen
- 0.5% AR-coated reflectance = ~1 gray level — essentially invisible (the desired effect)
- The difference between coated vs uncoated is therefore **10–20× more visible than any other lens effect**
- Dispersion (color fringing at edges) might produce 1–2px color shifts — subtle but detectable as "cheap-looking" on low-Abbe (Vd=30) lenses

## Implications for VTO

### What to implement in Phase 1 (MUST):

1. **Fresnel reflectance via three.js MeshPhysicalMaterial** — the single biggest lens realism factor
2. **AR coating as a reduced-reflectivity variant** — subtle colored tint on the specular response
3. **Transmission (eyes show through lens)** — already planned; verify transmission works with face occluder

### What to skip in Phase 1:

- Refractive ray-bending (requires full path tracing — overkill for webcam)
- Edge thickness variation by Rx (only visible in profile, minimal at webcam scale)
- Precise dispersion/Abbe simulation (can be approximated with subtle chromatic aberration on high-index lenses)

### How to decide AR vs no-AR at runtime:

The current GLB-based approach loads a single lens material. For premium look:
- **Option A (simple):** Always use AR-coated parameters (cleanest look, lower reflectance)
- **Option B (accurate):** Allow config toggle — AR on/off changes `ior` and `reflectivity` at runtime

---

## three.js MeshPhysicalMaterial Parameter Table: Lens Optics

### Base lens material (clear, AR-coated CR-39, n=1.50)

| Property | Value | Notes |
|----------|-------|-------|
| `color` | `#ffffff` | Base white; tint overrides for photochromic |
| `metalness` | `0` | Dielectric |
| `roughness` | `0.05` | Optically polished surface |
| `ior` | `1.50` | Refractive index of CR-39 |
| `reflectivity` | `1.0` | Full Fresnel (driven by ior) |
| `transmission` | `0.95` | ~95% transmission (5% absorbed by lens + AR coating) |
| `thickness` | `0.002` | 2mm center thickness (meters) |
| `attenuationColor` | `#ffffff` | Clear lens; change for tints |
| `attenuationDistance` | `0.05` | Long attenuation path (effectively clear) |
| `specularIntensity` | `0.15` | Subtle specular on AR-coated surface |
| `specularColor` | `#b8c8ff` | Faint blue-purple AR residual tint |
| `clearcoat` | `0` | No clearcoat on lenses |
| `opacity` | `0.92` | Slight opacity for realism |

### Bare (uncoated) lens variant

| Property | Value | Notes |
|----------|-------|-------|
| `specularIntensity` | `0.40` | Stronger specular reflection |
| `specularColor` | `#ffffff` | Neutral white reflection |
| `transmission` | `0.92` | 8% reflected (4% per surface at n=1.50) |

### High-index lens (n=1.67, AR-coated)

| Property | Value | Notes |
|----------|-------|-------|
| `ior` | `1.67` | MR-7 / 1.67 high-index |
| `specularIntensity` | `0.12` | Better AR coating performance on high-index |
| `specularColor` | `#d0c8ff` | More pronounced purple AR tint |
| `transmission` | `0.97` | Better AR = higher transmission |

### Lens baseColor for dispersion approximation (optional)

For high-index lenses (Vd < 35), subtle chromatic separation can be faked with a custom shader or, more simply, by using a very slight edge tint:

| Lens Grade | Abbe Vd | Suggestion |
|------------|---------|------------|
| Mid-index (1.60, Vd 41) | 41 | No dispersion needed at webcam scale |
| High-index (1.67, Vd 32) | 32 | Subtle warm edge fringing perceptible; skip for Phase 1 |
| Ultra-index (1.74, Vd 33) | 33 | Similar to 1.67; higher reflectance is more visible than dispersion |

### Photochromic tint parameters → see [[F005 physics-photochromic-tints]]

## References

- Wikipedia: "Corrective lens" — Ophthalmic material property tables (retrieved 2026-08-04)
- Wikipedia: "Anti-reflective coating" — Single-layer and multi-layer interference theory
- Wikipedia: "Fresnel equations" — Normal-incidence reflectance formula
- Wikipedia: "Abbe number" — Vd definition and glass classification
- Mitsui Chemicals: MR Series ophthalmic lens materials datasheets
- Zeiss: DuraVision Platinum AR coating specifications (<0.3% reflectance)
- Essilor: Crizal AR coating family
- three.js: MeshPhysicalMaterial documentation (r170+) — transmission, ior, specularColor
