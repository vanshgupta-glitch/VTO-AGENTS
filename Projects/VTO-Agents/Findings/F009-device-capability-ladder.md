---
okf: 1
id: F009-5
type: finding
project: VTO
source_agent: ra-device
parent_task: T009
status: complete
created: 2026-08-04
tags: [finding, ladder, devices, depth, strategy, recommendation]
---

# F009-5 — Device Capability Ladder: Recommended Approach per Tier

## The Ladder

This is the **single recommended device-capability ladder** for VTO's PD/scale strategy, ordered from highest-quality to most-degraded:

| Tier | Device Class | Front Depth? | PD Accuracy | Recommended Approach | Implementation |
|------|-------------|-------------|-------------|---------------------|----------------|
| **Tier 0 — Depth Native** | iPhone X+ with TrueDepth (iOS app) | ✅ TrueDepth (30,000 IR dots) | **±0.5–1mm** | Native iOS app: ARKit `ARFaceTrackingConfiguration` → 3D face mesh → direct 3D pupil distance. Store PD in user profile. | Build companion iOS app (Swift + ARKit). Capture once, reuse in web VTO. |
| **Tier 1 — Card Calibration** | Any device with camera (web or native) | ❌ None (RGB only) | **±1–2mm** | User holds standard card (credit card / ID) next to face. Known card dimensions → absolute scale calibration. | Web-based card detection + MediaPipe FaceLandmarker. |
| **Tier 2 — Iris Prior** | Any device with webcam (current baseline) | ❌ None (RGB only) | **±2–3mm** | MediaPipe FaceLandmarker → detect iris diameter → assume 11.7mm → scale face → compute PD. | Already implemented. Current VTO product. |
| **Tier 3 — Manual PD** | Any device, any browser | ❌ None | **±0mm (user-supplied)** | User manually enters PD from their prescription or measurement. | Simple form input. Reliable but high friction (<5% users know their PD). |
| **Tier 4 — Degraded** | Very old phones, poor cameras, extreme lighting | ❌ None | **±5mm+** | Iris prior with degraded landmarks → warn user, suggest manual input or better lighting. | Graceful degradation + UX guidance. |

## Strategic Recommendations

### 1. Tier 0 (Native TrueDepth) is the quality unlock — pursue it

- **Why:** Reduces PD error from ±2-3mm (iris prior) to ±0.5-1mm (TrueDepth) — a 2-6× improvement that brings PD within clinical tolerances.
- **Coverage:** ~40% of mobile e-commerce traffic (TrueDepth iPhones).
- **Cost:** Building + maintaining a companion iOS app (Swift + ARKit). Relatively small for a personal project.
- **UX:** "Scan your face once with the app, your measurements are saved forever." Low friction after initial scan.
- **What to expose in web VTO:** After native scan, store PD + 3D face measurements in account/profile. Web VTO reads profile for absolute scale, falls back to iris prior if no profile data.

### 2. Tier 1 (Card Calibration) is the mid-ground — implement as opt-in

- **Why:** ~60% coverage, halves error vs. iris prior, works cross-platform (web).
- **Friction cost:** Medium — user must find and hold up a card. Not zero-friction.
- **Recommendation:** Offer as an opt-in "for a more accurate fit" button. Not default — let users self-select into the calibration flow.

### 3. Tier 2 (Iris Prior) is the baseline — keep and improve

- **Why:** 100% coverage, zero friction, "good enough" for casual try-on.
- **Quality floor:** ±2-3mm — acceptable for browsing, not ideal for purchase decision.
- **What to improve:** Better face detection models, temporal filtering across frames, pose estimation to correct for off-angle selfies.

### 4. WebXR Depth / Browser Depth — abandon

- **Why:** Safari iOS has zero WebXR support. Chrome Android WebXR Depth only provides environment depth (rear), not face depth. No browser API accesses TrueDepth.
- **Apple is not adding WebXR to Safari** — it's a deliberate privacy/strategy wall. Do not build a product plan around this changing.
- **The web is RGB-only, permanently, for selfie try-on.**

### 5. Android Front Depth — don't target

- **Why:** Pixel 4 was the only mainstream Android phone with front depth (Soli + IR). Google killed the line. Samsung never shipped front ToF. Current (2024-2025) Android flagships have no front depth sensors.
- **The Android depth addressable base is <1% of e-commerce traffic.**
- **For Android, the plan is:** Iris prior (Tier 2) or card calibration (Tier 1). No native app needed.

## Implementation Priority

```
Phase 1 (NOW):        Tier 2 (Iris prior) — already done, baseline
Phase 2 (NEXT):       Tier 1 (Card calibration) — web-based, quick win
Phase 3 (QUALITY):    Tier 0 (Native TrueDepth iOS app) — quality unlock for ~40% users
Phase 4 (MAYBE):      Tier 3 (Manual PD input) — trivial, add any time
```

## Cost/Benefit Summary

| Investment | Cost Estimate | Coverage Boost | Accuracy Gain | Verdict |
|------------|--------------|----------------|---------------|---------|
| Native iOS TrueDepth app | Medium (Swift + ARKit dev, App Store) | +40% of users get Tier 0 accuracy | **2-6× improvement** | **High ROI** for a quality-first product |
| Card calibration (web) | Low (web-based CV) | All users get Tier 1 option | **2× improvement** (opt-in) | **Quick win** — build soon |
| WebXR Depth path | Zero (can't build) | 0% (doesn't work) | N/A | **Dead end** — abandon |
| Android native ToF | High (native Android app for <1% users) | <1% | N/A | **Not worth it** |

## Related

- [[F009-1]] — device inventory
- [[F009-2]] — installed base share
- [[F009-3]] — web API access
- [[F009-4]] — accuracy gain
- [[T009 Device-Capability-Ladder]]
- [[VTO]]