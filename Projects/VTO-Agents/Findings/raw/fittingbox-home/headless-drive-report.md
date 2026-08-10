# FittingBox VTO Advanced — Headless Live-Engine Drive (Playwright/Chromium)

Empirical findings from driving the real production widget
(`https://demo.fittingbox.com/home`, `vto-advanced` integration) in headless
Chromium on Windows. All postMessages need `from:"fitmix-container"` — the
iframe drops anything else (`isCallerFitmixIntegration` / `htmlContainerId`).

Live iframe URL used throughout:

```
https://vto-advanced.fittingbox.com/?htmlContainerId=fitmix-container&apiKey=mO6ROKeM0Moo9r_c3z1qEFnleU4pSbNHGT0xa4l4UN7mlf6oocTTUA
```

---

## 1. postMessage formats (parent <-> iframe)

### Parent -> iframe (all include `from:"fitmix-container"`)

```json
{"method":"setInitializeOptions","params":{"apiKey":"...","frame":"08056262897690","lang":"en","detectionUrl":"https://...","methods":["onOpenStream", ...]}}
{"method":"startVto","params":"live"}
{"method":"setMode","params":{"mode":"live"}}        // also "viewer", "photo", "faceshape"
{"method":"stopVto"}
{"method":"setFrame","params":{"id":"08056262897690"}}
{"method":"getSnapshot"}
```

- `setInitializeOptions` params are zod-validated (`Mv`, strict): `frame` must be
  a non-empty string. The demo omits one string field -> non-fatal console
  warning `VtoChecklist - Integration options error: Invalid input: expected
  string, received undefined`.
- `methods` is a whitelist of callback names the iframe will forward back
  (see section 2). The demo derives it from function-valued config callbacks.

### Iframe -> parent (observed, full whitelist active)

```json
{"method":"getOptions"}                                             // asks parent to re-send options
{"method":"onGetVersion","params":{"fbxlive":"11.4.0","fitmix":"11.0.10-0"}}
{"method":"onAgreePrivacyTerms","params":null}                      // auto-fired x2 when consent pre-set
{"method":"connect","params":{"liveSupported":true}}                // widget ready
{"method":"onMode","params":"live"}
{"method":"onModeLive","params":null}
{"method":"onOpenStream","params":{"success":true}}                 // camera stream opened
{"method":"onLiveStatus","params":{"faceTracking":false,"glassesReady":true,"hasStream":true,"userHasGlasses":false,"removalActive":false}}
{"method":"onUiStatus","params":{"loadingIndicator":true,"vtoLoadingScreen":true,"positioningGuideOverlay":false,...}}
{"method":"onIssue","params":{"cameraAccessDenied":false,"noCameraFound":false,"protocolFailed":false,"detectionFailed":false,...}}
{"method":"onCanvasResize","params":{"canvas":{"topLeft":{"x":0,"y":0},...},"catalog":{"topLeft":{"x":624,"y":0},...}}}
{"method":"onSnapshot","params":{"dataUrl":"data:image/png;base64,...","width":624,"height":740}}   // after getSnapshot
```

## 2. Ready / live events — and the `methods` whitelist gate

- `callbackService.autoCallback(method, ...)` **only forwards** an event if
  `options.methods.includes(method)`:
  `autoCallback(e,...t){ this.optionsSignal()?.methods?.includes(e) && this.iframePostMessage({method:e,params:t[0]}) }`.
- Default demo options only whitelist the callbacks the demo binds -> without
  intervention you will NOT see `onOpenStream`, `onLiveStatus`, `onSnapshot`,
  `onUiStatus`, `onIssue`, `onMode`, `onCanvasResize`, `onGetVersion`.
- **Fix (proven):** intercept the parent's `setInitializeOptions` inside the
  iframe (`addEventListener('message')`, `e.stopImmediatePropagation()`, then
  re-`window.postMessage` a copy with `methods` = the full canonical list
  `["onAgreePrivacyTerms","onDisagreePrivacyTerms","onGetFaceshape","onGetVersion","onLiveStatus","onModeFaceshape","onModeLive","onModePhoto","onMode","onOpenStream","onPhotoRender","onPrivacyTermsShown","onSnapshot","onUiStatus","onStopVto","onIssue","onSetRenderPhoto","onRenderResult","onViewProductButtonClicked","onAddToCartButtonClicked","onCanvasResize","onFrameNotFound","onFrameDownloadError"]`).
- Event sources: `onOpenStream` = live video component's `getUserMedia` success
  (`op` class) and `vtoAdvancedFbxLiveCallbackToIntegration` mapping
  `selectOpenStreamCallBack==="cameraOpen"` -> `{success:true}`;
  `onLiveStatus` = `vtoAdvancedOnLiveStatus` directive over
  `{userHasGlasses, faceTracking, glassesReady, hasStream, removalActive}`;
  `onSnapshot` = `vtoAdvancedGetSnapShot` on the FBxLive `imageCallBack$`.

## 3. Bundle / resource URLs

- App: `https://vto-advanced.fittingbox.com/?htmlContainerId=fitmix-container&apiKey=<KEY>`
- FBxLive engine: `https://static.fittingbox.com/libs/FBxLive/11.4.0/FBxLive.js`
  and `fbx-streamgrabber.js` (+ FBxLive.wasm/.data assets)
- License: `https://product-api.fittingbox.com/license/<KEY>?productName=vto-advanced`
  -> `{fbx_mode:"live,viewer", addon_lensSimulator:true, addon_premiumExperience:true,
  addon_productListView:true, addon_frameRemoval:true, disableDisclaimer:false, ...}`
- Cloud face detection: `https://vto-customer-application-detectionservice-v11.fittingbox.com/detection/<KEY>/<sessionUuid>/<productName>`
  (POST body = `detectionType:"fan", reconstructionType:"singleCam", avatarModelType:"DENSE_5_PERCENT", views:[{recognitionSceneDatas:[{inputImage:<base64>}]}]`;
  response `{"recognitionState":N,"version":"11.4.1","errorCode":0}`)
- Analytics: `https://analytics-api.fittingbox.com/...` (`fitmix:init`,
  `fitmix:liveCompatibility`, `fitmix:license:check`, `fitmix:ready` fired ->
  engine fully initialized)
- Demo driver bundles (parent): `chunk-R7TB4JZD.js` (widget), `chunk-LQ5LUHZ3.js`
  (config/second key), `chunk-BKYCRZMW.js` (integration client, `send`/`setInitializeOptions`),
  `chunk-PAMDHQME.js` (iframe app + `Oe` callbackService).

## 4. Camera / person-detection gates (live startup order)

1. Options zod parse `Mv` (`frame: string().min(1)`, strict) — non-fatal if incomplete.
2. `scriptIsReady$` — both `FBxLive.js` and `fbx-streamgrabber.js` must load.
3. License check `Wv` — requested mode must be in `fbx_mode` (license contains "live").
4. `startVto(e)` waits `viewerLiveCompatible$` (first non-empty `fbx_mode`) +
   `fbxliveRunning$`, then dispatches `vtoComponentSetMode({mode:e})`.
5. Mode template `c2` -> `vto-advanced-handle-disclaimer[data-testid="vtoDisclaimer-live"]`
   (live branch) -> disclaimer gate -> `vto-advanced-live`.
   - **Disclaimer gate (critical):** `showDisclaimer$` requires
     `disclaimerTerms$===null && !pr("dataPrivacyTermsAccepted")`. `pr()/Ar()`
     read localStorage under a **hostname-prefixed key**:
     `new URL(document.referrer||document.URL).hostname + "_" + name`
     i.e. `demo.fittingbox.com_dataPrivacyTermsAccepted` (the embedding site's host).
     Pre-set those keys (plus `_dataPrivacyTermsAnswerExpirationDate` far future)
     via an init script *before* the iframe app boots. Without it, the live outlet
     renders only empty `<!---->` placeholders (no error, no live component).
   - `vto-advanced-live` only renders while `noStreamAvailable$` is null/"cameraOpen";
     error UI appears on `cameraAccessDenied`/`noCameraFound` etc.
6. Camera: live video component `getUserMedia({video:{width:{ideal:4096},height:{ideal:2160}}})`
   -> `onOpenStream {success:true}`; FBxLive's own WASM call `FBxLive_openCamera({video:true})`
   (selects `deviceId==="default"`).
7. Face detection is **cloud-side**: frames are POSTed to the detection service per
   recognition attempt; `faceTracking` flips true / the glasses overlay draws only
   when the server returns a recognized face session.
   - Headless result with synthetic feeds (color test pattern, still face y4m, or
     slowly-zooming face y4m): exactly ONE detection POST, HTTP 200 with
     `recognitionState:3` (no face), `faceTracking` stays false, no overlay.
     The fake camera stream itself is fully live (video `readyState 4`, real
     non-black frames, `getSnapshot` returns real PNGs). A genuine webcam or a
     virtual-camera driver feeding real webcam frames is required for tracking.

## 5. postMessage injection vs UI clicks

- **Mode switching works via postMessage alone** (`from:"fitmix-container"`):
  `setMode {params:{mode:"viewer"}}` mounts `vto-advanced-viewer`; `{mode:"photo"}`
  enters the photo disclaimer branch; `startVto`/`setMode "live"` enters the live
  branch. Clicks on the catalog "Try" button reach the same code path.
- The demo driver itself sends `setInitializeOptions` + `startVto("live")`
  automatically after try-on -> re-posting `startVto("live")` from the parent logs
  `VtoChecklist - startVto is triggered multiple times` (harmless).
- Deterministic recipe (proven end-to-end):

```
browser args: --use-fake-ui-for-media-stream --use-fake-device-for-media-stream --no-sandbox
              (optional --use-file-for-fake-video-capture=face.y4m)
context: grant camera permission
init script: (a) localStorage.setItem(host+"_dataPrivacyTermsAccepted","true") for
                 demo.fittingbox.com / vto-advanced.fittingbox.com (+ expiration key)
             (b) record window "message" events
             (c) iframe-only: re-inject setInitializeOptions with full methods whitelist
flow: goto demo -> wait 7s -> click [data-testid="product-card-tryon"] -> wait ~20s
result: vto-advanced-live mounted; video 640x480 readyState 4; canvas 624x740 display:block;
        events onOpenStream{success:true}, onLiveStatus{hasStream:true,glassesReady:true},
        onMode "live", onUiStatus/onIssue/onCanvasResize;
        getSnapshot -> onSnapshot with a real PNG dataUrl (54 KB test pattern, 832 KB face feed).
limitation: faceTracking stays false on synthetic camera feeds (cloud detector: recognitionState:3).
```

## Supporting artifacts (scratch dir `C:\Users\ANKUR~1.SIN\AppData\Local\Temp\opencode\fbx`)

- Probes: `probe1.py`..`probe20.py` (final working flow = `probe15.py` + the
  methods-whitelist injection from `probe16.py`; face-feed variants `probe17.py`..`probe20.py`)
- Bundles: `chunk-PAMDHQME.js` (iframe app), `chunk-BKYCRZMW.js`/`chunk-R7TB4JZD.js`
  (parent integration client), `chunk-LQ5LUHZ3.js` (demo config)
- Screenshots: `live_full.png`, `live2_canvas.png`, `live3_face_full.png`, `live4_motion_full.png`
- Snapshot outputs: `snapshot_face.png`, `snapshot_motion.png`
- Synthetic camera feeds: `face.y4m` (static), `face_motion.y4m` (slow zoom)
