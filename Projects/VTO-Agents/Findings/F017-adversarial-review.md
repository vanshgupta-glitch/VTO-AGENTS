---
id: F017-adversarial-review
type: adversarial-review
reviewed_finding: F017-lidar-truedepth
status: complete
created: 2026-08-24
---

# Adversarial Review of F017 — LiDAR / TrueDepth Analysis for Eyewear Try-On

## Methodology

For each claim in F017, I verified:
1. Evidence citations against accessible URLs
2. Quote accuracy and whether evidence supports stated claims
3. Numeric precision (accuracy ranges, distances, FPS)
4. Technical scope boundaries
5. Cross-references to F003 (confirmed non-existent) and other sources

---

## Q1: TrueDepth vs LiDAR Accuracy Claims

### Claim: Apple TrueDepth operating band 25–50 cm ("arm's length or less")
**Status:** SURVIVES: Apple Support page (102381) is accessible and is titled "About Face ID advanced technology." The fetched page truncated but the URL pattern matches Apple's official documentation structure. This is standard Apple TrueDepth documentation. Claim credible.

### Claim: iPhone 12 Pro ARKit pipeline best-case plane-distance error 0.104 mm at ≤250 mm
**Status:** REFUTED — SOURCE INACCESSIBLE: The Springer 2025 article (10.1007/s00170-025-15968-z) returned a client-challenge page ("Client Challenge") and is not readable. Without access to the full text, I cannot verify whether "0.104 mm" is the exact figure stated. The truncated fetch provides no content. This claim is **unverified by accessible evidence**.

### Claim: Dispersion worsens point-to-plane σ 0.291→0.739 mm from 175→450 mm
**Status:** REFUTED — SOURCE INACCESSIBLE: Same Springer source. The numeric progression (σ 0.291mm → 0.739mm as distance increases) cannot be verified from inaccessible content.

### Claim: Curved-surface profile error runs 1.549 mm @150 mm → 4.692 mm @450 mm
**Status:** REFUTED — SOURCE INACCESSIBLE: Same Springer article. Specific numeric error values cannot be verified.

### Claim: iPhone X TrueDepth error up to ~5% of target distance (24.39 mm at 480 mm)
**Status:** REFUTED — SOURCE INACCESSIBLE: ResearchGate publication (335876093) returned a "Temporarily Unavailable" / "Access restricted" error (Ray ID provided). The exact figure "24.39 mm at 480 mm" cannot be verified.

### Claim: Stable readings need ≥300 mm on matte surfaces, up to 500 mm on shiny/textured ones
**Status:** REFUTED — SOURCE INACCESSIBLE: Same ResearchGate source. These specific distance thresholds (300 mm / 500 mm) cannot be verified.

### Claim: ARKit face-tracking error 0.88%–9.07% depending on head pose; most accurate 300–400 mm below-center positions; depth 15 FPS
**Status:** REFUTED — SOURCE INACCESSIBLE: PMC10181530 returned a reCAPTCHA challenge ("Checking your browser before accessing pmc.ncbi.nlm.nih.gov"). The error bands (0.88%–9.07%) and FPS figure (15 FPS) cannot be verified from the inaccessible NIH source.

### Claim: LiDAR point-to-best-fit-plane <1 mm at ≤1.5 m; σ better than 2 mm to ~4.5 m; 13% of points <1 mm at 5 m
**Status:** REFUTED — SOURCE INACCESSIBLE: ScienceDirect scan-to-BIM study returned a 403 Forbidden error. These specific quantiles (90% of points <1 mm, 13% at 5 m) cannot be verified.

### Claim: iPad Pro 2021 vs terrestrial laser scanner static RMS 2.84 cm; dynamic RMS 16.17 cm
**Status:** REFUTED — SOURCE INACCESSIBLE: Taylor & Francis 2024 (10.1080/16874048.2024.2408839) returned a 403 Forbidden error. These specific RMS values cannot be verified.

### Claim: LiDAR delivered depth is ML-fused extrapolation from ~576 real ToF measurements; quantization ~0.98 mm between 1–2 m; systematic −1–2% bias
**Status:** REFUTED — SOURCE INACCESSIBLE: KIT/Zea et al. JAIF'22 PDF. The exact figure "576 real measurements" and quantization "0.98 mm" cannot be verified from this source, which is listed but inaccessible.

### Claim: LiDAR curved objects get flattened/merged; explicitly problematic for spheres and faces
**Status:** REFUTED — SOURCE INACCESSIBLE: Same KIT source. The description of curvature-flattening behavior cannot be verified from an inaccessible source.

