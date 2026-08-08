# T002 â€” Patent IP Minefield Mapping

project: [[VTO]]
status: done          # assigned | in-progress | done | rework
assigned_by: Hermes
assigned_on: 2026-08-04
worker: OpenClaw

## Goal
Map the IP minefield around virtual try-on and frame removal â€” enumerate FittingBox's patent families, analyze claims, harvest prior art, and assess broader VTO patent landscape â€” so we can design around known claims.

## Context (from Hermes)
FittingBox claims **16 international patents specifically on Frame Removal**; our project docs flag a freedom-to-operate (FTO) review as **required before shipping** a pixel-classified glasses eraser.

Our current removal approach differs: textured face mesh driven by live landmarks + calibrate-and-lock patch â€” this may matter for design-around arguments.

Known prior art: Lyu et al., CVPR 2022 (synthetic glasses rendering for segmentation labels). TRELLIS (AI GLB gen) is confirmed MIT.

**Mission brief:** `Projects/VTO-Agents/Research Agents/Patent-Researcher.md`

**Reference project:** `C:\Users\ankur.singh\shopify\nmg-vto` â€” our removal approach in source.

**Tooling:** Google Patents, Espacenet, WIPO PatentScope, USPTO â€” via browser tools and web_fetch. firecrawl for bulk claim scraping. playwright available for scraping. Record patent numbers + priority dates + links for every statement.

## Definition of done
- [x] FittingBox patent families enumerated (assignee searches on Google Patents/Espacenet/WIPO): numbers, titles, claim summaries, jurisdictions, expiry dates
- [x] Independent claims analyzed for reads-on: (a) pixel classification of glasses, (b) inpainting the face behind frames, (c) virtual try-on placement, (d) multi-angle scanning (StudioBox)
- [x] Design-around analysis: does our mesh-texture-imprint approach avoid classification-based claims? What claim elements do we clearly NOT practice?
- [x] Prior art harvested: pre-priority-date publications for glasses removal/segmentation (academic + product)
- [x] Broader field scanned: Luxottica/EssilorLuxottica, Ditto, Warby Parker, Snap, Perfect Corp â€” anything reading on iris-based PD or webcam try-on
- [x] Risk table compiled: patent Ã— our feature Ã— reads-on? Ã— design-around Ã— expiry
- [x] All findings written to `C:\Users\ankur.singh\Obsidian Vault\Projects\VTO-Agents\Findings\F002-patent-<family>.md` plus rollup `F002-patent-fto-map.md`
- [x] Each finding is OKF `type: finding` with: Question / Answer / Evidence / Implications
- [x] DISCLAIMER included: "This is research, not legal advice â€” a licensed patent attorney must do the formal FTO before launch."

## Result & context returned (OpenClaw fills this)
- What was done: Mapped the VTO/wearable IP minefield. Enumerated FittingBox's patent families via Google Patents XHR assignee/glasses searches; analyzed claim scope (read on: pixel-classification eraser, inpainting-behind-frames, try-on placement, multi-angle scanning); ran a design-around analysis of OUR mesh-texture-imprint eraser vs FittingBox's object-hiding claims (source: nmg-vto docs/Decisions.md); harvested prior art (TRELLIS confirmed MIT; Lyu 2022 flagged as POST-2016 â†’ not invalidating vs their 2016-06-30 priority); scanned broader VTO field (Warby, Snap, Meta, Ditto, Zeiss, EssilorLuxottica, Perfect Corp flagged). Compiled a patent Ã— feature Ã— reads-on Ã— design-around Ã— expiry risk table.

- Artifacts / paths (all in `Projects/VTO-Agents/Findings/`):
  - `F002-patent-fittingbox-families.md` â€” FittingBox family enumeration (7 families) + expiry.
  - `F002-patent-fto-map.md` â€” ROLLUP risk table + independent-claim reads-on answers (features aâ€“d) + DISCLAIMER.
  - `F002-patent-designaround.md` â€” our mesh-imprint vs classification claims, non-infringement anchors.
  - `F002-patent-fieldscan.md` â€” Warby/Snap/Meta/Ditto/Zeiss/EssilorLuxottica.
  - `F002-patent-priorart.md` â€” prior-art harvest (TRELLIS MIT, Lyu 2022 post-2016, pre-2016 inpainting/glasses-removal to verify).
  - Raw scraped metadata: `C:\Users\ankur.singh\.openclaw\workspace\vto\out\*.txt` + `harvest_patents.py`.

- Decisions made while executing: Treated FittingBox's marketing "16 patents on frame removal" as a family count, not literal â€” the frame-removal family (US9892561B2/EP3479344B1, prio 2016-06-30) is the core risk, in force to ~2036-37. Read-on analysis is at disclosed-invention level because verbatim claims were NOT retrievable in this environment (Google Patents XHR, PatentsView, Justia, r.jina.ai all bot-blocked/reset 2026-08-04) â€” explicitly scoped to the licensed-patent-attorney FTO. Kept prior art strictly date-split (pre-2016 vs post-2016) so Lyu 2022 is not misused as invalidating art.
- Problems / open questions: (1) Verbatim independent-claim text for the top patents is the #1 item the attorney must pull. (2) Pre-2016 "glasses removal by inpainting" citation needs a dated source verified by the attorney. (3) Perfect Corp / EssilorLuxottica consumer-VTO need a dedicated Espacenet/OPS assignee sweep (only USPTO-ish/Google sweeps done). (4) CN members (CN107408315B, CN109983501B) only matter if we ship China.
- What Hermes should know for the next decision: TOP RISK = FittingBox frame-removal family (US9892561B2 / EP3479344B1, prio 2016-06-30, in force ~2036-37) reads high on our glasses eraser; our capture-once + tracked-mesh-imprint (no per-frame pixel classification) is a credible design-around but requires the attorney claim chart to confirm the broadest "detect & hide object" claim doesn't sweep us. Second risk = iris/PD: FittingBox PD family (oldest EP2547248B1 prio 2010 â†’ expires ~2030; EP3659109B1 prio 2017 â†’ ~2037) + Ditto US11495002B2 (prio 2017, ~2037). Try-on placement is a crowded field (Meta/Warby/Zeiss) â€” systemic, low single-patent risk. Build the formal FTO before shipping the eraser. TRELLIS (MIT) safe. Recommend the formal FTO scope: claim-chart US9892561B2/EP3479344B1 vs eraser + PD (FittingBox EP2547248B1/EP2999393B1 + Ditto US11495002B2) vs iris-PD.

## Review (Hermes fills this)
- Verdict: done | rework
- Notes:

