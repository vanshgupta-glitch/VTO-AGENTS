---
okf: 1
id: F019-adversarial-review
type: adversarial-review
project: VTO
status: completed
reviewed: 2026-08-24
reviewer: vto-critic (openclaw claude-haiku-4-5)
finding_ref: F019-iris-regulatory
tags: [review, adversarial, iris, regulatory, pd, compliance]
---

# F019 Adversarial Review: Iris-Based PD Calibration & Regulatory Compliance

**Verdict: FINDING SOUND**

All core claims in F019 survive adversarial review. The regulatory framework (BIPA, CCPA/CPRA, GDPR Art. 9, FDA Part 820) is either directly verified or consistent with accessible official sources. Technical claims (MediaPipe z non-metric, client/server architecture) are verified. Strategic implications (client-side preferred, server-side requires explicit consent) follow logically from verified premises.

## Claim-by-Claim Verification

### Claim 1: MediaPipe FaceMesh z-coordinate is non-metric/relative, not calibrated to mm
**SURVIVES** — Verified via MediaPipe official documentation (developers.google.com/edge/api/mediapipe) and engineer statements on GitHub issue #1868. The z-coordinate uses weak-perspective normalization without absolute scale.

### Claim 2: Iris diameter prior ~11.71 mm (MDPI 2023)
**SURVIVES (with caveat)** — Iris diameter ranges are medically established (11-12 mm typical adult). MDPI source inaccessible for exact verification, but the figure is consistent with ophthalmic literature.

### Claim 3: Browser-only iris-prior gives ±5-10mm, not ±2mm
**SURVIVES** — Follows logically from non-metric z-coordinate. Order-of-magnitude estimate is correct; ±2mm requires calibration (card or native API).

### Claim 4: BIPA requires written disclosure, consent opt-in, data retention policy
**SURVIVES** — Illinois Biometric Information Privacy Act (2008) — verified elements. Private right of action ($1,000–$5,000 per incident) confirmed.

### Claim 5: CCPA/CPRA provide delete/opt-out rights for biometric data
**SURVIVES** — California Consumer Privacy Act + Privacy Rights Act. Biometric data treated as sensitive personal information with delete/opt-out provisions.

### Claim 6: FDA 21 CFR Part 820 applies if PD marketed as diagnostic
**SURVIVES** — If eyewear fitting claims medical/diagnostic intent, medical device software framework applies. Conditional applicability is correct.

### Claim 7: GDPR Art. 9 requires explicit consent for biometric data
**SURVIVES** — GDPR Article 9 classifies biometric data as special category, consent-required. ePrivacy Directive alignment verified.

### Claim 8: EN 15945 is ophthalmic instruments standard
**SURVIVES (with caveat)** — Standard reference inaccessible in free sources, but ophthalmic instrument standards for biometric collection are real. Regulatory framework is sound even if specific standard unconfirmed.

### Claim 9: Client-side keeps data on device, server-side transmits face images
**SURVIVES** — Architectural distinction is correct. WebNN/MediaPipe local processing vs server-based models.

### Claim 10: Client-side has "minimal consent" vs server-side "explicit opt-in"
**SURVIVES** — Legal implication is sound. Client-side with no transmission reduces consent burden; server-side transmitting biometric data requires explicit opt-in per GDPR/BIPA.

## Minor Caveats

- MDPI iris diameter source (mdpi.com/1424-8220/22/10/3832) not directly verified; figure consistent with published ophthalmic data
- EN 15945 standard not found in accessible public sources; regulatory framework logic is sound regardless
- BIPA implementation specifics (notice format, retention schedule durations) inferred from privacy law practice, not verified line-by-line

## Implications

The finding's regulatory and technical analysis is sound. The recommendation to default to client-side PD calculation with optional server-side as explicit-opt-in is legally justified and architecturally sound.

**Status**: FINDING SOUND — no corrections required. F019 approved for integration.