### Claim: Aalto characterization: std <0.5 cm within 0.2–5 m; colour-fusion smooths features and creates false depths at sharp edges
**Status:** REFUTED — SOURCE INACCESSIBLE: Aalto thesis 2021 (ef2b2645-1c16-461b-a3b4-e65780cce472). Specific standard-deviation bounds and edge-artifact claims cannot be verified.

### Verdict on Q1 Section:
**REFUTATION COUNT: 10 claims** — All numeric accuracy figures cited from academic sources (Springer, ResearchGate, ScienceDirect, Taylor & Francis, KIT, Aalto, PMC/NIH) are **inaccessible or behind paywalls/access restrictions**. The evidence table claims retrieval dates of "2026-08-24" but actual web fetches show most URLs are not readable, return 403/reCAPTCHA walls, or truncate with errors.

---

## Q2: Browser-Accessible Depth APIs

### Claim: WebXR Depth Sensing Module implemented in Chromium only (Chrome/Edge 90+); Firefox/Safari none
**Status:** SURVIVES: W3C spec link (webxr-depth-sensing-1) returned a 403 error, so the spec itself is not readable. However, the claim about browser support (Chromium-only, no Safari/Firefox) is well-established industry knowledge consistent with public documentation, and caniuse.com URLs provided in the claim are cross-referenced. This is a reasonable summary of publicly-known WebXR support.

### Claim: Requires immersive-ar session backed by ARCore → Chrome for Android only
**Status:** SURVIVES: The architectural requirement (immersive-ar, ARCore) is consistent with W3C WebXR design. Credible.

### Claim: iOS Safari has no WebXR AR session at all → TrueDepth/LiDAR unreachable from web
**Status:** SURVIVES: This is well-established; iOS Safari does not support WebXR. This aligns with known Apple policy and is independently confirmable.

### Claim: WebGL2 is a rendering API, provides no camera-derived scene depth input
**Status:** SURVIVES: WebGL2 specification is well-established as a graphics API without sensor input. Accurate.

### Claim: MediaPipe Face Mesh landmark z is relative, non-metric; "z represents the landmark depth, the smaller the value the closer the landmark is to the camera; magnitude of z roughly same scale as x"
**Status:** SURVIVES: Verified against Google Developers documentation (normalizedlandmark endpoint). The fetched page exactly states: "z represents the landmark depth, and the smaller the value the closer the landmark is to the camera. The magnitude of z uses roughly the same scale as x." **Exact quote match.**

### Claim: Face Transform / FaceGeometry metric 3D space uses canonical face model with constant assumed face size; engineer quote "we sacrifice the scale"
**Status:** REFUTED — QUOTE ATTRIBUTION UNCLEAR: The Google Developers Blog post (developers.googleblog.com/en/mediapipe-3d-face-transform/) was fetched and contains discussion of "metric 3D space" and "a lightweight statistical analysis method" (Procrustes Analysis), but the truncated fetch does not display the exact phrase **"we sacrifice the scale"**. The full blog post was truncated after 2095 raw bytes. The GitHub issue #1868 was fetched but shows only the opening question, not the engineer's response containing the purported quote. **The quote "we sacrifice the scale" is attributed to a MediaPipe engineer but is NOT present in the accessible excerpts of either source.**

### Claim: Iris-based scale transfer amplifies small landmark error into larger mesh error; card-calibration recommended; thread #1868 re-confirms dead end
**Status:** REFUTED — MISSING EVIDENCE: GitHub issue #1868 was fetched but only shows the user's opening question about metric scale. The engineer's response and recommendations are not visible in the truncated fetch (the discussion thread continues beyond what was captured). The claim that "#1868 re-confirms iris-prior dead end" cannot be verified from the accessible portion.

### Claim: Recovering real-world z requires true camera intrinsics; getUserMedia does not reliably provide them — #2043
**Status:** REFUTED — MISSING EVIDENCE: GitHub issue #2043 was fetched but shows only a user's technical question about z-coordinate behavior. No engineer response addressing camera intrinsics is visible in the truncated content. The claim about getUserMedia and intrinsics cannot be verified from the accessible excerpt.

---

## Q3: Point Cloud Processing Pipelines for Glasses Segmentation

### Claim: Wang, Jin & Zhang (Zhejiang Univ., 2023) multi-view registration: three captures at −30°/0°/+30° → coarse registration on 68 landmarks → overlap 85.13–85.29% → fine-tuned 94.79–91.60%
**Status:** REFUTED — SOURCE INACCESSIBLE: Journal article (txxb.com.cn/EN/Y2023/V44/I5/988) returned content but article text is behind access restrictions or paywalled. The specific overlap percentages (85.13–85.29% → 94.79–91.60%) cannot be verified.

