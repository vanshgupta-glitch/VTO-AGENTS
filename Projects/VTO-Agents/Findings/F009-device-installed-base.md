---
okf: 1
id: F009-2
type: finding
project: VTO
source_agent: ra-device
parent_task: T009
status: complete
created: 2026-08-04
tags: [finding, devices, market-share, truedepth, ecommerce]
---

# F009-2 — Installed Base Share: E-Commerce Traffic from Depth-Capable Devices

## Question

What percentage of e-commerce mobile traffic comes from depth-capable devices? Focus on FRONT-facing sensors (TrueDepth/ToF) — try-on uses the selfie camera.

## Answer

### Estimated Breakdown of Mobile E-Commerce Traffic by Depth Capability

| Segment | % of Global Mobile E-Commerce Traffic | Front Depth Sensor? | Notes |
|---------|--------------------------------------|---------------------|-------|
| **iOS — TrueDepth (iPhone X+)** | **~35-45%** | YES (TrueDepth) | iPhone X (2017) and newer; ~80% of active iPhones |
| **iOS — No TrueDepth (iPhone SE, pre-X)** | **~5-10%** | NO | iPhone SE models, iPhone 8 and older |
| **Android — Front ToF/Structured Light** | **~0.5-1%** | YES (ToF/dot projector) | Pixel 4 only meaningful model; discontinued |
| **Android — No front depth** | **~45-55%** | NO | All other Android phones |
| **Desktop/Tablet** | **~5-10%** | Mixed | iPad Pro has TrueDepth; desktops none |

### Key Numbers

- **Apple ~28-30% of global smartphone installed base** (~1.5B active iPhones)
- **~80% of active iPhones have TrueDepth** (iPhone X, 2017+)
  - iPhone SE (all generations): ~10-12% of iPhone base
  - iPhone 8 and older: ~8-10% of iPhone base
  - iPhone X+ with TrueDepth: ~78-82%
- **iOS dominates mobile e-commerce: 55-65% of mobile e-commerce revenue** in major Western markets (US, UK, AU, CA)
  - StatCounter: Apple mobile vendor share ~28% globally but ~55% in US
  - Shopify analytics (public): iOS ~65% of mobile checkout sessions
  - The iOS share of e-commerce TRAFFIC (not just revenue) is even higher due to higher iOS engagement
- **Android mobile e-commerce share: ~35-45%**, but nearly zero front depth penetration

### Consolidated Estimate

**Front depth-capable devices represent approximately 35-45% of global mobile e-commerce traffic** — almost entirely from iPhones with TrueDepth.

Breakdown:
- **TrueDepth iPhones:** ~38% (best estimate)
- **Front ToF Android:** ~0.5% (negligible, Pixel 4 only)
- **Total depth-capable:** ~38-40%

For a predominantly Western audience (US/UK/AU), the TrueDepth share rises to **~45-55%** because iOS market share is higher in affluent e-commerce markets.

### Trends

- Apple's TrueDepth installed base grows steadily as older non-Face-ID iPhones age out (~2-3 year replacement cycle)
- Android front depth sensors are a **declining category** — Google killed Pixel 4's Soli, Samsung never shipped front ToF
- The gap between iOS and Android depth capability is widening, not narrowing

## Evidence

- StatCounter Global Stats: mobile vendor market share (2024-2025): Apple 28%, Samsung 24%, Xiaomi 12%
- Apple active installed base: ~1.5B devices (Apple earnings, Q4 2024)
- Shopify public analytics benchmarks: iOS ~65% of mobile traffic
- Google Pixel 4 sales: estimated <5M units (vs 1.5B+ total smartphones); discontinued 2020
- Samsung Galaxy S21+ spec: dropped ToF sensor entirely; S22-S25 no front ToF

## Implications for VTO

- **TrueDepth-only strategy covers ~40% of mobile e-commerce traffic.** Significant but not majority.
- **For the other 60%, fallback to RGB + iris prior is mandatory.**
- **Android front depth is not worth targeting** — the addressable base is vanishingly small and shrinking.
- A **native iOS app** could access TrueDepth (ARKit), yielding depth for ~40% of users. A web-only approach gets zero depth.
- The product ladder should be: **Web RGB (100% coverage) → iOS Native TrueDepth (~40% coverage, high quality) → nothing for Android depth**

## Related

- [[F009-1]] — device inventory
- [[F009-3]] — web API access
- [[F009-4]] — accuracy gain
- [[T009 Device-Capability-Ladder]]
- [[VTO]]
