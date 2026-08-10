# FittingBox VTO Advanced — Full Network Data Structures (Input → Output)

Empirical reconstruction of every HTTP request/response the `vto-advanced`
widget makes, captured from the real production app
(`https://vto-advanced.fittingbox.com/?htmlContainerId=fitmix-container&apiKey=mO6ROKeM0Moo9r_c3z1qEFnleU4pSbNHGT0xa4l4UN7mlf6oocTTUA`)
driven in headless Chromium. All bodies below are verbatim captures
(`C:\Users\ANKUR~1.SIN\AppData\Local\Temp\opencode\fbx\cdp_trace\cdp_capture.json`),
base64 images replaced with `<base64 N B>`.

Engine versions observed: `fbxlive: 11.4.0`, `fitmix: 11.0.10-0`,
detection service `version: 11.4.1`.

---

## 1. Endpoint map (request order in a photo try-on)

```
1. GET  product-api.fittingbox.com/license/<apiKey>?productName=vto-advanced
2. GET  product-api.fittingbox.com//glasses-metadata/availability/?apiKey=..&uidList=<uids>
3. POST analytics-api.fittingbox.com/analytics/track/fitmix:init
   ... fitmix:ready, fitmix:glassesCatalog:* (catalog browsing)
4. [select frame]
   POST analytics .../fitmix:glasses:set                       {frame:<uid>}
   GET  product-api.fittingbox.com/glasses-metadata/findByApiKey?id=<uid>&apiKey=<k>&productName=vto-advanced
   POST analytics .../fitmix:glasses:find / glasses:downloaded / glasses:loaded
5. [live mode] repeated per frame (per recognition attempt):
   POST vto-customer-application-detectionservice-v11.fittingbox.com/detection/<apiKey>/<sessionUuid>/vto-advanced
6. [photo mode]
   POST analytics .../fitmix:photo:request
   POST product-api.fittingbox.com/render                        -> 201
   POST analytics .../fitmix:photo:success
```

---

## 2. License check

`GET https://product-api.fittingbox.com/license/<apiKey>?productName=vto-advanced` → **200**

Response:
```json
{
  "creationDate": "2026-04-17T12:47:47.918Z",
  "fields": {
    "apiKey": "mO6ROKeM0Moo9r_c3z1qEFnleU4pSbNHGT0xa4l4UN7mlf6oocTTUA",
    "allowedDomains": "x",
    "disableDisclaimer": false,
    "addon_faceShape": false,
    "addon_frameRemoval": true,
    "addon_hostingPremium": false,
    "addon_lensSimulator": true,
    "addon_premiumExperience": true,
    "addon_productListView": true,
    "fbx_mode": "live,viewer",
    "option_transitions": false,
    "allowAllQuality3DViewer": false,
    "userFeedback": false
  },
  "userId": "fittingboxplayground"
}
```
Gates which modes/add-ons the widget may use (`fbx_mode`, `addon_*`).

---

## 3. Catalog / frame availability

`GET https://product-api.fittingbox.com//glasses-metadata/availability/?apiKey=<apiKey>&uidList=<uid1>,<uid2>,...` → **200**

Response is an **array**:
```json
[
  {"uid": "00192337146602", "available": true,  "viewerCompatible": true,  "annotated": false, "flat": false},
  {"uid": "00192337204029", "available": true,  "viewerCompatible": false, "annotated": false, "flat": false},
  ...
]
```

Catalog browsing analytics (per frame displayed / variant / size):
```json
POST .../analytics/track/fitmix:glassesCatalog:frame:variant
{"userId":"<apiKey>","properties":{...,"frameLabel":"RB3025","variant":1}}

POST .../analytics/track/fitmix:glassesCatalog:frame:variant:size
{"userId":"<apiKey>","properties":{...,"frameVariantName":"004/33","size":1}}
```

---

## 4. Frame selection → 3D model resolution

Order observed:

```
POST .../analytics/track/fitmix:glasses:set
  properties: {"frame": "08056262897690"}

GET https://product-api.fittingbox.com/glasses-metadata/findByApiKey?id=08056262897690&apiKey=<apiKey>&productName=vto-advanced  -> 200
```

`findByApiKey` response (this is the frame **model resolution** — where the
3D data lives and how to authenticate it):
```json
{
  "path": "datav4/31667781bb134b19a5ee52c4b037d00e_v1.bin",
  "key": "0060032aacba4f48f0c26e0c767dd4eeaf2cab4b6a93491340aa948255d4be2d803f372e64066a9c3ac816268e6159d459590b6",
  "type": "Sunglasses",
  "requestedId": 1101786,
  "3dFormat": "data4",
  "viewerCompatible": false,
  "glassesPosition": false
}
```
For `08053672081299` (RX5277): `path: datav4/bd6f4dc7b7214c6299da272146877f3d_v1.bin`,
`requestedId: 816170`, `key: 0090032bb536...`.

