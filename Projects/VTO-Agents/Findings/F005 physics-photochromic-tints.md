---
okf: 1
type: finding
id: F005-photochromic-tints
project: VTO
agent: Physics-Researcher
task: T005
status: complete
created: 2026-08-04
tags: [finding, physics, photochromic, tint, lens, threejs]
links:
  - "[[VTO]]"
  - "[[VTO-Agents]]"
  - "[[T005 Physics-Materials-Optics]]"
  - "[[F005 physics-lens-optics]]"
  - "[[Research Agents/Physics-Researcher]]"
---

# F005 — Physics: Photochromic & Tint Simulation

## Question

What are the real transmission curves of photochromic, polarized, and gradient lenses, and how can we simulate them with three.js `transmission`/`attenuation` at mobile cost?

## Answer: AttenuationColor + AttenuationDistance are the right three.js tools

Lens tints are modeled as wavelength-dependent absorption through a transmissive medium. In three.js MeshPhysicalMaterial, this is controlled by two parameters:

- **`attenuationColor`**: The tint color — light transmitted through the lens is multiplied by this color
- **`attenuationDistance`**: The distance (in world units) after which the light is attenuated to `attenuationColor × 1/e ≈ 37%`

For eyewear, the lens is thin (~2mm), so we use a short attenuationDistance to achieve the desired visible tint.

## Evidence

### 1. Real Lens Transmission Ranges

Based on industry datasheets (Transitions Optical, Essilor, Zeiss):

| Lens Type | Visible Light Transmission (VLT) | Appearance | AttenuationColor | attenuationDistance (at 2mm) |
|-----------|----------------------------------|------------|-----------------|------------------------------|
| Clear (AR-coated) | 95–98% | Near-invisible | `#ffffff` | 0.10 (effectively clear) |
| Photochromic (indoor/clear) | 85–92% | Very faint gray/brown | `#f0f0f0` | 0.04 |
| Photochromic (outdoor/dark) | 12–25% | Dark gray/brown | `#808080` | 0.003 |
| Gradient (top) | 15–30% (top), 70–85% (bottom) | Darker at top | Varies by gradient map | Gradient map needed |
| Polarized gray | 12–20% | Dark neutral gray | `#707070` | 0.0025 |
| Polarized brown | 15–22% | Brown/warm tint | `#9a7a5a` | 0.0028 |
| Fashion tint (light) | 60–80% | Subtle color wash | Color-dependent | 0.008 |
| Fashion tint (medium) | 30–50% | Noticeable color | Color-dependent | 0.004 |
| Yellow/blue-block | 85–90% | Yellow tint | `#ffffd0` | 0.03 |
| Mirror coating | 25–50% | Mirrored front | Use `specularIntensity` + high `reflectivity` | — |

### 2. Photochromic Transition Curve

Photochromic lenses (e.g., Transitions® Signature Gen 8) transition between clear and dark states based on UV exposure:

| State | VLT | Time to 70% transition | Full transition |
|-------|-----|----------------------|-----------------|
| Indoor (clear) | ~90% | — | 0 sec |
| Mid-transition | ~50% | ~30 sec | — |
| Fully darkened | ~15% | ~90 sec | ~3-5 min |
| Fade back to clear | ~90% | ~2 min (50% fade) | ~5-10 min |

**For webcam VTO:** The transition time is far too slow to animate in a try-on session. Instead, let the user choose a state (clear, mid, dark) and show that fixed state. Or, if the webcam scene brightness is known, auto-select: detect bright scene → show darkened state.

### 3. Polarized Lens Physics

Polarized lenses work by absorbing light with a specific polarization orientation (horizontal glare from reflective surfaces). This is NOT simulable with three.js attenuation — it requires polarization-aware rendering which three.js does not support. **Skip polarization simulation for Phase 1.**

However, the tint color of polarized lenses (gray, brown, G15 green) IS simulable with `attenuationColor`.

### 4. Gradient Tint Implementation

Gradient lenses (darker at top, clearer at bottom) require a gradient map rather than a uniform color:

