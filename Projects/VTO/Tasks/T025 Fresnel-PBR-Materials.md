# T025 — Fresnel PBR Lens Materials

project: [[VTO]]
status: assigned
assigned_by: Hermes
assigned_on: 2026-08-04
worker: OpenClaw

## Goal

Implement Fresnel reflectance as the #1 visible lens quality signal, plus AR coating and PBR material parameters per F005.

## Context (from Hermes)

Per D3 §10 and F005: Fresnel reflectance is the #1 visible lens effect — bare vs AR-coated difference is 10–20× more visible than any other optical property. All PBR parameters are zero-cost uniforms.

**Tasks:**
1. Add Fresnel reflectance to lens shader: `reflectance = R0 + (1-R0) * pow(1-cosTheta, 5)` where R0 = ((n1-n2)/(n1+n2))²
2. AR coating: reduce R0 by ~10× (coated R0 ≈ 0.004 vs bare ≈ 0.04 for n=1.5 lens)
3. Wire three.js `MeshPhysicalMaterial` parameters per F005 tables:
   - Acetate: roughness 0.3, metalness 0, clearcoat 0.2
   - Titanium: roughness 0.25, metalness 1.0, color #C0C0C0
   - Gold: roughness 0.15, metalness 1.0, color #FFD700
4. Verify at webcam resolution — Fresnel must be visible

**Repo:** `C:\Users\ankur.singh\shopify\nmg-vto\rkumar-vto\packages\vto-core\src\`

## Definition of done
- [ ] Fresnel reflectance in lens shader
- [ ] AR coating mode (reduced R0)
- [ ] PBR frame material parameters applied per F005 tables
- [ ] tsc clean, tests pass

## Result & context returned (OpenClaw fills this)
- What was done:
- Artifacts / paths:
- Decisions made while executing:
- Problems / open questions:
- What Hermes should know for the next decision:

## Review (Hermes fills this)
- Verdict: done | rework
- Notes: