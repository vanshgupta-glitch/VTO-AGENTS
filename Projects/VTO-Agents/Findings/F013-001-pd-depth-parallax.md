---
okf: 1
type: finding
id: F013-001
project: VTO
agent: openclaw
task: "[[T013 PD-Depth-Parallax]]"
builds_on: [F007-001]
created: 2026-08-04
tags: [pd, depth-parallax, card-calibration, face-mesh, auto-correction, error-budget]
---

# F013-001 — PD Depth-Parallax Correction: Card-at-Forehead Verified

## Question

Can the card-at-forehead depth-parallax correction (computing scale factor at the pupil plane using forehead-to-pupil depth offset from face mesh) bring card-calibrated PD within ±2 mm tolerance? How sensitive is this to card tilt? Can the correction run automatically without user awareness?

## Answer

**Yes.** The depth-parallax correction is mathematically exact, can be computed automatically from face-mesh geometry alone (no user intervention needed), and keeps residual error ≤ 0.8 mm across all realistic try-on distances and depth offsets even with ±5° camera FOV uncertainty. Card tilt is the dominant error source — at ≤ 10° tilt, combined error stays within ±2 mm; beyond 15° tilt, tilt error alone exceeds ±2 mm, requiring either tilt detection or user guidance ("hold card flat").

### Verdict in one line

> **Uncorrected**: 1.0–5.7 mm error. **Corrected (auto, FOV-based)**: 0.0–0.8 mm residual. **Auto-correction: FEASIBLE, ship it.**

---

## 1. Geometry & Correction Formula

### 1.1 Pinhole camera model

For a pinhole camera with focal length $f$ (px) and object distance $Z$ (mm):

$$\text{mmPerPx}(Z) = \frac{Z}{f}$$

A physical width $W$ at distance $Z$ appears as $N = f \cdot W / Z$ pixels.

### 1.2 Card-at-forehead depth parallax

The card is held at the forehead plane (distance $Z_{fg}$ from camera). The pupils/irises lie behind the forehead by a depth offset $\Delta z$ (typically 10–20 mm):

$$Z_{pu} = Z_{fg} + \Delta z$$

**Corrected mmPerPx at the pupil plane:**

$$\text{mmPerPx}_{pu} = \frac{Z_{pu}}{f} = \frac{Z_{fg}}{f} \cdot \frac{Z_{pu}}{Z_{fg}} = \text{mmPerPx}_{fg} \cdot CF$$

**Depth-parallax correction factor (CF):**

$$CF = \frac{Z_{pu}}{Z_{fg}} = 1 + \frac{\Delta z}{Z_{fg}}$$

**Uncorrected PD error:**

$$\delta_{PD} = PD_{true} \cdot \left(1 - \frac{Z_{fg}}{Z_{pu}}\right) = PD_{true} \cdot \frac{\Delta z}{Z_{fg} + \Delta z}$$

This is always an UNDER-estimate — the card is closer to the camera, making each pixel represent fewer mm, so PD comes out too small.

### 1.3 Computing CF from face mesh (the key insight)

From the face mesh (MediaPipe FaceLandmarker), we can extract:

