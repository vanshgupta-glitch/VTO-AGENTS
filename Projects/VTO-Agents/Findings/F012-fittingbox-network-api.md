---
okf: 1
id: F012-fittingbox-network-api
type: finding
project: VTO
status: done
created: 2026-08-08
updated: 2026-08-08
tags: [vto, fittingbox, teardown, network, api, schemas, detection, render]
source_agent: opencode (network analysis)
source_task: FittingBox VTO input→output network capture
---

# F012 — FittingBox VTO Network API: Full Input→Output Schemas

**Project:** [[VTO]] · Evidence: [[raw/fittingbox-home]] (`cdp_capture-302req.json`)

## Question

What exactly does the FittingBox `vto-advanced` widget send and receive over the
network — every endpoint, full request body, full response body — so our own
try-on can mirror the contracts and so visual-UI tests have reference payloads?

## Answer

All bodies below are **verbatim captures** from the live production widget
(`vto-advanced.fittingbox.com`, engine `fbxlive 11.4.0` / `fitmix 11.0.10-0`,
detection service `11.4.1`). 302 requests captured; the widget touches exactly
**six** FittingBox hosts:

| Host | Purpose |
|---|---|
| `product-api.fittingbox.com` | license check, frame availability, frame model resolution |
| `vto-customer-application-detectionservice-v11.fittingbox.com` | **live** face detection |
| `product-api.fittingbox.com/render` | **photo** face/eye analysis |
| `analytics-api.fittingbox.com` | `fitmix:*` event stream (204s) |
| `static.fittingbox.com` | FBxLive WASM engine (see [[F001-fittingbox-network-waterfall]]) |
| `assets.fittingbox.com` | 3D frame binaries (`fitsource`) — see [[F012-fittingbox-network-api]] §5 |

---

### 1. License check

`GET product-api.fittingbox.com/license/<apiKey>?productName=vto-advanced` → **200**

```json
{"creationDate":"2026-04-17T12:47:47.918Z",
 "fields":{"apiKey":"mO6ROKeM0Moo9r_...","allowedDomains":"x","disableDisclaimer":false,
   "addon_faceShape":false,"addon_frameRemoval":true,"addon_hostingPremium":false,
   "addon_lensSimulator":true,"addon_premiumExperience":true,"addon_productListView":true,
   "fbx_mode":"live,viewer","option_transitions":false,"allowAllQuality3DViewer":false,
   "userFeedback":false},
 "userId":"fittingboxplayground"}
```
Gates which modes/add-ons the widget may use. `fbx_mode:"live,viewer"` (no `photo`
in the mode string, yet photo render is reachable via the render API below).

### 2. Frame availability (catalog)

`GET product-api.fittingbox.com//glasses-metadata/availability/?apiKey=<key>&uidList=<uids>` → **200**, array:

```json
[{"uid":"00192337146602","available":true,"viewerCompatible":true,"annotated":false,"flat":false},
 {"uid":"00192337204029","available":true,"viewerCompatible":false,"annotated":false,"flat":false}]
```
`uidList` holds the demo catalog barcodes (e.g. `08056262897690,08053672081299,...`).
`available` = license can load it; `viewerCompatible` = usable in 3D viewer.

### 3. Frame model resolution (the 3D asset pointer)

`GET product-api.fittingbox.com/glasses-metadata/findByApiKey?id=<uid>&apiKey=<key>&productName=vto-advanced` → **200**

```json
{"path":"datav4/31667781bb134b19a5ee52c4b037d00e_v1.bin",
 "key":"0060032aacba4f48f0c26e0c767dd4eeaf2cab4b6a93491340aa948255d4be2d803f372e64066a9c3ac816268e6159d459590b6",
 "type":"Sunglasses","requestedId":1101786,"3dFormat":"data4","viewerCompatible":false,"glassesPosition":false}
```
- `requestedId` = internal product id (RB3025→1101786, RX5277→816170); echoed in all analytics.
- `path`+`key` = where + how to fetch the proprietary **data4** 3D binary (the modern
  successor to the `fitsource` binaries observed in [[F001-fittingbox-network-waterfall]]).
  The `.bin` itself was served from cache in this capture (analytics `glasses:downloaded`
  fired with `timing:1.28` first frame, `0.1` second) — expected at
  `static.fittingbox.com/<path>` with `key` as credential.

### 4. Live mode — face detection service

`POST vto-customer-application-detectionservice-v11.fittingbox.com/detection/<apiKey>/<sessionUuid>/vto-advanced`

**Request (27 keys, verbatim):**
```json
{"faceFeaturesDetectionType":"fan","faceDetectionType":"fan","faceReconstructionType":"disable",
 "doIrisDetection":false,"earDetectionType":"disable","doFaceShapeDetection":0,
 "irisBasedPDTuningType":"disable","doGlassesDetection":1,"doGlassesSegmentation":0,
 "glassesDetectionResult":1,"doCardDetection":0,"glassesSegmentationType":"disable",
 "isGlassesDetected":1,"sendGlassesSegmentationInfos":1,"glassesAlignmentType":"disable",
 "faceAndGlassesAdaptationType":"disable","doFaceAndGlassesAdaptation":0,
 "avatarModelType":"DENSE_5_PERCENT","enableFacePoseValidation":0,"enableFaceStabilityValidation":0,
 "enableEyesClosedValidation":0,"enableIrisDetectionValidation":0,"enableFaceRegionValidation":0,
 "atlasComputationType":"disable","id":"<vtoSessionUuid>","fbxEngineVersion":"11.4.0",
 "views":[{"referenceCameraIndex":0,"recognitionSceneDatas":[
   {"inputImage":"<base64 jpeg, ~11.7 KB, 640x480>","imageWidth":640,"imageHeight":480,
    "cameraFocal":{"x":595.2,"y":595.2},"cameraCenterPoint":{"x":320,"y":240},"focalComputationMode":0}]}]}
```
- `id` = the **vtoSessionUuid** (same value in analytics envelope).
- `inputImage` = current webcam frame, re-encoded to ~11–12 KB JPEG by the client.

