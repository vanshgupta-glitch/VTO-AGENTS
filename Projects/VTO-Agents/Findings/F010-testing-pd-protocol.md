---
okf: 1
id: F010-testing-pd-protocol
type: finding
project: VTO
status: done
created: 2026-08-04
tags: [vto, testing, ground-truth, pd, calibration, validation]
---

# F010 — Ground-Truth PD Study Protocol

**Project:** [[VTO]] · Source note: [[Testing-Researcher]] · Task: [[T010 Testing-Validation-Protocols]]

## One-line takeaway

A self-service, caliper/pupillometer PD ground-truth study for n≥5 faces, designed to validate the `IRIS_PD_CALIBRATION` claim (±2 mm) against reference instruments — zero corporate QA, fully personal-project-executable.

---

## Equipment

| Item | Specification | Why | Approx. Cost |
|------|--------------|-----|-------------|
| **Digital PD meter** (pupillometer) | Essilor AKR 550 or Reichert PDCheck; ≥0.5 mm resolution | Gold-standard optical PD — what opticians use | ~$150–400 (used) |
| **Digital caliper** | Mitutoyo 500-196-30 or equivalent; ±0.02 mm accuracy | Fallback physical PD (corneal reflex method) | ~$40–100 |
| **Webcam** | Logitech C920s or better; 1080p, fixed focus, ≥60 cm standoff | Consistent optics — same camera used for VTO testing | ~$70 |
| **Rig / stand** | Adjustable tripod + phone/face cradle at fixed distance | Eliminates distance variance across sessions | ~$40 |
| **Lighting** | Diffuse front light (ring or softbox), no harsh shadows | Ensures consistent iris detection | ~$30 |
| **Measurement tape / ruler** | Metric, rigid, for camera-to-face distance calibration | Confirm camera standoff | ~$5 |

Total equipment budget: **~$335–645**. Cheapest MVP: skip pupillometer, use digital caliper only + surgeon's ruler — **~$85**.

## Participants (n≥5 faces, ≥10 eyes)

Recruitment criteria for self-service (friends/family/coworkers):

| Criterion | Minimum | Ideal |
|-----------|---------|-------|
| Face count | 5 | 8–12 |
| Age spread | 20–60 | Full adult range |
| Inter-pupil range | 55–75 mm | Stringent test of PD estimator range |
| Iris color diversity | ≥2 colors | Dark, light, hazel (tests MediaPipe iris detection across contrast) |
| Wearing glasses? | 3+ yes, 2+ no | Tests with/without frames in video stream |
| Prior PD known? | Note if available | Optician records add secondary validation |

**Consent:** Record on phone video: "I consent to having PD measurements recorded for a personal glasses-try-on accuracy study. No data will be shared or published." Verbal, stored locally only.

## Procedure (per participant, ~15 min)

### Phase A — Reference measurement (no VTO)

