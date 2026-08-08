---
okf: 1
id: F001-fittingbox-merchant-adoption
type: finding
project: VTO
status: done
created: 2026-08-04
updated: 2026-08-04
tags: [vto, fittingbox, teardown, merchants, adoption, competitors]
related: ["[[F001-fittingbox-metrics]]", "[[VTO]]"]
---

# F001 — FittingBox: Merchant Adoption (who actually embeds it)

## Question
Which live eyewear storefronts actually embed FittingBox's widget, and what does the integration look like? Are the named targets (glasses.com, clearly.ca, framesdirect.com) FittingBox customers?

## Answer
**The three named flagship targets do NOT use FittingBox** — glasses.com, clearly.ca and framesdirect.com are **EssilorLuxottica-owned** and use Luxottica's **own VMMV "Virtual Mirror"**, not FittingBox:
- **glasses.com**: `<script src="https://vmmv.luxottica.com/v/5.6/index.umd.js">`, `vmVersion="9.0.0"`, `VirtualMirror/` script dir; VTO page `/gl-us/virtual-mirror`. Zero `fittingbox`/`FBxLive`/`vto-advanced` in homepage HTML.
- **clearly.ca**: React/MUI storefront, zero FittingBox strings; own "Virtual Mirror" at `/en-ca/c/virtual-mirror`.
- **framesdirect.com**: only Luxottica `#vmmvSwitch`/`#vmmv-banner` CSS; VTO page `/collections/virtual-try-on-glasses-dp`.

*(Note: FittingBox is itself an EssilorLuxottica brand — VMMV is a sibling product, which is why the flagship stores use VMMV.)*

### Who actually uses FittingBox (adoption evidence)
- FittingBox's own homepage + demo store list client logos: **Eyerim, JINS, Fielmann, Multiopticas, Afflelou, Kits, Pair Eyewear, Specsavers, Zenni, Le Petit Lunetier, Alensa, Baxter Blue, Hans Anders, Marchon, Zeiss, Eschenbach, LVMH, Transitions** (many of these logo URLs were visible in the demo store header).
- One confirmed literal embed: optician e-commerce platform **Optify** (`go.optifyonline.com/invision`) — "FREE Virtual Try-On powered by Fittingbox®".
- Shopify merchants using the official Fittingbox VTO personalized app (by reviews): **INDY Sunglasses, Moshades, NURILENS, FETCH Eyewear, Yoovy**.

### Integration model (observed on the demo store)
- Embedding is an **iframe** widget, not an npm/guest lib: `vto-advanced.fittingbox.com/?htmlContainerId=fitmix-container&apiKey=<merchantKey>&productName=vto-advanced`.
- A merchant-specific **apiKey** in the iframe URL drives license validation and frame catalog (`product-api.fittingbox.com/license/<apiKey>` + `glasses-metadata`). Glasses metadata is keyed to the merchant's key (`uidList=…`).

## Evidence
- `opencode` merchant scrape report `f001-scratch/merchants.md` (raw HTML fetch + grep of glasses.com / clearly.ca / framesdirect.com, 2026-08-04).
- Demo store header assets (afflelou/jins/fielmann/marchon/zenni/specsavers/lacoste/etc. PNGs) and client nav from fittingbox.com.
- Live iframe URL + apiKey captured in `f001-scratch/waterfall.json`.

## Implications for VTO
- **Don't treat the flagship EssilorLuxottica stores as FittingBox benchmarks** — they run sibling VMMV. For an Apple-style teardown, the meaningful FittingBox comparables are the independent/Shopify merchants (Pair, Zenni affiliate, INDY, FETCH, etc.) and the demo itself.
- FittingBox's go-to-market is a **Shopify "personalized" app + iframe with per-merchant apiKey** — matches our Shopify Theme App Extension distribution. We have a distribution adjacency.
- The apiKey-in-URL + license call-home dependency is a real product weakness we can avoid (fully client-side, no per-session license round-trip).

## Links
[[VTO]] · [[FittingBox-Researcher]] · [[F001-fittingbox-network-runtime]] · [[F001-fittingbox-metrics]]
