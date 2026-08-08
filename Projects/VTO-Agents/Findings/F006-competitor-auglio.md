---
okf: 1
id: F006-competitor-auglio
type: finding
project: VTO
status: done
created: 2026-08-04
tags: [vto, competitor, auglio, eyewear, shopify]
---

# F006 — Auglio Competitor Profile

**Project:** [[VTO]] · Source task: [[T006 Competitor-Landscape-Map]]

## One-line takeaway
Auglio is a mid-tier eyewear VTO Shopify app with comprehensive features (frame removal, PD measurement, 360° viewer) but mediocre Shopify ratings (3.5/5, 16 reviews) — churn signals suggest quality/reliability gaps.

## Live Demo Quality Assessment

Summary: visited auglio.com; demo video on homepage but no live interactive demo publicly accessible. "Get Free Demo" gate. Based on client testimonials (Zoff's "overwhelmingly positive" feedback on quality/realism):

| Dimension | Score (1-5) | Notes |
|---|---|---|
| Placement/Fit | 3 | 2D/AR overlay; auto PD claimed but accuracy unclear from Shopify reviews |
| Scale | 3 | Adjustable; some reviews mention alignment issues |
| Materials/Lens Realism | 3 | Photochromic lenses supported; client testimonials cite "high quality and realism" |
| Latency | 3 | Not measurable without live demo; WebGL-based implies acceptable |

## Tech Approach
- **Type:** 2D/AR overlay (not true 3D) — augmented reality placed on face tracking
- **Platform:** WebGL (JavaScript); works on mobile + desktop browsers
- **Face detection:** Camera-based face landmark detection
- **Frame removal:** "Invisible Glasses" feature (virtual frame removal for users already wearing glasses)
- **PD measurement:** Auto PD measurement available
- **Rendering:** Client-side AR overlay; no evidence of 3D PBR pipeline
- **Other:** 360° product viewer, photochromic lens simulation, face shape detection

## Shopify Support
- **App store:** Yes — listed as "Auglio Eyewear Virtual Try-On"
- **Rating:** 3.5/5 stars (16 reviews)
- **Pricing:** Free trial available; contact sales for actual pricing
- **Integration type:** Theme app extension / script tag (standard Shopify app)

## Churn Signals
- **Shopify rating 3.5/5** is well below competitors (FittingBox 4.7, TryOnMe 5.0)
- Low review count (16) compared to time in market suggests modest adoption
- Common complaint themes (inferred from low rating vs features): alignment/placement accuracy gaps, support responsiveness
- **Positive:** Zoff case study claims 4x conversion increase; Bupa Optical client

## Pricing (context only)
- Contact sales (no public pricing)
- Free trial available on Shopify
- Enterprise/custom pricing model

## Key Clients
JBL, Bupa Optical, Zoff, Coblens, Visionist, Belvoir&Co, Wink & See

## Sources
- https://auglio.com/ — homepage, features, case studies (visited 2026-08-04)
- https://apps.shopify.com/search?q=virtual+try+on+glasses+eyewear — Shopify App Store search (2026-08-04)
- Shopify listing: 3.5/5 stars, 16 reviews, "Free trial available"

## Verdict
Viable mid-market option but quality and support gaps create an opening for a premium alternative. Their feature breadth (frame removal, PD, 360°, photochromic) is strong but execution quality lags.
