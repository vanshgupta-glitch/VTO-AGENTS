---
okf: 1
id: F010-testing-device-matrix
type: finding
project: VTO
status: done
created: 2026-08-04
tags: [vto, testing, device-matrix, cloud-farm, camera-injection]
---

# F010 — Minimal Real-Device Matrix & Cloud Farm Options

**Project:** [[VTO]] · Source note: [[Testing-Researcher]] · Task: [[T010 Testing-Validation-Protocols]]

## One-line takeaway

A self-service device validation strategy with 5 physically-owned devices covering the critical browser/OS permutations, plus cloud farm options (BrowserStack Automate, Sauce Labs) for breadth — but with a hard reality: NO cloud farm supports real webcam injection for `getUserMedia`, so camera-dependent flows must run locally.

---

## The camera injection problem

The VTO is **video-only** — every feature runs on a live webcam stream via `getUserMedia`. This is the fundamental testing constraint:

| Platform | Camera support | Viable for VTO testing? |
|----------|---------------|------------------------|
| **Local machine** | Real webcam / OBS virtual camera / `--use-fake-device-for-media-stream` | ✅ Full testing |
| **BrowserStack Automate** | No `getUserMedia` support. `--use-fake-device-for-media-stream` requires Chrome flag passthrough — not reliably supported on remote devices. Camera permission prompts cannot be automated. | ❌ Camera flows blocked |
| **BrowserStack Live** | Real device with camera hardware — but interactive only (manual testing). No automation API. | ⚠️ Manual QA only |
| **Sauce Labs** | Same as BrowserStack — cloud VMs/emulators don't expose camera. `getUserMedia` returns `NotAllowedError` or hangs. | ❌ Camera flows blocked |
| **Sauce Real Device Cloud** (mobile) | Real phones/tablets have cameras. But: automation can't grant camera permission programmatically on iOS; Android's `--use-fake-device-for-media-stream` only works on rooted devices. | ⚠️ Manual or highly limited |
| **LambdaTest** | Same camera limitation as BrowserStack/Sauce. No `getUserMedia` passthrough. | ❌ |
| **GitHub Actions / CI** | Playwright with `--use-fake-device-for-media-stream --use-fake-ui-for-media-stream` + a sample `.y4m` video file as fake device input. This IS the existing harness. | ✅ CI regression guard |

**Bottom line:** Cloud farm automation is great for non-camera tests (bundle load, UI flow, a11y, responsive layout, browser compatibility) but **cannot validate the core VTO camera→tracking→render pipeline on real hardware**. That pipeline must be tested locally with actual cameras.

---

## Tier 1: Minimal real-device set (own these)

Five physically owned devices, all available for self-service testing:

| # | Device | Browser | OS | Why this one | Est. Cost (used) |
|---|--------|---------|----|-------------|------------------|
| 1 | **Desktop PC/laptop** (your dev machine) | Chrome latest, Edge, Firefox | Windows 10/11 | Primary dev target; C920s webcam at fixed rig. Already owned. | $0 (owned) |
| 2 | **iPhone 13 or newer** | Safari latest | iOS 17+ | The critical mobile target. Safari WebKit has unique WebGL/MediaPipe behavior. Must test camera permission flow, WebGL2 support, GPU tier. | ~$350 (used) |
| 3 | **iPhone SE 2020 or iPhone 11** | Safari (one major version behind) | iOS 16 | Older iOS Safari — catches WebGL regression on aging devices. Also tests lower-res front camera. | ~$150 (used) |
| 4 | **Samsung Galaxy A-series** (A34/A54) or Pixel 6a | Chrome latest | Android 14 | Mid-range Android — MediaPipe CPU/GPU delegate fallback, WebGL performance. Front camera quality varies. | ~$180 (used) |
| 5 | **Cheap Android** (Moto G / Nokia G-series, ~$120 new) | Chrome latest | Android 13 | Low-end Android — CPU-delegate mandatory. Tests whether tiering system correctly drops to low quality. Worst-case FPS benchmark. | ~$80 (used) |

**Total: ~$760.** This covers: desktop + modern iOS + older iOS + mid Android + low Android. Every browser engine family (Blink, WebKit, Gecko), both GPU and CPU MediaPipe delegates, and both front-camera quality tiers.

### What to test per device

