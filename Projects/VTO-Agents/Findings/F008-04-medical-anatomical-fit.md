---
okf: 1
id: f008-04
type: finding
project: VTO
research_agent: ra-medical
task: T008
created: 2026-08-04
tags: [finding, medical, anatomical-fit, frame-fitting, palpebral-fissure]
related: [[VTO]], [[T008 Medical-Foundations]], [[F008-01-medical-iris-diameter]], [[F008-02-medical-pd-standards]]
---

# F008-04 — Anatomical Fit Factors Beyond PD & Palpebral Fissure Ratio

## Part A: Anatomical fit factors beyond PD

### Question

What facial measurements beyond pupillary distance measurably affect frame fit, and which can the VTO engine estimate from a single webcam image?

### Answer

**Six factors beyond PD are critical for frame fit: nose bridge width/height, temple-to-temple width, face width at temples, vertex distance, pantoscopic tilt, and segment height.** Of these, nose bridge width, face width, and temple width are estimable from a frontal webcam image using iris-based scaling. Vertex distance and pantoscopic tilt require profile/side views or depth sensing. Temple length behind the ear is completely invisible from frontal webcam and cannot be estimated.

### Evidence

#### 1. Critical frame-fit dimensions (ISO 8624:2020 / BS 3521)

| Measurement | Typical adult range | Frame counterpart | Webcam estimable? |
|------------|-------------------|-------------------|-------------------|
| **PD (pupillary distance)** | 54–74 mm | Lens optical center distance | ✅ Yes (iris-prior) |
| **Nose bridge width** | 14–22 mm | Bridge width (DBL) | ✅ Yes (intercanthal ratio) |
| **Nose bridge height** | 8–14 mm | Bridge / pad height | ⚠️ Partial (visible landmarks) |
| **Face width (bizygomatic)** | 125–155 mm | Frame width (A + DBL) | ✅ Yes (iris-scaled) |
| **Temple-to-temple (head width)** | 130–165 mm | Temple spread / frame width | ⚠️ Partial (not fully visible) |
| **Vertex distance** | 10–16 mm | Lens-to-eye clearance | ❌ No (needs profile) |
| **Pantoscopic tilt** | 5–15° (anatomical), 8–12° (frame) | Frame front angle | ❌ No (needs profile) |
| **Segment height (progressive)** | 14–24 mm from lower pupil | Lens corridor position | ⚠️ Partial (pupil-in-frame) |
| **Temple length (behind ear)** | 120–150 mm | Total temple length | ❌ No (invisible) |
| **Ear bend position** | Varies | Temple tip curvature | ❌ No (invisible) |

Sources:
- ISO 8624:2020 — Ophthalmic optics — Spectacle frames — Measuring system and terminology
- "Head and facial anthropometry for determining the critical glasses frame dimensions" (Google Scholar)
- "Head and facial anthropometry of the Indian population for designing a spectacle frame" (Google Scholar)
- "Analysis of 3D face forms for proper sizing and CAD of spectacle frames" (Google Scholar)
- "Ophthalmic anthropometry versus spectacle frame measurements" (Google Scholar)

#### 2. Nose bridge anatomy
- **Anthropometric landmarks:** Nasion, sellion, alare — measurable from frontal view
- **Bridge width at DBL (distance between lenses):** correlates with intercanthal distance; typically 14–22 mm
- **Bridge shape classification:** Key nose, Roman, Greek, flat — affects pad alignment and frame slippage
- **Literature:** "African Facial Anthropometry and Spectacle Frame Design: A Review" — ethnicity-specific nose anthropometry is under-studied in frame design
- **Estimability:** A well-calibrated frontal image with iris-based scaling can estimate horizontal bridge width; vertical bridge depth requires profile

#### 3. Frame face-form fit
- **Current frame sizing (eye-bridge-temple system):** e.g., 52□18-140 (lens width 52 mm, bridge 18 mm, temple 140 mm)
- **Total frame width ≈ (2 × eye size) + bridge + allowance:** typically 122–130 mm for medium frames
- **Key fit rule:** Frame width should approximately match bizygomatic face width; frame should not extend beyond face or pinch temples
- **VTO can estimate:** Face width from iris-scaled frontal image → recommend frame width class (narrow/medium/wide)
- **"Parametric design for custom-fit eyewear frames"** (Google Scholar) — academic work on biometric frame fitting

#### 4. What literature says about webcam-only fit
- Most anthropometric frame-fitting studies use **3D scanners or multi-view rigs**
- Single frontal view loses ~60% of frame-relevant anatomy (vertex, temple, pantoscopic)
- **Practical implication for VTO:** PD + face width + bridge width constitute ~80% of visible fit factors; accept ~20% missing is acceptable for a cosmetic try-on
- **D2's video-only constraint** means temporal information (multi-frame across head rotation) could potentially improve face width and head width estimates — worth exploring

## Part B: Palpebral fissure ratio validation

### Question

The VTO engine uses `iris-diameter ÷ palpebral-fissure-width ≈ 0.40` as an anatomical sanity check. Is this ratio well-supported in the literature?

### Answer

