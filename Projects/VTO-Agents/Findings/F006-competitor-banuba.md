---
okf: 1
id: F006-competitor-banuba
type: finding
project: VTO
status: done
created: 2026-08-04
tags: [vto, competitor, banuba, eyewear, shopify, sdk]
---

# F006 — Banuba Competitor Profile

**Project:** [[VTO]] · Source task: [[T006 Competitor-Landscape-Map]]

## One-line takeaway
Banuba is a broad AR SDK platform (not eyewear-specialist) selling TINT Virtual Try-On — strong technology (face tracking, hand tracking, background removal) but eyewear is one of many SKUs, and Shopify reviews are modest (4.0/5, 5 reviews).

## Live Demo Quality Assessment

Summary: visited banuba.com; TINT product page details but no publicly accessible eyewear-specific live demo. Demos gated behind "Request a Demo."

| Dimension | Score (1-5) | Notes |
|---|---|---|
| Placement/Fit | 3 | AR face-tracking SDK; quality depends on implementation. "Realistic virtual products" claimed. |
| Scale | 3 | Face AR SDK offers face tracking — scale should be adequate |
| Materials/Lens Realism | 3 | "Realistic virtual products"; no specific PBR/3D lens claims found |
| Latency | 3 | SDK optimized for real-time; "Quick integration" promised |

## Tech Approach
- **Type:** Face AR SDK — 3D face mesh with texture mapping
- **Platform:** iOS, Android, Unity, Web (Web AR SDK)
- **Face tracking:** Proprietary face tracking SDK (foundation for all products)
- **Hand tracking:** Also available (for jewelry, watches)
- **Frame removal:** Not explicitly advertised for eyewear; beauty AR and face filters are primary
- **Highlights:** Background subtraction (deep learning), body segmentation, eye tracking
- **Digitization:** "New collection digitization in under 48 hours"

## Shopify Support
- **App store:** Yes — "Banuba AI Virtual Try-On"
- **Rating:** 4.0/5 stars (5 reviews)
- **Pricing:** Free plan available
- **Scope:** Virtual try-on for makeup, glasses, lenses & hair color (multi-category)
- **Limitation:** Generalist VTO app, not eyewear-specialized

## Churn Signals
- Only 5 Shopify reviews — very low adoption on Shopify specifically
- **4.0/5 rating** with few reviews suggests mixed but limited feedback
- Being a generalist may mean slower eyewear-specific improvements
- **Positive:** Oceane client: "1,000%+ add-to-cart rate" with realistic virtual try-on
- Enterprise clients (Gucci, Samsung) suggest the SDK technology is sound

## Pricing (context only)
- Free plan available on Shopify
- Face AR SDK: contact sales / free trial
- 48-hour digitization turnaround for new collections

## Key Clients
Gucci, Samsung, Logitech, RingCentral, Schwarzkopf, Oceane

## Sources
- https://www.banuba.com/ — homepage, features, TINT product page (visited 2026-08-04)
- https://apps.shopify.com/search?q=virtual+try+on+glasses+eyewear — Shopify App Store search (2026-08-04)
- Shopify listing: 4.0/5 stars, 5 reviews, "Free plan available"

## Verdict
Strong underlying AR technology but eyewear is not their focus. Their Shopify presence is weak (5 reviews). The SDK quality (Gucci/Samsung clients) suggests good tech, but their Shopify app may be a thin wrapper. The 48-hour digitization is a real operational advantage if true.
