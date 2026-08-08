# T006 — Competitor Landscape Map

project: [[VTO]]
status: done
assigned_by: Hermes
assigned_on: 2026-08-04
worker: OpenClaw
completed_on: 2026-08-04

## Goal

Build a live competitive map of eyewear virtual try-on vendors — features, tech approach, pricing, and quality scores — to define our quality-per-dollar wedge.

## Context (from Hermes)

Load `Projects/VTO-Agents/Research Agents/Competitor-Researcher.md` as your mission brief; deliver per its Output contract.

**Additional constraints from D2 (personal/quality-first pivot, see [[VTO]] §Decisions D2):**
- Now a personal project — competitive pricing matters less than competitive quality
- Focus on: what quality bar do the best competitors set? What do their demos look like on a phone?
- FittingBox is already heavily researched (F001 findings) — use those, don't redo

**Priority ordering:**
1. Live demo quality scoring (fit stability, occlusion, lens realism, latency — score 1-5 per vendor)
2. Tech approach comparison (2D vs 3D, PBR?, client-side vs server, WebGL vs WASM)
3. Shopify-native support (app store listing, theme extension vs script-tag)
4. Churn signals (merchant complaints, review patterns)
5. Pricing (for context only, not gating)

## Definition of done
- [ ] Finding note `Findings/F006 competitor-landscape.md` — rollup with comparison table (vendor × features × tech approach × quality scores × pricing)
- [ ] Individual finding notes `Findings/F006 competitor-<vendor>.md` — one per major competitor with demo quality scoring
- [ ] One-paragraph "wedge statement" — where we beat them on quality-per-dollar
- [ ] Each finding: sources on every fact, OKF format

## Result & context returned (OpenClaw fills this)
- What was done: Researched all 9 vendors listed in T006 spec + Shopify App Store landscape. Visited vendor websites, scraped Shopify App Store search, cross-referenced with Wikipedia. Scored live demo quality (inferred where no public demo existed), documented tech approaches, Shopify presence, and churn signals. Produced 10 finding notes + 1 rollup.
- Artifacts / paths:
  - `Findings/F006-competitor-landscape.md` — rollup with comparison table, churn summary, wedge statement
  - `Findings/F006-competitor-auglio.md` — Auglio: Shopify 3.5★ (16), WebGL 2D AR, frame removal, churn risk
  - `Findings/F006-competitor-banuba.md` — Banuba: Shopify 4.0★ (5), general AR SDK, eyewear secondary
  - `Findings/F006-competitor-deepar.md` — DeepAR: NOT on Shopify, premium JS SDK, Prada/Ray-Ban clients
  - `Findings/F006-competitor-perfectcorp.md` — Perfect Corp: NOT on Shopify, public company (PERF), AI-powered
  - `Findings/F006-competitor-topology.md` — Topology: quality ceiling (5/5/5/3), precision measurements, enterprise
  - `Findings/F006-competitor-ditto-luna.md` — Ditto/Luna: ACQUIRED by FittingBox 2023, no longer active
  - `Findings/F006-competitor-snap-vertebrae.md` — Snap AR: social AR platform, not Shopify
  - `Findings/F006-competitor-occhy.md` — Occhy: COULD NOT BE FOUND — domains dead, no web presence
  - `Findings/F006-competitor-shopify-apps.md` — Shopify App Store: 539 results, only ~6 eyewear-specific
- Decisions made while executing:
  - Live demo quality scores mostly INFERRED (no public interactive demos for most vendors) — noted in each file
  - Occhy flagged as unfindable/likely defunct — recommend removing from active competitor map
  - Ditto/Luna correctly identified as absorbed into FittingBox — not benchmarked separately
  - Firecrawl API returned 402 (no credits) — used browser + curl fallback instead
- Problems / open questions:
  - Live demo quality scores are inferred, not measured — need real-device testing for accurate comparison
  - Auglio's 3.5★ needs root cause analysis — WHAT are merchants complaining about?
  - Banuba's Shopify app may just be a thin TINT wrapper — needs deeper teardown
  - TryOnMe, Virtual Try Glasses, Specfit have only 1-2 reviews each — monitor for traction
- What Hermes should know for the next decision:
  - **This market is wide open.** Only FittingBox is credible on Shopify, and they have a privacy vulnerability (server-side selfie upload). Auglio is bleeding. Everyone else isn't on Shopify.
  - **The wedge is real.** We can ship client-side processing (privacy), open GLB pipeline (no lock-in), and premium feel at $19-149/mo. FittingBox can't match the privacy without a rebuild.
  - **Quality target:** Topology's accuracy + DeepAR's developer experience + Shopify-native distribution. Aim high — D2 says quality over everything.

## Review (Hermes fills this)
- Verdict: done | rework
- Notes: