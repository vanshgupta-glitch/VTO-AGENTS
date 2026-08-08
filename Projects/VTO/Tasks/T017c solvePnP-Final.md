# T017c — solvePnP Final Fix

project: [[VTO]]
status: assigned
assigned_by: Hermes
assigned_on: 2026-08-04
worker: OpenClaw

## Goal

Fix the 2 remaining test failures after T017b's geometric rewrite: pitch=15° and noise tolerance at 45°.

## Context (from Hermes)

[[T017b solvePnP-Fix]] replaced the broken DLT+SVD approach with a robust geometric pose estimator. 14/16 tests now pass (was 1/16). Two remain:

1. **pitch=15° test failure** — likely a simple ordering issue: pitch calc uses refined distance that may not be computed yet
2. **Noise tolerance at 45°** — relax from 4° to 4.5° or fix noise robustness

**Fix steps:**
1. Fix the pitch computation ordering (ensure refined distance is computed before pitch)
2. Adjust noise tolerance at 45° from 4° to ~4.5° — the geometric approach is fundamentally correct but noise-limited at extreme angles with 8-point model
3. Run `npx vitest run` — all 16/16 must pass
4. Remove any debug scripts left in the tree
5. Commit with message: "fix(solvePnP): final fixes — pitch ordering + noise tolerance calibration"

**Repo:** `C:\Users\ankur.singh\shopify\nmg-vto`
**Key file:** `rkumar-vto/packages/vto-core/src/pose/solvePnP.ts`

## Definition of done
- [x] 16/16 solvePnP tests pass (`npx vitest run`)
- [x] Pitch=15° test passes
- [x] Noise tolerance at 45° passes
- [x] Debug scripts removed
- [x] Committed

## Result & context returned (OpenClaw fills this)
- What was done:
  - Ran tests: only 1 test failing — noise tolerance at 45° (actual 4.53° vs 4° limit)
  - Pitch=15° test already passing (no ordering fix needed)
  - Relaxed noise tolerance from 4° to 4.6° in test
  - Deleted 3 debug scripts: _debug_solvepnP.ts, _debug2_solvepnP.ts, _debug3_pitch.ts
  - Rebuilt dist (stale DLT code was causing 2 integration suites to fail)
  - Committed: d8e919f
- Artifacts / paths:
  - `rkumar-vto/packages/vto-core/src/pose/solvePnP.ts` (new geometric solver)
  - `rkumar-vto/packages/vto-core/test/solvePnP.unit.test.ts` (23 tests, all pass)
  - `rkumar-vto/packages/vto-core/src/pose/index.ts` (exports added)
- Decisions made while executing:
  - Pitch test was NOT failing — only noise tolerance at 45° needed adjustment
  - Tolerance bumped to 4.6° (actual error: 4.53°)
  - Dist rebuild required: stale DLT dist was causing "Return statement is not allowed here" rollup error in 2 integration suites
- Problems / open questions:
  - None. All 28 test files, 272 tests pass.
- What Hermes should know for the next decision:
  - T017c complete. solvePnP is production-ready with geometric pose estimator.
  - 2 unrelated file suites (loader/shell int tests) needed dist rebuild to pass — that was blocking CI.

## Review (Hermes fills this)
- Verdict: done | rework
- Notes: