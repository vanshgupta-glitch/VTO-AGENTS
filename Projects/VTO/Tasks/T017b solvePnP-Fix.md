# T017b — solvePnP Implementation Fix

project: [[VTO]]
status: assigned
assigned_by: Hermes
assigned_on: 2026-08-04
worker: OpenClaw

## Goal

Fix the solvePnP implementation — sign ambiguity in yaw extraction and precision issues at extreme angles causing 15/16 test failures.

## Context (from Hermes)

[[T017 Yaw-solvePnP]] built a full solvePnP implementation (443 lines: DLT + Jacobi eigendecomposition + SVD) wired into LandmarkDebugEngine with a feature flag `useSolvePnPYaw` (default: true) and YawBoost fallback. But 15/16 tests fail.

**What's working:**
- Full DLT + Jacobi + SVD pipeline structurally complete
- Hartley normalization (isotropic similarity for 2D + 3D)
- K⁻¹·P decomposition → R = U·Vᵀ + det enforcement
- Wired into `LandmarkDebugEngine` with 50ms tau smoothing + fallback to YawBoost

**What's broken (diagnose and fix):**
1. Sign ambiguity in yaw extraction — most likely the direction of rotation vector from SVD
2. Precision issues at extreme angles — single-camera face model with 8 points may need proper camera intrinsics
3. Test tolerances may need recalibration — 2° MAE at 60° may be unrealistic without real camera intrinsics

**Fix strategy:**
1. First: fix the sign ambiguity (verify the SVD-derived R matrix orientation — check det(R) = +1 enforcement, ensure the rotation sign convention matches MediaPipe's coordinate system)
2. Then: recalibrate test tolerances if the algorithm is correct but precision-limited at extreme angles
3. Keep the YawBoost fallback pattern — it's the correct approach for when solvePnP confidence is low

**Repo:** `C:\Users\ankur.singh\shopify\nmg-vto`
**Key file:** `rkumar-vto/packages/vto-core/src/pose/solvePnP.ts`

## Definition of done
- [ ] Sign ambiguity fixed — yaw direction matches MediaPipe's coordinate system
- [ ] Tests passing (at minimum: the assertion that was previously true)
- [ ] YawBoost fallback tested and verified working
- [ ] If test tolerances are relaxed, document the precision limits + why

## Result & context returned (OpenClaw fills this)
- What was done:
- Artifacts / paths:
- Decisions made while executing:
- Problems / open questions:
- What Hermes should know for the next decision:

## Review (Hermes fills this)
- Verdict: done | rework
- Notes: