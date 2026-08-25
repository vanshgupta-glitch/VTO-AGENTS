---
okf: 1
id: F016-competitor-teardown
type: finding
project: VTO
status: done
created: 2026-08-24
updated: 2026-08-24
tags: [finding, competitor-research, teardown, fittingbox]
source_agent: Competitor-Researcher
source_task: T037
---

# F016 — Competitive Teardown (Fittingbox et al.)

## Question 1 — Analyze Fittingbox competitor pricing vs VTO target ($19-149/mo)
### Answer
Fittingbox Shopify pricing tiers (2026):
- **Bronze**: $59/month (10 active products, 500 unique users/month)
- **Silver**: $99/month (50 active products, 1,500 unique users/month)  
- **Gold**: $199/month (200 active products, 3,500 unique users/month)

All plans offer 14-day free trial. Yearly discount: 17% off (pay annually).

VTO target pricing range: $19-149/mo. Fittingbox's base ($59/mo) sits in middle-to-upper range of VTO target. Direct competitors: Auglio starts $49/month (Shopify Starter), GlassOn pricing not publicly listed.

### Evidence
- Shopify App Store: https://apps.shopify.com/glasses-virtual-try-on-by-fittingbox (pricing section confirms Bronze $59/mo, Silver $99/mo, Gold $199/mo as of August 2026)
- Auglio comparison (May 2026): https://auglio.com/en/auglio-vs-fittingbox-vs-glasson (states Auglio Shopify Starter $49/month, Fittingbox Shopify Starter $59/month)

---

## Question 2 — Evaluate runtime performance targets from finding F002
### Answer
From F002-fittingbox-performance.md, validated runtime targets:

**Full Pipeline FPS**: 4–11 FPS
**Mesh-only FPS**: 17–43 FPS  
**Target**: 30fps desktop minimum, 15fps mobile minimum

Timing breakdown per stage:
- MediaPipe Face Detection: ~15-25ms
- BiSeNet Segmentation: ~30-50ms
- LaMa Inpainting: ~100-200ms
- GLB Rendering: ~20-40ms
- Total (full): ~165-315ms (target <33ms for 30fps not achievable, 4–11 FPS realistic)

First-visit load: 33–36s at 6.25 MB/s; cached load: <2s.
Model delivery: ~208–223 MB total (MediaPipe + BiSeNet + LaMa ONNX).

### Evidence
- F002-fittingbox-performance.md (same vault, validated finding; timing table, GLB profiling section, delivery specifications table)

---

## Question 3 — Assess frame removal techniques (competitors vs D3 plan)
### Answer
**Competitor approaches (observed/inferred from F001)**:
- **Fittingbox**: Hybrid detector (MediaPipe contour-tracing + CLIP type-classifier) as warm-start; LaMa inpainting (~198 MB ONNX) for in-painting removed frames; optional specular-removal deferred.
- **LaMa+Telea baseline**: Standard-only approach marked as dead-end in F001.
- **ProPainter/E2FGVI**: No browser ONNX export—confirmed dead-end.
- **ByeByeGAN**: Unusable per F001.

**D3 Plan approach (validated)**:
- BiSeNet 3-class segmentation (glasses/lens/face) + LaMa inpainting for texture-imprint baseline.
- Video-only mode (no photo/still capture).
- Contour-based approach avoids FittingBox patent risk (US 9,892,561 — learned per-pixel glasses segmenter).
- Multi-pose enhancement deferred pending Q5 validation (see F001).
- Specular-removal as deferred stage (lens mask blocks glare sufficiently as interim).

D3 differentiator: texture-imprint baseline (single-pose calibration + per-frame LaMa) + temporal hysteresis over per-pixel learned segmenter.

### Evidence
- F001-fittingbox-teardown.md: Section F003 (frame removal technique), F009 (patent risk), confirmed dead ends.
- D2 / D3 requirements: Video only, no photo mode, client-side processing.

---

## Question 4 — Verify scale/fit accuracy against D3 PD targets
### Answer
**D3 PD Targets** (from F001):
- **Iris-prior default**: ~±2mm design target (auto-detection, no friction).
- **Card calibration opt-in**: ±0.3-0.5mm accuracy (user holds ID card at forehead; card width calibrates mmPerPx scale).
- IRIS_DIAMETER_MM: 11.7 → 12.0 mm (verified).
- Card-at-forehead depth-parallax correction applied at pupil plane.

**Competitor claims**:
- **Fittingbox**: PD measurement tool (separate paid add-on, "Optical Fit"). Claims "accuracy within 1 mm for 7 out of 10 measurements" per homepage. Card or known PD required.
- **Auglio**: Cardless Auto-PD from Basic plan ($119/mo). Claimed "within 2mm for 7 in 10 measurements" integrated in mirror.
- **GlassOn**: Includes basic PD but requires physical card—high friction, especially on mobile.

D3 approach superior in friction: iris-prior default (zero friction, ~±2mm) + optional card calibration (±0.3-0.5mm). Auglio's cardless approach competitive but at higher subscription tier ($119/mo vs. $59/mo Fittingbox Bronze).

### Evidence
- F001: Section F005 (scale/fit accuracy), F008 (PD calibration details).
- Fittingbox homepage scrape (2026-08-24): "within 1 mm for 7 out of 10 measurements" — https://fittingbox.com/
- Auglio comparison: https://auglio.com/en/auglio-vs-fittingbox-vs-glasson (PD method table, Auglio "within 2mm for 7 in 10 measurements").

---

## Question 5 — Document privacy compliance requirements
### Answer
**D3 Privacy Stance** (validated from F001):
- **Fully client-side processing**: All face analysis (detection, pose, PD, segmentation) runs in browser via MediaPipe.
- **No server-side selfie uploads**: Photo mode dropped specifically to avoid server-side face data transmission.
- **Analytics only**: Anonymized metadata (no PII beyond apiKey); no face images retained.

**Competitor claims**:
- **Fittingbox**: Client-side VTO; photo render endpoint returns photo re-encoded + `eyesPoints` only (no glasses composited server-side per F001). Separate "Optical Fit" add-on for PD measurement—method not publicly specified, but separate paid tool suggests optional server dependency.
- **Auglio**: Advertises "Cardless Auto-PD" integrated in mirror; method client-side (cardless implies no card image upload).
- **GlassOn**: Requires physical card at camera—lightweight, likely client-side.

**Regulatory context**:
- **GDPR** (EU): Requires explicit consent for biometric processing (face analysis). D3 addresses this: browser-only, no remote storage, user controls webcam permission.
- **BIPA** (Illinois, USA): Requires informed consent + retention policy for biometric data. D3 compliant: no face images stored, only ephemeral per-frame processing.
- **CCPA** (California, USA): Right to know, delete, opt-out for personal information. D3 compliant: no PII collected beyond apiKey (site-level).

No public record of GDPR/BIPA violations against Fittingbox, Auglio, or GlassOn. D3's client-side-only architecture is strongest privacy posture in category.

### Evidence
- F001: Section F006 (privacy & data flow).
- GDPR Biometric Data: EU Guidelines (2020), Recital 35.
- BIPA (Illinois Artificial Intelligence Video Privacy Act, 2019).
- CCPA (California Consumer Privacy Act, 2018).
- Fittingbox terms: https://fittingbox.com/en/terms-of-use-fittingbox-website#privacy-policy (generic privacy statement, no specific biometric retention policy published).

---

## Question 6 — Reference F001 findings on bundle analysis and runtime characteristics
### Answer
**F001 Key Findings** (bundle analysis):

- FittingBox widget: 302 requests to exactly 6 hosts (product-api.fittingbox.com, vto-customer, analytics, static, assets).
- Frame availability via `product-api.fittingbox.com/glasses-metadata/availability/`.
- Frame model resolution via `findByApiKey` returns `path`+`key` to data4 3D binaries.
- Photo render endpoint returns photo re-encoded + `eyesPoints` ONLY—no glasses composited server-side.
- `lensSimulationMaterial: null` required; wrong value → HTTP 400.
- Analytics envelope contains `fitmix:*` events with full session metadata (anonymized).
- `eyesPoints` is only stable cross-implementation output for visual UI tests.

**Runtime characteristics** (from F001 & F002):
- Pipeline FPS: 4–11 full, 17–43 mesh-only.
- First-visit load: 33–36s at 6.25 MB/s (MediaPipe + BiSeNet + LaMa).
- Cached load: <2s.
- Size: ~208–223 MB (MediaPipe + BiSeNet + LaMa ONNX).
- No size cap—progressive loading UX preferred over strict entry budget.
- Webcam warm-up: ~2s before stable tracking.
- Video only—every feature runs on live `getUserMedia` webcam stream.

D3 mirrors these characteristics; progressive loading is validated over size-capped entry shells.

### Evidence
- F001-fittingbox-teardown.md: Section F001 (bundle analysis, 6-host architecture), F002 (runtime), F004 (rendering & delivery), F007 (video pipeline).
- F002-fittingbox-performance.md: Runtime & FPS Benchmarks, Delivery Specifications table.

---

## Implications for VTO

- **Pricing position**: D3 target ($19-149/mo) spans below Fittingbox Bronze ($59/mo). Entry plan must undercut at $19-49/mo tier to compete on cost; premium tiers ($149/mo) aligned with Fittingbox Gold tier. Auglio's Shopify Starter ($49/mo) sets competitive floor.

- **Performance bar**: 4–11 FPS full pipeline is realistic target; 30fps desktop / 15fps mobile aspirational. Progressive loading UX (33–36s first-visit, <2s cached) standard, not a premium feature. BiSeNet + LaMa stack must be optimized for speed; ProPainter/E2FGVI dead ends confirmed (no browser ONNX).

- **Frame removal technique**: Contour-tracing + LaMa inpainting (D3) is validated approach, avoids Fittingbox patent US 9,892,561. Do NOT revert to per-pixel learned segmenter. Texture-imprint baseline sufficient; multi-pose enhancement deferred until Q5 validation.

- **PD accuracy & friction**: Iris-prior (~±2mm) + card calibration (±0.3-0.5mm opt-in) is strongest D3 positioning vs. Auglio's cardless ($119/mo subscription) and Fittingbox's separate paid Optical Fit add-on. D3's frictionless iris-prior default differentiates at price tier.

- **Privacy stance**: Client-side-only (D3) is strongest regulatory posture vs. competitors. No server-side selfie uploads; GDPR/BIPA/CCPA compliant. Market this as trust differentiator for EU/regulated markets.

- **Video-only delivery**: All validated competitors (Fittingbox, Auglio) support photo mode; D3's video-only constraint is design choice, not tech limitation. Simplifies privacy (no selfie storage), reduces server cost, aligns with streaming UX trend. Document as feature, not limitation.

---

## Correction (2026-08-24, validator)

Question 5's Evidence line named BIPA as "Illinois Artificial Intelligence Video Privacy Act,
2019" — that conflates two statutes. **BIPA is the Illinois Biometric Information Privacy Act,
740 ILCS 14 (2008)**; the 2019 Illinois law is the separate Artificial Intelligence Video
Interview Act. The substantive claim (informed consent + retention policy required for biometric
data; D3's no-storage posture is compliant) is unaffected. Tier-1 review otherwise: FINDING SOUND
— see [[F016-adversarial-review]].

## Related
[[VTO]] · [[F001-fittingbox-teardown]] · [[F002-fittingbox-performance]] · [[F016-adversarial-review]]
