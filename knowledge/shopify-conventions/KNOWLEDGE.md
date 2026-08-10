---
okf: 1
id: knowledge-shopify-conventions
type: knowledge-pack
name: shopify-conventions
version: 1.0.0
applies_to: [vto-widget]
status: active
created: 2026-08-08
updated: 2026-08-08
tags: [knowledge, shopify, platform]
---

# shopify-conventions v1.0.0

Platform rules that constrain what may be built. Violating one of these does not produce a
failing test — it produces a rejected app review, which is discovered far later and costs far
more.

## App structure

- **Admin** is React with App Bridge and Polaris.
- **Storefront widget is vanilla TypeScript.** No React on the storefront. This is a settled
  architectural decision — reject React-on-storefront proposals rather than debating them.
- Delivered as a **Theme App Extension**, not a script tag.
- Monorepo: pnpm workspaces, `packages/vto-core`, `packages/vto-widget`, `packages/shared`,
  `extensions/vto`.

## Theme App Extension rules

- Blocks and snippets live under `extensions/vto/`.
- Liquid is for wiring, not logic.
- Assets must be referenced through the extension's asset pipeline.
- Settings come from the schema; never hard-code merchant configuration.

## Storefront constraints

- **No unsri'd external scripts.** There is a check script for this; it runs in CI.
- **CSP baseline is enforced.** A change that widens it needs justification.
- Never block first paint on the try-on bundle.
- The widget must degrade cleanly when the camera is denied or absent.

## Accessibility

Target **WCAG 2.2 AA**: focus states, focus-trapped modals, `aria-label` coverage,
status conveyed by more than colour, a camera-free fallback, and reduced-motion support.

## Verification

`test:unit` · `test:integration` · `typecheck` · `lint` · `build:packages` · `glb:validate` ·
`security`. All must pass before a change is considered done. Never a subset.

## What gets an app rejected

Sending customer imagery off-device without disclosure · requesting scopes beyond need ·
blocking the storefront on a heavy asset · breaking the theme editor preview ·
unhandled camera-permission denial.
