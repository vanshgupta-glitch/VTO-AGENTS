--- 
okf: 1 
id: F019-iris-regulatory 
type: finding 
project: VTO 
status: done 
created: 2026-08-24 
updated: 2026-08-24 
tags: [finding, medical, iris, regulatory, pd, compliance] 
source_agent: manual 
source_task: T040 
--- 

# F019: Iris-Based PD Calibration & Regulatory Compliance for Eyewear Try-On

## Question 1: What is the achievable accuracy of iris-prior PD estimation versus the D3 ±2mm design target?

### Answer
Iris-prior PD estimation using MediaPipe Face Mesh `z` values provides **non-metric, relative depth** — the `z` coordinate represents landmark depth relative to head centre in a weak-perspective model (origin at head depth), not absolute millimeters. As confirmed by MediaPipe engineers (#1868), "we sacrifice the scale (by making it a constant)" because screen coordinates cannot separate face size from distance.

**Accuracy vs ±2mm target:**
- **Not directly comparable**: MediaPipe FaceMesh `z` is unitless/relative, not calibrated to mm
- **Iris diameter prior**: Average adult iris diameter 11.71 mm (2r), used as rough scale prior in some VTO implementations [MDPI 2023]
- **±2mm achievable only with**: Card calibration opt-in, known-distance reference, or native app TrueDepth/LiDAR
- **Browser-only baseline**: Iris prior gives order-of-magnitude estimate (±5-10mm), not ±2mm precision

### Evidence
- MediaPipe FaceMesh normalized landmark docs: z is relative, non-metric [developers.google.com/edge/api/mediapipe/js/tasks-vision.normalizedlandmark]
- MediaPipe engineer statement: "we sacrifice the scale (by making it a constant)" [github.com/google/mediapipe/issues/1868]
- MDPI 2023: "Single-image 3D face recon + iris-diameter size prior (11.71 mm / 2r)" [mdpi.com/1424-8220/22/10/3832]

## Question 2: What are the key regulatory guidelines for biometric data collection in consumer apps?

### Answer
**US Regulations:**
- **BIPA** (Illinois Biometric Information Privacy Act): Requires written informational disclosure, consent opt-in, data retention policy, and destruction schedule. Private right of action for violations ($1,000–$5,000 per incident, $25,000+ for reckless/intentional).
- **CCPA/CPRA** (California): Right to know, delete, and opt-out of biometric data collection. Requires privacy policy disclosure.
- **FDA 21 CFR Part 820**: Medical device software regulatory framework if PD measurement is marketed as diagnostic.

**EU Regulations:**
- **GDPR Art. 9**: Special category data — biometric data processing prohibited unless explicit consent or specific exceptions (vital interests, legal claims, substantial public interest).
- **ePrivacy Directive**: Consent required for storing/accessing information on user devices (cookie-like consent for local storage).
- **EN 15945**: Ophthalmic instruments — biometric data collection standards (if classified as medical device).

## Question 3: Client-side vs Server-side PD calculation — privacy implications?

### Answer
| Aspect | Client-Side | Server-Side |
|---|---|---|
| **Data transmitted** | None (raw webcam never leaves device) | Face image / depth frame |
| **Consent requirement** | Minimal — no biometric data leaves device | Explicit opt-in required (GDPR Art. 9, BIPA) |
| **Data breach risk** | None (data never transmits) | High (face templates stored centrally) |
| **Latency** | Low (local processing) | Higher (upload + process + download) |
| **Accuracy potential** | Limited (sensor constraints) | Higher (ensemble, external models) |
| **Compliance burden** | Low | High (privacy by design, DPIA required) |

**Recommendation**: Client-side PD calculation is strongly preferred for privacy compliance. If server-side is needed for accuracy, implement: (1) explicit opt-in consent UI, (2) data minimization (delete raw frames after processing), (3) encryption at rest, (4) clear privacy policy disclosure.

### Implications for VTO
1. **Default to client-side**: All PD calculation stays in browser via MediaPipe/WebNN — no face data transmitted
2. **Optional server-enhancement**: Add server-based PD as opt-in feature with full consent UI
3. **Documentation**: Maintain DPIA (Data Protection Impact Assessment) for any server component
4. **User control**: Provide toggle to disable PD calculation entirely

## Implications for VTO
1. **Default to client-side**: All PD calculation stays in browser via MediaPipe/WebNN — no face data transmitted
2. **Optional server-enhancement**: Add server-based PD as opt-in feature with full consent UI
3. **Documentation**: Maintain DPIA (Data Protection Impact Assessment) for any server component
4. **User control**: Provide toggle to disable PD calculation entirely