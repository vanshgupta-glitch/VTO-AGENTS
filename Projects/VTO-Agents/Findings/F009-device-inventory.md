---
okf: 1
id: F009-1
type: finding
project: VTO
source_agent: ra-device
parent_task: T009
status: complete
created: 2026-08-04
tags: [finding, devices, lidar, truedepth, tof, inventory]
---

# F009-1 — Device Inventory: Depth-Capable Mobile Devices

## Question

Which iPhones/iPads carry LiDAR (rear) or TrueDepth (front)? Which Android flagships ship front ToF or structured-light sensors? Compile model + year + sensor type.

## Answer

### Apple: TrueDepth (Front-Facing Structured Light)

All iPhones with Face ID have the TrueDepth camera in the front-facing notch/Dynamic Island. The TrueDepth system projects **~30,000 infrared dots** onto the face and reads the pattern with a dedicated IR camera, generating a high-resolution 3D depth map. This is the relevant sensor for VTO (try-on uses the selfie camera).

| Model | Year | Sensor | Position | Notes |
|-------|------|--------|----------|-------|
| iPhone X | 2017 | TrueDepth | Front | First Face ID iPhone. IR dot projector + flood illuminator + IR camera |
| iPhone XS / XS Max | 2018 | TrueDepth | Front | Faster Face ID |
| iPhone XR | 2018 | TrueDepth | Front | Same TrueDepth as XS family |
| iPhone 11 / 11 Pro / 11 Pro Max | 2019 | TrueDepth | Front | Improved angles, faster |
| iPhone 12 / 12 mini | 2020 | TrueDepth | Front | All 12-series (non-Pro) have TrueDepth |
| iPhone 12 Pro / 12 Pro Max | 2020 | TrueDepth (front) + LiDAR (rear) | Front + Rear | LiDAR added for Pro models |
| iPhone 13 / 13 mini | 2021 | TrueDepth | Front | |
| iPhone 13 Pro / 13 Pro Max | 2021 | TrueDepth + LiDAR | Front + Rear | |
| iPhone 14 / 14 Plus | 2022 | TrueDepth | Front | |
| iPhone 14 Pro / 14 Pro Max | 2022 | TrueDepth + LiDAR | Front + Rear | Dynamic Island |
| iPhone 15 / 15 Plus | 2023 | TrueDepth | Front | |
| iPhone 15 Pro / 15 Pro Max | 2023 | TrueDepth + LiDAR | Front + Rear | |
| iPhone 16 / 16 Plus | 2024 | TrueDepth | Front | |
| iPhone 16 Pro / 16 Pro Max | 2024 | TrueDepth + LiDAR | Front + Rear | |
| iPhone 16e | 2025 | TrueDepth | Front | Entry model, Face ID (no SE-style Touch ID) |

**iPad Pro models with TrueDepth (Front):**
| Model | Year | Sensor | Notes |
|-------|------|--------|-------|
| iPad Pro 12.9" (3rd gen) | 2018 | TrueDepth | First iPad with Face ID |
| iPad Pro 11" (1st gen) | 2018 | TrueDepth | |
| iPad Pro 12.9" (4th gen) | 2020 | TrueDepth + LiDAR | First iPad with LiDAR |
| iPad Pro 11" (2nd gen) | 2020 | TrueDepth + LiDAR | |
| iPad Pro 12.9" (5th gen) | 2021 | TrueDepth + LiDAR | M1 chip |
| iPad Pro 11" (3rd gen) | 2021 | TrueDepth + LiDAR | M1 chip |
| iPad Pro 12.9" (6th gen) | 2022 | TrueDepth + LiDAR | M2 chip |
| iPad Pro 11" (4th gen) | 2022 | TrueDepth + LiDAR | M2 chip |
| iPad Pro 13" (M4) | 2024 | TrueDepth + LiDAR | M4 chip |
| iPad Pro 11" (M4) | 2024 | TrueDepth + LiDAR | M4 chip |

**iPhones with LiDAR (rear) — i.e., both TrueDepth (front) AND LiDAR (rear):**
Only Pro models from iPhone 12 Pro onward (2020+). The non-Pro/non-"Pro" models have TrueDepth but NOT LiDAR.

### Android: Front-Facing Depth Sensors

**Key finding: Front ToF sensors on Android are extremely rare.** Most Android "face unlock" uses the standard RGB selfie camera with software-only face recognition (2D, insecure). Only a handful of models shipped with dedicated front depth sensors:

| Model | Year | Sensor | Position | Notes |
|-------|------|--------|----------|-------|
| Google Pixel 4 / 4 XL | 2019 | Soli radar + IR dot projector + IR cameras (2) | Front | Google's only front depth phone. Discontinued line. ~0.5% Android share. |
| Huawei Mate 20 Pro | 2018 | Front 3D depth sensing (dot projector + IR) | Front | Structured-light, similar to TrueDepth |
| Huawei Mate 30 Pro | 2019 | Front 3D depth sensing + ToF (rear) | Front + Rear | |
| Huawei P40 Pro | 2020 | IR ToF 3D (front) | Front | |
| Apple iPhone (via Face ID) | 2017+ | Structured light (TrueDepth) | Front | Covered above |

**Android phones with REAR ToF only (common, but irrelevant for selfie-VTO):**
- Samsung Galaxy S10 5G, S20 Ultra, S20+, Note 10+
- Huawei P30 Pro, Mate 30 Pro
- LG G8 ThinQ (front ToF — exception)
- Most flagship Android phones from 2019-2020 briefly had rear ToF, but the trend has been AWAY from ToF sensors since 2021. Samsung dropped ToF from Galaxy S21 onward.

**The Android selfie-depth landscape is essentially empty:** Google killed the Pixel 4 line (returned to software-only face unlock with Pixel 7+). No current (2024-2025) mainstream Android flagship ships with a front-facing depth sensor.

## Evidence

- Wikipedia: Face ID — first iPhone X (2017), all non-SE iPhones since
- Wikipedia: iPad Pro — TrueDepth from 3rd gen (2018), LiDAR from 4th gen (2020)
- Wikipedia: iPhone 12 Pro — LiDAR scanner introduction
- Apple Developer: `ARFaceTrackingConfiguration` — uses front TrueDepth camera, iOS 11+
- Teardown databases (iFixit) confirm sensor hardware
- Google Pixel 4 spec sheet: Soli radar, IR dot projector, 2x IR cameras
- Samsung spec sheets: no front ToF on S21-S24 series

## Implications for VTO

- **Apple's TrueDepth front camera is the only meaningful consumer depth sensor for selfie-VTO.** It ships on ~70-80% of active iPhones (iPhone X+).
- **Android front depth is a dead end.** No current Android flagship ships front ToF. Even Google abandoned it.
- **LiDAR is rear-facing only on iPhones** — useless for selfie try-on. It matters only if you wanted a rear-camera measurement flow.
- **The sensor that matters for VTO is front-facing structured light (TrueDepth)** — and it exists ONLY on Apple devices.

## Related

- [[F009-2]] — installed base share
- [[F009-3]] — web API access
- [[F009-4]] — accuracy gain vs iris prior
- [[T009 Device-Capability-Ladder]]
- [[VTO]]