| Test | Desktop | iPhone 13+ | iPhone SE/11 | Galaxy A | Low Android |
|------|---------|-----------|-------------|----------|-------------|
| Widget loads, VTO button appears | ✅ | ✅ | ✅ | ✅ | ✅ |
| Camera permission flow (accept/deny/block) | ✅ | ✅ | ✅ | ✅ | ✅ |
| Frame removal on glasses-wearing face | ✅ | ✅ | ✅ | ✅ | ⚠️ low fps |
| GLB renders with correct occlusion | ✅ | ✅ | ✅ | ✅ | ✅ |
| Temple articulation visible (yaw ±30°) | ✅ | ✅ | ✅ | ✅ | ✅ |
| FPS ≥ 30 sustained | ✅ | ✅ | ⚠️ ≥24 | ⚠️ ≥24 | ⚠️ ≥20 |
| Model switch works (change frame) | ✅ | ✅ | ✅ | ✅ | ✅ |
| Camera teardown on close (no leak) | ✅ | ✅ | ✅ | ✅ | ✅ |
| Portrait/landscape rotation | N/A | ✅ | ✅ | ✅ | ✅ |
| Selfie mirror correct (not flipped) | N/A | ✅ | ✅ | ✅ | ✅ |
| Memory ≤ 300 MB after 2 min session | ✅ | ✅ | ✅ | ✅ | ✅ |
| a11y: voiceover/talkback labels | ✅ | ✅ | ✅ | ✅ | ✅ |
| In-app webview fallback (Instagram/FB) | N/A | ✅ | ✅ | ✅ | N/A |

### Device matrix recording

Store results in `test/device-matrix/device-matrix.md` per release:

```markdown
# Device Matrix — Release v0.3.0 (2026-08-15)

| Device | Browser | Camera | FPS (avg) | Frame Removal | Occlusion | Memory (peak) | Pass? | Notes |
|--------|---------|--------|-----------|---------------|-----------|---------------|-------|-------|
| Desktop Win10, Chrome 128 | C920s, 1080p | 48 | ✅ | ✅ | 210 MB | ✅ | |
| iPhone 13, Safari 17.6 | Front camera | 32 | ✅ | ✅ | 185 MB | ✅ | Slight overscan on notch |
| iPhone SE 2020, Safari 16.7 | Front camera | 28 | ✅ | ⚠️ temple float | 160 MB | ⚠️ | See issue #412 |
| Galaxy A54, Chrome 128 | Front camera | 30 | ✅ | ✅ | 245 MB | ✅ | |
| Moto G54, Chrome 127 | Front camera | 21 | ⚠️ slow | ✅ | 190 MB | ⚠️ | FPS below 24 target — tier down more |
```

---

## Tier 2: Cloud farm (non-camera tests)

Use BrowserStack Automate for breadth on the tests that DON'T need a camera. This leverages the existing Playwright harness.

### BrowserStack Automate setup

```bash
# Install BrowserStack local (for testing dev-store / localhost)
npm i -g browserstack-local
```

```typescript
// playwright.browserstack.config.ts
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e/browserstack',
  timeout: 60000,
  use: {
    // NO fake-camera here — BrowserStack can't use it
    // These tests are camera-less: bundle, a11y, UI flow, layout
    launchOptions: {},
  },
  projects: [
    // Desktop browsers for bundle/a11y/layout
    { name: 'chrome@latest-win', use: { browserName: 'chromium' } },
    { name: 'safari@latest-mac', use: { browserName: 'webkit' } },
    { name: 'firefox@latest-win', use: { browserName: 'firefox' } },
    // Mobile browsers for responsive layout + a11y
    { name: 'iphone-15-safari', use: { ...devices['iPhone 15'], browserName: 'webkit' } },
    { name: 'pixel-7-chrome', use: { ...devices['Pixel 7'], browserName: 'chromium' } },
    { name: 'galaxy-s23-chrome', use: { ...devices['Galaxy S23'], browserName: 'chromium' } },
    // WebView simulation (though true in-app webview needs real device)
    { name: 'iphone-webview', use: { ...devices['iPhone 15'], browserName: 'webkit', isMobile: true } },
  ],
});
```

### What cloud farms CAN validate (non-camera)

| Test category                                  | BrowserStack | Sauce Labs |
| ---------------------------------------------- | ------------ | ---------- |
| Widget shell loads on all browsers             | ✅            | ✅          |
| Responsive layout (320px–1440px)               | ✅            | ✅          |
| Bundle size within budget                      | ✅            | ✅          |
| axe-core WCAG 2.2 AA scan                      | ✅            | ✅          |
| Widget lifecycle (mount/unmount, no JS errors) | ✅            | ✅          |
| VTO config parsing + model catalog             | ✅            | ✅          |
| CORS/CDN asset loading                         | ✅            | ✅          |
| CSP compliance                                 | ✅            | ✅          |
| Touch vs click interaction parity              | ✅            | ✅          |
| Progressively-enhanced loading states          | ✅            | ✅          |
| Error boundaries (missing GLB, bad config)     | ✅            | ✅          |
| Dark mode / forced-colors media queries        | ✅            | ✅          |

### Cloud farm cost

| Provider | Plan | Cost/month | Key limit |
|----------|------|-----------|-----------|
| **BrowserStack Automate** | Desktop + Mobile | ~$39/mo (individual) | 100 automates min/mo, 5 parallels |
| **Sauce Labs** | Live + Automated | ~$49/mo (individual) | 250 automated min/mo |
| **LambdaTest** | Automation | ~$25/mo (individual) | 100 automates min/mo |

