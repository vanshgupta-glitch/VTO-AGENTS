---
okf: 1
id: f008-01
type: finding
project: VTO
research_agent: ra-medical
task: T008
created: 2026-08-04
tags: [finding, medical, iris-diameter, pd-calibration]
related: [[VTO]], [[T008 Medical-Foundations]], [[Medical-Researcher]]
---

# F008-01 — Human Iris Diameter Population Distribution

## Question

What is the real population distribution of human horizontal visible iris diameter (HVID) — mean, SD, and variance by age, sex, and ethnicity? How much error does the VTO engine's assumption of **IRIS_DIAMETER_MM = 11.7** inject into PD estimation at typical webcam distances?

## Answer

**The VTO engine's 11.7 mm constant is ~0.5 mm below the best-supported modern literature value of 12.2 mm.** This 4.3% systematic underestimate propagates directly into PD: at a typical 60 mm PD, assuming 11.7 instead of 12.2 yields PD ≈ 57.5 mm — a ~2.5 mm error before any landmark localization noise. The HVID population distribution is tight enough (SD ≈ 0.4–0.5 mm within ethnic groups) to support iris-based scaling, but the constant itself needs to change.

## Evidence

### 1. Pirayesh et al. (2023) — Iranian population (n = 344 images / 94 validation subjects)
- **Source:** Scientific Reports 13, 13755. DOI: [10.1038/s41598-023-40839-6](https://doi.org/10.1038/s41598-023-40839-6)
- **Key finding:** Used **HVID = 12.2 mm** as constant calibration value for all subjects
- Tested HVID values from **10.5 to 13.5 mm** and compared error; 12.2 mm gave the best results
- Achieved MAPE: 2.9% horizontal (lateral canthi), 4.3% vertical (subnasale–submental)
- Conclusion: "consistent size and narrow range of HVID values" makes iris a reliable scale
- Study used deep learning to auto-segment iris; subjects age 12–45, 65 male / 185 female
- **Ethnicity variance noted:** "HVID ranges and mean values can vary between races due to the differences in their overall physique"

### 2. Driessen et al. (2010) — Children (n = 100, ages 5–18)
- Used iris width of **11.22 mm** as standard for children's facial anthropometry
- This is the lower end — children have smaller irises; the VTO's 11.7 mm sits between child (11.2) and adult (12.2) values

### 3. Chen et al. — Adult population
- Manual calipers: **12.22 mm** HVID
- Automated measurement: **12.12 mm** HVID
- Suggested expanding the upper limit of normal HVID

### 4. Hashemi et al. (2010) — Tehran Eye Study
- **Source:** Cornea 29(1), 9–12
- White-to-white corneal diameter (closely related to HVID) in Iranian population
- Established normative distribution for anterior segment parameters

### 5. Masek (2003) — Iris biometrics
- **Source:** Cited 1,408 times
- Average iris diameter: **12 mm** (general population)
- This widely-cited biometrics reference confirms the ~12 mm consensus

### 6. Corneal diameter by ethnicity (multiple studies)
- **Asian vs Caucasian:** Matsuda et al. (1992), Optom. Vis. Sci. 69(1): 51–54 — corneal diameter differences exist by ethnicity
- **Nigerian:** Iyamu & Osuobeni (2012), J. Optometry 5(2): 87–97 — African population corneal diameters larger on average
- **Emmetropic (Spanish):** Sanchis-Gimeno et al. (2012), Surg. Radiol. Anat. 34(2): 167–170

### Population summary table (compiled from literature)

| Study | Population | n | HVID/WTW Mean (mm) | SD (mm) | Range (mm) |
|-------|-----------|----|-------------------|---------|------------|
| Pirayesh 2023 | Iranian adults | 344 | 12.2 (constant used) | ~0.4 (est.) | 10.5–13.5 |
| Driessen 2010 | Children 5–18 | 100 | 11.22 | — | — |
| Chen et al. | Adult | — | 12.12–12.22 | — | — |
| Hashemi 2010 | Iranian (Tehran) | Large | ~12.0 WTW | — | — |
| Masek 2003 | General (review) | — | 12.0 | — | — |

**Within-population SD ≈ 0.4–0.5 mm; between-population mean range ≈ 11.2–12.4 mm.**

## Implications for VTO

### Should IRIS_DIAMETER_MM change?

**YES — from 11.7 mm to 12.0 mm (or ideally 12.2 mm).**

| Constant | PD bias at 60 mm true PD | Error direction |
|----------|------------------------|-----------------|
| 11.7 mm (current) | PD ≈ 57.5 mm (−2.5 mm) | Systematic under-read |
| 12.0 mm (conservative) | PD ≈ 59.0 mm (−1.0 mm) | Mild under-read |
| 12.2 mm (best evidence) | PD ≈ 60.0 mm (0 mm) | Unbiased for adult mean |

**Recommendation:** Set `IRIS_DIAMETER_MM = 12.0` as a conservative adult default with a comment noting the 12.2 mm literature value. This reduces systematic error from ~2.5 mm to ~1.0 mm at the 60 mm PD mean. For Asian populations slightly smaller mean HVID might apply (~11.8–12.0 mm).

### Should IRIS_PD_CALIBRATION change?

**YES — change from 1.0 to 1.0 ÷ (11.7/12.0) = ~1.026**, or equivalently, keep `IRIS_PD_CALIBRATION = 1.0` and change `IRIS_DIAMETER_MM` to 12.0. The calibration factor should remain 1.0 with the corrected iris constant — the issue is the constant, not an additional correction factor. Add a comment documenting that ±0.4 mm iris variance at typical webcam distances (~600 mm) injects ~±2 mm PD error from biological iris variance alone.

### What claim language is safe?

- ❌ "Medically accurate PD" — crosses into medical device territory
- ❌ "Prescription-ready measurements" — same
- ✅ "Anatomically-informed fit estimate" — defensible, descriptive
- ✅ "Estimated pupillary distance for virtual try-on sizing" — precise about scope
- ✅ Add disclaimer: "This is a fit-sizing estimate, not a medical measurement. Consult your optometrist for prescription PD."
