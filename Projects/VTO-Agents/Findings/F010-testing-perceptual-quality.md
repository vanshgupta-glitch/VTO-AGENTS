---
okf: 1
id: F010-testing-perceptual-quality
type: finding
project: VTO
status: done
created: 2026-08-04
tags: [vto, testing, perceptual-quality, ssim, lpips, golden-image, ab-testing]
---

# F010 — Perceptual Quality Gates

**Project:** [[VTO]] · Source note: [[Testing-Researcher]] · Task: [[T010 Testing-Validation-Protocols]]

## One-line takeaway

A two-tier perceptual quality gate: (1) automated SSIM/LPIPS thresholds against golden images at canonical poses — fast, CI-safe; (2) a self-service competitor A/B protocol vs FittingBox demos — the human "looks premium" verdict for decisions the metrics can't make.

---

## Tier 1: Automated metric gates

### Why both SSIM and LPIPS

**SSIM (Structural Similarity)** catches luminance/contrast/structure drift — good for detecting rendering regressions (missing lighting, wrong material, occlusion break). But SSIM is **pixel-grid-aligned** and insensitive to small geometric shifts.

**LPIPS (Learned Perceptual Image Patch Similarity)** uses a deep feature extractor (AlexNet or VGG) — it catches perceptual differences that SSIM misses: texture sharpness loss, subtle color grading changes, anti-aliasing quality. LPIPS is **the metric most correlated with human quality judgments** (Zhang et al., 2018).

Together: SSIM = "is the render structurally correct?" LPIPS = "does it LOOK as good?"

### Reference implementation

Use the `lpips` npm package (tensorflow.js backend) for LPIPS and a minimal pure-JS SSIM implementation. Both run in Node.js on CI — no browser/GPU needed for the metric computation.

```bash
pnpm add lpips sharp   # lpips for TFJS-based LPIPS, sharp for image loading/resize
```

```typescript
// test/perceptual-quality/metrics.ts
import * as lpips from 'lpips';
import sharp from 'sharp';

/** SSIM between two same-size uint8 RGBA buffers. Returns [0,1], 1 = identical. */
export function computeSSIM(a: Uint8Array, b: Uint8Array, width: number, height: number): number {
  const K1 = 0.01, K2 = 0.03;
  const L = 255;
  const C1 = (K1 * L) ** 2, C2 = (K2 * L) ** 2;

  // 8x8 windows, stride 4
  let ssimSum = 0, windowCount = 0;
  for (let y = 0; y <= height - 8; y += 4) {
    for (let x = 0; x <= width - 8; x += 4) {
      let muA = 0, muB = 0;
      for (let dy = 0; dy < 8; dy++) {
        for (let dx = 0; dx < 8; dx++) {
          const o = ((y + dy) * width + (x + dx)) * 4;
          muA += a[o]! * 0.299 + a[o + 1]! * 0.587 + a[o + 2]! * 0.114; // luma
          muB += b[o]! * 0.299 + b[o + 1]! * 0.587 + b[o + 2]! * 0.114;
        }
      }
      muA /= 64; muB /= 64;

      let varA = 0, varB = 0, cov = 0;
      for (let dy = 0; dy < 8; dy++) {
        for (let dx = 0; dx < 8; dx++) {
          const o = ((y + dy) * width + (x + dx)) * 4;
          const la = a[o]! * 0.299 + a[o + 1]! * 0.587 + a[o + 2]! * 0.114;
          const lb = b[o]! * 0.299 + b[o + 1]! * 0.587 + b[o + 2]! * 0.114;
          varA += (la - muA) ** 2;
          varB += (lb - muB) ** 2;
          cov += (la - muA) * (lb - muB);
        }
      }
      varA /= 64; varB /= 64; cov /= 64;
      ssimSum += ((2 * muA * muB + C1) * (2 * cov + C2)) /
                 ((muA ** 2 + muB ** 2 + C1) * (varA + varB + C2));
      windowCount++;
    }
  }
  return windowCount > 0 ? ssimSum / windowCount : 0;
}

/** LPIPS distance between two PNG file paths. Lower = more similar. */
export async function computeLPIPS(goldenPath: string, candidatePath: string): Promise<number> {
  // Resize both to 256x256 (LPIPS expects fixed input size)
  const [goldenBuf, candidateBuf] = await Promise.all([
    sharp(goldenPath).resize(256, 256).raw().toBuffer(),
    sharp(candidatePath).resize(256, 256).raw().toBuffer(),
  ]);
  // lpips expects float tensors in [0,1], shape [1,3,256,256]
  // Actual API depends on the package; this is the conceptual call
  return lpips.compute(goldenBuf, candidateBuf);
}
```

### Thresholds

| Metric | Threshold | What it means | Fail action |
|--------|-----------|---------------|-------------|
| **SSIM** | ≥ 0.92 | Per-frame structural similarity to golden | Render pipeline changed — occlusion, lighting, material. Investigate diff image. |
| **LPIPS** | ≤ 0.08 | Perceptual distance to golden (VGG/AlexNet) | Visual quality degraded. Compare side-by-side; if intentional (e.g., new material model), re-bake goldens. |
| **SSIM (strict)** | ≥ 0.97 | Glasses-only region (masked to exclude background skin) | Frame model changed — placement, scale, or GLB asset. If intentional, re-bake. |

**Threshold rationale:** These are conservative starting points. SSIM ≥ 0.92 is the standard "visually indistinguishable" threshold in compression literature. LPIPS ≤ 0.08 is the "just noticeable difference" threshold per Zhang et al. **These should be tightened** after the first rounds of real data — start conservative, narrow as confidence builds.

### Golden-image suite (building on 049)

Extends handoff 049's plan with the metric gates:

```
test/perceptual-quality/
├── metrics.ts                  ← SSIM + LPIPS implementations
├── goldens/                    ← approved baseline PNGs
│   ├── gg1978/
│   │   ├── frontal.png
│   │   ├── yaw+15.png
│   │   ├── yaw-15.png
│   │   ├── yaw+30.png
│   │   ├── yaw-30.png
│   │   ├── pitch+15.png
│   │   └── pitch-15.png
│   └── ... (one folder per model in catalog)
├── perceptual-quality.spec.ts  ← the test suite
├── rebake-goldens.ts           ← deliberate golden refresh script
└── thresholds.ts               ← per-model + per-pose overrides
```

**Canonical poses** per model (from 049): frontal, yaw±15°, yaw±30°, pitch±15°. Rendered via Playwright with deterministic renderer (SwiftShader/software WebGL), fixed camera distance, fixed lighting, fixed DPR=1.

```typescript
// perceptual-quality.spec.ts
import { describe, it, expect } from 'vitest';
import { computeSSIM, computeLPIPS } from './metrics';
import { getThresholds } from './thresholds';
import { getGoldenPath, getModelPoses, renderModelAtPose } from './harness';

for (const model of getModelCatalog()) {
  describe(`Perceptual quality: ${model.id}`, () => {
    for (const pose of getModelPoses(model.id)) {
      it(`${pose.name}: SSIM ≥ ${getThresholds(model.id, pose.name).ssim}`, async () => {
        const goldenPath = getGoldenPath(model.id, pose.name);
        const candidate = await renderModelAtPose(model.id, pose);
        const [goldenBuf, candidateBuf] = await Promise.all([
          loadPng(goldenPath), loadPng(candidate),
        ]);
        const ssim = computeSSIM(goldenBuf, candidateBuf, 512, 512);
        expect(ssim).toBeGreaterThanOrEqual(getThresholds(model.id, pose.name).ssim);
      });

      it(`${pose.name}: LPIPS ≤ ${getThresholds(model.id, pose.name).lpips}`, async () => {
        const goldenPath = getGoldenPath(model.id, pose.name);
        const candidate = await renderModelAtPose(model.id, pose);
        const lpipsVal = await computeLPIPS(goldenPath, candidate);
        expect(lpipsVal).toBeLessThanOrEqual(getThresholds(model.id, pose.name).lpips);
      });
    }
  });
}
```

**New model without goldens → hard fail.** Every model in the catalog must have goldens. This forces deliberate review of every new asset.

**Re-bake script:** `pnpm test:rebake-goldens <model-id>` — regenerates goldens for one model. Gated behind explicit flag. Never auto-runs. Commits new PNGs alongside the model change.

### Occlusion-specific assertions (from 049)

Beyond SSIM/LPIPS, add structural assertions:

- **Temple occlusion:** Sample pixels behind the face plane at temple regions — must show face/skin color, not frame color. Assert mean luma in temple-occlusion region ≥ skin-luma − 20.
- **No black model:** `minLuma(glassesRegion)` ≥ 30 — entire glasses region must receive lighting.
- **No floating model:** Bridge anchor Y position within ±2 px of golden bridge Y.
- **Lens transparency:** Lens region SSIM vs skin-behind-lens in golden ≥ 0.85 — proves the lens is rendered transparent, not opaque.

---

## Tier 2: Competitor A/B protocol

### Why automated metrics aren't enough

SSIM/LPIPS tell you the render is **structurally similar** to the golden. They do NOT tell you it "looks premium" relative to FittingBox. A render can pass every metric gate and still look worse than the competition in a side-by-side.

### Self-service A/B protocol

Run by one person (personal project), no panel, no statistical power — this is **directional signal**, not proof.

**Setup:**
1. Open two browser windows side-by-side on same display (same color profile, same brightness).
2. Left: VTO app running on localhost or deployed store.
3. Right: FittingBox demo at `fittingbox.com` or a specific merchant's try-on page.
4. Use the **same webcam** feed split to both windows (OBS virtual camera or browser source).
5. Record the session with OBS at 1080p.

**Comparison frames — 7 canonical scenarios:**

| Scenario | What to judge | Weight |
|----------|---------------|--------|
| **Frontal, bright** | Baseline — glasses placement, scale, material look. Which looks more like real glasses on a face? | 3× |
| **Yaw ±30°** | Temple articulation, frame depth, lens edge visibility. Does the frame wrap convincingly? | 2× |
| **Pitch ±15°** | Frame sits correctly on nose bridge. Does it slide unnaturally? | 1× |
| **Distance change** (lean in/out) | Scale responsiveness. Does the frame resize smoothly? | 2× |
| **Frame removal** (for VTO only) | Quality of inpainting behind frames. Test on a face wearing glasses. Compare to FittingBox server-side removal. | 3× |
| **Lens tint/transparency** | Can you see eyes through the lenses? Correct tint color? | 1× |
| **Low light** (~150 lux) | Tracking robustness, noise handling. Does either break? | 1× |

**Scoring rubric (per scenario):**

| Score | Meaning |
|-------|---------|
| +2 | VTO clearly better — noticeable quality gap |
| +1 | VTO slightly better — small edge |
| 0 | Indistinguishable — equal quality |
| −1 | FittingBox slightly better |
| −2 | FittingBox clearly better — noticeable quality gap |

**Weighted score:** `total = Σ(score_i × weight_i)`. Positive = VTO wins; zero = tie; negative = FittingBox wins.

**Pass gate:** Weighted score ≥ 0 (VTO matches or beats FittingBox on quality-weighted scenarios). Frame removal is the hardest comparison — FittingBox does it server-side. An honest result may be negative here but positive overall; that's acceptable if frame removal is documented as "being improved."

**Frequency:** Run A/B protocol once per major release or on any rendering pipeline change. Takes ~15 minutes.

### Competitor frame extraction

For repeatable reference, extract comparison frames from FittingBox's demos:

1. Record FittingBox demo with OBS (same camera, same face, same lighting as VTO).
2. Extract frames at canonical poses from the recording.
3. Store as `test/perceptual-quality/competitor/fittingbox/<pose>.png`.
4. These are **read-only references** — never asserted against in CI, only used for human A/B review.

---

## When to use which tier

| Change | Auto metric gate (Tier 1) | A/B protocol (Tier 2) |
|--------|--------------------------|----------------------|
| New GLB model added | Required — re-bake goldens | Optional |
| Rendering pipeline change (materials, lighting) | Required — re-bake goldens | Required |
| Smoothing/tracking change | Not applicable (use rotation-stability metric) | Required if placement visibly changes |
| Frame removal improvement | Required (SSIM on inpainted region) | Required |
| New feature (e.g., environment mapping) | Required — add new golden poses | Required |
| Bug fix (occlusion, transparency) | Required — existing goldens should pass | Optional |

## CI wiring

- `test:perceptual` stage in CI after unit tests, before e2e.
- Requires golden PNGs in repo (LFS). Missing goldens = hard fail.
- Tier 2 is **never run in CI** — it's a manual release-checklist item.
- Re-bake script is **never triggered by CI** — explicit human action only.

## Limitations

- **LPIPS/SSIM are not perfect quality judges.** A render with different but equally-good anti-aliasing can fail LPIPS. Use the re-bake path for intentional changes.
- **Golden images need a deterministic renderer.** SwiftShader or software WebGL pinned to a specific version. GPU variance across CI runners causes SSIM noise. The existing 049 plan already addresses this.
- **A/B protocol is n=1 with bias.** The person running it knows which is which. This is acceptable for a personal project — it's directional signal, not clinical evidence.
- **FittingBox demos may change.** FittingBox could update their renderer. Re-capture competitor frames when they do.

## Related

- [[VTO]] · [[Testing-Researcher]]
- Repo: `rkumar-vto/packages/vto-core/src/renderer/GlassesRenderer.ts`
- Handoff 049: CV-Accuracy & Golden-Image Tests
- Competitor A/B comparison target: FittingBox (see [[F001-fittingbox-summary]])
- SSIM: Wang et al., 2004. LPIPS: Zhang et al., 2018 (arXiv:1801.03924)