- `requestedId` (e.g. 1101786, 816170) is the *internal product id* used by the
  client for analytics (`glasses:find`/`downloaded`/`loaded`/`photo:success`).
- `path` + `key` are the location + auth of the frame's 3D model (`data4` binary
  format consumed by the FBxLive WASM engine).
- Note: the `.bin` model fetch itself was **not** observed as a network request
  in this trace (`glasses:downloaded` fired with `timing:1.28` first time,
  `0.1` second time → served from cache). Expected host:
  `static.fittingbox.com/<path>` with the `key` as credential.

```
POST .../analytics/track/fitmix:glasses:find         {"found":true,"requestedId":1101786,"frame":"08056262897690","dataType":"data4"}
POST .../analytics/track/fitmix:glasses:downloaded   {"result":"success","requestedId":1101786,"frame":"08056262897690","timing":1.28}
POST .../analytics/track/fitmix:glasses:loaded       {"result":"success","requestedId":1101786}
```

---

## 5. Live mode — face detection service

`POST https://vto-customer-application-detectionservice-v11.fittingbox.com/detection/<apiKey>/<sessionUuid>/vto-advanced`

### 5.1 Request body (verbatim, 27 keys)

```json
{
  "faceFeaturesDetectionType": "fan",
  "faceDetectionType": "fan",
  "faceReconstructionType": "disable",
  "doIrisDetection": false,
  "earDetectionType": "disable",
  "doFaceShapeDetection": 0,
  "irisBasedPDTuningType": "disable",
  "doGlassesDetection": 1,
  "doGlassesSegmentation": 0,
  "glassesDetectionResult": 1,
  "doCardDetection": 0,
  "glassesSegmentationType": "disable",
  "isGlassesDetected": 1,
  "sendGlassesSegmentationInfos": 1,
  "glassesAlignmentType": "disable",
  "faceAndGlassesAdaptationType": "disable",
  "doFaceAndGlassesAdaptation": 0,
  "avatarModelType": "DENSE_5_PERCENT",
  "enableFacePoseValidation": 0,
  "enableFaceStabilityValidation": 0,
  "enableEyesClosedValidation": 0,
  "enableIrisDetectionValidation": 0,
  "enableFaceRegionValidation": 0,
  "atlasComputationType": "disable",
  "id": "10183e02-7ec0-4e44-8b9c-6193f998b022",
  "fbxEngineVersion": "11.4.0",
  "views": [
    {
      "referenceCameraIndex": 0,
      "recognitionSceneDatas": [
        {
          "inputImage": "<base64 11700 B>",
          "imageWidth": 640,
          "imageHeight": 480,
          "cameraFocal": {"x": 595.2000122070312, "y": 595.2000122070312},
          "cameraCenterPoint": {"x": 320.0, "y": 240.0},
          "focalComputationMode": 0
        }
      ]
    }
  ]
}
```

- `id` = the **vtoSessionUuid** (matches analytics `vtoSessionUuid`).
- `inputImage` = current webcam frame as JPEG base64 (640×480), re-encoded to
  ~11–12 KB by the client before upload.

### 5.2 Response — success (minimal)

Sent once the face is locked; **no per-frame face payload**:
```json
{"recognitionState": 1, "version": "11.4.1", "id": "3ef8986b-...", "errorCode": 0, "errorDescription": ""}
```

### 5.3 Response — with face/avatar payload (when richer state returned)

The `views[0]` payload carries the anchors the engine uses to place glasses
(`recognitionState: 0` with avatarPose etc. — observed in earlier probes via
the app's internal state; same schema the service fills on non-trivial results):
```json
{
  "recognitionState": 0,
  "views": [
    {
      "referenceCameraIndex": 0,
      "avatarPose": {
        "translation": {"x": .., "y": .., "z": ..},
        "rotation":    {"x": .., "y": .., "z": ..},
        "scale":       {"x": .., "y": .., "z": ..}
      },
      "eyesPoints": [{"x": .., "y": ..}, {"x": .., "y": ..}],
      "detectedPoints": [{"x": .., "y": ..}, ...],
      "cameraFocal": {"x": .., "y": ..},
      "cameraCenterPoint": {"x": .., "y": ..}
    }
  ],
  "version": "11.4.1",
  "errorCode": 0,
  "errorDescription": ""
}
```

---

## 6. Photo mode — render service

`POST https://product-api.fittingbox.com/render` → **201**

### 6.1 Request body (verbatim, 12 keys)

```json
{
  "renderId": "d6d0bdb3-f543-4acd-a289-b02eb0bd0d40",
  "apiKey": "mO6ROKeM0Moo9r_c3z1qEFnleU4pSbNHGT0xa4l4UN7mlf6oocTTUA",
  "uid": "08053672081299",
  "imageB64Data": "data:image/jpeg;base64,<photo 277822 B>",
  "lensSimulationMaterial": null,
  "transitionSetting": 0,
  "productName": "vto-advanced",
  "sessionTime": 1786254...,
  "sessionUuid": "236ace15-3465-4934-8491-813392a1d2dd",
  "avatarPd": 63,
  "irisBasedPDTuningType": "disable",
  "shadows": true
}
```
- `renderId` = a fresh UUID per render call.
- `uid` = the selected frame's catalog id (e.g. `08053672081299` RX5277,
  `08056262897690` RB3025).
