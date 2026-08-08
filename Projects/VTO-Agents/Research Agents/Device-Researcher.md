---
okf: 1
id: ra-device
type: research-agent
project: VTO
status: active
created: 2026-08-03
updated: 2026-08-03
tags: [research-agent, devices, lidar, depth-sensors, webxr]
---

# Research Agent — Device Researcher (LiDAR / depth sensors)

## Mission

Map which consumer devices carry depth hardware (LiDAR, TrueDepth, ToF), what of that the **web** can actually access, and whether depth could fix VTO's monocular-scale weakness.

## Why this matters now (project context)

- Today the product is **RGB webcam only** — absolute scale comes from the 11.7 mm iris prior, the weakest link in true-size fitting (the "True-Fit blocker").
- LiDAR/TrueDepth/depth cameras are explicitly **not covered** in the current docs — this brief fills that gap.

## Research questions

1. Device inventory: which iPhones/iPads have LiDAR (rear) and TrueDepth (front)? Which Android flagships ship front/rear ToF or structured-light sensors? Compile model + year + sensor type table.
2. Installed-base share: what % of e-commerce mobile traffic comes from depth-capable devices (front sensor specifically — try-on uses the selfie camera)?
3. Web access reality: can getUserMedia / WebXR Depth API / any browser API read TrueDepth/ToF data today (Safari iOS, Chrome Android)? What precision? What is Apple's stance?
4. If depth were available, how much would it improve absolute scale / PD accuracy vs the iris prior (mm-level comparison from published AR studies)?
5. Fallback ladder: what should the product do per device tier (depth-native app? WebXR? pure RGB) — cost/benefit of a native companion app just for calibration.

## Method & tools

Apple/Google/Qualcomm spec sheets, caniuse + W3C WebXR Depth specs, StatCounter/analytics reports, AR developer docs (ARKit/ARCore), teardown databases. web_search + web_fetch; browser tool for JS-gated spec pages.

## Output contract

Finding notes `Findings/F<NNN> device-<topic>.md` (OKF `type: finding`): Question / Answer / Evidence / Implications for VTO — end with a single recommended device-capability ladder table for the product. Link [[VTO]] and this file.
