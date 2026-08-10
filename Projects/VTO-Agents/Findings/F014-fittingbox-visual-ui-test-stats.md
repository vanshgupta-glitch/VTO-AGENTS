---
okf: 1
id: F014-fittingbox-visual-ui-test-stats
type: finding
project: VTO
status: done
created: 2026-08-08
updated: 2026-08-08
tags: [vto, fittingbox, teardown, visual-testing, accuracy, metrics, video-tester, stats]
source_agent: opencode (network analysis)
source_task: FittingBox VTO validation reference statistics
---

# F014 — FittingBox VTO: Reference Stats for Validating Visual UI Tests

**Project:** [[VTO]] · Consumers: VideoTester / Accuracy orchestrators ([[PRD]] §3)

## Question

What concrete, measured numbers from FittingBox's live widget can our visual-UI
and accuracy harnesses assert against — so tests compare to **ground truth**
instead of invented expectations?

## Answer

The table below is the reference set. All values were measured from the live
production widget on 2026-08-08 (headless Chromium 151, Windows 11) via a full
302-request CDP trace + controlled API replays. It gives the VideoTester and
Accuracy disciplines hard numbers for: engine/API versions, catalog behaviour,
detection response shape, photo-render contract, and session identifiers.

### 1. Versions & identifiers (assert these on every run)

| Signal | Value | Where |
|---|---|---|
| FBxLive engine | `11.4.0` | `onGetVersion` params |
| fitmix (app) | `11.0.10-0` | `onGetVersion` params |
| detection service | `11.4.1` | detection response `version` |
| engine | `11.4.0` | detection request `fbxEngineVersion` |
| product name | `vto-advanced` | `productName` in render/findByApiKey |
| license user | `fittingboxplayground` | license response `userId` |
| vto session | uuid, e.g. `10183e02-...` | = detection request `id` = analytics `vtoSessionUuid` |
| parent session | uuid, e.g. `236ace15-...` | render `sessionUuid` + analytics `sessionUuid` (differs from vtoSessionUuid) |

### 2. Photo-render contract (the only stable cross-implementation output)

| Metric | Value | Use in validation |
|---|---|---|
| Endpoint | `POST product-api.fittingbox.com/render` → **201** | Harness must expect 201, not 200 |
| Input photo | 480×640 JPEG, 277,822 B, `data:image/jpeg;base64,` prefix | Echo exact bytes in fixtures |
| Output image | 480×640 JPEG, **184,311 B** (fixed for this photo) | Byte-size + dims assertion |
| Output uniqueness | **byte-identical across uid/shadow/pd/transition mutations** | See [[F013-fittingbox-render-analyser]] — do not assert per-frame pixel deltas |
| `eyesPoints` (photo 1) | `(327.5,172.5)`, `(394,169.5)` | Pupil anchors are the placement ground truth |
| `avatarPd` default | `63` (mm) | PD sent by the client |
| Non-null `lensSimulationMaterial` | → **HTTP 400** | Negative test: strict schema |

### 3. Face-detection response states

| `recognitionState` | Meaning | Observed response body |
|---|---|---|
| `1` | face locked (minimal) | `{recognitionState, version, id, errorCode:0, errorDescription:""}` |
| `0` | face + pose/anchors | adds `views[].avatarPose{translation,rotation,scale}`, `eyesPoints`, `detectedPoints`, `cameraFocal`, `cameraCenterPoint` |
| `3` | no face (headless fake feed) | minimal body, no views |

Request invariants: `faceDetectionType:"fan"`, `avatarModelType:"DENSE_5_PERCENT"`,
`inputImage` ≤ ~12 KB JPEG at 640×480, `cameraFocal {595.2,595.2}`, `cameraCenterPoint {320,240}`.

### 4. Timing & sizing baselines (headless, this machine — treat as order-of-magnitude)

| Measure | Value | Note |
|---|---|---|
| Detection input frame size | ~11.7 KB (640×480 JPEG) | Client re-encodes aggressively |
| Glasses model download (RB3025, first) | `timing: 1.28 s` | analytics `glasses:downloaded` |
| Glasses model download (second frame) | `timing: 0.10 s` | cached |
| Photo render, end-to-end | ~28–44 s | analytics `photo:success` `timing` — dominated by headless model + transfer; real-world far lower |
| Catalog frames in demo | ~31 barcodes, `variant:1` (2 frames use `variant:10`/`variant:4`) | `glassesCatalog:frame:variant` events |

### 5. Catalog ground truth (frames used in the demos)

| frameLabel | barcode `uid` | `requestedId` | type | 3dFormat |
|---|---|---|---|---|
| RB3025 (Ray-Ban Aviator) | `08056262897690` | `1101786` | Sunglasses | `data4` |
| RX5277 (Ray-Ban optical) | `08053672081299` | `816170` | Sunglasses | `data4` |

`findByApiKey?id=<uid>` maps barcode → `{path: datav4/<hash>_v1.bin, key, requestedId, 3dFormat}`.
**Key on `requestedId` in tests** — the barcode is the merchant-facing key, the id is stable.

### 6. Pixel-comparison guardrails (for diffing rendered output)

From [[F013-fittingbox-render-analyser]] — how to diff FittingBox output vs source
without false positives:

| Rule | Value |
|---|---|
| Expected eye-region diff (no overlay) | mean ≈ **2.9** (0–255) |
| Expected outside-region diff (JPEG re-encode) | mean ≈ **1.9** |
| Eye-line band dark-pixel ratio | **falls** 0.346 → 0.334 (lighter, never darker) |
| Interpretations | a mean eye-region diff > ~10× background, or darkening in the lens band ⇒ a real overlay was composited |

For our own output validation (Accuracy discipline), the same anatomy applies
in reverse: a correct composite **must** show a strong, localized eye-region delta
and a darkened lens band; a uniform-noise-only diff means the glasses were not drawn.

## Implications for VTO

1. **Ground-truth fixtures exist.** Save `render-rx5277.jpeg`/`render-rb3025.jpeg`
   + `eyesPoints` as the FittingBox reference anchors for the Accuracy gate
   ([[PRD]] F6.4 / F6.7 perceptual terms are currently blocked on capturing such
   references — this unblocks the anchor/placement term today).
2. **Assert contracts, not pixels, against FittingBox.** Byte-identical renders
   prove pixels are non-informative for placement; assert 201/400, `eyesPoints`,
   `requestedId`, versions.
3. **Test the opposite sign on our own output.** VideoTester clip verdicts should
   check the *inverse* of §6: overlay present = localized eye delta + lens darkening.
4. **Timing is hardware/model-dependent.** Record `photo:success`/`downloaded`
   timings per run as regression baselines (drift >2× ⇒ investigate), not as absolutes.

## Evidence

- `raw/fittingbox-home/cdp_capture-302req.json` — full trace (versions, ids, timings)
- `raw/fittingbox-home/replay_render.py`, `compare_renders.py` — experiment + analysis
- `raw/fittingbox-home/render-rx5277.jpeg`, `render-rb3025.jpeg` — identical outputs
- [[F012-fittingbox-network-api]] — full schemas behind every row above
- [[F013-fittingbox-render-analyser]] — the diff/eyeband numbers behind §6

## Related

- [[F012-fittingbox-network-api]]
- [[F013-fittingbox-render-analyser]]
- [[F001-fittingbox-summary]]
- [[PRD]] (VideoTester / Accuracy disciplines; F6.4/F6.7)
- [[VTO]] D3
