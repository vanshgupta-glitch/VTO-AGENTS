# web-harvest v2.1.0

## When to use

You need the content of a page and cannot assume a plain request will return it.

**Do not use** for an API with a documented contract — call the operation directly.
**Do not use** to decide *whether* something is worth fetching. That is your judgment, made before you load this.

## Inputs

- Target URL or URLs.
- **What you are looking for, in one sentence.** You will need it at step 4.

## Procedure

1. `web.fetch` the URL.

2. If the response is non-empty and contains the expected markers → return it. Done.

3. If empty, or a shell with no content → `web.render` (headless, wait for network idle).

4. If still empty, or a challenge page:
   > **DECIDE:** is this content obtainable another way — a sitemap, a JSON endpoint, an archived copy, a different entry point?
   > You know what you are looking for; the fetch layer does not. Choose based on that, not on persistence.

5. If paginated, follow `rel=next` up to 20 pages, then stop and report the truncation.

6. On 429 or 503, back off 2s / 8s / 30s. After the third, stop.

7. Record every URL attempted and its outcome. **Partial results are results.**

## The stopping rule

**Two strategies, then report.** Plain, then rendered. If both fail, the answer is *"this is not obtainable this way"* — and that answer is worth having quickly.

Retry logic feels like diligence. A fourth attempt, a fifth backoff, a creative route around a challenge: none of it produces the content, and all of it burns wall-clock while somebody waits. Whoever asked knows *why* they wanted it and can decide what to do instead. The fetch layer cannot.

## Failure modes

| Symptom | Cause | What to do |
|---|---|---|
| Empty body, 200 status | Client-rendered | Step 3 |
| Challenge interstitial | Bot protection | Step 4 — **do not attempt evasion** |
| Content behind login | Not public | Stop. Report as unobtainable. |
| Repeated 429 after backoff | Rate limited | Stop. Report with the URLs attempted. |
| Content present but not what you wanted | Wrong page, or the site changed | Report what you got. Do not guess at a better URL. |

If none apply, emit STUCK with all four fields.

## Constraints

Respect robots and terms of service. Public pages and documented endpoints only. Never evade bot protection, never work around authentication, never scrape what a site asks you not to. **A blocked source is a result — report it as one.**

Cite every fetched fact with its URL and the date checked.

## Output contract

```json
{
  "url": "<requested>",
  "method_used": "fetch | render",
  "status": 200,
  "content": "<body>" ,
  "urls_attempted": [{"url": "...", "status": 403}],
  "truncated": false,
  "notes": "<anything the caller should know>"
}
```

`content: null` with a populated `urls_attempted` and a clear `notes` is a complete, useful answer. It is not a failure.
