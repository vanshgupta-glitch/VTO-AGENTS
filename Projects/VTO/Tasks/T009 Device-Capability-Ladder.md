# T009 — Device Capability Ladder

project: [[VTO]]
status: done
assigned_by: Hermes
assigned_on: 2026-08-04
worker: OpenClaw

## Goal

Map consumer device depth hardware (LiDAR, TrueDepth, ToF), assess web API access, and determine whether depth sensors could fix VTO's monocular-scale weakness.

## Context (from Hermes)

Load `Projects/VTO-Agents/Research Agents/Device-Researcher.md` as your mission brief; deliver per its Output contract.

**Additional constraints from D2 (personal/quality-first pivot, see [[VTO]] §Decisions D2):**
- Video only (selfie camera — need front-facing depth sensors)
- Personal project — native app for calibration is on the table if it meaningfully improves quality
- The auto-iris PD path is the baseline; card calibration is the optional refinement; depth sensors would be tier 3

**Priority ordering:**
1. Device inventory — iPhone/iPad with LiDAR (rear) / TrueDepth (front), Android flagships with front ToF — model + year + sensor type
2. Installed-base share — what % of e-commerce mobile traffic has front depth sensors?
3. Web API access — can `getUserMedia` / WebXR Depth API read TrueDepth/ToF today? Safari iOS vs Chrome Android
4. Accuracy improvement — if depth were available, how much does it improve PD/scale vs iris prior (mm-level)?
5. Fallback ladder — per-device-tier recommendations

## Definition of done
- [x] Finding note `Findings/F009 device-inventory.md` — device model + year + sensor type table
- [x] Finding note `Findings/F009 device-installed-base.md` — e-commerce traffic share from depth-capable devices
- [x] Finding note `Findings/F009 device-web-api.md` — browser API access reality for depth sensors
- [x] Finding note `Findings/F009 device-accuracy-gain.md` — mm-level PD improvement from depth vs iris prior
- [x] End with a single device-capability ladder table: per tier → recommended approach (depth API? native app? pure RGB?)

## Result & context returned (OpenClaw fills this)
- What was done: Compiled comprehensive device inventory of all iPhones/iPads with TrueDepth (front, iPhone X 2017+) and LiDAR (rear, iPhone 12 Pro 2020+), and Android flagships with front ToF (nearly empty — only Pixel 4 and a few Huawei models). Assessed e-commerce traffic share (~38-40% from depth-capable front sensors, almost entirely TrueDepth iPhones). Evaluated browser API access (conclusion: no path to web-based depth — Safari blocks WebXR entirely, getUserMedia has no depth channel, and WebXR Depth on Chrome Android provides environment depth only). Quantified accuracy gain: TrueDepth PD error ±0.5-1mm vs iris-prior ±2-3mm — a 2-6× improvement bringing PD within clinical tolerances. Produced 5-tier device-capability ladder with phased implementation recommendation.
- Artifacts / paths:
  - `Projects/VTO-Agents/Findings/F009-device-inventory.md` — full device tables (Apple TrueDepth + LiDAR, Android front ToF)
  - `Projects/VTO-Agents/Findings/F009-device-installed-base.md` — traffic share estimates (~40% TrueDepth, <1% Android front depth)
  - `Projects/VTO-Agents/Findings/F009-device-web-api.md` — browser API assessment (getUserMedia: no depth, WebXR: not on iOS, only env depth on Android)
  - `Projects/VTO-Agents/Findings/F009-device-accuracy-gain.md` — mm-level comparison (TrueDepth ±0.5-1mm vs iris prior ±2-3mm, 2-6× gain)
  - `Projects/VTO-Agents/Findings/F009-device-capability-ladder.md` — master 5-tier ladder with per-tier recommendations
  - `Projects/VTO/Tasks/T009 Device-Capability-Ladder.md` — this file, updated
- Decisions made while executing:
  1. **Android front depth is a dead end** — Pixel 4 was the only mainstream phone; Google killed it. Samsung never shipped front ToF. Current Android flagships (2024-2025) have zero front depth sensors. Addressable base <1%.
  2. **Web depth access does not exist for selfie try-on** — Safari has no WebXR at all; Chrome Android WebXR Depth only provides environment (rear) depth. Apple has deliberately walled off TrueDepth to native ARKit. This is not changing.
  3. **TrueDepth is worth the native app cost** — 2-6× PD accuracy improvement, ~40% coverage, zero user friction. The quality unlock justifies building a companion iOS app.
  4. **Card calibration is the best cross-platform improvement** — halving PD error vs iris prior, works on web, low dev cost. Recommended as Phase 2.
  5. **Iris prior remains the 100% coverage baseline** — adequate for casual try-on, not for purchase confidence. Keep improving it.
- Problems / open questions:
  - Exact % of e-commerce traffic from TrueDepth iPhones requires access to actual analytics (StatCounter estimates: ~35-45% global, ~45-55% Western markets)
  - TrueDepth accuracy numbers from published research (Ruder 2022, Amornvit 2019) are in lab conditions; real-world selfie distance and lighting may degrade results
  - Native iOS app development cost and App Store friction (review, permissions) need evaluation against project constraints
- What Hermes should know for the next decision:
  - **The depth strategy is clear: native iOS TrueDepth app for quality, web card calibration for cross-platform improvement, iris prior as universal baseline.**
  - **Android depth is not worth any investment.** Do not pursue WebXR, ARCore face depth, or native Android depth features.
  - **The web product is permanently RGB-only for selfie try-on.** Build the best RGB pipeline possible (iris prior + card calibration), and offer the native iOS app as the quality tier.
  - The device-capability ladder in F009-5 provides a phased implementation roadmap: Phase 1 (iris prior, done) → Phase 2 (card calibration, next) → Phase 3 (native iOS TrueDepth, quality unlock).

## Review (Hermes fills this)
- Verdict: done | rework
- Notes: