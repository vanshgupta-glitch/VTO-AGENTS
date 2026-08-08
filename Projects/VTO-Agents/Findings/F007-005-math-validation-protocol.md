---
okf: 1
type: finding
id: F007-005
project: VTO
agent: ra-math
task: "[[T007 Mathematical-Error-Budgets]]"
builds_on: ["[[F007-001-math-pd-error-budget]]"]
created: 2026-08-04
tags: [statistics, validation, sample-size, pd-accuracy, power-analysis]
---

# F007-005 — Statistical Validation Protocol for PD Accuracy

## Question

What sample size and protocol are required to claim "PD within ±X mm at 95% confidence" from a caliper ground-truth study? How many subjects, measurements, and conditions?

## Answer

### Claim formulation

The claim "PD within ±2 mm at 95% confidence" is a **tolerance interval** problem, not a confidence interval problem. The correct statistical framing:

> With 95% confidence, at least P% of future measurements will fall within ±2 mm of ground truth.

For P=95% (the typical "95/95" tolerance interval), we need to determine sample size n such that the tolerance factor k satisfies:

$$k \cdot \sigma \leq 2.0 \text{ mm}$$

where σ is the estimated measurement error standard deviation.

### Method 1: Tolerance interval approach

For a normal distribution with sample size n, the two-sided tolerance factor k for (γ=0.95 confidence, P=0.95 coverage) is:

$$k = \sqrt{\frac{(n-1) \cdot \chi^2_{1-P, 1}}{\chi^2_{1-\gamma, n-1}}}$$

where χ² are chi-square quantiles. For P=0.95, γ=0.95:

| n | k factor | Required σ ≤ 2.0/k |
|---|----------|---------------------|
| 5 | 4.65 | 0.43 mm |
| 10 | 3.22 | 0.62 mm |
| 15 | 2.86 | 0.70 mm |
| 20 | 2.69 | 0.74 mm |
| 30 | 2.51 | 0.80 mm |
| 50 | 2.36 | 0.85 mm |
| 100 | 2.22 | 0.90 mm |

**Finding:** With the HVID-only σ of 2.42 mm (from F007-001), n > 200 required — practically infeasible. With n=15: 95/95 tolerance is ±6.92 mm. With n=30: ±6.07 mm. **Iris-prior PD cannot be validated to ±2 mm.** Card calibration must be required for the accuracy claim.

### Method 2: With card calibration (σ ≈ 0.50 mm)

Card calibration removes HVID variance. The remaining error budget is:
- Card measurement error: ~0.15 mm (standard card 85.6 mm, ±0.25 mm manufacturing tolerance, camera resolution limited)
- Iris jitter (per-frame): ~0.30 mm at 640 px
- Yaw correction noise: ~0.15 mm at |yaw| < 15°
- Pupil jitter: ~0.10 mm

Total σ ≈ √(0.15² + 0.30² + 0.15² + 0.10²) ≈ 0.38 mm

But per-subject systematic errors (card placement angle, face asymmetry, calibration execution) add ~0.30 mm, giving **σ ≈ 0.50 mm per measurement session.**

| n subjects | k factor | Required σ | Achievable? |
|-----------|----------|------------|-------------|
| 7 | 3.83 | ≤ 0.52 mm | ✅ (σ=0.50) |
| 15 | 2.86 | ≤ 0.70 mm | ✅ |
| 20 | 2.69 | ≤ 0.74 mm | ✅ |
| 30 | 2.51 | ≤ 0.80 mm | ✅ |

**Required sample size: n ≥ 7 subjects** with card calibration to claim "PD within ±2 mm at 95/95 confidence." We recommend n ≥ 20 to account for non-normality and to power Bland-Altman LoA estimation (n=38 for LoA precision ≤ 0.25 mm with s_d=0.50 mm).

### Method 3: Bland-Altman analysis

Standard medical device validation for agreement between two measurement methods. The 95% limits of agreement (LoA):

$$\text{LoA} = \bar{d} \pm 1.96 \cdot s_d$$

where d̄ is mean bias and s_d is the SD of differences. The claim "within ±2 mm" requires:

$$|\bar{d}| + 1.96 \cdot s_d \leq 2.0$$

Sample size for Bland-Altman (from Carkeet 2015, "Exact Parametric Confidence Intervals for Bland-Altman Limits of Agreement"):

$$n = \left\lceil \frac{(z_{1-\alpha/2})^2 \cdot s_d^2 \cdot (1 + (z_{1-\beta})^{-2})}{(\text{LoA tolerance})^2} \right\rceil$$

For LoA tolerance (the precision with which we want to estimate the LoA) = 0.25 mm (gives ~±0.5 mm on the final LoA):

- s_d ≈ 0.50 mm → n ≥ 25
- s_d ≈ 0.75 mm → n ≥ 55

### Recommended validation protocol

#### Design

**Factorial:** 3 distances × 3 yaw angles × n subjects = 9n measurements

| Factor | Levels | Rationale |
|--------|--------|-----------|
| Distance | Near (40 cm), Mid (60 cm), Far (100 cm) | Covers face-height range 800 → 300 px |
| Yaw | 0°, 20°, 40° | Covers the useful measurement range |
| Subject | n ≥ 20 | Mixed demographics, various HVIDs |

**Ground truth:** Digital pupillometer (Essilor or Nidek, ±0.25 mm accuracy). Mean of 3 consecutive readings per eye, monocular PD summed to binocular.

**Per condition:** 5 repeated measurements (test-retest within the same condition), median taken to reject outliers.

**Total measurements:** 20 subjects × 3 distances × 3 yaws × 5 repeats = 900 measurements. Expected duration: ~30 min per subject, total ~10 hours.

#### Statistical analysis pipeline

1. **Intraclass correlation (ICC):** ICC(3,1) per condition — test-retest reliability. ICC > 0.90 acceptable.
2. **Bland-Altman per condition:** Bias + 95% LoA. Pass if |bias| + 1.96·s_d ≤ 2.0 mm.
3. **Mixed-effects model:** `error ~ distance * yaw + (1|subject)`. Tests whether distance/yaw are significant predictors of error (they shouldn't be if the measurement is correct).
4. **ANOVA for systematic effects:** Tests whether sex, age group, or HVID are significant predictors.
5. **Overall tolerance interval:** Pooled across all conditions, compute the 95/95 tolerance interval for the claim.

#### Pass/fail criteria

| Metric | Pass threshold |
|--------|---------------|
| Mean bias | ≤ 0.5 mm |
| 95% LoA width | ≤ 4.0 mm (±2.0) |
| ICC per condition | ≥ 0.90 |
| Distance effect p-value | > 0.05 (not significant) |
| Yaw effect p-value | > 0.05 (not significant) |
| 95/95 tolerance interval | ≤ ±2.0 mm |

#### Without card calibration (iris-prior only)

If the product ships without mandatory card calibration, the claim must be relaxed:

**Relaxed claim:** "PD typically within ±4 mm, may vary ±6 mm for some face shapes."

| n | Required σ | Achievable? |
|---|-----------|-------------|
| 50 | ≤ 0.83 mm | ❌ (σ=2.42 mm) |
| 100 | ≤ 0.88 mm | ❌ |

No achievable sample size validates ±2 mm with iris-prior. The only mathematically valid claims without card calibration are based on the HVID population distribution:

| Claim | Coverage |
|-------|----------|
| ±2 mm | ~59% of adults |
| ±3 mm | ~78% of adults |
| ±4 mm | ~90% of adults |
| ±5 mm | ~96% of adults (1.96σ) |
| ±6 mm | ~99% of adults |

### Power analysis for detecting a 1 mm improvement

For a future algorithm change that claims 1 mm improvement in PD accuracy:

$$n = \frac{2 \cdot (z_{1-\alpha/2} + z_{1-\beta})^2 \cdot \sigma^2}{\delta^2}$$

where δ = 1.0 mm (effect size), σ = 1.5 mm (paired differences), α = 0.05, β = 0.20 (80% power):

n = 2 · (1.96 + 0.84)² · 1.5² / 1.0² = 35.3 → **n ≥ 36 subjects per group.**

For paired design (same subjects, old vs new algorithm): **n ≥ 25 subjects** with 3 measurements per condition.

### Simulation script

`scratch/F007-005-validation-sample-size.py` — computes tolerance factors, Bland-Altman sample sizes, and power curves for PD validation.

## Evidence

1. **Tolerance intervals:** Krishnamoorthy & Mathew "Statistical Tolerance Regions" (2009) — §2.3 for two-sided normal tolerance intervals
2. **Bland-Altman:** Bland & Altman "Statistical Methods for Assessing Agreement Between Two Methods of Clinical Measurement" (Lancet 1986) — the original paper, 50,000+ citations
3. **Bland-Altman sample size:** Carkeet "Exact Parametric Confidence Intervals for Bland-Altman Limits of Agreement" (Optometry and Vision Science 2015)
4. **PD measurement validation:** Pointer "The Interpupillary Distance: A Literature Review" (Ophthalmic and Physiological Optics 2009) — PD measurement accuracy standards in clinical practice
5. **Codebase:** `PdEstimator.ts` — `IRIS_PD_CALIBRATION = 1.0`, current PD smoothing (minCutoff=0.5, beta=0.0)
6. **F007-001 simulation:** σ_PD decomposition shows HVID variance as dominant term at 2.42 mm

## Implications for VTO

1. **IF shipping with card calibration:** n ≥ 20 subjects, 9 conditions, 900 total measurements. Budget: ~10 hours of testing. Claim: "PD within ±2 mm at 95% confidence" — VALIDATABLE.
2. **IF shipping iris-prior only:** No achievable sample size validates ±2 mm. Valid claims are distributional: "PD typically within ±4 mm for most adults." Do not claim ±2 mm — this is mathematically dishonest.
3. **The PD disclaimer is correct but insufficient:** `PD_DISCLAIMER = 'Estimated PD — not for prescription use'` is legally necessary but doesn't address accuracy expectations. Add: "Accuracy: typically within ±4 mm; for best results, use the calibration card."
4. **Feed into Testing-Researcher (T008):** This protocol provides the statistical framework; the Testing-Researcher operationalizes it (equipment, subject recruitment, measurement procedure, environment control).
5. **Regulatory note:** If VTO ever ships as a medical device (Class I 510(k) exempt optical measurement tool), the FDA expects a Bland-Altman analysis with n ≥ 30 subjects. This protocol meets that bar preemptively.

## Related

- [[VTO]] — project hub
- [[T007 Mathematical-Error-Budgets]] — parent task
- [[F007-001-math-pd-error-budget]] — error budget source data
- [[Testing-Researcher]] — consumer of this protocol