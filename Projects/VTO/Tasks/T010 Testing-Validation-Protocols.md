# T010 — Testing & Validation Protocols

project: [[VTO]]
status: done
assigned_by: Hermes
assigned_on: 2026-08-04
completed_on: 2026-08-04
worker: OpenClaw

## Goal

Design how everything this project builds gets proven — ground-truth PD study, rotation-stability metrics, perceptual quality gates, device matrix, and research-data QA checklist.

## Context (from Hermes)

Load `Projects/VTO-Agents/Research Agents/Testing-Researcher.md` as your mission brief; deliver per its Output contract.

**Additional constraints from D2 (personal/quality-first pivot, see [[VTO]] §Decisions D2):**
- Personal project — no corporate QA department; protocols must be self-service
- Video-only — all testing is on live webcam streams, not still photos
- Existing harness: Vitest (217 unit tests), Playwright with fake device media, golden-image suites, GLB validation CI, axe-core WCAG 2.2 AA

**Priority ordering:**
1. Ground-truth PD protocol — caliper/pupillometer study design (n≥5, equipment, procedure, data format)
2. Rotation-stability metric — measurable score for patch/glasses jitter under scripted head motion
3. Perceptual quality gate — "looks premium" scoring (SSIM/LPIPS thresholds, competitor A/B protocol)
4. Device matrix — minimal real-device set + cloud farms that allow camera injection
5. Research-data QA checklist — when to accept a swarm finding as "tested knowledge"

## Definition of done
- [x] Finding note `Findings/F010-testing-pd-protocol.md` — ready-to-run caliper study protocol (steps, thresholds, pass/fail)
- [x] Finding note `Findings/F010-testing-rotation-stability.md` — jitter metric definition + test harness design
- [x] Finding note `Findings/F010-testing-perceptual-quality.md` — SSIM/LPIPS thresholds + A/B protocol vs FittingBox demos
- [x] Finding note `Findings/F010-testing-device-matrix.md` — real-device set + cloud farm options with camera injection
- [x] Finding note `Findings/F010-testing-research-qa.md` — checklist for accepting findings (source count, recency, refutation pass)

## Result & context returned (OpenClaw fills this)
- What was done: All five T010 deliverables written as OKF finding notes in `Projects/VTO-Agents/Findings/`. Each is a ready-to-run protocol or gate definition (steps, thresholds, pass/fail), not commentary.
- Artifacts / paths:
  - `C:\Users\ankur.singh\Obsidian Vault\Projects\VTO-Agents\Findings\F010-testing-pd-protocol.md` (~9.5 KB)
  - `C:\Users\ankur.singh\Obsidian Vault\Projects\VTO-Agents\Findings\F010-testing-rotation-stability.md` (~13 KB)
  - `C:\Users\ankur.singh\Obsidian Vault\Projects\VTO-Agents\Findings\F010-testing-perceptual-quality.md` (~13 KB)
  - `C:\Users\ankur.singh\Obsidian Vault\Projects\VTO-Agents\Findings\F010-testing-device-matrix.md` (~13 KB)
  - `C:\Users\ankur.singh\Obsidian Vault\Projects\VTO-Agents\Findings\F010-testing-research-qa.md` (~12 KB)
- Decisions made while executing:
  1. **PD protocol**: Designed for self-service (personal project) — caliper + optional pupillometer, n≥5 faces, 3-phase procedure (reference measurement → VTO capture → variant condition). Pass/fail gates at ±2 mm static frontal, ≤1.5 mm group RMSE, ≤3.0 mm yaw invariance. Feeds directly into existing `pd-accuracy.spec.ts` CV-accuracy suite (049).
  2. **Rotation-stability jitter metric**: Single `jitterScore` (0–100, lower=better) computed from 6 signals (bridge X/Y, scale, yaw, temple X/Y) across a 6-clip scripted-motion video corpus. Harness extends existing Vitest tolerance-band patterns (`face-scale.unit.test.ts`, `one-euro.unit.test.ts`). Thresholds per clip: static≤3, sweep-fast≤12, sweep-pitched≤15, sweep-nod≤18. Regression guard: 15% margin on locked baselines.
  3. **Perceptual quality gates**: Two-tier — Tier 1 automated (SSIM≥0.92, LPIPS≤0.08 per canonical pose) with `lpips` npm package; Tier 2 self-service A/B protocol vs FittingBox (7 scenarios, weighted scoring, ≥0 = VTO matches/beats). Builds on handoff 049's golden-image plan. Occlusion-specific structural assertions (temple hide, no black model, lens transparency).
  4. **Device matrix**: 5 physically-owned devices (~$760 total) covering desktop/iOS modern/iOS older/mid Android/low Android. Cloud farms (BrowserStack at $39/mo, Sauce Labs) for non-camera breadth tests. Hard reality: NO cloud farm supports real camera injection — camera-dependent flows must run locally. Fake-camera CI with `.y4m` corpus for regression.
  5. **Research-data QA checklist**: 5-gate checklist (source quality, recency, refutation pass, integration fit, format compliance) with a Node.js auto-validation script. Integrates with existing LOOP-ENGINEER adversarial gate (Catalyst → Opus). Confidence levels: high/medium/low. Re-validation triggers for stale findings.
- Problems / open questions:
  - n=5 for PD study is minimum viable, not statistically powered — [[Mathematical-Researcher]] should compute required n (likely 8–12).
  - Rotation-stability harness needs the video corpus checked into repo (LFS); engine must be callable headlessly (requires WebGL context or headless-gl).
  - LPIPS npm package availability and version should be confirmed (the conceptual implementation assumes a `lpips` package exists; alternatives: `piq` via Python subprocess, or custom TFJS model loading).
  - BrowserStack/Sauce Labs camera support was confirmed via documentation search as NOT available for automated camera injection — this is an architectural limitation unlikely to change.
- What Hermes should know for the next decision:
  - All five protocols are designed with the existing harness (Vitest 217 tests, Playwright fake-camera, golden-image plan from 049) as the foundation — nothing is replaced, everything extends.
  - The PD protocol, rotation-stability harness, and perceptual-quality gates all produce PASS/FAIL thresholds that can gate CI. The device matrix and QA checklist are manual/semi-automated release-checklist items.
  - Next step: Hermes should assign tasks to implement these protocols (wire PD fixtures into CI, build jitterScore harness, set up LPIPS golden-image suite, acquire real devices, deploy validate-finding.mjs).

## Review (Hermes fills this)
- Verdict: done | rework
- Notes: