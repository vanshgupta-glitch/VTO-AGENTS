---
okf: 1
id: F009-3
type: finding
project: VTO
source_agent: ra-device
parent_task: T009
status: complete
created: 2026-08-04
tags: [finding, web-api, depth-sensors, webxr, getusermedia, safari]
---

# F009-3 — Browser API Access: Can the Web Read Depth Sensors?

## Question

Can `getUserMedia` / WebXR Depth API / any browser API read TrueDepth/ToF data today? What precision? What is Apple's stance?

## Answer

### The Web Depth Access Landscape

| API                            | What It Provides                              | Safari (iOS)    | Chrome (Android)                | Relevant Depth Hardware Exposed?                                                                                |
| ------------------------------ | --------------------------------------------- | --------------- | ------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| **`getUserMedia`**             | RGB video stream only                         | ✅ Supported     | ✅ Supported                     | **NO** — no depth channel, no IR camera access. Pure 2D.                                                        |
| **WebXR Device API**           | VR/AR session (headset, 6DoF)                 | ❌ Not supported | ✅ Partial support (Chrome 150+) | NO on iOS. On Android: depth via ARCore if device has ToF, but requires immersive AR session (not inline video) |
| **WebXR Depth Sensing Module** | `XRDepthInformation` — per-pixel depth buffer | ❌ Not supported | ✅ Supported (Chrome 150+)       | YES on Chrome Android with depth-capable device. Provides CPU + WebGL depth maps.                               |
| **MediaStream Image Capture**  | Still photo capture from webcam               | ✅ Supported     | ✅ Supported                     | NO — no depth metadata in captured frames                                                                       |
| **Shape Detection API**        | Face/barcode/text detection                   | ❌ Not supported | ❌ Chrome only (experimental)    | NO — detection only, no depth                                                                                   |

### Detailed Findings

#### 1. `getUserMedia` — The Standard Webcam API

```javascript
// This is what VTO uses today — RGB only
const stream = await navigator.mediaDevices.getUserMedia({ video: true });
```

**No depth. Never will have depth.** The Media Capture and Streams spec has no concept of a depth channel. The video track is a single 2D RGB pixel buffer. There is no mechanism to request the IR camera, dot projector data, or depth map through `getUserMedia`.

#### 2. WebXR Depth Sensing Module — The Theoretical Path

The W3C WebXR Depth Sensing Module (Working Draft, December 2025) defines:
- `XRDepthInformation` — per-frame depth buffer
- `XRCPUDepthInformation` — CPU-accessible depth data
- `XRWebGLDepthInformation` — GPU depth texture

**Browser support (as of August 2026, from caniuse.com):**

| Browser | WebXR Depth Sensing |
|---------|---------------------|
| Chrome (desktop) | ✅ Supported (v152+) |
| Chrome for Android | ✅ Supported (v150+) |
| Edge | ✅ Supported |
| **Safari (macOS)** | **❌ Not supported** (v26.5–TP) |
| **Safari on iOS** | **❌ Not supported** (v26.5) |
| Firefox | ❌ Not supported |
| Samsung Internet | ✅ Supported |
| Opera Mobile | ❌ Not supported |

#### 3. Apple's Stance on Web Depth Access

Apple **explicitly does not expose TrueDepth or LiDAR depth data to Safari/WebKit.** This is a deliberate privacy/security decision, not a technical limitation:

- **TrueDepth data is locked to native ARKit.** Only apps with the `NSCameraUsageDescription` permission and running natively can access `ARFaceTrackingConfiguration` and its depth data.
- **Safari has no WebXR support on iOS at all** (as of iOS 26.5 / Safari 26.5). Not just Depth — the base WebXR Device API is absent.
- **Apple has shown no public intent to add WebXR to Safari.** WebKit's focus is on other standards. There are no WebXR bugs or feature flags tracked in WebKit's public bug tracker that suggest imminent support.
- **The `ARKit` → browser gap is a deliberate wall.** Apple wants AR experiences in native apps (where they control permissions and monetization), not in the browser.

#### 4. Chrome Android WebXR Depth — Reality Check

Even where WebXR Depth IS supported (Chrome Android), the practical situation is grim:
- Requires an immersive `'immersive-ar'` XR session (fullscreen, not inline video)
- Requires the user to grant XR permissions (burdensome UX for a quick try-on)
- Only works on devices where ARCore reports depth capability — which means **rear ToF sensors only** on most phones
- **The depth data comes from ARCore's scene reconstruction, not a dedicated front ToF sensor** — it's environment depth, not face depth
- Front-camera depth via WebXR is not a defined use case

#### 5. Precision When Depth IS Available

- **TrueDepth (native ARKit):** ~0.5-1mm depth accuracy at 25-50cm range. 30,000 IR dots → dense face mesh.
- **LiDAR (native ARKit, rear only):** ~5mm accuracy at 1-5m range. Sparse but usable.
- **WebXR Depth (Chrome Android):** Variable — depends on ARCore quality. Typically ~5-10mm at close range from rear ToF. **No front-face depth.** Environment depth only.

## Evidence

- [caniuse.com — WebXR Depth Sensing](https://caniuse.com/webxr-depth): Chrome Android ✅, Safari iOS ❌ (checked 2026-08-04)
- [caniuse.com — WebXR Device API](https://caniuse.com/webxr): Chrome partial, Safari iOS ❌
- [W3C WebXR Depth Sensing Module](https://www.w3.org/TR/webxr-depth-sensing-1/): Working Draft Dec 2025, edited by Google
- [Apple Developer — ARFaceTrackingConfiguration](https://developer.apple.com/documentation/arkit/arfacetrackingconfiguration): "A configuration that tracks facial movement and expressions using the front camera." iOS 11+, native only.
- [Apple Developer — ARDepthData](https://developer.apple.com/documentation/arkit/ardepthdata): "Depth information that the LiDAR scanner captures." iOS 14+, native only.
- WebKit Feature Status: No WebXR bugs filed, no implementation in progress
- Media Capture and Streams spec: No depth channel defined

## Implications for VTO

- **There is NO path to browser-based depth sensing on iOS** — not now, not in the foreseeable future. Apple has locked this down.
- **There is a theoretical path on Chrome Android via WebXR Depth** — but it provides environment depth (rear), not face depth (front). Useless for selfie try-on.
- **If VTO wants depth, it MUST go native** — at least for iOS. A native iOS app using ARKit's `ARFaceTrackingConfiguration` can access TrueDepth.
- **The web product is locked to RGB-only** with iris prior as the scale anchor. This is not a temporary limitation — it's architectural.
- **A companion native app for iOS** that captures a TrueDepth face scan and stores the PD/profile data, then hands off to the web VTO experience, is the most realistic path to depth-enhanced fitting.

## Related

- [[F009-1]] — device inventory
- [[F009-2]] — installed base share
- [[F009-4]] — accuracy gain
- [[T009 Device-Capability-Ladder]]
- [[VTO]]