**Response — success (minimal):**
```json
{"recognitionState":1,"version":"11.4.1","id":"3ef8986b-...","errorCode":0,"errorDescription":""}
```
**Response — rich (when the service returns face/avatar payload; shape seen in
prior probes — `recognitionState:0` carries the anchors):**
```json
{"recognitionState":0,"version":"11.4.1","errorCode":0,"errorDescription":"",
 "views":[{"referenceCameraIndex":0,
   "avatarPose":{"translation":{"x":..,"y":..,"z":..},"rotation":{"x":..,"y":..,"z":..},"scale":{"x":..,"y":..,"z":..}},
   "eyesPoints":[{"x":..,"y":..},{"x":..,"y":..}],
   "detectedPoints":[{"x":..,"y":..}],
   "cameraFocal":{"x":..,"y":..},"cameraCenterPoint":{"x":..,"y":..}}]}
```
`recognitionState` values observed: `1` face locked (minimal body), `0` face + pose,
`3` no face (headless fake-feed runs). The engine places glasses from
`avatarPose`/`eyesPoints` **client-side**.

### 5. Photo mode — render service

`POST product-api.fittingbox.com/render` → **201**

**Request (12 keys, verbatim):**
```json
{"renderId":"d6d0bdb3-f543-4acd-a289-b02eb0bd0d40",
 "apiKey":"mO6ROKeM0Moo9r_...",
 "uid":"08053672081299",
 "imageB64Data":"data:image/jpeg;base64,<photo, 277,822 B>",
 "lensSimulationMaterial":null,
 "transitionSetting":0,
 "productName":"vto-advanced",
 "sessionTime":1786254...,"sessionUuid":"236ace15-...","avatarPd":63,
 "irisBasedPDTuningType":"disable","shadows":true}
```
**Response:**
```json
{"outputImageB64":"data:image/jpeg;base64,<184,311 B>",
 "eyesPoints":[{"x":327.5,"y":172.5},{"x":394,"y":169.5}]}
```
**Critical behavioural fact (proven by controlled replays — see [[F013-fittingbox-render-analyser]]):**
the endpoint is a **pure face/eye analyser**. `uid`, `avatarPd`, `shadows`,
`transitionSetting` do **not** alter `outputImageB64`; `lensSimulationMaterial`
set to a non-null value returns **HTTP 400**. Glasses are composited client-side
from the resolved data4 model + `eyesPoints` + `avatarPd`.

### 6. Analytics envelope (every `fitmix:*` event)

```json
{"userId":"<apiKey>","properties":{"vtoSessionUuid":"10183e02-...","sessionUuid":"236ace15-...",
 "parentSessionUuid":"standalone","referrer":"https://demo.fittingbox.com/","isMobile":false,
 "version":"11.0.10-0","approximateCountry":"United States","timestamp":"2026-08-08T06:57:49.855Z",
 "platformName":"Chrome Headless","platformOSFamily":"Windows","browserVersion":"151.0.7922.34",
 "device":"not supported","osVersion":"11","source":"web"}}
```
Events (each → 204): `fitmix:init`, `liveCompatibility`, `license:check`, `ready`,
`glassesCatalog:*`, `glasses:set/find/downloaded/loaded`, `setMode:*`, `startVto`,
`photo:request`/`photo:success`, `camera:*`, `disclaimer:skipped`.

---

## Implications for VTO

1. **`eyesPoints` are the contract.** FittingBox returns 2 pupil anchors on every
   render/detection path; that is the entire "model output" our Visual UI tests
   can compare against (see [[F014-fittingbox-visual-ui-test-stats]]).
2. **Server does NOT composite.** Photo render returns the input photo re-encoded
   + anchors; glasses pixels are client-side. Do not replicate a server-render
   dependency — matches D3 (video-only, fully client-side).
3. **Data4 replaces fitsource.** The current asset path is `datav4/<hash>_v1.bin`
   (`3dFormat:"data4"`) — newer than the `fitsource/` binaries in the original
   teardown. Frame-referencing tests should key on `requestedId`, not the barcode.
4. **Strict schema.** `lensSimulationMaterial` must be `null` (or exact schema);
   a wrong value 400s. Our middleware should validate rather than silently pass.

## Evidence

- `raw/fittingbox-home/cdp_capture-302req.json` — full 302-request trace
- `raw/fittingbox-home/network-data-structures.md` — expanded version of this schema
- `raw/fittingbox-home/render-body.json`, `render-rx5277.jpeg`, `render-rb3025.jpeg`
- [[F013-fittingbox-render-analyser]] — the controlled-replay experiment that proves §5
- [[F001-fittingbox-summary]] — original teardown this extends (schema + waterfall)

## Related

- [[F013-fittingbox-render-analyser]]
- [[F014-fittingbox-visual-ui-test-stats]]
- [[F001-fittingbox-network-waterfall]]
- [[F001-fittingbox-scale-fit]] (PD/eyesPoints approach)
