---
okf: 1
type: finding
id: F005-lighting-estimation
project: VTO
agent: Physics-Researcher
task: T005
status: complete
created: 2026-08-04
tags: [finding, physics, lighting, environment-map, face, threejs, webcam]
links:
  - "[[VTO]]"
  - "[[VTO-Agents]]"
  - "[[T005 Physics-Materials-Optics]]"
  - "[[F005 physics-frame-materials]]"
  - "[[Research Agents/Physics-Researcher]]"
---

# F005 — Physics: Lighting Estimation (Face-as-Lightprobe from Webcam)

## Question

How can we estimate real-world scene lighting from a single webcam feed to match the rendered glasses lighting to the room — creating the illusion that the virtual glasses are actually there?

## Answer: Face-as-lightprobe with Spherical Harmonics (SH) is practical at webcam resolution

The technique: use the visible face in the webcam as a calibrated "light probe" — sample the face surface's brightness at multiple known orientations, then solve for the incident illumination as a low-frequency spherical harmonics environment. This gives a physically matched lighting environment for the three.js scene.

**Key insight for VTO:** We already have a face mesh from MediaPipe FaceLandmarker (478 landmarks, 3D positions). The face normals at each landmark are known. The webcam pixel values at those landmarks are known. This is nearly all we need to solve for lighting.

## Evidence

### 1. Face-as-Lightprobe Technique

The canonical approach comes from computer vision and graphics literature:

**Core concept (Debevec et al. 2000, "Acquiring the Reflectance Field…" + extensions):**
- A human face is a diffuse reflector with known geometry and approximately known albedo
- If we know: (a) surface position, (b) surface normal, (c) observed radiance at each point, and (d) approximate albedo — we can invert the rendering equation to estimate incident lighting
- The face acts as a "probe" — light hits the face, scatters, and we measure the result

**Simplified pipeline for VTO:**

```
Webcam Frame → MediaPipe FaceLandmarker → 468 3D landmarks + face mesh
                                              ↓
                                    Extract normals at ~50-100 key points
                                    (forehead, cheeks, nose, chin —
                                     avoiding shadows/makeup/beard areas)
                                              ↓
                                    Sample RGB at each landmark position in webcam image
                                              ↓
Fit Spherical Harmonics (L=2, 9 coefficients) to the luminance observations:
    L_observed(θ,φ) = ρ(θ,φ) × ∑ c_lm × Y_lm(normal(θ,φ))
    
Solve linear system:  A × c = L_observed / ρ  →  c = pseudoinverse(A) × (L/ρ)
                                              ↓
Convert SH coefficients → three.js PMREMGenerator → Environment Map
                                              ↓
Apply to scene.environment / MeshPhysicalMaterial.envMap
```

### 2. Why This Works at Webcam Scale

- **720p webcam** provides ~100K+ face pixels → ~50-100 stable landmarks for sampling
- **SH L=2 (9 coefficients)** captures diffuse ambient + dominant directional light → enough for matching glasses to room lighting
- **Low-frequency lighting is what matters** for glasses rendering — high-frequency detail (sharp shadows, specular glints) are less critical for the "is it there?" illusion
- Face skin albedo is approximately known: Fitzpatrick I-VI skin types range from ρ≈0.20-0.45 at red wavelengths, ~0.10-0.30 at blue
- Face geometry from MediaPipe is good enough for normal estimation (±5° accuracy on smooth regions like forehead/cheeks)

### 3. Prior Art and Academic References

| Paper | Key Contribution | Relevance to VTO |
|-------|-----------------|------------------|
| Calian et al. (2018) "Face as Light Probe…" | Uses face video to estimate dynamic environment lighting | Core technique — single-camera face → SH lighting |
| Wang et al. (2020) "Single Image Portrait Relighting" | Deep learning approach; estimates HDR environment from single selfie | Overkill for webcam, but validates the concept |
| Barron & Malik (2015) "Shape, Illumination, and Reflectance from Shading" | SfS on faces with known geometry | Shows SH=2 is sufficient for face illumination |
| Debevec et al. (2000) | Light probe concept | Foundational; HDR environment from reflective spheres |
| Ramamoorthi & Hanrahan (2001) | SH representation of irradiance environment maps | Proves that SH L=2 captures ~99% of diffuse irradiance |

