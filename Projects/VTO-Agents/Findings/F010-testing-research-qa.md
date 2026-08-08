---
okf: 1
id: F010-testing-research-qa
type: finding
project: VTO
status: done
created: 2026-08-04
tags: [vto, testing, research-qa, validation, knowledge-gate]
---

# F010 — Research-Data QA Checklist

**Project:** [[VTO]] · Source note: [[Testing-Researcher]] [[Orchestration-Researcher]] · Task: [[T010 Testing-Validation-Protocols]]

## One-line takeaway

A gate that every swarm finding must pass before being accepted as "tested knowledge" in the vault: source count, recency, refutation pass, and integration with the existing [[LOOP-ENGINEER]] validation gate (Catalyst adversarial review → Claude Opus verdict).

---

## When this gate applies

Trigger: a research agent (or human) writes a finding note into `Projects/VTO-Agents/Findings/` with `status: done`. Before Hermes accepts it into the hub's knowledge base (wikilinks it from [[VTO]], cites it in a CANDIDATE or decision):

1. Run this QA checklist (automated where possible, manual judgment where not).
2. If it passes, mark `status: validated` and add a `validated_on` + `validated_by` field to frontmatter.
3. If it fails, mark `status: rework` with specific rejection items.

---

## QA checklist (5 gates)

### Gate 1: Source quality

Every factual claim in the finding must carry a source. No unsourced assertions accepted as knowledge.

| Check | Criterion | Fail if |
|-------|-----------|---------|
| **Source count** | ≥2 independent sources per major claim | Only one source, or all sources trace to the same origin |
| **Primary vs secondary** | At least one primary source (API doc, code, research paper, direct measurement) | All sources are blog posts, LLM-written summaries, or StackOverflow |
| **Source accessibility** | Every source is linkable or file-pathable | "I read it somewhere" or dead links with no archive |
| **Source type diversity** | Mix of: vendor docs, academic papers, code analysis, empirical measurement | All sources are the same type (e.g., all blog posts) |

**Automation:** Grep for URLs in the finding body; count unique domains. Warn if <2.

### Gate 2: Recency

The knowledge must be current. The VTO ecosystem (browsers, MediaPipe, WebGL, device APIs) moves fast.

| Check | Criterion | Fail if |
|-------|-----------|---------|
| **Maximum age** | All technical claims sourced from ≤18 months ago | Source older than 18 months with no freshness note |
| **Framework/library versions** | Version-numbered references match the versions actually used in `package.json` | Claims about "MediaPipe v0.10.9" when repo uses v0.10.18 |
| **Staleness flag** | Findings >12 months old carry a `staleness_check: YYYY-MM-DD` field; re-verified or flagged | No staleness date on finding >1 year old |
| **Browser-specific claims** | Referenced browser version is within last 2 major releases | Claims about "Chrome 110 behavior" when current is 128 |

**Automation:** Check finding's `updated` date vs current date; flag if >365 days without `staleness_check`. Cross-reference version numbers in finding against `package.json` versions.

### Gate 3: Refutation pass

Per [[Orchestration-Researcher]] and the repo's adversarial review pattern: someone (or something) must TRY to prove the finding wrong before it's accepted.

| Check | Criterion | Fail if |
|-------|-----------|---------|
| **Adversarial review** | Finding has been reviewed by at least one adversarial agent or peer | No adversarial review recorded |
| **Refutation attempt** | Reviewer explicitly tried to find counter-evidence | Review was rubber-stamp ("looks good") |
| **Counter-claims resolved** | Any counter-evidence found is addressed in the finding body (not dismissed, not ignored) | Counter-evidence exists but is buried |
| **Confidence level tagged** | Finding carries `confidence: high \| medium \| low` based on source strength + refutation outcome | No confidence tag |

**Confidence rubric:**

| Confidence | Criteria |
|------------|----------|
| **High** | ≥3 primary sources, all corroborating, refutation found no counter-evidence, <6 months old |
| **Medium** | 2+ sources, one primary, minor counter-evidence addressed, <12 months old |
| **Low** | Single source, or 2+ secondary, or known uncertainty, or >12 months without re-verification |

**Automation:** The existing [[LOOP-ENGINEER]] gate handles this: Catalyst (cheap model) tries adversarial refutation on Haiku; Claude Opus adjudicates. For a personal project without automation budget, at minimum: **Hermes reads the finding and explicitly asks "what's the strongest counter-argument and why is it wrong?"** before accepting.

### Gate 4: Integration fit

The finding must be actionable within THIS project — not generic knowledge.

| Check | Criterion | Fail if |
|-------|-----------|---------|
| **Project relevance** | Finding explicitly references a file path in `rkumar-vto/` or `3d_app/` or a Task note in this vault | Finding is generic "best practices" with no project anchor |
| **Actionable claim** | Finding has a clear "Therefore, the project should…" or "Implication for VTO:" section | Finding is interesting but has no directive |
| **No contradiction** | Finding doesn't contradict an already-validated finding or Decision | Creates unresolved conflict |
| **Conflict resolution** | If it contradicts a validated finding, the contradiction is EXPLICITLY noted and the older finding is either superseded (with date) or the newer one is flagged for resolution | Silent contradiction |

**Automation:** Grep for `rkumar-vto/`, `3d_app/`, `shopify/`, `nmg-vto` in finding body. Flag if absent.

### Gate 5: Format compliance

The finding must follow [[OKF-FORMAT]] so the vault is machine-readable and diffable.

| Check | Criterion | Fail if |
|-------|-----------|---------|
| **Frontmatter complete** | `okf: 1`, `id`, `type: finding`, `project: VTO`, `status`, `created`, `tags` | Any required field missing |
| **H1 title** | Single `#` title at line 1 (after frontmatter) | No title or wrong heading level |
| **Wikilinks present** | Links to at least [[VTO]] and the relevant research agent note | No wikilinks |
| **ISO dates** | `created` and `updated` fields are YYYY-MM-DD | Wrong format |
| **No binary content** | Finding is plain markdown; images are linked by path, not embedded | Base64 or binary blobs in markdown |
| **Bullets, not walls** | One idea per paragraph/bullet; scannable | Dense prose with no structure |

**Automation:** YAML frontmatter validator script. Already spec'd in OKF-FORMAT.

---

## Lightweight auto-validation script

A quick Node.js script that runs gates 1 (source count), 2 (recency), 4 (integration fit), and 5 (format) automatically:

```javascript
#!/usr/bin/env node
// scripts/validate-finding.mjs — run: node scripts/validate-finding.mjs Findings/F010-*.md

import { readFileSync, readdirSync } from 'fs';
import { parse as parseYaml } from 'yaml';
import { resolve, basename } from 'path';

const FINDINGS_DIR = resolve(process.argv[2] || 'Findings');

const RESULTS = { pass: [], fail: [], warn: [] };

for (const f of readdirSync(FINDINGS_DIR).filter(f => f.endsWith('.md'))) {
  const path = resolve(FINDINGS_DIR, f);
  const text = readFileSync(path, 'utf8');
  const issues = [];

  // Gate 5: Frontmatter
  const fmMatch = text.match(/^---\n([\s\S]*?)\n---/);
  if (!fmMatch) { issues.push('G5: Missing frontmatter'); }
  else {
    const fm = parseYaml(fmMatch[1]);
    if (!fm.okf) issues.push('G5: Missing okf field');
    if (!fm.id) issues.push('G5: Missing id field');
    if (fm.type !== 'finding') issues.push(`G5: type should be 'finding', got '${fm.type}'`);
    if (fm.status === 'done' && !fm.validated_on) issues.push('G5: status=done but no validated_on');
  }

  // Gate 1: Source count
  const urls = text.match(/https?:\/\/[^\s)]+/g) || [];
  const uniqueDomains = new Set(urls.map(u => { try { return new URL(u).hostname; } catch { return u; } }));
  if (uniqueDomains.size < 2) issues.push(`G1: Only ${uniqueDomains.size} unique source domain(s) (< 2 required)`);

  // Gate 2: Recency
  const fm = fmMatch ? parseYaml(fmMatch[1]) : {};
  if (fm.updated) {
    const age = (Date.now() - new Date(fm.updated).getTime()) / (86400_000);
    if (age > 365 && !fm.staleness_check) issues.push(`G2: Finding ${Math.round(age)} days old with no staleness_check`);
  }

  // Gate 4: Integration fit
  if (!/rkumar-vto|3d_app|shopify|nmg-vto/i.test(text)) {
    issues.push('G4: No project path reference (rkumar-vto, 3d_app, etc.)');
  }
  if (!/\[\[VTO\]\]/.test(text)) {
    issues.push('G4: Missing [[VTO]] wikilink');
  }
  if (!/\[\[.+-Researcher\]\]/.test(text) && !/\[\[.+-researcher\]\]/i.test(text)) {
    issues.push('G4: No research agent wikilink');
  }

  if (issues.length === 0) {
    RESULTS.pass.push(f);
  } else {
    RESULTS.fail.push({ file: f, issues });
  }

  // Gate 3: Refutation (cannot auto-validate — flag for human)
  if (!/refut|counter-arg|counter-evidence|adversarial/i.test(text)) {
    RESULTS.warn.push(`G3: No refutation language detected in ${f} — manual adversarial review needed`);
  }
}

console.log(`\n✅ ${RESULTS.pass.length} passed`);
for (const f of RESULTS.pass) console.log(`   ${f}`);

console.log(`\n❌ ${RESULTS.fail.length} failed`);
for (const { file, issues } of RESULTS.fail) {
  console.log(`   ${file}:`);
  for (const i of issues) console.log(`     - ${i}`);
}

console.log(`\n⚠️ ${RESULTS.warn.length} warnings`);
for (const w of RESULTS.warn) console.log(`   ${w}`);

process.exit(RESULTS.fail.length > 0 ? 1 : 0);
```

---

## Integration with existing validation gate

This QA checklist **augments**, not replaces, the [[LOOP-ENGINEER]] gate:

```
Swarm finding written (status: done)
    │
    ├── 1. Run validate-finding.mjs (Gates 1,2,4,5 auto-checked)
    │       └── Fail → return to author with specific issues
    │
    ├── 2. Manual adversarial review (Gate 3)
    │       ├── For HIGH-STAKES findings (cited in CANDIDATE, or affects D1/D2 decisions):
    │       │   → Run through LOOP-ENGINEER: Catalyst refutes → Opus verdict
    │       └── For LOW-STAKES findings (informational, background):
    │           → Hermes reads and explicitly surfaces counter-arguments
    │
    └── 3. Hermes accepts
            └── Mark frontmatter: status: validated, validated_on: YYYY-MM-DD, validated_by: Hermes
            └── Wikilink from [[VTO]] or relevant CANDIDATE note
```

**High-stakes rule:** Any finding that directly informs a CANDIDATE recommendation or a D-level Decision passes through the full LOOP-ENGINEER gate. Background/supporting findings pass through the lightweight manual review.

## Re-validation triggers

A validated finding must be re-validated when:

| Trigger                                                       | Action                                                                        |
| ------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| Finding >12 months old                                        | Run Gates 1–2 (source freshness). If sources are stale, mark `status: stale`. |
| New contradictory finding published                           | Run full adversarial review on both. Resolve or flag conflict.                |
| Dependency version bump (MediaPipe, three.js, Chrome)         | Re-verify version-specific claims. Update or flag.                            |
| Project pivot (new D-level decision that changes the context) | Re-check Gate 4 (integration fit). Old assumptions may no longer hold.        |

## Recording

Every validation run is recorded in a lightweight log:

```markdown
# Validation Log

| Date | Finding | Validator | Gate Results | Verdict |
|------|---------|-----------|-------------|---------|
| 2026-08-04 | F001-summary | Hermes | G1:✅ G2:✅ G3:⚠️ G4:✅ G5:✅ | validated (manual rev) |
| 2026-08-04 | F010-pd-protocol | Catalyst+Opus | G1:✅ G2:✅ G3:✅ G4:✅ G5:✅ | validated (deep rev) |
```

Store in `Projects/VTO-Agents/Validation Log.md`.

## Related

- [[VTO]] · [[Testing-Researcher]] · [[Orchestration-Researcher]]
- [[OKF-FORMAT]] · [[LOOP-ENGINEER]] · [[VTO Agent Architecture]]
- Repo adversarial-review pattern: `C:\Users\ankur.singh\shopify\nmg-vto\Decisions.md` (15/20/21-agent runs)