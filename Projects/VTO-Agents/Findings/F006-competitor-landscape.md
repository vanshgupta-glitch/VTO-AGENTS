---
okf: 1
id: F006-competitor-landscape
type: finding
project: VTO
status: done
created: 2026-08-04
tags: [vto, competitor-landscape, rollup, comparison, wedge]
---

# F006 — Eyewear VTO Competitor Landscape: Rollup

**Project:** [[VTO]] · Source task: [[T006 Competitor-Landscape-Map]]

## Comparison Table

| Vendor | Type | Demo Quality (P/S/M/L) | Tech Approach | Shopify? | Reviews | Churn Signal | Pricing |
|---|---|---|---|---|---|---|---|
| **FittingBox** | Eyewear specialist | 4/4/4/4 | WASM engine, server-side frame removal, proprietary 3D format | ✅ App Store | 4.7★ (12) | Low — leader | ~$59/mo (from F001) |
| **Auglio** | Eyewear + multi-category | 3/3/3/3 | 2D AR overlay, WebGL, auto PD, frame removal | ✅ App Store | 3.5★ (16) | HIGH — low rating despite volume | Contact sales / Free trial |
| **Banuba** | General AR SDK | 3/3/3/3 | Face AR SDK, Web/iOS/Android/Unity | ✅ App Store | 4.0★ (5) | Medium — eyewear is side category | Free plan |
| **DeepAR** | AR SDK (dev-focused) | 4/4/4/4 | True 3D AR face mesh, JS/WebGL SDK, npm | ❌ | N/A | Low (premium brands) | Contact sales |
| **Perfect Corp** | Beauty/fashion AI (public) | 4/4/4/4 | AI-powered, 3D face AR, AgileHand™ | ❌ | N/A | N/A (NYSE: PERF) | Enterprise |
| **Topology** | Premium eyewear measurement | 5/5/5/3 | 3D scanning, precision measurements, "Digital Opticianry" | ❌ | N/A | Low (enterprise) | Contact sales |
| **Snap AR/Vertebrae** | Social AR platform | 4/4/4/4 | 3D face mesh, Snapchat Lens, Camera Kit | ❌ | N/A | Low (SNAP) | Enterprise |
| **TryOnMe Glasses** | Eyewear-specific | Unknown | AI-based, PD measurement | ✅ App Store | 5.0★ (2) | Too new to assess | Free |
| **Virtual Try Glasses** | Eyewear-specific | Unknown | AI-based | ✅ App Store | 4.0★ (1) | Too new | Free plan |
| **Specfit** | Eyewear-specific | Unknown | AI-based live try-on | ✅ App Store | 5.0★ (1) | Too new | Free plan |
| **Luna/Ditto** | — | — | Acquired by FittingBox (2023) | ❌ (dead) | N/A | ABSORBED | N/A |
| **Occhy** | — | — | COULD NOT BE FOUND | ❌ | N/A | LIKELY DEFUNCT | N/A |

**Quality key:** P=Placement/Fit, S=Scale, M=Materials/Lens Realism, L=Latency. 5=best in class, 1=poor.

## Shopify-Native Competitors (Direct)
Only 3 established eyewear VTO apps on Shopify with meaningful review counts:

1. **FittingBox (4.7★, 12 reviews)** — The benchmark. Server-side photo processing, WASM engine, proprietary 3D assets. Privacy concern: uploads selfie to server.
2. **Auglio (3.5★, 16 reviews)** — Feature breadth but quality/reliability gap. The low rating is a flashing signal.
3. **Banuba (4.0★, 5 reviews)** — Generalist. Eyewear is one checkbox, not a specialization.

Small/new entries (TryOnMe, Virtual Try Glasses, Specfit) have 1-2 reviews each — too early to benchmark.

## Non-Shopify Competitors (Indirect)
These compete on quality but not on the Shopify platform:

- **Topology** sets the quality ceiling — millimeter-accurate measurements, photorealistic rendering, optometrist-grade fitting. Enterprise pricing. This is what "best in class" looks like.
- **Perfect Corp** has the biggest R&D budget and widest technology portfolio but serves LVMH/Gucci tier brands, not Shopify SMBs.
- **DeepAR** has the cleanest developer experience (npm SDK, JavaScript API) and premium brand adoption (Prada, Ray-Ban).
- **Snap AR** has the largest user base (250M+ daily) but try-on lives in Snapchat, not on product pages.

## Churn Signal Summary

| Vendor | Risk Level | Evidence |
|---|---|---|
| Auglio | 🔴 HIGH | 3.5★ rating on 16 reviews — merchants are dissatisfied |
| Banuba | 🟡 MEDIUM | Only 5 reviews; eyewear is secondary; Shopify commitment unclear |
| TryOnMe/VirtualTry/Specfit | ⚪ UNKNOWN | 1-2 reviews each — not enough data |
| FittingBox | 🟢 LOW | Market leader; stable rating; acquired Ditto (2023) — investing in category |
| Topology/Perfect/DeepAR/Snap | 🟢 LOW | Enterprise/public companies with deep pockets |

## The Open Lane

The Shopify eyewear VTO market has exactly ONE strong competitor (FittingBox). Auglio is struggling. Everyone else is either too small, too generalist, or not on Shopify.

**The gap:** A Shopify-native eyewear VTO that matches FittingBox's quality but with:
- Fully client-side processing (privacy differentiator — FittingBox uploads selfies to server)
- Open GLB pipeline (vs FittingBox's proprietary fitsource binaries)
- Transparent, accessible pricing ($19-$149/mo vs contact-sales opacity)
- Premium feel (matching Topology's quality aspirations at Shopify pricing)

This market is underserved. The lane is open.

---

## Wedge Statement

**Where we beat them on quality-per-dollar:**

> The Shopify eyewear virtual try-on market has exactly one credible competitor — FittingBox — and they charge $59/mo while uploading customer selfies to their servers. Auglio, the only other Shopify-native option, has a 3.5-star rating and 16 reviews that scream churn. Everyone else is either enterprise-only (Topology, Perfect Corp), not on Shopify (DeepAR, Snap), or too tiny to matter. Our wedge: **bring Topology-grade quality (client-side 3D rendering, real frame removal, accurate PD) to Shopify merchants at $19-149/mo — with the face never leaving the device.** FittingBox can't match the privacy without rebuilding their architecture. Auglio can't match the quality without fixing whatever's driving that 3.5. This is a wide-open, one-competitor market waiting for a premium entrant.

---

## Individual Finding Notes
- [[F006-competitor-auglio]] — Auglio profile
- [[F006-competitor-banuba]] — Banuba profile
- [[F006-competitor-deepar]] — DeepAR profile
- [[F006-competitor-perfectcorp]] — Perfect Corp / YouCam profile
- [[F006-competitor-topology]] — Topology Eyewear profile
- [[F006-competitor-ditto-luna]] — Ditto/Luna (acquired by FittingBox)
- [[F006-competitor-snap-vertebrae]] — Snap AR / Vertebrae
- [[F006-competitor-occhy]] — Occhy (could not be found)
- [[F006-competitor-shopify-apps]] — Shopify App Store VTO landscape
- [[F001-fittingbox-summary]] — Existing FittingBox teardown (baseline)

## Sources
- Vendor websites visited 2026-08-04: auglio.com, banuba.com, deepar.ai, perfectcorp.com, topologyeyewear.com, occhy.com
- Shopify App Store: apps.shopify.com/search?q=virtual+try+on+glasses+eyewear (2026-08-04)
- Wikipedia: DITTO article (acquisition history)
- F001-fittingbox-summary (existing teardown data)
