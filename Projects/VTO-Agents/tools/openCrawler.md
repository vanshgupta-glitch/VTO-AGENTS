# openCrawler — Signature Credential Request

> Moved here from the prior opencode session (2026-08-06) per the "global tools" ask.
> **WARNING:** the signature value below is a TRUNCATED copy from session notes —
> re-issue the original request before using these values in production code.

## Requested credential

| Field | Value |
|---|---|
| Name | `openCrawler` |
| Domain | `ankurs-vto.myshopify.com` |
| Signature | `…dK+u1HxaFvmu9pgxpdB5f0bu3yix5u+w6bmvn2j/UOjB3sCw==:` (⚠ truncated — full value missing) |
| Signature-Input | (⚠ not recorded) |
| Signature-Agent | `"https://shopify.com"` |
| Expires | (⚠ not recorded) |

## Context

- HTTP Message Signature (draft-ietf-httpbis-message-signatures) style credential.
- Scoped to the dev store `ankurs-vto.myshopify.com` (deploy target `vto-phase1`,
  client_id `dbfe07d1…`).
- Intended as a "global tool" for the `openCrawler` web-crawler agent.

## TODO

1. Re-issue / recover the full `Signature`, `Signature-Input`, and `Expires` values.
2. Confirm storage location (`.secrets.env`-style, never committed) vs vault.
3. Wire into the crawler agent's request signing before first live use.
