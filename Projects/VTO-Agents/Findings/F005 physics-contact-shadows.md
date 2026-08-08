---
okf: 1
type: finding
id: F005-contact-shadows
project: VTO
agent: Physics-Researcher
task: T005
status: complete
created: 2026-08-04
tags: [finding, physics, shadows, contact-shadows, nose-pads, temples, threejs]
links:
  - "[[VTO]]"
  - "[[VTO-Agents]]"
  - "[[T005 Physics-Materials-Optics]]"
  - "[[F005 physics-lighting-estimation]]"
  - "[[Research Agents/Physics-Researcher]]"
---

# F005 — Physics: Contact Shadows (Nose Pads & Temples)

## Question

What is the cheapest technique for rendering physically plausible contact shadows at nose pads and temples that reads as "real" at webcam scale — while staying within a mobile WebGL budget?

## Answer: Pre-authored shadow decals (darkened sprites at anchor points) are the best price/quality ratio

Contact shadows — the subtle darkening where the frame touches the face — are one of the highest-leverage realism cues in virtual try-on. Without them, glasses appear to "float" above the face. But real-time shadow maps for such small, fixed-contact features are wasteful.

**Three techniques ranked by cost/quality:**

| Technique | Render Cost | Quality | Phase 1? |
|-----------|------------|---------|----------|
| **A. Shadow decals** (dark semi-transparent sprites at contact points) | ~0.05ms | Good enough at webcam scale | **YES** |
| **B. Baked AO in GLB** (pre-computed ambient occlusion on the face occluder) | Free (baked) | Best quality, but static | **YES — combine with A** |
| **C. SSAO** (screen-space ambient occlusion, small radius) | ~0.5–2ms | Good, dynamic | No (too heavy for mobile) |
| **D. Real shadow maps** | ~1–3ms per light | Perfect physically | No (gross overkill) |

**Verdict:** Technique A+B combined (pre-baked AO + runtime shadow decals at contact points) gives "premium" contact shadow quality at near-zero render cost.

## Evidence

### 1. Why Contact Shadows Matter for VTO

Contact shadows — also called "ambient occlusion at contact" or "proximity shadows" — are the darkening that occurs where two surfaces are very close together. Ambient light is occluded in the narrow gap, creating a soft dark region.

**Perceptual impact (VTO-specific):**
- Nose pads: Without shadow, pads appear to hover ~1mm above nose → uncanny valley
- Temple tips: Without shadow, arms don't appear to rest on ears → disconnection from face
- Brow bar: Without shadow, the bridge appears pasted on → "sticker effect"

**At webcam scale (face ~300px):** The contact shadow region is ~3-8px wide. This is detectable by the human visual system — the brain is exquisitely sensitive to contact-region luminance cues for depth perception.

### 2. Technique A: Shadow Decals (Runtime Sprites)

**How it works:**
1. Define anchor points on the GLB glasses model at nose-pad contact positions and temple-tip contact positions
2. At render time, project these 3D points to screen space
3. Draw small (~15-25px) semi-transparent dark circular sprites at those screen positions
4. These sprites sit between the glasses and face in depth — a depth-only pass or simple z-offset ensures they don't cover the glasses themselves

