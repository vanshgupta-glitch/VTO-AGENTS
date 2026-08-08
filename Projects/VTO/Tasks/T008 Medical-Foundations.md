# T008 — Medical Foundations

project: [[VTO]]
status: done
assigned_by: Hermes
assigned_on: 2026-08-04
worker: OpenClaw

## Goal

Give the VTO project medically sound foundations for face/eye measurements — human iris diameter distribution, PD measurement gold standards, and the regulatory line between "fit tool" and "medical device."

## Context (from Hermes)

Load `Projects/VTO-Agents/Research Agents/Medical-Researcher.md` as your mission brief; deliver per its Output contract.

**Additional constraints from D2 (personal/quality-first pivot, see [[VTO]] §Decisions D2):**
- Personal project — regulatory risk is lower, but still important to stay on the "fit tool" side
- The v2 candidate flagged PD accuracy as unverified — this mission must answer: should `IRIS_PD_CALIBRATION` change?

**Priority ordering:**
1. Human iris diameter distribution (mean, SD, age/ethnicity variance → error from assuming 11.7 mm)
2. Optometry gold standards for PD (pupillometer, ruler, apps — accepted tolerances)
3. Regulatory line (US FDA, EU MDR, India CDSCO) — what wording to avoid
4. Anatomical fit factors beyond PD (nose bridge shapes, temple length, face width)
5. Palpebral fissure ratio validation (iris ÷ fissure width ≈ 0.40 from engine)

## Definition of done
- [x] Finding note `Findings/F008-01-medical-iris-diameter.md` — population distribution, error injected by 11.7 mm assumption
- [x] Finding note `Findings/F008-02-medical-pd-standards.md` — gold-standard measurement methods + accepted tolerances
- [x] Finding note `Findings/F008-03-medical-regulatory-line.md` — FDA/MDR/CDSCO stance on virtual try-on vs medical device; safe claim language
- [x] Finding note `Findings/F008-04-medical-anatomical-fit.md` — measurable fit factors beyond PD, estimability from webcam, palpebral fissure ratio validation
- [x] Each finding: Question / Answer / Evidence (study n-sizes, URLs) / Implications for VTO

## Result & context returned (OpenClaw fills this)
- What was done: Researched all 5 topics via Google Scholar (8+ search queries), Nature journal article, FDA.gov regulatory pages. Searched iris diameter distribution, PD standards, FDA/MDR/CDSCO regulatory classification, anatomical frame fit factors, and palpebral fissure ratio. Wrote 4 comprehensive finding notes with primary-source citations, study n-sizes, and specific action recommendations.
- Artifacts / paths:
  - `C:\Users\ankur.singh\Obsidian Vault\Projects\VTO-Agents\Findings\F008-01-medical-iris-diameter.md`
  - `C:\Users\ankur.singh\Obsidian Vault\Projects\VTO-Agents\Findings\F008-02-medical-pd-standards.md`
  - `C:\Users\ankur.singh\Obsidian Vault\Projects\VTO-Agents\Findings\F008-03-medical-regulatory-line.md`
  - `C:\Users\ankur.singh\Obsidian Vault\Projects\VTO-Agents\Findings\F008-04-medical-anatomical-fit.md`
- Decisions made while executing:
  1. **IRIS_DIAMETER_MM should change from 11.7 → 12.0 (conservative) or 12.2 (best-evidence).** Current 11.7 mm is ~0.5 mm below the best-supported literature value (Pirayesh 2023, n=344). This injects ~−2.5 mm systematic error into PD at 60 mm mean. Correction to 12.0 mm reduces bias to ~−1.0 mm.
  2. **IRIS_PD_CALIBRATION should remain 1.0** after correcting IRIS_DIAMETER_MM. The calibration issue is the constant, not an additional factor.
  3. **~±2.0 mm PD accuracy floor** — this is the biological limit from iris diameter variance (±0.4 mm SD). No software improvement can beat this.
  4. **Safe claim language:** "Estimated PD for frame sizing," "Approximate fit estimate — not for prescription." Never claim medical accuracy.
  5. **Palpebral fissure ratio 0.40 should be a soft warning, not a hard gate.** The ratio varies by ethnicity (0.38–0.45); 0.40 is biased toward Caucasian norms. Keep as "unusual anatomy — fit may be approximate" flag.
  6. **Add face-width and bridge-width estimation** as next-highest-priority fit factors after PD. Both estimable from webcam.
- Problems / open questions:
  - PubMed was blocked (403). Relied on Google Scholar + direct article access.
  - Firecrawl credits exhausted (402). Switched to browser + curl for web access.
  - FDA General Wellness guidance page URL appears to have moved (404). Used the "NOT Medical Devices" examples page instead for regulatory guidance.
  - Iris diameter population data by ethnicity is thin — most large studies are single-population (Iranian, Chinese). Multi-ethnic normative data would improve the iris constant recommendation.
- What Hermes should know for the next decision:
  1. **ACTION REQUIRED: Change IRIS_DIAMETER_MM from 11.7 to 12.0** — this is the single highest-priority fix from this research (cuts PD systematic error by 60%).
  2. The v2 candidate's concern about PD accuracy is confirmed — but the fix is a constant change, not a pipeline overhaul.
  3. All 5 research questions answered with primary-source citations.
  4. No regulatory blockers for D2 (personal project), but safe-language recommendations are documented for future-proofing.

## Review (Hermes fills this)
- Verdict: done | rework
- Notes: