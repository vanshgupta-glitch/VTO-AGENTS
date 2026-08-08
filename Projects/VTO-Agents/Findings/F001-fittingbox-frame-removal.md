---
okf: 1
id: F001-fittingbox-frame-removal
type: finding
project: VTO
status: done
created: 2026-08-04
tags: [vto, fittingbox, teardown, frame-removal, server-side]
---

# F001 — FittingBox Frame-Removal Pipeline: Client-side or Server-side?

**Project:** [[VTO]] · Source note: [[ra-fittingbox]] · Related: F001-fittingbox-summary

## Question
Does FittingBox's frame-removal (try on glasses without taking off your current pair) run client-side (ML model downloads at activation) or server-side (image uploads)? What is the latency of the first removal?

## Answer
**Server-side.** The FittingBox "advanced website" try-on renders and removes the shopper's current glasses **on their cloud**, not in the browser. The client uploads a **base64 photo + glasses uid** to a `render` endpoint and receives back the processed image (`outputImageB64`) plus eye landmarks (`eyesPoints`). Frame removal is a **premium add-on flag** (`addon_frameRemoval`, `selectIsRemovalAvailable`) gating a dedicated "removal component" in the client. This is consistent with their internal positioning that each pixel is classified into background / lenses / frame — that segmentation runs in their backend service, and the result is streamed back to the browser.

### Key code evidence (from vto-advanced app JS)
- `getRender({ imageB64Data, glassesId, pupillaryDistance, lensSimulationSetting, material })` →
  `this.http.post(\`${restApiUrl}render\`, { renderId, apiKey, uid, imageB64Data, lensSimulationMaterial, ..., avatarPd, irisBasedPDTuningType: "disable", shadows })`
  returns `{ outputImageB64, eyesPoints }`.
- `selectIsRemovalAvailable: ... e?.addon_frameRemoval` → removal is an addon feature flag.
- Splitting is a **feature flag gate**: `fbx_mode` (a mode list) controls which features run.
- Removal component events: `"removal compute action"`, `"removal switch to tryon"`, `"removal is positioning succeed"`, `"first success"` → a compute + position step, then overlay onto try-on.
- Face-shape / detection are dedicated server services: `vto-customer-application-detectionservice-v11.fittingbox.com`, `faceshapeservice.fittingbox.com`.
- Avatar/photo pipeline: `avatarModelType: "DENSE_5_PERCENT"`, `generateAvatarObj:0`, `avatarPd` — the still/avatar path is server-rendered (`POST ${restApiUrl}render`).

## Evidence
- Source: vto-advanced `chunk-BPYZF72V.js` / `chunk-TDW6KIIV.js` (render POST payload, returns `outputImageB64` + `eyesPoints`; `addon_frameRemoval` selector; removal-component reducers).
- Network: on demos, POST bodies observed went to `analytics-api.fittingbox.com` (tracking only); the `render` endpoint is called only after a valid photo/removal flow is started — which requires an interactive flow not reachable in headless (see Limitations). Config confirmed `restApiUrl` is the render base.

## Latency of first removal
- **Not directly measured** — the removal flow needs a started webcam/live session, which headless cannot drive. Structure shows it is a **network round-trip** (client → render service → client), so first-removal latency = upload + server inference/segmentation + return, i.e. at least one RTT plus server processing. This is inherently slower than local ML.

## Implications for VTO
- **This is the single most important finding for our 250 KB constraint.** FittingBox did not solve in-browser ML segmentation for removal — they **offload it to the server** and keep the client thin. Their "client-side try-on" claim is really: real-time webcam try-on (frame placement + lighting) is client-side in WASM, but **frame removal + still photo renders + face-shape analysis are server-side**.
- For VTO: our all-client-side MediaPipe segmentation is a **differentiator** if we can fit it in-budget, but we must be honest that a quality-competitive removal is heavy. If we cannot fit client ML, the FittingBox-validated escape hatch is a **server-side removal service** (their approach) — but that creates privacy/upload concerns (F001-fittingbox-privacy) and recurring cost they address with the $59/mo price.
- **Patent note for [[Patent-Researcher]]:** the "classify each pixel into background/lenses/frame" is done server-side here — review whether any of FittingBox's 59 patents claim the client-vs-server split or the specific segmentation network.

## Sources
- vto-advanced app JS (render POST payload & return contract, removal component reducers, feature flags)
- https://vto-advanced.fittingbox.com/ (iframe capture)