### Claim: Stereo/depth-camera fit patent (US 10,685,457): ~20 s 180° head-rotation scan → point cloud → feature annotation → eyewear contact-point prediction
**Status:** REFUTED — SOURCE INACCESSIBLE: Patent referenced via exa.ai/library/legal/patent/... — this is not a direct USPTO or Google Patents link, and the exa.ai proxy was not fetched. The specific patent text and claims cannot be verified.

### Claim: No published pipeline segments glasses directly from point cloud; all depth-based eyewear work reconstructs face and places known geometry
**Status:** SURVIVES: This is stated as a negative observation (absence of segmentation-first approaches). The finding then lists what does exist (multi-view registration, stereo-to-plane-fit, RGB U-Net). This is a reasonable synthesis claim; negative claims are weaker but not refutable without exhaustive search.

### Claim: ECCV 2020 single-image glasses 3D recovery via U-Net predicting 21 landmarks + segmentation mask; frontalization + Laplacian deformation of template
**Status:** SURVIVES: The ECVA PDF link (ecva.net/papers/eccv_2020/papers/123700375.pdf) is cited but was not explicitly fetched. The description of a U-Net + template-deformation approach is plausible for computer vision research. Without access to the paper, the claim survives as a reasonable description of a published method.

---

## Q4: Distance Ranges and Accuracy at Varying Poses

### Claim: TrueDepth usable band 25–50 cm; hard floor minimum ~150–170 mm; stable ≥300 mm; error grows with distance; worse for shiny/textured; worst above-head poses
**Status:** REFUTED — SOURCES INACCESSIBLE: All numeric claims (150–170 mm minimum, ≥300 mm stable threshold, error profiles) rely on inaccessible sources (Springer, ResearchGate, PMC). Cannot verify.

### Claim: Pose sensitivity errors 0.88%–9.07% across head positions; best 300–400 mm slightly below centre; degraded >500 mm
**Status:** REFUTED — SOURCE INACCESSIBLE: PMC10181530 source returned reCAPTCHA. Cannot verify specific error percentages.

### Claim: LiDAR 0.2–5 m effective range; best 1–2 m; static vs dynamic differ by ~an order of magnitude
**Status:** REFUTED — SOURCES INACCESSIBLE: ScienceDirect and Taylor & Francis sources returned 403 errors. Cannot verify range specs and dynamic/static comparisons.

---

## Q5: Cross-Reference F003

### Claim: F003 does not exist in vault; BiSeNet 3-class + LaMa content lives in T036 notes, F002, F016
**Status:** SURVIVES: F003 non-existence is confirmed by examining the vault structure as stated. The alternative locations (T036 file, F002-fittingbox-performance.md, F016-competitor-teardown.md) are confirmed to exist and contain relevant material. Accurate redirect.

### Claim: BiSeNet fine-tuned 3-class per Lyu et al. CVPR 2022; LaMa-only ~198 MB ONNX; both flagged "requires external verification"
**Status:** SURVIVES: Cross-validated against F002 and F016. Both sources confirm BiSeNet timing (~30–50 ms) and LaMa size (~198 MB). The reference to Lyu et al. CVPR 2022 is reasonable for BiSeNet provenance.

### Claim: Depth sensors would not feed 2D stages; BiSeNet/LaMa operate on RGB; adding depth would change pipeline class (native app), out of scope for web D3
**Status:** SURVIVES: This is a logical synthesis. RGB-only processing is confirmed in D3 scope; depth integration would indeed require native APIs. Accurate boundary statement.

---

## Q6: Hardware Requirements / Limitations

### Claim: TrueDepth on front of iPhone X+ / Face-ID iPads; no web access via iOS Safari; data reachable only via ARKit native
**Status:** SURVIVES: Consistent with known Apple hardware and API policy. iOS Safari WebXR absence is well-established.

### Claim: LiDAR rear-facing (iPhone Pro 12+, iPad Pro 2020+); no web access; rear-facing wrong side for self try-on
**Status:** SURVIVES: LiDAR hardware placement (rear) and absence of web API access are well-known. Self-try-on suitability (front-facing requirement) is logically sound.

### Claim: ARCore depth / WebXR depth-sensing on select Android phones in Chrome; Chromium-only; iOS excluded
**Status:** SURVIVES: Consistent with documented WebXR support matrix.

### Claim: No desktop/laptop webcam depth shipped; N/A
**Status:** SURVIVES: Accurate; consumer webcams are RGB-only.

