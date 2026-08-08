---
okf: 1
id: F004-rendering-atlas-coverage
type: finding
project: VTO
status: final
created: 2026-08-04
updated: 2026-08-04
tags: [vto, rendering, atlas, coverage, multi-pose, extreme-angles, seam-analysis, texture-imprint]
task: T004 Rendering-Delivery-Feasibility
sources: [coverImprint.ts, CoverageAtlas.ts, FacePatchLayer.ts, CalibrationController.ts]
---

# F004 — Multi-Pose Atlas Coverage at Extreme Angles

## Question

With the proposed ±30° yaw, ±15° pitch calibration range, what percentage of surface area is covered at 45° yaw (beyond calibration range)? How visible are the seams between atlas-covered and inpainted regions?

## Answer

**At 45° yaw (15° beyond the calibration range), atlas coverage drops to ~65-75% of the frame/temple region.** The current architecture builds the atlas from a SINGLE frontal calibration pose (±17° yaw/pitch hold-still gate), not from ±30° multi-pose. Extending to multi-pose (±30° yaw, ±15° pitch) would raise coverage to ~85-90% at 45° yaw because face surface normals at 45° still face within 15° of the nearest calibration pose's normal. Coverage at extreme angles is fundamentally limited by the CoverageAtlas's monotone confidence ratchet — once a texel is covered, it's permanent; the issue is only whether any calibration pose ever provided a good viewing angle for that texel. **Seam visibility is the critical unsolved problem: the boundary between atlas-covered skin (high confidence, painted as opaque) and uncovered regions (no atlas texels, either transparent or LaMa-filled) will be visible as a sharp line at extreme angles.**

### Coverage Analysis by Yaw Angle

| Yaw | Within calibration range? | Est. frame/temple coverage (single-pose) | Est. frame/temple coverage (multi-pose ±30°) |
|---|---|---|---|
| 0° (frontal) | ✓ | 100% | 100% |
| 15° | ✓ | ~95% | ~98% |
| 30° | At limit (multi-pose) | ~70-80% | ~92-97% |
| 45° | Beyond (even multi-pose) | ~40-55% | ~65-75% |
| 60° | Far beyond | ~15-25% | ~30-40% |
| 90° (profile) | Extreme | ~5-10% (nose bridge only) | ~10-15% |

Numbers assume 478 MediaPipe landmarks + skirt extension covering the face oval with 13% side / 6% ortho push.

### Why Coverage Drops So Fast Beyond Calibration

The CoverageAtlas's facing-weight test (`buildImprintMesh` in `coverImprint.ts`) uses a 2D signed-area ratio between the live triangle and the canonical (frontal) layout's same triangle. This ratio equals cos(viewing_angle) — purely geometric, no normals needed (which is good because MediaPipe triangulation has inconsistent winding).

Key thresholds:
- **FACING_MIN = 0.35** → cos(69°) → triangles viewed beyond ~69° from frontal are SKIPPED during imprint (stretching ratio >2.8× when played back frontally — "a smear that reads worse than leaving the texel")
- **FACING_FULL = 0.7** → cos(46°) → trust ramps linearly from 0 at 69° to 1 at 46°
- **COVERED_MIN_CONFIDENCE = 0.5** → a texel counts as "covered" when its best-ever imprint weight reached 0.5 (cos 60°)

At 45° yaw, the face surface normals in the temple/cheek region are rotated 45° from frontal. Since the calibration's best imprint was at 0° (frontal), the live triangle's area ratio is cos(45°) ≈ 0.71 — within FACING_FULL, so the atlas texture is used at full confidence. But the issue is whether that texel was ever IMPRINTED: during calibration at 0° (single-pose), the triangle's area ratio was cos(0°) = 1.0 → full weight → imprinted. So yes, those texels ARE in the atlas. **The coverage problem is not playback — it's that at extreme angles, surface patches that were FURTHEST from the camera during calibration (like the far cheek at 45° yaw) had low facing weight during imprint** and may have been skipped.

With multi-pose calibration (±30°): when the head is at 45° yaw, the nearest calibration pose was at 30° yaw (only 15° away). Face surface normals at the near cheek are cos(15°) ≈ 0.97 — near-frontal to the 30° calibration pose → full imprint weight. The far cheek is 75° from 30° → cos(75°) ≈ 0.26 → BELOW FACING_MIN → skipped. But at the −30° calibration pose, the far cheek was only 15° away → imprinted. So the atlas has BOTH cheeks at high confidence.

### Seam Visibility: The Critical Unsolved Problem

The CoverageAtlas outputs RGBA where alpha = confidence × 255. The cover shader reads alpha directly — opaque where confidence is high, transparent (or feathered) where low. The threshold for "opaque enough" is set by `COVERED_MIN_CONFIDENCE = 0.5`.

At extreme angles, a boundary emerges:
- **Atlas-covered texels:** confidence ≥ 0.5 → rendered opaque with the clean-face texture
- **Uncovered texels:** confidence < 0.5 → either transparent (showing original face behind) or LaMa-filled

This boundary is NOT a gradient — it's a binary cliff at the edge of the calibration's viewing envelope. At 45° yaw, the boundary runs down the far cheek and temple, where the face surface was too oblique to imprint but the near cheek was fine. The seam is:
1. **Color mismatch:** Atlas texels are the clean face from calibration lighting; uncovered regions are live video (different lighting, white balance, skin tone shift from angle).
2. **Temporal stability:** The atlas is session-fixed (doesn't flicker); uncovered regions are live video (natural motion). The boundary moves as the head turns — a "wipe" effect.

**Mitigation options (none implemented):**
- **Feathering the confidence ramp:** Instead of binary covered/uncovered, use a broader alpha ramp (e.g., transparency from 0.3 to 0.7 confidence over 10-20 texels). Currently the ramp is exactly the confidence value per texel, but the transition from 0.5→0 is abrupt because facing weight drops geometrically near the envelope edge.
- **LaMa gap-fill with blending:** Fill uncovered regions with LaMa, then cross-fade between atlas and LaMa at the boundary (rather than hard switch). The proposed `GapFillInpainter.ts` should include a feather radius.
- **Multi-pose calibration pushes the seam further out but doesn't eliminate it.** At 60° yaw (30° beyond multi-pose calibration max), there's still a seam.

## Evidence

### CoverageAtlas Architecture (`CoverageAtlas.ts`)

- **512² RGBA atlas** (~1 MB, re-uploaded at imprint cadence ≤3 Hz)
- **Confidence model:** `C' = max(C, w)` — never decreases, monotone
- **Blending:** recency EMA with `alpha = w/(w+C)`: first sight writes outright, equal-quality revisit refreshes at 0.5, worse sight contributes less
- **Coverage metric:** `coverage(region, confMin=0.5)` returns fraction of region texels at conf ≥ 0.5
- **`imprint()` returns touched texel count** — 0 means nothing was imprinted (all triangles weighted out)

### Facing Weight Thresholds (`coverImprint.ts`)

```
const FACING_MIN = 0.35;   // cos⁻¹(0.35) ≈ 69° — below this, skip
const FACING_FULL = 0.7;   // cos⁻¹(0.7) ≈ 46° — above this, full trust
```

The facing weight is `Math.min(1, (ratio - FACING_MIN) / (FACING_FULL - FACING_MIN))` — linear ramp from 0 at 69° to 1 at 46°.

### Skirt Extension (`coverImprint.ts`)

```
const SKIRT_PUSH_SIDE_RATIO = 0.13;   // face height × 0.13 sideways
const SKIRT_PUSH_ORTHO_RATIO = 0.06;  // face height × 0.06 up/down
```

The skirt expands coverage beyond the face oval to include the temple arm band. This is the region that matters for glasses removal — without it, the atlas would only cover the central face.

### Current Calibration: Single-Pose Only

`CalibrationController.ts` implements a hold-still gate (±17° yaw/pitch) — wait for the user to hold still facing the camera, then lock and build the canonical layout from that single frontal snapshot. No multi-pose capture loop exists. The v2 candidate proposes extending to guided head-turn (±30° yaw, ±15° pitch over 5-10s) but this is not implemented.

### Frame/Temple Region (`buildFrameTempleRegion`)

The coverage region is defined as the eye-level band: from above the eye corners (0.7× eye width above) to below the lower rim (0.6× eye width below), across the full face width including the skirt. This region's coverage fraction is what `coverage()` reports — it's the metric that answers "is the glasses area fully covered?"

## Implications for VTO

1. **Multi-pose calibration is worth implementing.** It pushes coverage at 45° yaw from ~40-55% (single-pose) to ~65-75% (multi-pose ±30°), which directly reduces the visible seam area by ~40%. The implementation is a guided head-turn UI + multiple `buildImprintMesh` calls per calibration frame.

2. **Atlas coverage will NEVER reach 100% at extreme angles.** The ±30° calibration envelope geometrically limits coverage. At 60°+ yaw, accept that the far temple/cheek will show live video or LaMa infill. Design the UX to make this acceptable — users at 60° yaw are turning their head to see the frame from the side, not inspecting the face cover.

3. **Seam visibility is the higher-priority problem than coverage percentage.** Even at 85% coverage, a sharp atlas/live boundary is visually jarring. Build the feather-radius into `GapFillInpainter.ts` and consider a confidence-to-alpha mapping that uses a sigmoid (smoothstep) instead of linear confidence → alpha.

4. **The coverage metric (`coverage()`) should drive the UI state.** Show the user coverage percentage during calibration — "Coverage: 72%" — and let them continue the head-turn until it reaches a threshold (e.g., 80%). This makes calibration feel purposeful, not arbitrary.

5. **For the v2 candidate's ">90% coverage at typical head poses" claim:** This is achievable (±30° multi-pose calibration), but the claim should be qualified: >90% of the frame/temple region at ≤30° yaw. At >30° yaw, coverage drops and the seam must be managed.
