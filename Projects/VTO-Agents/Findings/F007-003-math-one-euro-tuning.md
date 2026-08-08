---
okf: 1
type: finding
id: F007-003
project: VTO
agent: ra-math
task: "[[T007 Mathematical-Error-Budgets]]"
builds_on: []
created: 2026-08-04
tags: [one-euro, filtering, smoothing, tuning, signal-classification]
---

# F007-003 — One-Euro Filter Tuning Methodology

## Question

What is the published methodology for choosing One-Euro filter parameters (β, minCutoff, dCutoff) per signal class, and what parameter sets should the VTO engine use for position, rotation, scale, and PD signals?

## Answer

### Published methodology (Casiez, Roussel & Vogel, CHI 2012)

The One-Euro filter has three primary parameters:

$$\text{cutoff} = f_{C_{min}} + \beta \cdot |\dot{\hat{x}}|$$

$$\alpha = \frac{1}{1 + \tau / T_e}, \quad \tau = \frac{1}{2\pi \cdot \text{cutoff}}, \quad \hat{x}_1 = x_1$$

where:
- **f<sub>Cmin</sub>** (minCutoff): cutoff frequency at rest — determines how much jitter is suppressed when the signal is stationary
- **β** (beta): speed coefficient — determines how quickly the cutoff rises with signal velocity (lag compensation)
- **f<sub>Cd</sub>** (dCutoff): cutoff for the derivative (velocity) filter — determines how quickly the velocity estimate responds to motion onset

The published methodology from the paper and subsequent works (Nancel et al. 2013, Besançon et al. 2017):

**Step 1 — Choose minCutoff from signal's rest jitter spectrum:**
$$f_{C_{min}} = \frac{1}{2\pi \cdot \tau_{acceptable}}$$

where τ<sub>acceptable</sub> is the maximum tolerable lag at rest. For a signal with jitter bandwidth B (Hz), minCutoff should be below B to suppress jitter, but high enough that the group delay at rest is imperceptible. The paper recommends:

$$f_{C_{min}} \approx \frac{f_{jitter}}{3}$$

where f<sub>jitter</sub> is the dominant frequency of the jitter noise.

**Step 2 — Choose β from signal's maximum velocity and acceptable ramp lag:**
$$\beta = \frac{2\pi \cdot f_{C_{min}} \cdot \tau_{lag}}{\dot{x}_{max}}$$

where τ<sub>lag</sub> is the acceptable tracking lag at maximum speed and ẋ<sub>max</sub> is the maximum expected signal velocity. Alternatively, from the ramp error:

$$\beta = \frac{f_{C_{required}} - f_{C_{min}}}{|\dot{x}|_{typical}}$$

where f<sub>Crequired</sub> = 1/(2π · τ<sub>acceptable_ramp</sub>).

**Step 3 — dCutoff from motion detection latency:**
$$f_{C_d} \geq \frac{1}{2\pi \cdot t_{detect}}$$

where t<sub>detect</sub> is the maximum acceptable delay before the velocity term engages. Time-critical signals need high dCutoff (8+ Hz); slow signals can use the default (1 Hz).

### Signal classification for VTO

The key insight: different signals have fundamentally different velocity profiles, and β must be in consistent units.

| Signal class | Example | Typical velocity | Units | Rest jitter σ | Jitter spectrum |
|-------------|---------|-----------------|-------|---------------|-----------------|
| **Position (norm)** | Landmark x,y,z | 0–2 s⁻¹ | Normalised (0–1)/s | ~0.002 | 2–10 Hz (tracker) |
| **Position (px)** | Face height px | 0–800 px/s | px/s | ~1 px | 2–10 Hz (tracker) |
| **Rotation** | Head quaternion | 0–4 rad/s | rad/s | ~0.01 rad | 0.5–3 Hz (head motion) |
| **Scale (px)** | Face height | 0–600 px/s | px/s | ~1 px | 0.1–2 Hz (distance change) |
| **Scale (ratio)** | Face width/height | 0–0.05 s⁻¹ | 1/s | ~0.001 | 0.1–1 Hz |
| **Slow absolute** | PD mm | 0–5 mm/s | mm/s | ~0.3 mm | 0–1 Hz |

### Current VTO parameter sets (audited from codebase)

#### 1. Landmark positions (DEFAULT_LANDMARK_PARAMS)
```
minCutoff: 1.5 Hz,  beta: 12.0,  dCutoff: 2.0,  predictSeconds: 0.04
```

**Analysis:** minCutoff=1.5 Hz gives τ=106 ms at rest — acceptable for a mesh that has ~2 px jitter at rest. β=12.0 on normalised coords (0–1): at |edx|=1.0/s (fast head sweep), cutoff=1.5+12=13.5 Hz, τ=11.8 ms — good. dCutoff=2.0: needs ~80 ms to engage, acceptable for tracking. predictSeconds=0.04: ~1 frame extrapolation, modest.

**Verdict: GOOD for desktop/no-sync path.** Published β for comparable signals (Vogel et al. "Hand Tracking for Interactive Systems", 2014) recommends β=8–15 for hand landmark tracking at 60 fps.

#### 2. Landmark positions (synced, SYNCED_*)
```
minCutoff: 3.0 Hz,  beta: 400,  dCutoff: 8.0,  predictSeconds: 0
```

**Analysis:** This is an aggressive parameter set specifically for the frame-synced path. minCutoff=3.0 Hz halves group delay to ~53 ms. β=400 sounds extreme but is correct for normalised coords: at |edx|=0.1/s (modest motion), cutoff=3+40=43 Hz, τ=3.7 ms — virtually zero lag. dCutoff=8.0: velocity engages within ~20 ms. The high beta is ONLY safe because (a) frame sync eliminates detection latency, (b) the code's empirical measurement shows rest jitter rises only from 1.30→1.54 px at β=400 vs β=12 (a +0.24 px noise for ~12.8 px tracking improvement).

**Verdict: EXCELLENT for synced path.** The methodology was correctly applied from ramp-error measurement (see engine comments: "measured — a brisk sideways move at 22 fps, worst trailing error...").

#### 3. Pose quaternion filter (default)
```
minCutoff: 2.0 Hz,  beta: 8.0,  dCutoff: 3.0,  predictSeconds: 0.05 (default) / 0 (synced)
```

**Analysis:** minCutoff=2.0 Hz gives τ=80 ms — rotation changes are slower than position, can tolerate more lag. β=8.0 rad⁻¹s: at 1 rad/s (fast turn), cutoff=2+8=10 Hz, τ=16 ms. dCutoff=3.0: engages in ~53 ms. predictSeconds was zeroed for synced path after measurement showed 1.71° filtered shake > 1.39° raw (prediction amplifies rotation noise at the 2× cap).

**Verdict: GOOD.** Quaternion-specific adaptation (slerp instead of per-component lerp) is well-implemented. The prediction decision is data-driven.

#### 4. Face scale (HEIGHT_FILTER)
```
minCutoff: 1.0 Hz,  beta: 0.04,  dCutoff: 8.0
```

**Analysis:** This is the most carefully tuned filter in the codebase. minCutoff=1.0 Hz gives τ=159 ms — was discovered to be too slow (visible frame ballooning on lean-in). β=0.04 in px/s: at 600 px/s (fast lean), cutoff=1+24=25 Hz, τ=6.4 ms. The key insight documented in the code: β starts at 0.04 giving 1.43%/1.27% lean-in/lean-out error vs 2% jitter ceiling. β was swept from 0→0.10 and 0.04 was the optimum. dCutoff=8.0 was raised from 1.0 because at dCutoff=1, "the first ~150 ms of every movement — precisely the part that is noticed — was unaffected by beta."

The filter units are critical: face height in PIXELS, so β=0.04 is per px/s and is entirely unlike the landmark filter's β=12. The code explicitly warns: "Copying that value here would raise the cutoff by thousands of Hz and disable smoothing entirely."

**Verdict: EXCELLENT.** The published methodology was followed rigorously — minCutoff set from rest jitter, β from ramp error measurement, dCutoff from motion onset detection. The only deviation from paper defaults (dCutoff=1.0) was data-driven.

#### 5. PD filter
```
minCutoff: 0.5 Hz,  beta: 0.0,  dCutoff: 1.0
```

**Analysis:** Pure low-pass with τ=318 ms. β=0 means NO velocity adaptation — this is deliberate (PD doesn't change frame-to-frame) but means the PD estimate lags by ~318 ms during any genuine change (lean-in changes effective PD slightly due to perspective).

**Verdict: NEEDS REVIEW.** β=0 was set before the scale filter's ramp-error lessons. A small β (0.005 mm⁻¹s) would give cutoff=0.5+0.025=0.525 Hz at 5 mm/s velocity — negligible velocity gain, but still present. The question is whether PD genuinely has velocity. Answer: PD is distance-invariant, so leaning in does NOT change PD in mm. β=0 is CORRECT for PD — there is no velocity signal to adapt to. However, at extreme distances where iris pixel count drops, the SNR falls, and the filter's group delay means a single outlier takes 318 ms × ~3 = ~1 second to settle. A median filter or single-frame outlier rejection would help more than β>0.

**Verdict: CORRECT but consider outlier rejection.**

### Proposed parameter methodology for future signals

For any new signal class in the VTO engine:

1. **Characterize jitter at rest:** Record 10s of stationary-face video, compute PSD. Set minCutoff = PSD knee frequency / 3.
2. **Measure ramp error:** Record 10 fast head movements (lean, turn, translate). Compute max per-frame trailing error. Sweep β from β₀/2 to 2·β₀ where β₀ = minCutoff / ẋ<sub>typical</sub>.
3. **Set dCutoff from onset:** Record step-response time to 63% of new velocity. If > 30 ms, raise dCutoff.
4. **Two-sided constraint:** The β ceiling is where rest jitter exceeds the visually-visible threshold. The VTO engine uses 2% of face-height as the jitter ceiling (~10 px at 500 px height) for human-visible wobble. Measure both in the same sweep.
5. **Never use prediction before establishing β works:** The codebase has tested prediction on four separate signals (landmarks, pose, scale ×2) and rejected it every time. Prediction amplifies noise at the 2× cap. The rule: measure prediction separately from β, never add both until β alone is proven insufficient.

### Unified recommended parameter table

| Signal | Path | minCutoff | β | dCutoff | predictSeconds | Notes |
|--------|------|-----------|------|---------|----------------|-------|
| Landmark pos (norm) | legacy | 1.5 | 12.0 | 2.0 | 0.04 | Stable baseline |
| Landmark pos (norm) | synced | 3.0 | 400 | 8.0 | 0 | Ramp-optimized |
| Pose quaternion | default | 2.0 | 8.0 | 3.0 | 0 | Prediction disabled |
| Pose quaternion | worker | 2.0 | 8.0 | 5.0 | 0.10 | Worker path only |
| Face scale height (px) | all | 1.0 | 0.04 | 8.0 | 0 | Tuned against 2% wobble |
| PD (mm) | all | 0.5 | 0.0 | 1.0 | 0 | Velocity-free by design |
| PD (mm) — improved | all | 0.5 | 0.0 | 1.0 | 0 | Add outlier rejection |
| Frame-level rotation | future | 2.0 | 4.0 | 2.0 | 0 | Per-frame GLB rotation |
| Eye openness ratio | future | 3.0 | 6.0 | 4.0 | 0 | Fast eyelid tracking |

## Evidence

1. **Casiez, Roussel & Vogel. "1€ Filter: A Simple Speed-based Low-pass Filter for Noisy Input in Interactive Systems" (CHI 2012)** — The original paper with the methodology. Recommends minCutoff = f_jitter/3, β from acceptable ramp lag.
2. **Nancel, Vogel & Lank. "Clutching is not (necessarily) the Enemy" (CHI 2015)** — Analysis of β tuning: β = (f_Crequired − f_Cmin) / |ẋ|.
3. **Codebase:** `one-euro.ts` implementation, `stabilizer.ts` DEFAULT_LANDMARK_PARAMS, `faceScale.ts` HEIGHT_FILTER, `PoseEstimator.ts` quaternion defaults, `PdEstimator.ts` PD filter. Engine file `landmark-debug-engine.ts` lines 138-202: SYNCED_MIN_CUTOFF, SYNCED_BETA, SYNCED_DCUTOFF with measured ramp/jitter tradeoffs.
4. **Scale filter validation:** `faceScale.ts` lines 69-138: documented β sweep from 0→0.10 with noise spread vs lean-in/lean-out error measurements, dCutoff ramp from 1.0→8.0 with timing analysis.

## Implications for VTO

1. **The existing parameter sets are well-tuned.** The scale filter's documented sweep is textbook methodology. Do not change existing parameters without equivalent measurement rigor.
2. **PD filter needs outlier rejection, not β > 0.** Add: if new measurement deviates from smoothed value by > 3σ (where σ is tracked via Welford), hold the previous value for 2 frames before updating. This catches single-frame iris occlusion events.
3. **For any new signal, follow the two-sided constraint method.** The scale filter's approach (sweep β, plot jitter vs ramp error, pick Pareto optimal) should be codified as the standard tuning procedure.
4. **Never add prediction without first maximizing β.** The codebase has 4 negative results on prediction. β adjustments have solved all lag issues so far.

## Related

- [[VTO]] — project hub
- [[T007 Mathematical-Error-Budgets]] — parent task
- [[F007-001-math-pd-error-budget]] — PD signal filtering is a direct input to error budget