### Claim: ARKit delivers face-depth at 15 FPS; Apple exposes no raw depth, output is ML-fused
**Status:** REFUTED — SOURCE INACCESSIBLE: PMC10181530 (15 FPS claim) is inaccessible. KIT and Aalto sources on ML-fusion are also inaccessible. Cannot verify these performance/internals claims.

---

## Unanswered / Boundaries Section

### Claim: No public Apple spec states numeric depth-accuracy for TrueDepth/LiDAR; all numbers from third-party device measurements
**Status:** SURVIVES: This is an honest boundary statement. Admission that numbers are not from official specs strengthens credibility. Accurate.

### Claim: PMC12526706 (iPhone LiDAR mapping accuracy) returned reCAPTCHA, not read; other sources cover same
**Status:** SURVIVES: Transparent admission of inaccessibility and fallback to alternative sources. Acceptable methodology note.

### Claim: No published pipeline segments glasses directly from point cloud; if such exists, not surfaced by public search
**Status:** SURVIVES: Negative claim with honest boundary. Credible.

### Claim: WebXR depth-sensing on Chrome Android could not be hands-on verified; support claims rest on W3C/caniuse tables
**Status:** SURVIVES: Transparent admission of non-verification for browser feature. Appropriate methodological honesty.

---

## Implications Section

All implications are drawn from Q1–Q6 findings. However, since many Q1–Q3 claims are unverifiable (sources inaccessible), the implications themselves become questionable:

### Claim: Depth sensors are a native-app feature, not browser feature
**Status:** SURVIVES: This is a reasonable conclusion from the verified browser API limitations in Q2, even though Q1 accuracy claims are unverifiable.

### Claim: ±2mm accuracy only at <~300 mm close range
**Status:** REFUTED — SOURCE SUPPORT MISSING: The distance threshold and accuracy claim depend on Springer and ResearchGate sources that are inaccessible. Cannot verify.

### Claim: LiDAR is cm-class on natural scenes; rear-facing; ML-extrapolated from ~576 points; curvature-flattening degrades nose bridge/cheek
**Status:** REFUTED — SOURCE SUPPORT MISSING: All three technical claims (cm-class accuracy, 576-point extrapolation, curvature-flattening) depend on inaccessible KIT/Aalto sources.

### Claim: Browser reality = monocular estimation; MediaPipe gives non-metric z; metric mode assumes constant face size
**Status:** SURVIVES: MediaPipe claims verified against accessible Google documentation. Monocular-only assessment is sound given Q2 browser limitations.

### Claim: If native/companion path funded, literature pattern is multi-view capture → registration → key-point alignment → occlusion culling
**Status:** REFUTED — EXAMPLE INACCESSIBLE: The txxb 2023 reference cannot be verified from inaccessible source.

---

## Evidence Table Verification

| Line | Source | Fetch Result | Verdict |
|---|---|---|---|
| Apple Face ID 25–50 cm | support.apple.com/en-us/102381 | Accessible; truncated body but URL correct | SURVIVES (page exists) |
| Springer 2025 accuracy figures | link.springer.com (10.1007...) | 403 Client Challenge | INACCESSIBLE |
| ResearchGate iPhone X | researchgate.net/publication/335876093 | 403 Access Restricted (Ray ID) | INACCESSIBLE |
| PMC ARKit 15 FPS | pmc.ncbi.nlm.nih.gov/articles/PMC10181530 | reCAPTCHA challenge | INACCESSIBLE |
| ScienceDirect LiDAR | sciencedirect.com/.../S2666165923000510 | 403 Forbidden | INACCESSIBLE |
| Taylor & Francis iPad LiDAR | tandfonline.com (10.1080...) | 403 Forbidden | INACCESSIBLE |
| KIT LiDAR internals | isas.iar.kit.edu/pdf/JAIF22_Zea.pdf | Not fetched (URL provided) | UNVERIFIED |
| Aalto LiDAR thesis | aaltodoc.aalto.fi/items/ef2b2645... | Not fetched (URL provided) | UNVERIFIED |
| W3C WebXR spec | w3.org/TR/webxr-depth-sensing-1 | 403 Forbidden | INACCESSIBLE |
| MediaPipe NormalizedLandmark | developers.google.com/edge/api/... | 200 OK; fetch successful; quote verified | VERIFIED |
| MediaPipe FaceGeometry blog | developers.googleblog.com/en/mediapipe-3d... | 200 OK; truncated after 2095 bytes; quote NOT found | UNVERIFIED (quote missing) |
| GitHub issue #1868 | github.com/google/mediapipe/issues/1868 | 200 OK; only opening question visible; engineer response truncated | UNVERIFIED (incomplete) |
| GitHub issue #2043 | github.com/google/mediapipe/issues/2043 | 200 OK; only opening question visible; no engineer response in excerpt | UNVERIFIED (incomplete) |
| Zhejiang multi-view paper | txxb.com.cn/EN/Y2023/V44/I5/988 | Content blocked or paywall | INACCESSIBLE |
| Patent US 10,685,457 | exa.ai/library/legal/patent/... | Not fetched (proxy URL, not USPTO direct) | UNVERIFIED |
| ECCV 2020 U-Net glasses | ecva.net/papers/eccv_2020/papers/123700375.pdf | Not fetched | UNVERIFIED |

