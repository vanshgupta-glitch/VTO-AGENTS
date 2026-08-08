---
okf: 1
id: F001-fittingbox-privacy
type: finding
project: VTO
status: done
created: 2026-08-04
tags: [vto, fittingbox, teardown, privacy]
---

# F001 — FittingBox Privacy Posture: What Actually Leaves the Browser

**Project:** [[VTO]] · Source note: [[ra-fittingbox]] · Related: F001-fittingbox-summary

## Question
What actually leaves the shopper's browser during FittingBox try-on vs their privacy claims?

## Answer (two distinct flows)
1. **Real-time webcam try-on (live):** run in the **client** via the FBxLive WASM engine — **no webcam frames are uploaded** for the live try-on itself. Only small **analytics/tracking events** (session UUIDs, event names like `fitmix:*`) go to `analytics-api.fittingbox.com` and PostHog (`eu-assets.i.posthog.com`), plus license/metadata checks to `product-api.fittingbox.com`.
2. **Photo render / frame-removal / still try-on:** **the shopper's face photo (base64) IS uploaded** to FittingBox's server-side `render` service and face-shape/detection services. This is the frame-removal pipeline (F001-fittingbox-frame-removal) and the avatar/photo render path — biometric-grade facial imagery transits to their cloud, not just a slide deck.

### Observed outbound (POST/GET from public demos)
- `analytics-api.fittingbox.com/analytics/track/fitmix:*` — events: `init`, `liveCompatibility`, `license:check`, `ready`, `glassesCatalog:frame:variant`, `glassesCatalog:material`, `glassesCatalog:material:error`, `multi:request`, etc. Payloads are small (~0.6 KB JSON: userId=apiKey, sessionUuid, event properties).
- `eu.i.posthog.com/flags` + `eu-assets.i.posthog.com` — feature-flag / autocapture analytics (PostHog), ~0.1–0.9 KB, plus `surveys.js` (96 KB) / `web-vitals.js`.
- `product-api.fittingbox.com/license/...` + `glasses-metadata/availability/?apiKey=...&uidList=...` — license + catalog metadata (no PII; transmits frame barcodes/UID list).
- `vto-customer-application-detectionservice-v11.fittingbox.com`, `faceshapeservice.fittingbox.com` — server-side face detection / face-shape endpoints (used in photo/avatar flow).
- `render` (restApiUrl) — receives `imageB64Data` + glasses `uid` + PD; returns processed image — **this is the PII / biometric egress point**.

## Evidence
- Network capture: all POST bodies on the demo flows were analytics (0.6 KB pyjamas) + PostHog; no live webcam frames were observed leaving in the live path.
- Source of render payload (vto-advanced JS): `imageB64Data`, `apiKey`, `uid`, `avatarPd`, `irisBasedPDTuningType`, `shadows` → confirms photo upload for render/removal.
- Dedicated detection/face-shape service hosts confirm server-side image processing exists.

## Implications for VTO
- **Our privacy edge:** VTO stays 100% client-side (MediaPipe + three.js), so the shopper's face never leaves the device. FittingBox's live path also stays local, but their **removal + still/photo path uploads facial imagery** and runs server-side — a meaningful privacy and consent/compliance (GDPR) differentiator for us, and a cost center for them.
- Merchants adopting FittingBox's advanced widget inherit this photo-upload reality; we can market "face never leaves the browser" if we keep removal/PD client-side too.
- Callout for [[Patent-Researcher]]: server-side removal may let them sidestep some client-ML claims, but the segmentation method itself ("classify each pixel background/lenses/frame") may still be patented irrespective of where it runs.

## Sources
- Playwright network captures of https://demo.fittingbox.com (home, list) & https://vto-advanced.fittingbox.com (observe only)
- vto-advanced app JS (render/detection/face-shape endpoints)
- https://pd-measurement-demo.fittingbox.com/ (analytics: `msrt:*`)