1. **Seat participant** at fixed distance from camera rig. Chin rest or mark position.
2. **Pupillometer measurement** (if available): 3 repetitions, record each. Take mean. Record: `pupillometer_pd_mm`, `pupillometer_pd_L_mm`, `pupillometer_pd_R_mm`.
3. **Caliper corneal-reflex measurement:** Participant fixates on distant point (or camera lens at ≥1 m). Caliper measures outer edge of right cornea → inner edge of left cornea (far PD). 3 reps, record mean. Record: `caliper_far_pd_mm`.
4. **Caliper near PD:** fixate at screen distance (arm's length). Same method. Record: `caliper_near_pd_mm`.
5. **Surgeon's ruler backup:** Hold metric ruler across bridge of nose, photograph from straight-on. Compute from photo: `ruler_photo_pd_mm`.

**Ground-truth label:** The pupillometer reading (or caliper far PD if no pupillometer). Label the "reference PD" as `ground_truth_pd_mm = pupillometer_pd_mm ?? caliper_far_pd_mm`.

### Phase B — VTO measurement capture

6. **Start VTO on the rig webcam.** Record a screen capture (OBS or similar) at 1080p, 30 fps.
7. **Scripted head-motion protocol** (45 seconds):
   - 0–5s: Static frontal, neutral expression → VTO calibrates
   - 5–15s: Slow yaw sweep left→right, ~30° each way, ~5s per side
   - 15–25s: Slow pitch sweep up→down, ~20° each way
   - 25–35s: Static frontal (again, re-stabilized)
   - 35–45s: Move closer (lean in ~20 cm) then return — tests distance invariance
8. **Extract the VTO's PD estimate** from the `PdEstimate` structure at the static-frontal segments (0–5s and 25–35s). Record every frame's `pdMm` + `confidence`.

### Phase C — Variant conditions (one per participant, rotating)

9. Assign each participant ONE of:
   - **Glasses ON:** Repeat B while wearing glasses → tests frame-removal/PdEstimator interaction
   - **Dim lighting:** Lower room light to ~100 lux → tests low-light iris detection
   - **Off-axis seating:** Sit 15 cm left/right of camera center → tests non-centered face

## Data format

Per-participant JSON file stored in `test/fixtures/pd-ground-truth/<participant-id>.json`:

```json
{
  "participant_id": "P01",
  "session_date": "2026-08-04",
  "demographics": { "age": null, "iris_color": "dark", "wears_glasses": true },
  "reference": {
    "method": "pupillometer",
    "pupillometer_pd_mm": 63.5,
    "pupillometer_pd_L_mm": 31.5,
    "pupillometer_pd_R_mm": 32.0,
    "pupillometer_reps": [63.5, 63.0, 64.0],
    "caliper_far_pd_mm": 64.0,
    "caliper_near_pd_mm": 61.5,
    "ground_truth_pd_mm": 63.5
  },
  "vto_static_frontal_1": {
    "frames": [
      { "timestamp_ms": 1200, "pdMm": 62.8, "confidence": 0.92, "mmPerPx": 0.389 },
      { "timestamp_ms": 1333, "pdMm": 63.1, "confidence": 0.94, "mmPerPx": 0.391 }
    ],
    "mean_pdMm": 63.0,
    "stdev_pdMm": 0.2,
    "mean_confidence": 0.93,
    "delta_mm": -0.5
  },
  "vto_static_frontal_2": {
    "frames": [],
    "mean_pdMm": 63.2,
    "delta_mm": -0.3
  },
  "vto_yaw_sweep": {
    "max_deviation_mm": 1.1,
    "at_yaw_deg": -28
  },
  "variant_condition": "glasses_on",
  "notes": "commercial")]
  }
}
```

## Pass/fail thresholds

Builds on existing `IRIS_PD_CALIBRATION` ±2 mm claim from codebase:

| Gate | Threshold | Fail action |
|------|-----------|-------------|
| **Static frontal accuracy** | Mean |VTO PD − ground truth| ≤ 2.0 mm across all participants | Flag participant, investigate. Re-calibrate mmPerPx mapping. |
| **Group RMSE** | RMS error across all n≥5 static-frontal means ≤ 1.5 mm | PD estimator is overclaiming. Tighten or widen claim to matched RMSE. |
| **Per-participant stability** | StdDev of `pdMm` across static-frontal frames ≤ 0.5 mm | Smoothing/time-constant issue — One-Euro filter may need re-tuning. |
| **Yaw invariance** | |pdMm@yaw=±30° − pdMm@yaw=0°| ≤ 3.0 mm for all participants | Foreshortening correction broken (face-scale tests should have caught this; VT). |
| **Distance invariance** | |pdMm@close − pdMm@far| ≤ 2.0 mm | Scale/magnification compensation error. |
| **Minimum confidence** | Mean confidence across static-frontal frames ≥ 0.7 for all participants | Iris detection unreliable — check lighting/camera/iris color. |
| **Out-of-range detection** | Any PD < 50 or > 85 mm MUST set `inRange = false` | Synthetic or real extremes must be flagged. |

**Overall pass:** All gates green for ≥4 of 5 participants (80%). A single-participant fail is acceptable if the participant has a known detection challenge (very dark irises, strong prescription glasses) and is documented.

## Integration with existing test harness

The study feeds directly into `measurement.unit.test.ts` and the CV-accuracy tolerance suite (049):

1. **Fixture ingestion:** `pd-accuracy.spec.ts` reads `test/fixtures/pd-ground-truth/*.json` and programmatically asserts each participant's `delta_mm` against the ±2 mm tolerance.
2. **CI-safe variant:** For CI (no real camera), use synthetic clips from the ground-truth clips recorded in 049 step 1 — these pair known head pose + known PD per frame. The PD estimator is then tested in Vitest with the recorded landmark arrays.
3. **Re-calibration path:** If group RMSE > 1.5 mm, adjust `IRIS_PD_CALIBRATION.mmPerPxScale` or the default iris diameter at `src/measurement/irisMetrics.ts`. Re-run study. Document the delta.

## Self-service operations checklist

- [ ] Acquire equipment (minimum: caliper + ruler; ideal: pupillometer too)
- [ ] Set up rig — mark camera distance, chin position
- [ ] Recruit 5+ participants (friends/family)
- [ ] Run Phase A (reference measurements) — 3 reps per instrument
- [ ] Record session video per participant (OBS screen capture)
- [ ] Run Phase B (VTO capture with scripted motion)
- [ ] Export VTO PD estimates from console/hook into data format
- [ ] Write per-participant JSON fixture to `test/fixtures/pd-ground-truth/`
- [ ] Wire into `pd-accuracy.spec.ts` CI stage
- [ ] Re-run study on any mmPerPx or iris-diameter change

## Limitations (honest)

- n=5 is **minimum viable**, not statistically powered. [[Mathematical-Researcher]] should compute required n for α=0.05, β=0.2 given the observed variance — expect 8–12 needed.
- Pupillometer and caliper measure slightly different things (pupillometer = corneal reflex → entrance pupil; caliper far = outer canthus to inner canthus). Document which method provided ground truth.
- Video-only design means the VTO never sees the face in a controlled still-photo setting — this is intentional (the app is video-only per D2) but means we cannot compare photo-mode accuracy.
- Self-service means operator skill varies. 3-rep averaging mitigates this.

## Related

- [[VTO]] · [[Testing-Researcher]] · [[Mathematical-Researcher]]
- Repo: `rkumar-vto/packages/vto-core/src/measurement/irisMetrics.ts`, `PdEstimator.ts`, `faceScale.ts`
- Handoff 049: CV-Accuracy & Golden-Image Tests
- Existing unit tests: `measurement.unit.test.ts`, `face-scale.unit.test.ts`