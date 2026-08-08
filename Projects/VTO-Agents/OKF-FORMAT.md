---
okf: 1
id: okf-format
type: protocol
project: VTO
status: active
created: 2026-08-03
updated: 2026-08-03
tags: [okf, format, spec]
---

# OKF — Open Knowledge Format (spec for this vault)

Every file in `Projects/VTO-Agents/` follows this format so the whole knowledge base is **plain markdown + YAML frontmatter**: diffable, git-pushable, and loadable as context by any future agent (Claude, Hermes, OpenClaw, or anything else that reads text).

## Frontmatter (required keys)

```yaml
---
okf: 1                  # format version
id: kebab-case-unique   # stable id, never changes
type: soul | research-agent | finding | task | protocol
project: VTO
status: active | draft | done | archived
created: YYYY-MM-DD
updated: YYYY-MM-DD     # bump on every edit
tags: [..]
---
```

## Body rules

1. H1 title, then H2 sections **fixed per type** (see the type templates in this folder — a soul has Identity/Mission/Playbook; a research-agent has Mission/Research questions/Method/Output contract; a finding has Question/Answer/Evidence/Implications).
2. One idea per bullet. Facts carry a source (URL or file path) when they came from outside.
3. Relations are `[[wikilinks]]` — they survive GitHub rendering as visible references.
4. ISO dates, metric units, ASCII-safe punctuation. No binary content — link to artifacts by path instead.
5. Findings are **append-only knowledge**: never rewrite a finding's Answer silently — add a dated correction block and bump `updated`.

## GitHub

The vault (or just `Projects/`) can be pushed as a repo any time: everything is text. Suggested: `git init` at vault root, `.gitignore` for `.obsidian/workspace*`. Ask Claude to set this up when wanted.

## Related

- [[VTO-Agents]] — folder index · [[SOUL-Hermes]] · [[SOUL-OpenClaw]] · [[VTO Agent Architecture]]