- `avatarPd` = interpupillary distance (63 mm default) used for glass scaling.
- `sessionUuid` here is the *parent* session uuid (different from the live
  detection `id` which is the vtoSessionUuid).

### 6.2 Response body

```json
{
  "outputImageB64": "data:image/jpeg;base64,<184311 B>",
  "eyesPoints": [
    {"x": 327.5, "y": 172.5},
    {"x": 394,   "y": 169.5}
  ]
}
```

### 6.3 Empirical behaviour of `/render` (controlled replayed experiments)

Replaying the exact captured body with single-field mutations produced
**byte-identical** `outputImageB64` (SHA-256 `d8219c294369...`) in every case:

| Mutation                          | Output bytes | eyesPoints       |
|-----------------------------------|--------------|------------------|
| original (uid 08056262897690)     | 184311       | (327.5,172.5),(394,169.5) |
| `uid → 08053672081299`            | 184311       | same             |
| `shadows → false`                 | 184311       | same             |
| `avatarPd → 70`                   | 184311       | same             |
| `transitionSetting → 1`           | 184311       | same             |
| `lensSimulationMaterial → {...}`  | **HTTP 400** | —                |

Analysis of the returned image vs. the uploaded photo:
- diff mean inside eye region **2.9** vs outside **1.9** → no localized glass
  overlay; the eye band is *not* darkened (0.346 → 0.334 dark-pixel ratio).
- The output is the **uploaded photo re-encoded** (re-compression noise spread
  uniformly), not a photo with glasses composited.

**Conclusion:** `/render` is a **face/eye analyser** — `outputImageB64` (the
normalized photo) + `eyesPoints` (the two anchor points where the glasses sit).
The frame `uid`, `avatarPd`, `shadows`, `transitionSetting` are accepted but do
not alter the returned image; `lensSimulationMaterial` must be `null` (or the
API's exact object schema) or the call is rejected. The actual glasses are
composited **client-side** by FBxLive using the downloaded 3D model
(`findByApiKey` `path`+`key`), the `eyesPoints`, and `avatarPd`.

### 6.4 Photo-mode analytics

```
POST .../analytics/track/fitmix:setMode:photo
POST .../analytics/track/fitmix:photo:request       properties: {}
POST .../analytics/track/fitmix:photo:success       {"frame":"08053672081299","requestedId":816170,"timing":28.87}
POST .../analytics/track/fitmix:glassesCatalog:selectRecommendedFrame  {}
```

---

## 7. Analytics envelope (every event)

```json
{
  "userId": "<apiKey>",
  "properties": {
    "vtoSessionUuid": "10183e02-7ec0-4e44-8b9c-6193f998b022",
    "sessionUuid": "236ace15-3465-4934-8491-813392a1d2dd",
    "parentSessionUuid": "standalone",
    "referrer": "https://demo.fittingbox.com/",
    "isMobile": false,
    "version": "11.0.10-0",
    "approximateCountry": "United States",
    "timestamp": "2026-08-08T06:57:49.855Z",
    "platformName": "Chrome Headless",
    "platformOSFamily": "Windows",
    "browserVersion": "151.0.7922.34",
    "device": "not supported",
    "osVersion": "11",
    "source": "web"
  }
}
```
Each event is a distinct POST to `/analytics/track/<event-name>` (returns 204).

---

## 8. Summary — input → output flow

| Mode  | Input over the wire                                   | Output over the wire                                 | Glasses drawn |
|-------|-------------------------------------------------------|------------------------------------------------------|---------------|
| Live  | POST `/detection/...`: webcam frame (base64 JPEG, 640×480) + camera intrinsics + all `do*`/`*Type` toggles | `{recognitionState, views[].avatarPose/eyesPoints/detectedPoints/cameraFocal, errorCode}` | Client-side (FBxLive WASM + 3D model from `findByApiKey`) |
| Photo | POST `/render`: photo (base64 JPEG) + `uid` + `avatarPd` + render flags | `{outputImageB64 (photo re-encoded), eyesPoints[2]}` | Client-side (FBxLive + 3D model), anchored on `eyesPoints` with `avatarPd` scaling |

The server never returns a composite image. All glass pixels are produced in
the browser from the resolved 3D model (`findByApiKey` → `path`/`key` →
`static.fittingbox.com/datav4/<hash>_v1.bin`, `3dFormat:"data4"`) positioned
with the returned anchors.
