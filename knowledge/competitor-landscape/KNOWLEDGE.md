---
okf: 1
id: knowledge-competitor-landscape
type: knowledge-pack
name: competitor-landscape
version: 1.0.0
applies_to: [vto-widget]
status: active
created: 2026-08-08
updated: 2026-08-08
tags: [knowledge, competitors]
---

# competitor-landscape v1.0.0

Settled facts about the competitive field. Live investigation belongs in findings; this pack
holds only what has stopped changing.

## The field

| Vendor | Position | Status |
|---|---|---|
| **FittingBox** | The benchmark. ~$59/mo. The only credible Shopify competitor. | Active — our reference target |
| Ditto / Luna | Was a serious player | Acquired |
| Occhy | Shopify-adjacent | Defunct |
| Banuba · DeepAR · Auglio | SDK vendors, not Shopify apps | Active, different market |
| Perfect Corp | Beauty-first, eyewear secondary | Active |
| Topology | Custom-fit eyewear, not try-on | Adjacent |

**The market is open.** One credible competitor on the platform we target.

## FittingBox — what is established

- **Server-side selfie upload.** Their pipeline sends the customer image to their backend.
  This is the privacy vulnerability our client-side approach exploits, and it is the single
  most durable differentiator we have.
- **Small shell, deferred engine.** Roughly a 79 KB entry with ~12 MB loaded at try-on —
  they proved the deferred-engine pattern works commercially.
- **~16 frame-removal patents.** Relevant to a commercial build; **not gating for this
  project** per decision D2.
- Network and render behaviour captured under `Projects/VTO-Agents/Findings/raw/fittingbox-home/`.

## How to treat this pack

Facts here are the ones that stopped moving. Anything you are actively investigating is a
**finding**, not knowledge, until it settles. Promoting an unsettled fact into this pack is
how a wrong belief becomes load-bearing.

Every claim here should be re-verified if older than 90 days — competitor behaviour changes
without notice, and a stale competitive fact is worse than none because it feels solid.