For a personal project: **BrowserStack Automate at $39/mo** gives the best coverage. Activate only during release testing cycles (1 week/month) — total ~$10–39 per release.

---

## Tier 3: GitHub Actions CI (fake camera)

This is the **existing harness** — keep and extend it:

```yaml
# .github/workflows/e2e.yml (extends existing)
- name: Camera regression (fake device)
  run: pnpm test:e2e
  env:
    PLAYWRIGHT_BROWSERS_PATH: 0

- name: Browserstack breadth (no camera)
  run: pnpm test:browserstack
  env:
    BROWSERSTACK_USERNAME: ${{ secrets.BROWSERSTACK_USERNAME }}
    BROWSERSTACK_ACCESS_KEY: ${{ secrets.BROWSERSTACK_ACCESS_KEY }}
  if: github.event_name == 'push' && github.ref == 'refs/heads/main'
```

### Fake camera video corpus for CI

Extend the existing `--use-file-for-fake-video-capture` approach with a video corpus as defined in 049. The fake camera feeds are `.y4m` files checked into LFS:

```
test/fixtures/fake-camera/
├── frontal-neutral.y4m          ← Static face, known PD
├── yaw-sweep.y4m                ← Yaw ±50°, known per-frame yaw
├── pitch-nod.y4m                ← Pitch ±25° nod
├── distance-change.y4m          ← Lean in/out
├── glasses-on-dark.y4m          ← Face wearing glasses (frame removal test)
├── glasses-off-clear.y4m        ← Bare face (no-glasses path)
└── ground-truth.json            ← Per-frame pose + PD ground truth
```

---

## What cloud farms CANNOT catch

Things you MUST test on real devices (Tier 1):

| Risk | Why cloud misses it |
|------|-------------------|
| **Real camera quality variance** | Front cameras differ in color science, dynamic range, focus, noise. MediaPipe iris detection accuracy varies with camera quality. |
| **Real lighting conditions** | Fake video clips are fixed lighting. Real usage has backlight, mixed color temp, shadows. |
| **GPU/driver-specific WebGL bugs** | BrowserStack/Sauce use virtual GPUs. Real Mali/Adreno/PowerVR GPUs have driver-specific rendering artifacts. |
| **True mobile performance** | Cloud mobile emulators share host CPU/GPU. Real low-end Android is slower. |
| **Camera permission UX** | Cloud platforms can't test the native permission dialog flow, especially iOS Safari's "Allow" prompt. |
| **Memory pressure + GC** | Cloud devices have abundant RAM. Real low-end devices have memory pressure that triggers different GC/heap behavior. |
| **Thermal throttling** | Sustained 3D rendering heats real phones. Cloud devices don't throttle. |
| **In-app webview** | Instagram/Facebook/TikTok webview has unique JS engine restrictions + camera API behavior. No cloud farm tests actual webview. |
| **Selfie mirror orientation** | Some Android front cameras deliver mirrored buffers, some don't. This is driver-specific. |

---

## Self-service operations checklist

- [ ] Acquire and set up 5-tier real device set (start with desktop + 1 iPhone + 1 Android)
- [ ] Record fake-camera `.y4m` clips for CI (one-time, re-record on major camera/model changes)
- [ ] Sign up for BrowserStack Automate ($39/mo, activate during release weeks)
- [ ] Wire `test:browserstack` into CI (non-blocking, informational on PRs, blocking on main)
- [ ] Create `device-matrix.md` template in `test/device-matrix/`
- [ ] Run full matrix once per release, record results
- [ ] For budget-conscious: start with real-devices only, add BrowserStack later

## Limitations

- **n=5 devices, not exhaustive.** The real device set covers the most common browser/OS/GPU combos but misses: Huawei (no Google Play), older iPads, foldables, Chromebook. Trade coverage for cost — personal project constraint.
- **iPhone testing requires macOS for some debug workflows.** Safari Web Inspector works from macOS only. If you're on Windows, test visually + use BrowserStack for Safari debug.
- **Cloud farm camera limitation is unlikely to change.** BrowserStack/Sauce Labs have fundamental architecture constraints (remote VMs don't have physical cameras; even real-device-cloud has permission automation barriers). Plan for this to remain permanently manual.

## Related

- [[VTO]] · [[Testing-Researcher]] · [[Device-Researcher]]
- Repo: `rkumar-vto/playwright.config.ts`, `rkumar-vto/e2e/`
- Handoffs: 048 (Playwright harness), 050 (Performance & Device Matrix), 049 (CV Accuracy)
- BrowserStack: https://www.browserstack.com/automate
- Sauce Labs: https://docs.saucelabs.com/web-apps/automated-testing/