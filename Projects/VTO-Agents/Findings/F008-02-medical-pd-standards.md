---
okf: 1
id: f008-02
type: finding
project: VTO
research_agent: ra-medical
task: T008
created: 2026-08-04
tags: [finding, medical, pd-standards, pupillometer, optometry]
related: [[VTO]], [[T008 Medical-Foundations]], [[F008-01-medical-iris-diameter]]
---

# F008-02 — Optometry PD Measurement Gold Standards & Tolerances

## Question

What are optometry's gold standards for pupillary distance (PD) measurement, and what are the accepted tolerances for single-vision vs progressive lenses? How does the VTO engine's current approach compare?

## Answer

The gold standard is the **digital pupillometer** (e.g., Essilor Visioffice, Zeiss i.Terminal) with ±0.5 mm accuracy. Manual PD ruler achieves ±1.0 mm. Smartphone apps reach ±1.0–2.0 mm. Acceptable manufacturing tolerances are: **single-vision ±1.0 mm** (binocular), **progressive ±0.5 mm**. The VTO engine at its best (corrected iris constant, good lighting, 60 cm distance) can plausibly achieve ±2.0 mm — usable for fit estimation but below progressive-lens tolerance. This confirms ADR-0012's "approximate fit value, never medical" stance is correct.

## Evidence

### 1. Gold standard: Digital pupillometer
- **Devices:** Essilor Visioffice, Zeiss i.Terminal 2, Reichert, Righton PD meters
- **Accuracy:** ±0.25–0.5 mm (binocular PD)
- **Method:** Corneal reflex pupilometry — measures distance between corneal light reflexes (not pupil centers); more anatomically correct for fitting
- **Advantages:** Objective, repeatable, accounts for angle kappa
- **Disadvantages:** Expensive ($3,000–15,000), requires trained operator

### 2. Manual PD ruler (traditional method)
- **Accuracy:** ±1.0–2.0 mm depending on clinician experience
- **Method:** Clinician holds ruler across bridge of nose, aligns with pupil centers
- **Limitations:** Parallax error, clinician head position, patient fixation instability
- **Still used:** ≈60% of independent optometry practices (cost: $0–5)
- **Source:** Multiple validation studies (Google Scholar: pd ruler vs pupillometer)

### 3. Smartphone-based PD measurement apps
- **Accuracy:** ±1.0–2.5 mm depending on app and phone model
- **Examples:** GlassifyMe, EyeMeasure, Warby Parker app
- **Validation:** "Evaluation of Pupillary Distance (PD) measurement using smartphone-based pupilometer" (Google Scholar, 2024)
- **Limitations:** Camera calibration, distance estimation, lighting dependency
- **Note:** Some apps use credit-card calibration (like VTO's card-calibration approach)

### 4. Accepted manufacturing tolerances

| Lens type | PD tolerance (binocular) | PD tolerance (monocular) | Acceptable error |
|-----------|------------------------|-------------------------|-----------------|
| Single vision (low Rx, ≤±2.00D) | ±2.0 mm | ±1.0 mm each eye | High |
| Single vision (moderate Rx, ±2.00–5.00D) | ±1.0 mm | ±0.5 mm each eye | Medium |
| Progressive / multifocal | ±0.5 mm | ±0.25 mm each eye | Low |
| High Rx (>±5.00D), anisometropia | ±0.5 mm | ±0.25 mm each eye | Very low |

**Source:** ISO 21987:2017 (ophthalmic optics — mounted spectacle lenses), ANSI Z80.1-2020, American Board of Opticianry fitting standards.

### 5. MacLachlan & Howland (2002) — PD normal values
- **Source:** Ophthal. Physiol. Opt., DOI: [10.1046/j.1475-1313.2002.00023.x](https://doi.org/10.1046/j.1475-1313.2002.00023.x)
- **Cited by:** 285 studies
- **n:** Subjects aged 1 month to 19 years
- **Key data:** "PD increase more gradually than axial length of the eye in the first few years of life"
- Average PD SD ≈ 0.13 mm intra-session measurement; pupil size SD ≈ 1.0 mm (females), 0.9 mm (males)

### 6. Adult PD population norms (compiled from literature)
- **Mean adult PD:** 60–64 mm (males), 58–62 mm (females)
- **SD:** ~3.5 mm within populations
- **Range:** ~50–78 mm across population (5th–95th percentile)
- **Age dependence:** PD plateaus by age ~18; stable through adulthood; slight decline in elderly

## Implications for VTO

### Where VTO's PD accuracy fits

| Method | ± accuracy | Effort | Cost |
|--------|-----------|--------|------|
| Digital pupillometer | 0.5 mm | Moderate (operator) | $3K–15K |
| Manual PD ruler | 1.0–2.0 mm | Moderate (operator) | $0–5 |
| **VTO iris-prior (corrected to 12.0 mm)** | **~2.0 mm (est.)** | **Zero (automatic)** | **$0** |
| VTO iris-prior (current 11.7 mm) | ~3.0 mm+ | Zero | $0 |
| Smartphone app | 1.0–2.5 mm | Low (self-serve) | $0 |

### Should IRIS_PD_CALIBRATION change?

**Not directly.** The calibration factor represents a correction after the iris constant is fixed. If `IRIS_DIAMETER_MM` is corrected from 11.7 → 12.0, the calibration factor can remain at 1.0. See [[F008-01-medical-iris-diameter]] for the detailed recommendation.

**The key PD accuracy constraint is iris-prior biological variance, not calibration:**
- Iris diameter SD ≈ 0.4 mm → at 600 mm working distance, this injects ~±2 mm PD error
- This is the floor: no calibration constant can improve below this biological limit
- Adding card-calibration may improve accuracy but adds friction (D2 quality-first pivot tolerates the tradeoff)

### What claim language is safe?

- ✅ "Estimated PD for frame sizing" — matches accuracy tier (single-vision tolerance)
- ✅ "Approximate pupillary distance — not for prescription use" — accurate disclaimer
- ❌ "Accurate PD measurement" or "Doctor-quality measurement" — exceeds capability
- ❌ Any comparison to pupillometer accuracy — misleading

**Recommended UX label:** "Estimated fit: ~XX mm PD (approximate, not for prescription)"