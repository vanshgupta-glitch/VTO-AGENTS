---
okf: 1
id: F006-competitor-deepar
type: finding
project: VTO
status: done
created: 2026-08-04
tags: [vto, competitor, deepar, eyewear, webgl, sdk]
---

# F006 — DeepAR Competitor Profile

**Project:** [[VTO]] · Source task: [[T006 Competitor-Landscape-Map]]

## One-line takeaway
DeepAR is the most developer-friendly AR SDK for web try-on (clean JavaScript API, npm package), with premium brand adoption (Prada, Ray-Ban, Nike) and "100M monthly AR experiences" — but priced for enterprise and NOT available on Shopify App Store.

## Live Demo Quality Assessment

Summary: visited deepar.ai; "Glasses try-on" listed prominently but no public interactive demo found. SDK docs show npm import pattern (`import * as deepar from 'deepar'`).

| Dimension | Score (1-5) | Notes |
|---|---|---|
| Placement/Fit | 4 | Premium brands (Ray-Ban, Prada) use it — implies high placement quality |
| Scale | 4 | Face mesh-based AR; proper 3D tracking |
| Materials/Lens Realism | 4 | 3D face masks and effects; glasses effects with aviators example |
| Latency | 4 | "Better performance than Snapchat" claimed; WebGL-optimized SDK |

## Tech Approach
- **Type:** True 3D AR face mesh (face filters + try-on)
- **Platform:** JavaScript/WebGL (npm: `deepar`), iOS, Android, HTML5, Unity, macOS
- **Face tracking:** Custom face mesh (3D face masks, effects)
- **Capabilities:** Glasses try-on, shoe try-on, wrist try-on (ultra-precise mapping), beauty & makeup, face filters, background replacement/blur
- **Developer experience:** Clean SDK (`await deepar.initialize({licenseKey, canvas, effect})`), dedicated Developer Portal, Asset Store, Creator Studio
- **Scale:** "100 million monthly AR experiences"
- **AR advertising:** DeepAR Ads SDK for programmatic AR ads at scale

## Shopify Support
- **App store:** NO — not listed on Shopify App Store
- **Integration:** SDK-based; would require custom development to integrate with Shopify
- **Target:** Developers building custom apps/websites, not turnkey Shopify merchants

## Churn Signals
- No Shopify reviews (not in app store) — no merchant churn data available
- Enterprise model: contact sales, no public pricing — likely expensive
- Published research papers suggest strong R&D investment
- Premium brand retention (Prada, Ray-Ban, Ralph Lauren, Nike) is a positive signal

## Pricing (context only)
- Pricing page returned 404 (as of 2026-08-04)
- "Contact Sales" / "Get a Demo" model
- NOT price-competitive for small/medium merchants

## Key Clients
Prada, Ray-Ban, Ralph Lauren, Nike, Shiseido, Absolut Vodka

## Sources
- https://www.deepar.ai/ — homepage, SDK details (visited 2026-08-04)
- https://www.deepar.ai/pricing — 404 (no public pricing)
- deepar npm package reference in homepage code snippet

## Verdict
Gold standard for developer-facing AR try-on SDK on web. Premium quality, premium brands, premium pricing. Not competing on Shopify directly — competing for brands willing to build custom implementations. The JS SDK cleanliness (single import, canvas binding) is what we should aspire to match.