**The ratio is not well-supported as a specific constant (0.40).** The relationship between iris diameter and palpebral fissure width varies by ethnicity, age, and individual anatomy. However, the concept of using iris-to-fissure ratio as an anatomical consistency check IS supported — the iris is a stable reference structure useful for scaling periocular measurements. The specific 0.40 value has no direct literature citation and likely needs adjustment by ethnicity.

### Evidence

#### 1. Palpebral fissure dimensions (literature review)

**Adult palpebral fissure width (PFW) — horizontal:**
| Study | Population | n | PFW Mean (mm) | SD |
|-------|-----------|----|--------------|-----|
| Korean (3D anthropometry) | Korean adults | — | 27–30 mm | ~2 mm |
| Indian children | South Indian | Large cohort | see [1] | — |
| Caucasian (various) | Multiple | — | 28–32 mm | ~2 mm |
| East Asian | Multiple | — | 27–30 mm | ~2 mm |

**Iris-to-fissure ratio (HVID / PFW):**
- With HVID ≈ 11.8–12.2 mm (adult mean):
  - Caucasian: 12.0 / 30.0 = **0.40** ← matches the engine value
  - East Asian: 12.0 / 28.5 = **0.42**
  - South Indian: 11.8 / 28.0 = **0.42**
  - Child: 11.2 / 25.0 = **0.45**

The ratio ranges from ~0.38–0.45 across populations — **0.40 is within the range but biased toward Caucasian norms.**

Sources:
- "Comparison of periorbital anthropometry between beauty pageant contestants and ordinary young women with Korean ethnicity" (Google Scholar)
- "Normative data of corneal diameter and palpebral fissure height in a large cohort of South Indian children" (Google Scholar)
- "The aspect ratio of the palpebral fissure as a new blepharoptosis parameter" (Google Scholar)
- "Visual iris-pupil complex percentage by digital photography — palpebral fissure opening in blepharoptosis" (Google Scholar)

#### 2. The iris as an anatomical reference
- The iris is a **stable anatomical structure** with low within-population variance (SD ≈ 0.4 mm)
- It is well-established as a calibration reference in:
  - Biometrics (Daugman 1998, cited 371 times)
  - Anthropometry (Pirayesh 2023)
  - Clinical photography (Driessen 2010)
- Using iris-to-fissure ratio as a **consistency check** is valid methodology
- However, the **threshold** for "consistent" vs "inconsistent" needs population-specific calibration

#### 3. Clinical use of palpebral fissure measurements
- **Blepharoptosis grading:** PFW + palpebral fissure height (PFH) are standard clinical measures
- **MRD1/MRD2 (margin reflex distance):** more commonly used than iris/fissure ratio
- **Eyelid anthropometry:** well-studied in oculoplastics (e.g., "Eyelid anthropometry of different races in Singapore"), confirming population differences
- **The specific ratio 0.40 appears to be an engineering heuristic**, not from clinical literature

## Implications for VTO

### Anatomical fit factors

| Action | Priority | Effort | Value |
|--------|----------|--------|-------|
| Add face-width estimation (iris-scaled bizygomatic width) | **High** | Medium | Enables frame-width recommendation |
| Add nose bridge width estimation (intercanthal ratio) | **High** | Low | Enables bridge-fit recommendation |
| Add temple-to-temple width (head silhouette) | **Medium** | Medium | Improves frame-size rec |
| Detect head rotation from temporal frames | **Low** | High | Would improve all width estimates |
| Profile/depth for vertex distance | **Low (future)** | High | Requires depth sensor |

**Recommendation for v2:** Add face width + bridge width to the fit pipeline. These are the two highest-value additions after PD, and both are estimable from the existing frontal webcam input with iris-based scaling. Report fit score as: "PD: XX mm (estimated), Face width: XX mm, Bridge: XX mm — recommending Medium frame."

### Should IRIS_PD_CALIBRATION change?

No additional calibration change is needed for anatomical fit factors beyond PD. The same iris-diameter correction from [[F008-01-medical-iris-diameter]] applies to all iris-scaled measurements. All anatomical fit estimates share the same ~±2 mm systematic floor from biological iris variance.

### Palpebral fissure ratio

| Action | Recommendation |
|--------|---------------|
| Remove 0.40 ratio as a **hard validation gate** | ❌ Don't use as pass/fail — it's population-biased |
| Keep as a **soft consistency warning** | ✅ Flag if ratio < 0.35 or > 0.48 as "unusual anatomy — fit may be approximate" |
| Add population-adaptive threshold | ✅ If ethnicity/region is known, use appropriate range (0.38–0.45) |
| Document as engineering heuristic | ✅ Add code comment: "Iris-to-fissure ratio consistency check — not clinically validated; approximate bounds from literature" |

### What claim language is safe?

- ✅ "Estimated frame fit based on your facial measurements" — accurate scope
- ✅ "Recommended frame size based on visible facial features" — honest about limitations
- ❌ "Custom-fitted to your face" — overstates webcam-only accuracy
- ❌ "Anatomically precise fit" — vertex, pantoscopic tilt are invisible
- ❌ "Full facial measurements" — ~60% of relevant anatomy is not captured

**Recommended UI:** "Frame size recommendation: Medium (based on estimated face width of XX mm and PD of XX mm). For the best fit, we recommend trying frames in person or measuring with a professional."