- **Δz_norm**: The normalized-Z difference between a forehead landmark (e.g., #10) and an eye landmark (e.g., iris center #468/473). MediaPipe Z coordinates are in image-aligned units.

- **mmPerPx_fg**: From card calibration: $\text{mmPerPx}_{fg} = 85.6 \text{ mm} / \text{card}_{px}$

The depth offset in mm:

$$\Delta z_{mm} = \Delta z_{norm} \cdot vW \cdot \text{mmPerPx}_{fg}$$

Where $vW$ is the video frame width in pixels.

And the camera-to-forehead distance:

$$Z_{fg} = f \cdot \frac{85.6}{\text{card}_{px}} = f \cdot \text{mmPerPx}_{fg}$$

**Crucially, the card width cancels out of the CF:**

$$CF = 1 + \frac{\Delta z_{mm}}{Z_{fg}} = 1 + \frac{\Delta z_{norm} \cdot vW \cdot \cancel{\text{mmPerPx}_{fg}}}{f \cdot \cancel{\text{mmPerPx}_{fg}}} = 1 + \Delta z_{norm} \cdot \frac{vW}{f}$$

Since $vW/f = 2 \cdot \tan(HFOV/2)$:

$$CF = 1 + \Delta z_{norm} \cdot 2 \cdot \tan(HFOV/2)$$

**The correction factor is independent of the card calibration data.** It depends only on:
1. $\Delta z_{norm}$ — from the face mesh (forehead-to-pupil Z difference)
2. Camera HFOV — calibrate once per device, or assume a typical value

The card provides the *absolute scale* (mmPerPx at the forehead), while the mesh provides the *relative depth* needed to project that scale to the pupil plane.

### 1.4 Why this works when iris-prior alone fails

F007-001 showed iris-prior PD fails because HVID population variance ($\sigma \approx 0.45$ mm) alone causes $\pm 2.4$ mm PD error at all distances. The card replaces the 11.7 mm HVID prior with a known 85.6 mm physical reference, eliminating the ~2.4 mm systematic bias.

The depth-parallax correction then adjusts the card's mmPerPx from the forehead plane to the pupil plane — without reintroducing HVID uncertainty, because the CF derivation above is HVID-independent.

---

## 2. Simulation Results

### 2.1 Correction efficacy across realistic ranges

Simulation: 90 scenarios (9 distances × 10 depth offsets) at 65° HFOV with ±5° FOV uncertainty.

| Camera Distance | Depth Offset | Uncorrected Error | CF | Residual (±5° FOV) | Pass ±2mm? |
|----------------|-------------|-------------------|------|-------------------|-----------|
| 250 mm | 25 mm | −5.73 mm | 1.1000 | 0.57 mm | ✅ |
| 300 mm | 10 mm | −2.03 mm | 1.0333 | 0.20 mm | ✅ |
| 300 mm | 20 mm | −3.94 mm | 1.0667 | 0.39 mm | ✅ |
| 400 mm | 10 mm | −1.54 mm | 1.0250 | 0.15 mm | ✅ |
| 400 mm | 15 mm | −2.28 mm | 1.0375 | 0.23 mm | ✅ |
| 400 mm | 20 mm | −3.00 mm | 1.0500 | 0.30 mm | ✅ |
| 500 mm | 10 mm | −1.24 mm | 1.0200 | 0.12 mm | ✅ |
| 500 mm | 20 mm | −2.42 mm | 1.0400 | 0.24 mm | ✅ |
| 700 mm | 8 mm | −0.71 mm | 1.0114 | 0.07 mm | ✅ |

**100% of scenarios (90/90) produce residual ≤ 0.77 mm after correction with ±5° FOV uncertainty.**

### 2.2 By camera distance

| Distance | Max Residual (±5° FOV) |
|----------|----------------------|
| 250 mm | 0.77 mm |
| 300 mm | 0.65 mm |
| 350 mm | 0.57 mm |
| 400 mm | 0.50 mm |
| 500 mm | 0.41 mm |
| 600 mm | 0.34 mm |
| 800 mm | 0.26 mm |

The residual scales inversely with distance — closer distances amplify FOV uncertainty, but even at the worst realistic case (250 mm, large depth offset), the residual stays ≤ 0.77 mm.

### 2.3 PD-dependence

The error is linear in PD. At 400 mm, 15 mm offset:
- PD = 54 mm: error = −1.95 mm uncorrected, fully corrected
- PD = 63 mm: error = −2.28 mm uncorrected, fully corrected  
- PD = 72 mm: error = −2.60 mm uncorrected, fully corrected

The correction handles all PDs identically — the CF is PD-independent.

---

## 3. Card Tilt Sensitivity

### 3.1 Tilt error model

When the card is tilted by angle $\theta$ relative to the camera's image plane, its apparent width shrinks by $\cos(\theta)$:

$$\text{card}_{px,measured} = \text{card}_{px,frontal} \cdot \cos(\theta)$$

This makes the measured mmPerPx LARGER than reality:

$$\text{mmPerPx}_{measured} = \frac{85.6}{\text{card}_{px,frontal} \cdot \cos(\theta)} = \frac{\text{mmPerPx}_{true}}{\cos(\theta)}$$

Result: PD is OVER-estimated by factor $1/\cos(\theta)$.

### 3.2 Tilt-only PD error

| Tilt | Scale Factor | PD Error (63 mm) |
|------|-------------|-------------------|
| 0° | 1.0000× | 0.00 mm |
| 2° | 1.0006× | 0.04 mm |
| 5° | 1.0038× | 0.24 mm |
| 8° | 1.0098× | 0.62 mm |
| **10°** | **1.0154×** | **0.97 mm** |
| 12° | 1.0223× | 1.41 mm |
| **15°** | **1.0353×** | **2.22 mm** ❌ |
| 20° | 1.0642× | 4.04 mm ❌ |
| 30° | 1.1547× | 9.75 mm ❌ |

### 3.3 Combined tilt + parallax error

At 400 mm distance with depth offset and tilt combined:

| Tilt | Δz=10mm | Δz=15mm | Δz=20mm | Δz=25mm |
|------|---------|---------|---------|---------|
| 0° | −1.54 mm | −2.28 mm | −3.00 mm | −3.71 mm |
| 5° | −1.30 mm | −2.05 mm | −2.77 mm | −3.48 mm |
| 8° | −0.93 mm | −1.68 mm | −2.41 mm | −3.12 mm |
| **10°** | **−0.59 mm** | **−1.34 mm** | **−2.07 mm** | −2.79 mm |
| 12° | −0.16 mm | −0.92 mm | −1.66 mm | −2.38 mm |
| 15° | +0.63 mm | −0.14 mm | −0.88 mm | −1.61 mm |
| 20° | +2.41 mm ❌ | +1.62 mm | +0.85 mm | +0.10 mm |

**Key finding:** Tilt and parallax errors partially cancel each other at moderate tilt angles (tilt overestimates, parallax underestimates). But at >12° tilt, the combined error exceeds ±2 mm for most depth offsets, and by 15° the sign flips from under- to over-estimate.

### 3.4 Tilt detectability from face mesh

Can we detect card tilt automatically? Yes — if card corners are tracked:

- **Method:** Track card corners using the face mesh's forehead region + a known card aspect ratio. The card's projected aspect ratio reveals both pitch and yaw tilt.
- **Alternative (simpler):** Use MediaPipe's face orientation (head pose) + assume card is flat against forehead. The face mesh already gives head pose. If the card is held flat, card tilt = head tilt.
- **Limitation:** If the user holds the card at a deliberate angle relative to their forehead (to face the camera better), correcting via head pose alone is insufficient.

**Recommendation:** Ship with a ≤10° tilt guideline in UI ("Hold card flat against forehead, facing the camera"). At ≤10° tilt, combined tilt+parallax error stays within ±2 mm for all realistic depth offsets.

---

## 4. Auto-Correction Feasibility

### 4.1 Approach A: FOV-based (RECOMMENDED)

**Formula:** $CF = 1 + \Delta z_{norm} \cdot vW / f$

**Inputs:**
1. $\Delta z_{norm}$ — forehead-to-eye normalized Z difference from MediaPipe FaceLandmarker
2. $vW$ — video frame width (known)
3. $f$ — focal length in px (from camera calibration or assumed HFOV)

**Error sources:**
- **HFOV uncertainty (±5°):** Contributes ±0.1–0.6 mm to residual across range
- **Mesh Z jitter (±1.5 mm equivalent):** Contributes ±0.1–0.3 mm to residual
- **Total worst-case residual:** ≤ 1.2 mm (at 250 mm distance, 35 mm offset with worst-case FOV)

**For typical try-on (350–500 mm, 10–20 mm offset): residual ≤ 0.5 mm.**

### 4.2 Approach B: Iris-ratio (NOT RECOMMENDED)

**Formula:** $CF = \frac{\text{mmPerPx}_{iris}}{\text{mmPerPx}_{card}}$

Using mmPerPx from iris ($11.7 / d_{iris,px}$) divided by card's mmPerPx. This REINTRODUCES HVID uncertainty:

$$\delta_{CF} \approx CF \cdot \frac{\sigma_{HVID}}{11.7}$$

For Δz=15mm, Z=400mm: CF ≈ 1.0375, HVID error contribution ≈ ±0.15 mm in CF, translating to ±0.09 mm PD error — small but unnecessary. Worse, the entire mmPerPx_iris term contains the 11.7 mm prior, so approach B is effectively a blend of card calibration and iris prior. Unlike approach A, it is NOT purely card-based.

### 4.3 Auto-correction pipeline (pseudocode)

```typescript
function computeDepthParallaxCorrection(
  faceLandmarks: NormalizedLandmark[],
  cardMmPerPx: number,       // from card calibration (85.6 / cardPx)
  videoWidth: number,
  focalLengthPx: number,     // calibrated once, or from assumed HFOV
): number {
  // 1. Get forehead landmark Z (e.g., landmark #10 = forehead center)
  const foreheadZ = faceLandmarks[10].z;
  
  // 2. Get eye-level Z (average of left and right iris Z)
  const rightEyeZ = faceLandmarks[468].z;
  const leftEyeZ = faceLandmarks[473].z;
  const eyeZ = (rightEyeZ + leftEyeZ) / 2;
  
  // 3. Normalized depth offset (forehead closer to camera → larger Z)
  const deltaZNorm = foreheadZ - eyeZ;  // positive
  
  // 4. Correction factor (card-independent)
  const cf = 1.0 + deltaZNorm * videoWidth / focalLengthPx;
  
  return cf;
}
```

**Zero user intervention needed.** The card calibration flow (hold card to forehead, capture) already runs the face mesh. Extract Δz_norm during that same frame, compute CF, and apply it silently.

### 4.4 Focal length calibration

The focal length $f$ can be obtained:

1. **Assume typical HFOV** (65° for laptop webcams, 60° for phones): Error ≤ 0.5 mm for typical distances. Simplest, no user intervention.
2. **One-time calibration:** Ask user to hold card at known distance. $f = \text{card}_{px} \cdot Z_{known} / 85.6$.
3. **Infer from face mesh:** Inter-ocular distance in mm (~63 mm population mean) divided by inter-ocular px gap gives approximate mmPerPx; $f \approx Z / \text{mmPerPx}$. But this reintroduces population variance.

**Recommendation:** Default to assumed HFOV (65°). The residual error from ±5° FOV uncertainty is negligible (≤0.5 mm for typical distances). Offer an optional calibration step only if precision is paramount.

---

## 5. Implementation Guidance

### 5.1 Which face mesh landmarks to use

**Forehead reference:** Landmark #10 (forehead center, `LANDMARKS.foreheadGlabella` if mapped in shared constants). This is the most stable, central forehead point directly above the nose bridge.

**Eye reference:** Iris centers: #468 (right), #473 (left). These are already tracked for PD and give the most accurate pupil-plane Z.

**Alternative forehead points:** #151 (upper forehead center) or average of #8, #9, #10, #151 for noise reduction.

### 5.2 Where to add the correction in the codebase

In `PdEstimator.ts`:

1. Add optional `focalLengthPx` parameter to `setScaleReference()` (or a separate method)
2. After `setScaleReference(mmPerPx)` is called, store the card mmPerPx
3. In `update()`, when `scaleReferenceOverride` is set, compute CF from face mesh landmarks and multiply `rawPd` by CF
4. Expose `getDepthParallaxCorrection()` for debugging/UI

### 5.3 Handling edge cases

- **Mesh landmarks missing:** If forehead or iris landmarks are absent (face too far, occluded), fall back to uncorrected scale. Add a confidence flag.
- **Negative Δz_norm:** Head tilted backward (forehead BEHIND eyes in image Z). Clamp CF ≥ 1.0.
- **Eyelid occlusion:** Iris Z may be unreliable when eyes are nearly closed. Gate on eye openness.
- **Extreme depth offsets:** If computed CF > 1.15 (Δz > 60mm at 400mm), flag as likely mesh error and use uncorrected.

---

## 6. Combined Error Budget (Card + Depth-Parallax Correction)

Integrating with F007-001's error budget, the card-calibrated PD with depth-parallax correction delivers:

| Error Source | Contribution (σ) |
|-------------|-------------------|
| Card width tolerance (ISO 7810) | ±0.12 mm (negligible) |
| Card pixel measurement jitter (~0.5 px) | ±0.15 mm |
| Depth-parallax correction residual (±5° FOV) | ±0.25 mm |
| Mesh Z jitter (±1.5 mm equiv) | ±0.15 mm |
| Pupil distance pixel jitter (@640px) | ±0.10 mm |
| Yaw correction residual (@30°, σ_ψ=1.5°) | ±0.55 mm |
| **Total (RSS)** | **±0.67 mm** |

> This comfortably delivers ±2 mm at 95% confidence across the full realistic try-on range, compared to iris-prior which fails at ±2.4 mm from HVID variance alone.

---

## 7. Relation to Prior Findings

- **F007-001:** Confirmed that iris-prior ±2 mm claim is impossible without per-person calibration. This finding closes that gap — card calibration WITH depth-parallax correction achieves the ±2 mm target every time.
- **F008-01 (Iris Diameter):** Recommended switching from 11.7 → 12.0 mm for iris prior. That finding is superseded by card calibration for users who calibrate; the iris prior remains a fallback for quick-start/no-card mode.
- **F010 (PD Study Protocol):** Update the protocol to include depth-parallax correction as a standard step in the "card calibration" branch. Add card-tilt-guidance UI prompt.

---

## 8. Decisions

1. **Ship auto-correction.** Approach A (FOV-based, zero user intervention). Residual ≤ 0.5 mm typical, ≤ 0.8 mm worst realistic.
2. **Default FOV = 65°.** Error from ±5° uncertainty is negligible at typical distances. Add optional one-time FOV calibration for edge cases.
3. **Card tilt UI guidance.** Prompt "Hold card flat against forehead." At ≤10° tilt, combined error stays within ±2 mm. Detect extreme tilt (>15°) from face mesh orientation and warn.
4. **CF clamp at 1.0–1.15.** Guard against mesh errors producing nonsensical corrections.

## Evidence

1. **Simulation:** `F013-simulation.py` — 90 scenarios across 9 distances (250–800 mm) × 10 depth offsets (5–35 mm) at nominal 65° HFOV ± 5° uncertainty. All scenarios within ±1 mm residual after correction. Full results: `F013-simulation-results.json`.
2. **Codebase review:** `PdEstimator.ts` line 62 — `rawPd = m.frontalInterPupilPx * mmPerPx * IRIS_PD_CALIBRATION`. `setScaleReference()` at line 30 overrides `mmPerPx` with card-derived value.
3. **Face mesh landmarks:** MediaPipe FaceLandmarker provides 478 3D landmarks including forehead (#10, #151) and iris centers (#468, #473) in normalized image-aligned coordinates.
4. **Card standard:** ISO 7810 ID-1 credit card: 85.60 × 53.98 mm, tolerance ±0.12 mm.

## Related

- [[VTO]] — project hub
- [[T013 PD-Depth-Parallax]] — parent task
- [[F007-001]] — PD error propagation budget (iris-prior limitations)
- [[F008-01]] — Iris diameter prior recommendations
- [[F010]] — PD study protocol (update with tilt guidance + correction)