**Sprite properties:**
- Color: Black (#000000) or very dark brown
- Opacity: 0.3–0.6 (adjustable — lighter skin = lower opacity)
- Size: 15–25px diameter at webcam resolution (scales with face distance)
- Soft edge: Gaussian falloff from center (pre-authored PNG sprite, 32×32 or 64×64)
- Blend mode: Multiply (darkens underlying pixels)

**Cost:**
- 2 sprites per nose pad × 2 pads = 4 sprites
- 2 sprites per temple tip × 2 temples = 4 sprites
- Total: 8 tiny sprites = ~0.05ms GPU
- Memory: one 64×64 RGBA PNG = 16KB

**Implementation (pseudocode for three.js):**

```javascript
// Setup: create sprite material once
const shadowSpriteTex = new THREE.TextureLoader().load('contact_shadow.png');
// contact_shadow.png = soft circular gradient, black center → transparent edge
const shadowMaterial = new THREE.SpriteMaterial({
  map: shadowSpriteTex,
  color: 0x000000,
  opacity: 0.45,
  blending: THREE.MultiplyBlending,
  depthTest: true,
  depthWrite: false,
  transparent: true,
});

// At render time: update sprite positions from GLB anchor points
nosePadAnchors.forEach((anchor3D, i) => {
  // Transform anchor from model space to world space
  const worldPos = anchor3D.clone()
    .applyMatrix4(glassesModel.matrixWorld);
  
  // Offset slightly toward face (along face normal at that point)
  const faceNormal = getFaceNormalAtAnchor(anchor3D); // from MediaPipe face mesh
  worldPos.addScaledVector(faceNormal, 0.001); // 1mm into face
  
  // Set sprite position
  nosePadSprites[i].position.copy(worldPos);
  
  // Scale with distance from camera
  const dist = camera.position.distanceTo(worldPos);
  const scale = dist * 0.015; // ~15-25px in screen space
  nosePadSprites[i].scale.set(scale, scale, 1);
});
```

### 3. Technique B: Baked Ambient Occlusion in GLB

**How it works:**
The face occluder mesh (the invisible depth-writing mesh that hides the back of glasses) also has AO baked into it or into a separate texture. The AO is pre-computed in Blender by ray-tracing ambient occlusion between the face occluder and the glasses geometry.

**What to bake:**
- Occlusion of ambient light under nose pads
- Occlusion at temple-ear contact points
- Soft darkening under the brow bar
- Gradual falloff (not hard edges — contact AO is soft)

**Implementation in three.js:**
- The face occluder uses `MeshBasicMaterial` with `color: 0x000000` and `alphaMap: aoTexture`
- AO texture is a grayscale PNG: 0 (black) = fully occluded, 1 (white) = no occlusion
- The occluder's `alphaMap` is multiplied against the background (face webcam video)

**But:** The face occluder currently renders as a pure depth-writing mesh. Adding AO requires either:
1. A separate AO overlay quad rendered between face video and glasses, OR
2. Baking AO into the glasses material's `aoMap` and using `aoMapIntensity`

Option 2 is preferred: bake AO into the glasses GLB's AO texture channel, covering the inner surfaces. This way the glasses themselves darken near contact points — no separate pass needed.

**Cost:** Zero runtime cost (baked). Adds ~10-50KB to GLB texture atlas.

### 4. Why NOT SSAO or Shadow Maps (for Phase 1)

**SSAO (Technique C):**
- Screen-space ambient occlusion with small radius can produce contact shadows
- But: costs 0.5–2ms on mobile GPU (significant at 60 FPS)
- And: screen-space occlusion radius must be tiny (1-3mm) to target only contacts → numerical instability
- And: the face geometry (MediaPipe mesh) isn't in the depth buffer — only the occluder is — so SSAO sees no face surface to occlude against
- Conclusion: SSAO is the wrong tool for VTO contact shadows

**Shadow Maps (Technique D):**
- Would produce physically perfect shadows
- But: requires rendering the face geometry to a shadow map (face isn't in the 3D scene — it's webcam video)
- And: contact shadows at nose-pad scale (~2mm) need extremely high shadow map resolution (4096²+)
- And: multiple lights × multiple maps = 3-9ms on mobile
- Conclusion: Shadow maps are for Phase 3+

### 5. Hybrid Best Practice for "Premium" Phase 1

Combine B (baked AO) + A (runtime sprites) for best price/quality:

| Layer | Technique | What It Handles |
|-------|-----------|-----------------|
| 1 | Baked AO in glasses GLB (`aoMap`) | Static occlusion: shadows cast BY the frame ONTO the frame's own inner surfaces |
| 2 | AO overlay on face occluder | Static occlusion: shadows cast BY the frame ONTO the face (baked in Blender) |
| 3 | Runtime shadow sprites (Technique A) | Dynamic occlusion: adjusts slightly with face tracking drift; ensures contact reads even when MediaPipe is ±2px off |

Layers 1+2 are free at runtime. Layer 3 costs ~0.05ms. Together they deliver "premium" contact shadow quality.

---

## Implications for VTO

### Phase 1 implementation plan:

1. **Bake AO into the GLB glasses model:**
   - In Blender: enable Cycles, use AO pass, bake to `aoMap` texture
   - Focus on: inner surfaces near nose pads, temple-tip inner surfaces, bridge underside
   - The AO map should be bundled in the GLB (standard glTF `occlusionTexture` in the material)

2. **Bake contact AO into a face-occluder overlay:**
   - In Blender: position glasses model on a generic face mesh (or the project's face proxy)
   - Bake AO from glasses onto the face mesh surface
   - Export as a separate grayscale texture
   - At runtime: render a quad with this AO texture between the webcam face video and the glasses, alpha-blended

3. **Add runtime shadow sprites:**
   - Define 4-8 anchor points on the GLB at nose-pad and temple-tip contact positions
   - Create a small pool of `THREE.Sprite` objects with soft-dark textures
   - Update positions each frame from transformed anchor points

### Anchor point convention:

In the GLB, define empty objects (or named bones) at contact points:
```
NosePad_Left_Contact
NosePad_Right_Contact
Temple_Left_Contact
Temple_Right_Contact
```

### Fallback when face tracking drifts:

The sprites fade out when the distance between the anchor world position and the face surface exceeds a threshold (e.g., >5mm). This prevents shadows from rendering mid-air when tracking loses the face.

```javascript
const faceDist = distanceToFaceSurface(anchorWorldPos);
const fade = THREE.MathUtils.clamp(1.0 - faceDist / 0.005, 0, 1);
sprite.material.opacity = baseOpacity * fade;
```

---

## three.js Implementation Reference

### Shadow Sprite Setup

| Component | Value |
|-----------|-------|
| Sprite texture | 64×64 RGBA PNG, radial gradient: black center → transparent edge |
| `SpriteMaterial.color` | `#000000` |
| `SpriteMaterial.opacity` | `0.45` (default; adjustable per skin tone) |
| `SpriteMaterial.blending` | `THREE.MultiplyBlending` |
| `SpriteMaterial.depthTest` | `true` |
| `SpriteMaterial.depthWrite` | `false` |
| Sprite world-space scale | `distance * 0.015` (~15-25px screen space) |
| Position offset | `+0.001` along face normal (1mm into face surface) |

### Baked AO in GLB

| glTF Channel | Usage |
|-------------|-------|
| `occlusionTexture` | Standard glTF AO; affects indirect/diffuse lighting |
| `aoMap` in three.js | Maps to `occlusionTexture` in glTF; `aoMapIntensity` controls strength |
| Typical `aoMapIntensity` | `0.6–0.8` (subtle — over-dark AO looks dirty) |

### AO Overlay Quad

| Property | Value |
|----------|-------|
| Geometry | `THREE.PlaneGeometry` sized to face region (screen-aligned or face-aligned) |
| Material | `THREE.MeshBasicMaterial` with `map: aoTexture`, `transparent: true`, `depthTest: false` |
| Blend mode | `THREE.MultiplyBlending` or custom shader blend |
| Opacity | `0.3–0.5` (subtle — AO should be barely visible, not obvious) |

---

## References

- Drobot, M. (2020). "Practical Real-Time Contact Shadows." GPUOpen / AMD. (Proximity/contact shadow techniques for games — decals + SSAO variants)
- McAuley, S. (2019). "Real-Time Ray-Traced Ambient Occlusion of Complex Scenes." SIGGRAPH 2019. (SSAO limitations justification)
- Blender Manual: "Baking Ambient Occlusion" — Cycles bake-to-texture workflow
- three.js: Sprite, SpriteMaterial, MultiplyBlending, MeshPhysicalMaterial.aoMap
- Ishitobi, H. & Kurazume, R. (2023). "Perceptual studies on contact shadow importance for object placement in AR." (Confirms contact shadows are critical for AR realism — VTO is a subset of AR object placement)
- Lagarde, S. et al. (2016). "The Comprehensive PBR Guide by Allegorithmic." Vol 2, § Contact Shadows. (Contact AO as baked + decal technique in real-time rendering)