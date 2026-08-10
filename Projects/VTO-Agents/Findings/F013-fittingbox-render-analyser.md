---
okf: 1
id: F013-fittingbox-render-analyser
type: finding
project: VTO
status: done
created: 2026-08-08
updated: 2026-08-08
tags: [vto, fittingbox, teardown, render, api, analysis, composite, client-side]
source_agent: opencode (network analysis)
source_task: FittingBox VTO render endpoint controlled experiment
---

# F013 — FittingBox `/render` is a Face Analyser, Not a Compositor

**Project:** [[VTO]] · Evidence: [[raw/fittingbox-home]] (`replay_render.py`, `compare_renders.py`)

## Question

Does FittingBox's photo-mode `/render` endpoint return an image **with glasses
composited** (i.e., a reference frame we could diff our output against), or does it
return something else? Which request fields actually change the output?

## Answer

**The `/render` endpoint returns the uploaded photo (re-encoded) plus two pupil
anchor points (`eyesPoints`). It does NOT composite the glasses, and it ignores
the frame `uid` and every render-quality flag.** Two different frames produced
**byte-identical** outputs (same SHA-256), and controlled single-field mutations
never changed a single byte of the returned image.

### Controlled experiment (direct replays, no browser)

Captured the real render request body (photo + RX5277 uid), then replayed it
against `product-api.fittingbox.com/render` with one field mutated per call:

| Mutation                          | Result                                  | Output bytes | eyesPoints       |
|-----------------------------------|-----------------------------------------|--------------|------------------|
| original (uid 08056262897690)     | 201                                     | 184,311      | (327.5,172.5),(394,169.5) |
| `uid → 08053672081299` (RX5277)   | 201, **byte-identical**                 | 184,311      | same             |
| `shadows → false`                 | 201, **byte-identical**                 | 184,311      | same             |
| `avatarPd → 70`                   | 201, **byte-identical**                 | 184,311      | same             |
| `transitionSetting → 1`           | 201, **byte-identical**                 | 184,311      | same             |
| `lensSimulationMaterial → {...}`   | **HTTP 400**                            | —            | —                |

SHA-256 of every 201 output: `d8219c2943698c8b...` — identical across all variants.

### Pixel-level comparison (source photo vs returned output)

| Metric | Value | Interpretation |
|---|---|---|
| Diff mean, eye region (±80×60 px around each pupil) | **2.9** | No localized overlay |
| Diff mean, outside eye region | **1.9** | Uniform re-compression noise |
| Dark-pixel ratio (<80), eye-line band, source | 0.346 | — |
| Dark-pixel ratio (<80), eye-line band, output | 0.334 | Output is *lighter*, not darker — no lens darkening |
| Image dims | 480×640 ×3 B (src and output) | Unchanged |
| Output size | 184,311 B JPEG | Re-encode of source (277,822 B) |

If glasses were composited server-side, the diff would concentrate inside the
eye region and the lens band would darken. Neither happens — the output is the
photo with a JPEG re-encode, plus `eyesPoints` anchors.

### How the actual composite happens

1. Client calls `findByApiKey?id=<uid>` → gets `path`/`key` of the **data4** 3D model
   (see [[F012-fittingbox-network-api]] §3).
2. Client calls `/render` → gets `outputImageB64` (photo re-encoded) + `eyesPoints`.
3. **FBxLive (WASM, in-browser)** renders the 3D glasses over the photo,
   positioned/scaled by `eyesPoints` + `avatarPd`. The composite never touches the network.

### Why this matters / correction to prior teardown

The original [[F001-fittingbox-summary]] listed photo render as
"server-side rendering → return" (a glassed composite). This experiment corrects
that: **the server returns a bare photo + anchors; the glasses are drawn client-side
by the same WASM engine used for live try-on.** The one server-side inference that
does exist is the **face/eye analysis** (pupil anchors), which is fast (~2–4 s
observed end-to-end in headless, dominated by model + transfer).

## Implications for VTO

1. **Do not copy a server-composite architecture.** FittingBox's photo path is
   "server analyses, client draws" — there is no server-rendered reference image
   to beat on quality. Our D3 plan (fully client-side, video-only) is aligned and
   strictly better on privacy/latency ([[VTO]] D3).
2. **`eyesPoints` is the only stable cross-implementation output.** Any "match
   FittingBox placement" visual test must compare pupil anchors / placement deltas,
   never rendered pixels (see [[F014-fittingbox-visual-ui-test-stats]]).
3. **Strict schema lesson.** `lensSimulationMaterial: null` is required (or exact
   object schema); arbitrary non-null → 400. Our render/try-on API must validate
   strictly and fail fast ([[DRIFT-AND-CONSISTENCY]] rung 4).
4. **Re-encode means "re-encode".** The output image differs from input by uniform
   JPEG noise — an automated visual test must not treat that as a content change.

## Evidence

- `raw/fittingbox-home/replay_render.py` — the controlled replay harness
- `raw/fittingbox-home/compare_renders.py` — pixel/diff + eye-band analysis
- `raw/fittingbox-home/render-rx5277.jpeg`, `render-rb3025.jpeg` — identical 184,311 B outputs
- `raw/fittingbox-home/render-body.json` — the exact captured request body
- [[F012-fittingbox-network-api]] §5 — request/response schemas

## Related

- [[F012-fittingbox-network-api]]
- [[F014-fittingbox-visual-ui-test-stats]]
- [[F001-fittingbox-summary]] (corrects the "server-side render" line)
- [[VTO]] D3 (validated plan: video-only, fully client-side)
