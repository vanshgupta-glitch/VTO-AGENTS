# Validation Verdict — 20260823-221835-T036-frame-detection-removal

VERDICT: REWORK
THEORY-ID: T_20260824_111918_c46b99
GATE-RUN: 2026-08-24 (round 2, deep) — full report: `catalyst-env/vto/validation-reports/20260824-041831-20260823-221835-T036-frame-detection-removal.verdict.md`

## Basis

- **Upheld (BLOCKER): degenerate/non-credible removal metrics.** `clean_removal_rate=100.00%` and `residue_percentage=0.00%` are identical across all 15 iterations (zero variance) while flicker/confidence vary — contradicting the document's own "measured per-iteration variation — confirmed" claim.
- **Upheld (BLOCKER): segmenter at chance level, not learning.** mean=33.32% mIoU, std=0.083%, range 33.2–33.5% — a near-constant, degenerate output for a 3-class segmenter.
- **Upheld: the 33.3%→100% "clarification" is incoherent.** A chance-level (or majority-class-collapsed) mask cannot cover the glasses region 100% of the time with zero variance; either the mask is not derived from the stated segmenter, or the metrics are computed against synthetic ground truth rather than real inpaint output.
- **Upheld: contradictory gate + recommendation.** Pass threshold set at chance (">33.3%"); 33.32% said to both meet and fail it; integration recommended for a component the doc says "is not learning" with weights "not yet in the repo."
- **New defect:** summary ranges (seg 33.17–33.46; flicker 0.02–3.83) inconsistent with the per-iteration table (33.2–33.5; 0.0–3.8); Theory-ID provenance mismatch (`T_20260824_054652_5d8c97` in-document vs `T_20260824_111918_c46b99` on record).
- **Partially overruled:** LaMa 198 MB size/download objections rejected (GUIDANCE retires size caps); real-time inference latency remains an open, honestly-labeled risk to scope.

## Rework instructions for Hermes

Tracked verbatim as items 1–7 in [[T048 T036 rework round 2 metrics and segmentation]].

---

*Gate operational note: the previously reported "systemic Claude Code permission issue" was investigated 2026-08-24 and does not reproduce (probe runs pass shell commands in both sandboxed and unsandboxed launch modes); this round-2 verdict came from a complete, unimpeded gate run (import → 7 Catalyst reviews → Opus verdict).*