```javascript
// Use a gradient texture as attenuationColor equivalent
// Technique: custom shader that varies attenuationDistance based on UV.y
// OR: Use a CanvasGradient to generate a gradient attenuationColor texture:

const canvas = document.createElement('canvas');
canvas.width = 256;
canvas.height = 256;
const ctx = canvas.getContext('2d');
const gradient = ctx.createLinearGradient(0, 0, 0, 256);
gradient.addColorStop(0, '#404040');    // dark at top
gradient.addColorStop(0.4, '#808080');   // mid
gradient.addColorStop(1.0, '#e0e0e0');  // nearly clear at bottom
ctx.fillStyle = gradient;
ctx.fillRect(0, 0, 256, 256);

const gradientTex = new THREE.CanvasTexture(canvas);
// Apply as attenuationColor (three.js r170+ supports texture for attenuationColor)
material.attenuationColor = new THREE.Color(1, 1, 1); // white base
// For gradient: use a custom ShaderMaterial extension or
// set attenuationColor texture via onBeforeCompile
```

### 5. Mobile Budget

All tint simulation via `attenuationColor` + `attenuationDistance` has zero additional GPU cost — these are uniform values used in the existing PBR shader. The only cost is:
- Gradient tint: one additional 256×256 texture (~4KB compressed) — negligible
- Photochromic state change: updating two float uniforms — free

---

## three.js MeshPhysicalMaterial Parameter Table: Lens Tints

### Clear (indoor, AR-coated)

| Property | Value |
|----------|-------|
| `transmission` | `0.95` |
| `attenuationColor` | `#ffffff` |
| `attenuationDistance` | `0.10` |

### Photochromic — Indoor / Clear State

| Property | Value |
|----------|-------|
| `transmission` | `0.90` |
| `attenuationColor` | `#f5f5f0` |
| `attenuationDistance` | `0.04` |

### Photochromic — Outdoor / Dark State (Gray)

| Property | Value |
|----------|-------|
| `transmission` | `0.85` |
| `attenuationColor` | `#888888` |
| `attenuationDistance` | `0.0025` |

### Photochromic — Outdoor / Dark State (Brown)

| Property | Value |
|----------|-------|
| `transmission` | `0.85` |
| `attenuationColor` | `#a08060` |
| `attenuationDistance` | `0.003` |

### Polarized Gray (G-15 style)

| Property | Value |
|----------|-------|
| `transmission` | `0.80` |
| `attenuationColor` | `#7a7a7a` |
| `attenuationDistance` | `0.002` |

### Polarized Brown (fashion tint)

| Property | Value |
|----------|-------|
| `transmission` | `0.80` |
| `attenuationColor` | `#a08060` |
| `attenuationDistance` | `0.0025` |

### Gradient (Gray top → clear bottom)

| Property | Value |
|----------|-------|
| `transmission` | `0.90` |
| `attenuationColor` | Texture map (256×256 vertical gradient: #555 → #ddd) |
| `attenuationDistance` | `0.003` |

### Fashion Tint — Light Rose

| Property | Value |
|----------|-------|
| `transmission` | `0.92` |
| `attenuationColor` | `#ffd0d0` |
| `attenuationDistance` | `0.008` |

### Fashion Tint — Light Blue

| Property | Value |
|----------|-------|
| `transmission` | `0.92` |
| `attenuationColor` | `#d0d0ff` |
| `attenuationDistance` | `0.008` |

### Yellow Night Driving

| Property | Value |
|----------|-------|
| `transmission` | `0.90` |
| `attenuationColor` | `#ffffc0` |
| `attenuationDistance` | `0.03` |

### Mirror Coating (Flash Mirror)

Mirror coatings are handled via specular reflection, not transmission:

| Property | Value |
|----------|-------|
| `roughness` | `0.02` (mirror finish) |
| `specularIntensity` | `1.5` |
| `specularColor` | e.g. `#aaccff` (blue flash) or `#ffccaa` (gold flash) |
| `ior` | `1.50` (base lens) |
| `transmission` | `0.50` (half blocked by mirror) |
| `attenuationColor` | `#ffffff` |
| `attenuationDistance` | `0.05` |

## References

- Transitions Optical: Transitions® Signature Gen 8 technical specifications
- Essilor: Crizal + Transitions combination product data
- Zeiss: PhotoFusion X technical specifications
- ISO 8980-3: Ophthalmic optics — Uncut finished spectacle lenses — Part 3: Transmittance specifications
- three.js: MeshPhysicalMaterial — attenuationColor, attenuationDistance, transmission
- Mitsui Chemicals: MR Series tintable lens materials (photochromic dye compatibility)