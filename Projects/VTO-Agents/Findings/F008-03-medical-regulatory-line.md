---
okf: 1
id: f008-03
type: finding
project: VTO
research_agent: ra-medical
task: T008
created: 2026-08-04
tags: [finding, medical, regulatory, fda, mdr, cdsco, samd, fit-tool]
related: [[VTO]], [[T008 Medical-Foundations]]
---

# F008-03 — Regulatory Line: Virtual Try-On vs Medical Device

## Question

Where is the regulatory line (US FDA, EU MDR, India CDSCO) between a "virtual try-on fit tool" and a medical device / prescription aid? What wording and claims must the VTO product avoid to stay safely on the "fit tool" side?

## Answer

A virtual eyewear try-on tool that estimates PD for **frame sizing only** and adds clear disclaimers sits firmly on the **non-medical-device** side of all three regulators. The boundary is defined by **intended use**: if the software claims to diagnose, treat, or provide clinical-grade measurements, it crosses into medical device territory. Under D2 (personal/non-commercial), regulatory risk is near-zero, but safe language practices should still be followed to establish good habits and avoid future rework if the project ever commercializes.

## Evidence

### 1. US FDA — Software as a Medical Device (SaMD) framework

#### The key test: "intended use"
The FDA regulates software as a medical device when it is "intended for use in the diagnosis of disease or other conditions, or in the cure, mitigation, treatment, or prevention of disease" (FD&C Act §201(h)). A virtual try-on that:
- Estimates PD for **cosmetic/fit purposes only** → **NOT a medical device**
- Provides PD that a user or professional **relies on for prescription lens ordering** → **IS a medical device**

#### FDA "NOT Medical Devices" categories that cover VTO
Source: [fda.gov — Examples of Software Functions That Are NOT Medical Devices](https://www.fda.gov/medical-devices/device-software-functions-including-mobile-medical-applications/examples-software-functions-are-not-medical-devices)

Relevant FDA non-device categories:

1. **General Wellness products** — "Software functions intended for individuals to log, record, track, evaluate, or make decisions or behavioral suggestions related to developing or maintaining general fitness, health or wellness" — NOT regulated
2. **General-purpose aids** — "Software functions that are generic aids or general-purpose products... not intended for use in the diagnosis of disease" — NOT regulated
3. **Reference materials** — Apps that provide information but don't perform clinical assessment — NOT regulated

No specific "virtual try-on" or "fit tool" example exists in FDA guidance, but the general wellness + generic aid categories clearly encompass a cosmetic try-on tool.

#### FDA "Regulated" categories to avoid
Source: [fda.gov — Examples of Device Software Functions the FDA Regulates](https://www.fda.gov/medical-devices/device-software-functions-including-mobile-medical-applications/examples-device-software-functions-fda-regulates)

The FDA regulates software that "use a sensor or lead connected to a mobile platform to measure and display... physiological parameters" for **diagnosis or treatment**. Off-the-shelf webcams doing cosmetic estimation don't fall here, BUT:
- A product claiming "PD measurement for prescription" WOULD trigger regulation
- Any integration with EMR/EHR systems could trigger regulation
- Claims of diagnosing strabismus, anisometropia, or other conditions → trigger

### 2. EU MDR (Regulation 2017/745)

#### Scope
EU MDR defines a medical device as any instrument, software, or material intended for:
- Diagnosis, prevention, monitoring, prediction, prognosis, treatment, or alleviation of disease
- Investigation, replacement, or modification of anatomy or a physiological/pathological process

#### VTO exclusion path
- A virtual try-on whose **sole purpose is cosmetic** (visualizing how glasses look) is NOT in MDR scope
- The MDR **Article 1(2)** excludes products for general wellness and cosmetic purposes
- **Annex XVI** extends MDR to certain non-medical products (contact lenses, fillers, liposuction) — but NOT virtual try-on software
- **MDR Article 2(1)** explicitly requires a **medical purpose**; cosmetic try-on lacks this

#### Key EU precedent: MDCG 2019-11
The Medical Device Coordination Group's guidance on qualification of software clarifies:
- Software that provides lifestyle/wellbeing information → NOT MDR
- Software that processes physiological data to provide clinical decision support → MDR Class IIa/IIb
- A try-on tool that just overlays glasses → clearly non-medical

### 3. India CDSCO — Medical Devices Rules, 2017

#### Classification
India's CDSCO follows risk-based classification (A, B, C, D). A virtual try-on tool:
- **Not listed** in any CDSCO medical device category
- The Drugs and Cosmetics Act definitions require "diagnosis, treatment, mitigation, or prevention" — cosmetic fitting is excluded
- **No ophthalmology-specific optical ruling** exists for cosmetic try-on apps

#### CDSCO distinction
- If the software claims PD is "for prescription ordering" → could be classified as Class A/B medical device
- If it clearly labels PD as "fit estimate only" → not a medical device
- No Pre-Market Approval (PMA) or registration needed for non-device cosmetic software

### 4. Regulatory line summary table

| Claim/Wording | FDA | EU MDR | CDSCO | Verdict |
|--------------|-----|--------|-------|---------|
| "See how glasses look on you" | ✅ Not regulated | ✅ Not regulated | ✅ Not regulated | **SAFE** |
| "Estimated PD for frame sizing" | ✅ General wellness | ✅ No medical purpose | ✅ Not covered | **SAFE** |
| "Anatomically-informed fit estimate" | ✅ Ok with disclaimer | ✅ Ok with disclaimer | ✅ Ok with disclaimer | **SAFE** |
| "Measure your PD for prescription lenses" | ❌ SaMD | ❌ Class I/IIa | ❌ Class A/B | **REGULATED** |
| "Clinically accurate PD measurement" | ❌ SaMD | ❌ Class IIa | ❌ Class B | **REGULATED** |
| "Doctor-quality eye measurements" | ❌ SaMD | ❌ Class IIa | ❌ Class B | **REGULATED** |
| "Diagnose vision problems" | ❌ Class II | ❌ Class IIb | ❌ Class C | **REGULATED** |
| Integrates PD into EHR/EMR | ❌ Likely SaMD | ❌ Likely Class I | ❌ Likely Class A | **REGULATED** |

## Implications for VTO

### What claim language is safe?

**Always use qualification language:**
- "Approximate," "estimated," "for fit purposes only," "not for prescription"
- "Virtual try-on for visual preview"
- "Frame sizing estimate — see your optometrist for measurements"

**Never make these claims:**
- "Medical-grade accuracy"
- "Replace your eye exam"
- "Prescription ready"
- "Clinically validated PD measurement"
- Any comparison to pupillometers or clinical tools (even if factual, it invites regulatory scrutiny)
- "Diagnose," "treat," "monitor," "prevent," "predict" (medical-purpose trigger words)

### Recommended UI disclaimers

**In-try-on notice (always visible):**
> "Estimated fit-sizing only. This is not a medical measurement. Consult your optometrist for prescription PD."

**Settings / about page:**
> "VTO provides an approximate fit preview for eyewear shopping. All measurements are estimates for cosmetic fitting purposes and should not be used for prescription lens ordering. Not a medical device."

### D2 context
Since this is a personal/non-commercial project (D2), regulatory risk is zero. However, maintaining clean language from the start is low-effort insurance against future commercialization. The FittingBox / Ditto patent cluster (webcam-PD: US ~11.4M / Family H) suggests competitors also understand the regulatory tightrope — they use similarly hedged language.
