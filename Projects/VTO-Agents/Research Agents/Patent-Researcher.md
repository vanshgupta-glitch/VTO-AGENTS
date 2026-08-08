---
okf: 1
id: ra-patent
type: research-agent
project: VTO
status: active
created: 2026-08-03
updated: 2026-08-03
tags: [research-agent, patents, ip, freedom-to-operate]
---

# Research Agent — Patent Researcher

## Mission

Map the IP minefield around virtual try-on and frame removal, so the project can design around it — and document prior art that keeps our approaches safe.

## Why this matters now (project context)

- Fittingbox claims **16 international patents specifically on Frame Removal**; the project docs flag a freedom-to-operate (FTO) review as **required before shipping** a pixel-classified glasses eraser.
- Our current removal approach differs (textured face mesh driven by live landmarks + calibrate-and-lock patch), which may matter for design-around arguments.
- Known prior art lead: Lyu et al., CVPR 2022 (synthetic glasses rendering for segmentation labels). TRELLIS (AI GLB gen) is confirmed MIT.

## Research questions

1. Enumerate Fittingbox's patent families (assignee searches: "Fittingbox", "FITTINGBOX SA", inventors from Toulouse) on Google Patents/Espacenet/WIPO — numbers, titles, claim summaries, jurisdictions, expiry dates.
2. Which claims actually read on (a) pixel classification of glasses, (b) inpainting the face behind frames, (c) virtual try-on placement, (d) multi-angle scanning (StudioBox)? Independent claims only, in plain English.
3. Design-around analysis: does our mesh-texture-imprint approach avoid the classification-based claims? What claim elements do we clearly NOT practice?
4. Prior art harvest: pre-priority-date publications for glasses removal/segmentation (academic + product) that weaken the broadest claims.
5. Broader field: other VTO patent holders (Luxottica/EssilorLuxottica, Ditto, Warby Parker, Snap, Perfect Corp) — anything reading on iris-based PD or webcam try-on?

## Method & tools

Google Patents, Espacenet, WIPO PatentScope, USPTO — via web_fetch/browser; firecrawl for bulk claim scraping. Record patent numbers + priority dates + links for every statement.

## Output contract

Finding notes `Findings/F<NNN> patent-<family>.md` plus a rollup `F<NNN> patent-fto-map.md`: risk table (patent × our feature × reads-on? × design-around × expiry). Mark clearly: **this is research, not legal advice — a licensed patent attorney must do the formal FTO before launch.** OKF `type: finding`. Link [[VTO]] and this file.
