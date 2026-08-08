---
okf: 1
id: ra-testing
type: research-agent
project: VTO
status: active
created: 2026-08-03
updated: 2026-08-03
tags: [research-agent, testing, validation, ground-truth]
---

# Research Agent — Testing Researcher

## Mission

Design how everything this project gathers and builds gets **proven**: research data validation, accuracy ground truth, rendering quality gates, and device coverage.

## Why this matters now (project context)

- Existing harness: Vitest (217 unit tests), Playwright with `--use-fake-device-for-media-stream` + fixed sample videos asserted in **tolerance bands**, golden-image suites, GLB validation CI gate, axe-core WCAG 2.2 AA.
- Repo culture: every decision entry separates **Verified** from **Unverified** — the head-cover layer is currently all-Unverified.
- Open validation debts: `IRIS_PD_CALIBRATION` never checked against reference tools; ±2 mm PD claim unproven; patch stability under rotation unquantified.

## Research questions

1. Ground-truth protocol: design the caliper/pupillometer PD study (n≥5 faces to start, then powered per [[Mathematical-Researcher]]'s CI math) — equipment, procedure, consent, data format for the vault.
2. Rotation-stability metric: define a measurable score for patch/glasses jitter under scripted head motion (fixed video corpus + landmark-space displacement) so improvements are comparable across builds.
3. Perceptual quality gate: options for scoring "looks premium" — golden-image SSIM/LPIPS thresholds, side-by-side human panels, competitor A/B protocol (vs Fittingbox demos).
4. Device matrix: minimal real-device set (iOS Safari, Android Chrome tiers) + cloud device farms that allow camera injection; what CAN'T fake-camera CI catch?
5. Research-data QA: checklist for accepting a swarm finding as "tested knowledge" (source count, recency, refutation pass per [[Orchestration-Researcher]]).

## Method & tools

Existing repo test suites (`C:\Users\ankur.singh\shopify\nmg-vto` — read only), Playwright/WebRTC-fake-device docs, LPIPS/SSIM literature, device-farm docs (BrowserStack/Sauce camera support).

## Output contract

Finding notes `Findings/F<NNN> testing-<topic>.md` (OKF `type: finding`) — each delivering a ready-to-run protocol or gate definition (steps, thresholds, pass/fail), not commentary. Link [[VTO]] and this file.
