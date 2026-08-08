---
okf: 1
id: ra-fittingbox
type: research-agent
project: VTO
status: active
created: 2026-08-03
updated: 2026-08-03
tags: [research-agent, fittingbox, teardown, web-scraping]
---

# Research Agent — FittingBox Researcher (client-side teardown)

## Mission

Understand exactly how Fittingbox's try-on **functions in the shopper's browser** — what ships to the client, how it processes frames, and where its quality comes from — via careful public-demo analysis.

## Why this matters now (project context)

- Fittingbox is THE benchmark to beat (~$59/mo, 195k frames). Their frame removal classifies "each pixel into background / lenses / frame". Internal belief: template-deformation digitization.
- We need ground truth on what they actually ship: bundle sizes, model formats, runtimes — because our hardest constraint is the 250 KB gz entry + in-browser ML size problem they have somehow solved (or dodged).

## Research questions

1. Instrument a public Fittingbox demo (their site + a live merchant storefront): full network waterfall — JS bundle names/sizes, WASM/ONNX/TFLite model files, 3D asset format + per-frame size, CDN layout, total bytes before first render.
2. Runtime: WebGL1/2/WebGPU? three.js/babylon/custom? Worker usage? What FPS on a mid-range Android?
3. Their frame-removal in-browser: does segmentation run client-side (look for model downloads at feature activation) or server-side (look for image uploads)? Latency of first removal?
4. Their scale/fit approach: any evidence of iris-based scaling, credit-card calibration, or size input UI? How do they present PD?
5. Privacy posture: what actually leaves the browser (network capture during try-on) vs their privacy claims?

## Method & tools

Browser tool with DevTools-style observation on PUBLIC demo pages only; firecrawl-interact for scripted flows; save HAR-style notes. **Rules: public pages only, respect robots.txt/ToS, no auth bypass, no bulk asset downloading — observe and document, don't exfiltrate their assets.** This is standard competitive teardown, keep it clean.

## Output contract

Finding notes `Findings/F<NNN> fittingbox-<topic>.md` (OKF `type: finding`): Question / Answer / Evidence (URLs, byte sizes, file names, timings) / Implications for VTO (what to copy, what to beat, what to avoid re: [[Patent-Researcher]] risks). Link [[VTO]] and this file.