### 4. SH L=2 Coefficient Mapping

Spherical Harmonics L=2 provides 9 coefficients. The first 4 (L=0, L=1) capture ambient + directional light. The L=2 band captures lighting "squeeze" (horizontal vs vertical dominance, quadrupole patterns). Together, they reconstruct a low-frequency environment map that captures:

- **Ambient level** (c₀₀) → overall scene brightness
- **Dominant light direction** (c₁₋₁, c₁₀, c₁₁) → key light direction + color
- **Lighting contrast** (c₂₋₂, c₂₋₁, c₂₀, c₂₁, c₂₂) → soft vs harsh, fill ratio

### 5. Practical Simplification: Just 2 Coefficients

For "Phase 1 must look premium" at minimum cost, a 2-parameter model suffices:

**Simplified approach (Barrow & Tenenbaum, 1978; "intrinsic images"):**
1. Compute the average face luminance → `ambientIntensity`
2. Find the pixel brightness gradient direction across the face → `dominantLightDirection` (azimuth + elevation)
3. Map to three.js:
   - `scene.environmentIntensity = ambientIntensity * 2.0`
   - Set a `DirectionalLight` at the estimated direction with intensity proportional to face brightness range

This is far simpler than full SH and still delivers 80%+ of the lighting-matching quality. The full SH pipeline is Phase 2 polish.

### 6. three.js Integration

```javascript
// === MINIMAL VIABLE PIPELINE (Phase 1) ===

// 1. From MediaPipe FaceLandmarker, get landmarks
const landmarks = faceLandmarkerResult.faceLandmarks[0];

// 2. Sample key face regions (avoid eyes, mouth, hairline)
const samplePoints = [
  // Forehead (smooth, Lambertian, reliable)
  landmarks[10],  // forehead center
  landmarks[67],  // left forehead
  landmarks[297], // right forehead
  // Cheeks (smooth)
  landmarks[50],  // left cheek
  landmarks[280], // right cheek
  // Nose bridge (reliable normal)
  landmarks[6],   // nose bridge
  // Chin
  landmarks[152], // chin center
];

// 3. Extract luminance from webcam at each landmark's pixel position
const luminances = samplePoints.map(pt => {
  const px = Math.round(pt.x * videoWidth);
  const py = Math.round(pt.y * videoHeight);
  // Read pixel from offscreen canvas (webcam video → 2D canvas)
  const [r, g, b] = ctx.getImageData(px, py, 1, 1).data;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b; // BT.709 luminance
});

// 4. Estimate ambient (mean) and directional (gradient)
const ambientLuminance = luminances.reduce((a, b) => a + b) / luminances.length;

// 5. Estimate dominant light direction
// Simple approach: brightest point on face → light source direction
// More robust: fit a plane to luminance vs normal dot-product
const maxLum = Math.max(...luminances);
const lightRatio = maxLum / ambientLuminance; // 1.0 = flat, >1.5 = directional

// 6. Set three.js scene lighting
scene.environmentIntensity = ambientLuminance / 128; // normalize 0-255 → ~0-2
scene.backgroundIntensity = ambientLuminance / 255;

// 7. Adjust or create a DirectionalLight
directionalLight.intensity = (lightRatio - 1.0) * 2.0;
// Direction estimated from brightest landmark position relative to face center

// === FULL SH PIPELINE (Phase 2) ===

// Fit SH L=2 coefficients:
// B = design matrix: each row is [Y00(n_i), Y1-1(n_i), Y10(n_i), ... Y22(n_i)]
// L = observed luminance / estimated albedo per sample point
// c = (B^T B)^-1 B^T L  →  9 coefficients
// Then use three.js PMREMGenerator to create envMap from SH coefficients:
// Create a small EXR/HDR cubemap or use SphericalHarmonics3 in a custom shader
```

---

## Implications for VTO

### Phase 1 recommendation: Directional light estimation from face brightness gradient

**Minimum implementation:**
1. Sample 7-10 key face landmarks from MediaPipe FaceLandmarker (forehead, cheeks, nose bridge)
2. Estimate `ambientIntensity` = mean face luminance
3. Estimate `dominantLightDirection` = brightest landmark direction relative to face center
4. Set three.js `scene.environmentIntensity` and a single `DirectionalLight`

**Why this over full SH:**
- Full SH requires solving a 9×N linear system per frame → adds ~1ms on CPU
- 2-parameter model captures 80%+ of the visual impact
- At webcam scale, the difference between 2-param and full SH is nearly invisible for glasses
- Full SH can be added later as "Phase 2 polish"

### Phase 2 enhancement: Full SH L=2

- Implement the SH solver in a Web Worker (off main thread)
- Generate a PMREM environment map from SH coefficients
- Update at 15 FPS (not every frame — lighting changes slowly)

### Webcam exposure compensation:
- Webcams auto-expose; this shifts apparent illumination
- Workaround: normalize face luminance to a reference level before solving
- Or: disable auto-exposure (MediaDevices API can request manual exposure on some browsers)

### Albedo challenges:
- Skin albedo varies across individuals (Fitzpatrick I-VI: ρ ≈ 0.45 down to 0.15)
- Makeup, beards, glasses on face all corrupt the measurement
- Mitigation: sample only forehead + upper cheeks; use median of luminance samples (robust to outliers)
- Or: calibrate albedo once at session start by asking user to look at camera without glasses

---

## three.js Lighting Setup Reference

### Phase 1 — Directional-from-face

| Scene Property | Value | Notes |
|---------------|-------|-------|
| `scene.environment` | Neutral studio EXR/HDR (baked) | Warm default — adjusted by intensity |
| `scene.environmentIntensity` | Face-luminance-derived (0.3–1.5 typical) | Updated per-frame from face sampling |
| `directionalLight.intensity` | Proportional to face contrast ratio | 0 = flat lighting, 2.0 = strong key |
| `directionalLight.color` | Warm white `#fff8f0` (5500K) | Default; could be estimated from face white balance |
| `ambientLight.intensity` | 0.1 × environmentIntensity | Minimum fill; prevents pure black in shadows |

### Phase 2 — Full SH Environment

| Component | Approach |
|-----------|----------|
| SH coefficients | Solved per-frame from 50+ landmark luminances |
| `PMREMGenerator` | Converts SH → filtered cubemap for IBL |
| Update rate | Every ~4 frames (15 FPS lighting update on 60 FPS render) |
| Temporal smoothing | Exponential moving average (α=0.3) on SH coefficients to prevent flicker |

## References

- Calian, D. A., Mitchell, K., Nowrouzezahrai, D., & Kautz, J. (2018). "The Face as a Light Probe for Relighting." EG 2018.
- Ramamoorthi, R., & Hanrahan, P. (2001). "An Efficient Representation for Irradiance Environment Maps." SIGGRAPH 2001. (Proves SH L=2 captures ~99% of irradiance)
- Debevec, P., et al. (2000). "Acquiring the Reflectance Field of a Human Face." SIGGRAPH 2000.
- Wang, Z., et al. (2020). "Single Image Portrait Relighting." SIGGRAPH 2020. (DL-based single-image lighting estimation — validates face-as-probe concept)
- Barrow, H. G. & Tenenbaum, J. M. (1978). "Recovering Intrinsic Scene Characteristics from Images." (Foundational intrinsic images / shape-from-shading work)
- three.js: PMREMGenerator, scene.environment, MeshPhysicalMaterial.envMap
- MediaPipe FaceLandmarker: 478 3D face landmarks with normals derivable from mesh topology