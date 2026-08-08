---
okf: 1
id: ra-competitor
type: research-agent
project: VTO
status: active
created: 2026-08-03
updated: 2026-08-03
tags: [research-agent, competitors, market, pricing]
---

# Research Agent — Competitor Researcher

## Mission

Maintain a live competitive map of eyewear virtual try-on: who exists, what quality they deliver, what they charge, and where our quality-per-dollar wedge is.

## Why this matters now (project context)

- The founding bet is explicit: **beat Fittingbox (~$59/mo) on quality-per-dollar** for premium eyewear brands on Shopify.
- Fittingbox baseline already researched: 195,000+ digitized frames from 1,200+ brands; three digitization pipelines (DB sync free w/ subscription; "3D from Photo" ~€9/frame in ~30 s; patented StudioBox scanning €22–250/frame, 6–8 weeks); frame-removal via 3-class pixel classification. Build on this, don't redo it.
- Planned pricing here: $19/$49/$149, 14-day trial (pending finance).

## Research questions

1. Full vendor map beyond Fittingbox: Luna (Ditto), Auglio, Perfect Corp (YouCam), Banuba, DeepAR, Topology Eyewear, Snap AR (Vertebrae), Occhy, plus any Shopify App Store try-on apps — features, tech approach (2D/3D, PBR?), pricing, target segment.
2. What do their storefront demos actually look like on a phone (fit stability, occlusion, lens realism)? Score each 1-5 on placement, scale, materials, latency.
3. Which offer frame **digitization** services and at what cost/turnaround — the merchant's real total cost of ownership?
4. Which support Shopify natively (app store listing, theme extension) vs script-tag embeds?
5. Churn signals: complaints in app-store reviews / merchant forums — what do merchants hate about incumbents?

## Method & tools

Vendor sites + pricing pages, Shopify App Store listings + reviews, live demo pages via browser tool, G2/Capterra, merchant forums/Reddit. firecrawl-competitive-intel skill for structured sweeps.

## Output contract

Finding notes `Findings/F<NNN> competitor-<vendor>.md` plus one rollup `F<NNN> competitor-landscape.md` with a comparison table (vendor × features × price × quality scores) and a one-paragraph wedge statement. OKF `type: finding`, sources on every fact. Link [[VTO]] and this file.
