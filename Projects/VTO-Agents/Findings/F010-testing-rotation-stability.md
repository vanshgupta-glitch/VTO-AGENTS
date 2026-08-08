---
okf: 1
id: F010-testing-rotation-stability
type: finding
project: VTO
status: done
created: 2026-08-04
tags: [vto, testing, rotation-stability, jitter, metric, harness]
---

# F010 — Rotation-Stability Jitter Metric & Test Harness

**Project:** [[VTO]] · Source note: [[Testing-Researcher]] · Task: [[T010 Testing-Validation-Protocols]]

## One-line takeaway

A single `jitterScore` metric (normalized 0–100, lower = more stable) computed from landmark-space displacement of the glasses patch across a fixed scripted-head-motion video corpus, with a Vitest harness that plugs directly into the existing `face-scale.unit.test.ts` and `one-euro.unit.test.ts` tolerance-band patterns.

---

## Metric definition: `jitterScore`

### What it measures

Under **scripted head motion** (sweeps, nods, combined), the glasses patch moves in screen space. Some movement is correct (the head actually turned). Jitter is the **uncorrelated residual** — the glasses trembling independently of the head.

### Computation

Given a time series of frames `i = 0..N` from a fixed test video:

1. **Landmark-space patch position:** For each frame, compute the glasses bridge position in **normalized landmark coordinates** (MediaPipe's 0–1 space, camera-independent). This is `p_i = (x_i, y_i)` — the screen position of the bridge anchor.

2. **Reference signal (ground-truth head motion):** Low-pass filter `p_i` with a **very aggressive One-Euro** (minCutoff=0.3, beta=0, dCutoff=1.0) to get `r_i` — the "head-intended position" stripped of tremor but passing intentional motion. This is the reference.

3. **Residual:** For each frame `i`: `res_i = ||p_i − r_i||` (Euclidean distance in normalized landmark space).

4. **Jitter per sweep segment:** Divide the video into motion segments (yaw sweep, nod, combined, static). For each segment `S` compute:
   ```
   jitter_S = RMS(residuals in S) / RMS(velocity of r in S + ε)
   ```
   The denominator normalizes by how fast the head is moving — jitter at rest is a different thing from jitter during motion. ε = 1e-6 avoids division by zero.

5. **Aggregate jitterScore:**
   ```
   rawScore = mean(jitter_S across all segments) * 100
   jitterScore = clamp(rawScore, 0, 100)
   ```

### Interpretation

| jitterScore | Meaning | Action |
|-------------|---------|--------|
| 0–5 | **Production quality** — patch feels rigidly attached to face | Ship |
| 5–15 | **Acceptable** — minute tremor, not noticed without scrutiny | Ship with note |
| 15–30 | **Noticeable jitter** — glasses "float" slightly during motion | Investigate smoothing pipeline (One-Euro β, minCutoff) |
| 30–60 | **Distracting** — glasses visibly shake during head turns | Fail. Root cause: quaternion-filter, face-scale, or landmark jitter. |
| 60+ | **Broken** — patch is unstable even at rest | Blocking regression |

### Dimensions measured

The metric is computed independently on these 6 signals (each gets its own sub-score; `jitterScore` = max of the six):

| Signal | Source in engine | What it catches |
|--------|-----------------|-----------------|
| **Bridge X** | `composeTransform` output position.x | Lateral wobble |
| **Bridge Y** | `composeTransform` output position.y | Vertical float |
| **Scale** | `FaceScale.faceWidthPx` | Size pulsation (breathing) |
| **Yaw rotation** | Render quaternion → Euler Y | Rotation jitter in plane |
| **Temple X** | Temple articulation hinge position.x | Temple-end shake |
| **Temple Y** | Temple articulation hinge position.y | Temple float relative to ear |

## Fixed video corpus

### Required clips

All clips at **22 fps** (the try-on frame rate), 1080p, from the C920s at fixed rig distance:

| Clip ID | Duration | Motion | Target test |
|---------|----------|--------|-------------|
| `sweep-fast` | 10s | Yaw ±50° at ~2 Hz, pitch 0° | Scale stability under fast motion (the original face-scale bug) |
| `sweep-pitched` | 12s | Yaw ±50° at ~1.5 Hz, pitch fixed +35° | Scale+position stability under pitch (the reported bug) |
| `sweep-nod` | 15s | Yaw ±50° at ~1.5 Hz + pitch ±25° nod at ~0.8 Hz | Combined stress — the dominant case |
| `static` | 10s | No motion, neutral face | Baseline — jitterScore should be ≤2 here |
| `lean-in` | 8s | Move from 80 cm → 50 cm distance, frontal | Distance-change stability |
| `lean-out` | 8s | Move from 50 cm → 80 cm distance, frontal | Reverse direction |

**Corpus storage:** `test/fixtures/rotation-stability/*.y4m` with companion `ground-truth.json` recording per-frame: `{yaw_deg, pitch_deg, roll_deg, distance_mm}`.

### Face in the corpus

Use a **printed face target** (life-size photo with MediaPipe-detectable features) mounted on a turntable + tilt mechanism. This gives **perfectly repeatable** motion across runs. Alternatives: real person on script (less repeatable but more realistic); synthetic render (zero noise — good for isolating algorithm jitter from tracker noise).

## Test harness design

### Architecture

The harness extends the **existing Vitest tolerance-band pattern** used in `face-scale.unit.test.ts` and `one-euro.unit.test.ts`. No new framework — Vitest + custom matchers.

```
test/rotation-stability/
├── jitterScore.ts              ← metric computation (pure function)
├── jitterScore.unit.test.ts    ← unit tests for the metric itself
├── harness.ts                  ← clip reader + engine wrapper
├── fixtures/
│   ├── sweep-fast.y4m
│   ├── sweep-pitched.y4m
│   ├── sweep-nod.y4m
│   ├── static.y4m
│   ├── lean-in.y4m
│   ├── lean-out.y4m
│   └── ground-truth.json
├── regression-baselines.json   ← locked jitterScore baselines per clip
└── rotation-stability.spec.ts  ← the actual test suite
```

### `jitterScore.ts` — metric implementation

```typescript
interface Point2D { x: number; y: number; }

interface FrameSignal {
  bridgeX: number;
  bridgeY: number;
  scale: number;
  yawRad: number;
  templeRX: number;
  templeRY: number;
  templeLX: number;
  templeLY: number;
}

function computeJitterScore(signals: FrameSignal[], segmentBounds: [number, number][]): {
  jitterScore: number;
  subScores: Record<string, number>;
} {
  // 1. Extract 6 time series
  const series = {
    bridgeX: signals.map(s => s.bridgeX),
    bridgeY: signals.map(s => s.bridgeY),
    scale:   signals.map(s => s.scale),
    yawRad:  signals.map(s => s.yawRad),
    templeRX: signals.map(s => s.templeRX),
    templeRY: signals.map(s => s.templeRY),
  };

  // 2. Reference = aggressively low-passed signal
  const ref = Object.fromEntries(
    Object.entries(series).map(([k, v]) => [k, lowPassReference(v)])
  );

  // 3. Per-segment per-signal normalized RMS
  const subScores: Record<string, number> = {};
  for (const [key, raw] of Object.entries(series)) {
    let sumSq = 0, count = 0;
    for (const [segStart, segEnd] of segmentBounds) {
      const slice = raw.slice(segStart, segEnd);
      const refSlice = (ref[key] as number[]).slice(segStart, segEnd);
      for (let i = 0; i < slice.length; i++) {
        const res = slice[i]! - refSlice[i]!;
        const vel = i > 0 ? refSlice[i]! - refSlice[i-1]! : 0;
        sumSq += (res * res) / (vel * vel + 1e-6);
        count++;
      }
    }
    subScores[key] = count > 0 ? Math.sqrt(sumSq / count) * 100 : 0;
  }

  // 4. Aggregate: max of sub-scores
  const jitterScore = Math.max(...Object.values(subScores));
  return { jitterScore: Math.min(jitterScore, 100), subScores };
}
```

### `rotation-stability.spec.ts` — test suite

```typescript
import { describe, it, expect } from 'vitest';
import { loadClip, runVtoEngine } from './harness';
import { computeJitterScore } from './jitterScore';
import baseline from './regression-baselines.json';

const CLIPS = ['static', 'sweep-fast', 'sweep-pitched', 'sweep-nod', 'lean-in', 'lean-out'] as const;

describe('Rotation stability', () => {
  for (const clipId of CLIPS) {
    it(`${clipId}: jitterScore ≤ threshold`, async () => {
      const frames = await loadClip(clipId);
      const signals = await runVtoEngine(frames);
      const { jitterScore, subScores } = computeJitterScore(signals, getSegments(clipId));

      // Hard threshold
      expect(jitterScore, `${clipId} jitterScore`).toBeLessThanOrEqual(getThreshold(clipId));

      // Regression guard: never worse than baseline + margin
      const bl = (baseline as Record<string, number>)[clipId];
      if (bl !== undefined) {
        expect(jitterScore, `${clipId} vs baseline`).toBeLessThanOrEqual(bl * 1.15);
      }

      // Diagnostic: log sub-scores on failure
      if (jitterScore > getThreshold(clipId)) {
        console.error(`Sub-scores for ${clipId}:`, JSON.stringify(subScores));
      }
    });
  }
});

function getThreshold(clipId: string): number {
  return {
    'static': 3,
    'sweep-fast': 12,
    'sweep-pitched': 15,
    'sweep-nod': 18,
    'lean-in': 10,
    'lean-out': 10,
  }[clipId] ?? 20;
}
```

### `harness.ts` — clip reader + engine wrapper

```typescript
import { readY4mFrames } from './y4m-reader';  // decode .y4m into RGBA frames
import { createLandmarkDebugEngine } from '../src/engine/landmark-debug-engine';
import type { FrameSignal } from './jitterScore';

export async function loadClip(clipId: string): Promise<ImageData[]> {
  const path = `test/fixtures/rotation-stability/${clipId}.y4m`;
  return readY4mFrames(path);
}

export async function runVtoEngine(frames: ImageData[]): Promise<FrameSignal[]> {
  const engine = createLandmarkDebugEngine();
  const signals: FrameSignal[] = [];

  for (let i = 0; i < frames.length; i++) {
    const frame = frames[i]!;
    const timestamp = i * (1000 / 22); // 22 fps

    // Run the real engine pipeline — same code path as the store
    const state = await engine.processFrame(frame, timestamp);

    signals.push({
      bridgeX: state.transform.position.x,
      bridgeY: state.transform.position.y,
      scale: state.faceScale.faceWidthPx,
      yawRad: state.headPose.yawRad,
      templeRX: state.templeRight?.hingeWorldPos?.x ?? 0,
      templeRY: state.templeRight?.hingeWorldPos?.y ?? 0,
      templeLX: state.templeLeft?.hingeWorldPos?.x ?? 0,
      templeLY: state.templeLeft?.hingeWorldPos?.y ?? 0,
    });
  }

  engine.dispose();
  return signals;
}
```

## Integration with existing tests

This harness does NOT replace — it **extends** the existing pattern:

| Existing test | What it covers | Rotation-stability adds |
|---------------|---------------|------------------------|
| `face-scale.unit.test.ts` | Scale stability under synthetic yaw/pitch ramps | Real video input with real MediaPipe noise |
| `one-euro.unit.test.ts` | Filter convergence, lateral lag, rest jitter | End-to-end through the full engine pipeline |
| `positioning.unit.test.ts` | Transform composition correctness | Temporal stability under motion |
| `quaternion-filter.unit.test.ts` | Quaternion convergence | Real head pose from actual video |

## Regression baselines

`regression-baselines.json` locks the current jitterScore per clip. Any change that increases jitterScore by >15% fails — this is the **regression guard**. Baselines are baked ONCE on first successful run:

```json
{
  "baked_at": "2026-08-04",
  "engine_version": "0.1.0",
  "scores": {
    "static": 1.2,
    "sweep-fast": 7.8,
    "sweep-pitched": 9.3,
    "sweep-nod": 11.5,
    "lean-in": 5.1,
    "lean-out": 4.8
  }
}
```

**Re-bake command:** `pnpm test:bake-jitter-baselines` — regenerates `regression-baselines.json`. Only run on intended smoothing/tracking changes. Never auto-updated in CI.

## CI wiring

- Add `test:jitter` script in `package.json`: `vitest run test/rotation-stability/`
- Stage in CI after unit tests, before e2e. ~30s runtime (6 clips × ~5s each).
- Fast path: if rotation-stability fixtures are missing (first checkout), skip with a warning — the test requires the video corpus which should be in LFS or a fixtures submodule.

## Limitations

- **Requires video corpus.** Cannot run in CI without the .y4m fixtures. These must be checked into the repo (LFS) or served from a fixtures repo.
- **Metric is comparative, not absolute.** jitterScore of 8.0 vs 12.0 = regression, but 8.0 vs 8.5 is within noise. The 15% margin on baselines accounts for this.
- **Single camera/lighting condition.** The C920s at fixed lighting is the reference condition. Real shoppers have worse conditions — the metric sets the ceiling, not the floor.
- **Engine must be callable headlessly.** `createLandmarkDebugEngine` must work without a DOM canvas. If it requires WebGL context, wrap in `headless-gl` or use the worker path with synthetic canvas.

## Related

- [[VTO]] · [[Testing-Researcher]]
- Repo: `rkumar-vto/packages/vto-core/src/smoothing/one-euro.ts`, `quaternion-filter.ts`, `faceScale.ts`
- Existing tests: `face-scale.unit.test.ts`, `one-euro.unit.test.ts`, `positioning.unit.test.ts`, `quaternion-filter.unit.test.ts`
- Handoff 049: CV-Accuracy & Golden-Image Tests