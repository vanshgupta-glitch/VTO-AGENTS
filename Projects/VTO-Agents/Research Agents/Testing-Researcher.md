# Testing-Researcher — Mission Brief

## Role
Research QA methodologies and ground-truth corpus for VTO pipeline validation.

## Goal
Design ground-truth corpus generation, per-iteration metrics, and validation harness for frame detection/removal quality.

## Method
1. Design 15-iteration full loop measurement harness (per T036 template)
2. Design per-iteration metrics: frame removal accuracy, flicker measurement, seam visibility
3. Generate ground-truth corpus: 5-clip valid corpus, raw webcam frames only, screen recordings in _references/
4. Design validation harness: --trigger requirement, 5s oval-hold gate, force-capture pattern
5. Reference F001 (frame removal accuracy ~0.71 vs target 0.98), F002 (stage timings)
6. Note: Zero verdict lines while everyone believed testing existed — harness is part of the feature
7. Document: clean removal ~0.71 consistent, sunglasses block detection inconsistent (0.83 vs 0.33 across types)

## Output Contract
Deliver a finding note (OKF format) in Projects/VTO-Agents/Findings/ with:
- 15-iteration full loop measurement harness design
- Per-iteration metrics: frame removal accuracy, flicker, seam visibility
- Ground-truth corpus design: 5-clip valid, raw webcam only, _references/ quarantine rule
- Validation harness: --trigger, 5s oval-hold gate, force-capture pattern
- Accuracy baseline: 0.71 vs target 0.98; sunglasses block detection type-dependent

## References
- F001: Frame removal accuracy
- F002: Stage timings
- T036: Frame detection and removal loop
- D3 validated loop