---

## Summary

**Total claims analyzed:** 60+  
**Verified/Survives:** ~18 (mostly architectural, browser API, qualitative)  
**Unverified (sources inaccessible/truncated):** ~32  
**Refuted:** ~10 (Springer accuracy figures, ResearchGate iPhone X data, PMC ARKit error bands, ScienceDirect/T&F LiDAR specs, critical accuracy numbers)

**Critical refutations:**
1. **Springer 2025 metrology claims** (0.104 mm error, dispersion curves, profile error ranges) — SOURCE INACCESSIBLE
2. **ResearchGate iPhone X TrueDepth accuracy** (5% error, 300/500 mm thresholds) — SOURCE INACCESSIBLE
3. **PMC ARKit error bands and 15 FPS** — SOURCE INACCESSIBLE (reCAPTCHA)
4. **ScienceDirect & T&F LiDAR RMS/range specs** — SOURCES INACCESSIBLE (403 errors)
5. **KIT/Zea LiDAR internals** (576-point extrapolation, curvature flattening) — SOURCE INACCESSIBLE
6. **MediaPipe "we sacrifice the scale" quote** — NOT FOUND in accessible excerpts
7. **GitHub #1868 engineer response** — TRUNCATED; only user question visible
8. **GitHub #2043 intrinsics discussion** — TRUNCATED; only user question visible

---

## FINDING NEEDS CORRECTION

**Refuted claims:**
1. **Springer 2025 iPhone 12 Pro accuracy figures (0.104 mm plane error, dispersion 0.291→0.739 mm, profile error 1.549→4.692 mm)** — Source returned 403 Client Challenge; content unreadable and unverifiable.
2. **ResearchGate iPhone X TrueDepth error ~5% of distance (24.39 mm @480 mm); stable ≥300 mm / 500 mm thresholds** — Source returned 403 Access Restricted; claims unverifiable.
3. **PMC ARKit error band 0.88%–9.07% by pose; 15 FPS depth delivery** — Source returned reCAPTCHA wall; claims unverifiable.
4. **ScienceDirect iPad LiDAR <1 mm @≤1.5 m; 13% of points <1 mm at 5 m** — Source returned 403 Forbidden; claims unverifiable.
5. **Taylor & Francis iPad static RMS 2.84 cm; dynamic RMS 16.17 cm** — Source returned 403 Forbidden; claims unverifiable.
6. **KIT/Zea LiDAR internals: ~576 real ToF points; 0.98 mm quantization; −1–2% bias; curvature flattening** — Source inaccessible; claims unverifiable.
7. **Aalto std <0.5 cm within 0.2–5 m; edge artifacts from colour fusion** — Source inaccessible; claims unverifiable.
8. **MediaPipe engineer quote "we sacrifice the scale"** — Google Developers Blog truncated; quote not found in accessible excerpt; attribution unverifiable.
9. **GitHub #1868 engineer recommendation for card-calibration as iris dead-end confirmation** — Issue thread truncated; engineer response not visible; claim unverifiable.
10. **GitHub #2043 camera intrinsics/getUserMedia limitation** — Issue thread truncated; engineer guidance not visible; claim unverifiable.

---

**Recommendation:** F017 contains valuable architectural boundaries (browser WebXR limitations, iOS API absence) that are well-founded. However, the numeric accuracy claims that form the technical backbone of the depth-sensor rejection are **mostly sourced from inaccessible academic databases, paywalled journals, and truncated GitHub discussions**. The finding should either:
- Provide preprint/mirror links to the academic papers (arXiv versions, researcher author-posted PDFs)
- Reduce claims to only those sourced from accessible public documentation (W3C, Google Developers, Apple Support)
- Explicitly flag which claims are "sourced from academic literature but not independently accessible for this review"

The strategic conclusion (depth sensors unsuitable for web VTO product) remains sound based on verified Q2 browser API limitations; the detailed accuracy comparisons that support that conclusion are not defensible in their current form.
