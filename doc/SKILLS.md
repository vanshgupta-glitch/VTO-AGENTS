---
okf: 1
id: skills
type: specification
status: active
created: 2026-08-08
updated: 2026-08-08
implements: "[[ADR-002-skills-architecture]]"
tags: [skills, knowledge, operations, catalogue]
---

# SKILLS — schema, catalogue and authoring

Implements [[ADR-002-skills-architecture]]. Rationale lives there; this is the contract and the initial catalogue.

**Three units, never conflated.** An **operation** is deterministic code. A **skill** is a reusable procedure. A **knowledge pack** is durable facts. A skill answers *how do I do X*; a knowledge pack answers *what is true here*.

---

## 1. `skill.yaml`

```yaml
name: web-harvest                  # unique within scope · kebab-case
version: 2.1.0                     # semver · bodies are immutable at a version
scope: _shared                     # _shared | vto | shopify | <codebase-slug>
when_to_use: >                     # ONE line. This is all an agent sees in its index.
  Fetching page content when a plain request may be blocked, rendered, or paginated.
applies_to: ["*"]                  # codebase slugs or globs
requires: [web.fetch, web.render]  # operations — validated against the allowlist at load
provides: web.harvest              # capability this satisfies
owner_agents: [researcher]         # who may invoke it
knowledge: []                      # packs this skill assumes
overrides: null                    # set when shadowing a lower-scope skill of the same name
```

**`when_to_use` is the highest-leverage line in the file.** It is the entire basis on which an agent decides to load the body. Vague here means the skill is either never used or used wrongly.

`version` is immutable: editing a released body is forbidden. Change the body, bump the version, let the pin decide.

---

## 2. `SKILL.md`

```markdown
# <name> v<version>

## When to use
Expanded from `when_to_use`. Include when NOT to use — that line prevents
more misuse than the positive case prevents omission.

## Inputs
What the invoking agent must have decided before loading this.

## Procedure
Numbered steps. Each step is an operation call, a decision, or an output.
Mark decision steps explicitly: > DECIDE: ...

## Failure modes
| Symptom | Cause | What to do |
Ends with: if none apply, emit STUCK with all four fields.

## Output contract
The exact shape the invoking agent must produce.
```

**A skill with no failure-modes section is not finished.** The happy path is the part an agent could improvise; the failure path is why the skill exists.

---

## 3. Composition

```
system prompt = persona.md                    (identity — short, stable)
              + knowledge packs               (IN FULL, declared in agent.yaml)
              + skill INDEX                   (name + when_to_use — NOT bodies)
              + standing constraints          (appended LAST)
```

Index entries render as one line each:

```
web-harvest@2.1.0 — Fetching page content when a plain request may be blocked, rendered, or paginated.
```

Loading bodies reproduces context flooding one layer down. The index is the mechanism that makes reuse cheap instead of expensive.

---

## 4. Invocation

```
1. Agent emits, on its own line:   SKILL: web-harvest@2.1.0
2. Runtime validates against the agent's declared skills.
   Undeclared → rejected, logged, agent re-prompted with the reason.
3. Runtime resolves the version, loads SKILL.md, appends it, re-invokes.
4. Invocation written to operations_log: agent · skill · resolved version · outcome.
```

Two-phase keeps the runtime in control and makes skill use **attributable** — which agent used which version of which procedure, and whether it worked. That attribution is what makes `success_rate` per skill possible later.

---

## 5. Resolution order

Most specific wins:

```
codebases/<slug>/skills/<name>     ← codebase override
skills/<domain>/<name>             ← vto · shopify
skills/_shared/<name>              ← universal
```

An override must declare `overrides: <name>@<version>`. The registry warns when the base has moved beneath it — silent overrides are how forks rot.

---

## 6. Testing

Every skill ships `test/` golden cases: recorded input, expected output shape.

```
test/
├─ blocked-page.json        # input + expected
├─ paginated.json
└─ clean-fetch.json
```

A skill change runs its own goldens **plus the goldens of every agent that pins it**. This is the answer to a shared abstraction's central danger: one edit, N silent breakages.

---

## 7. The catalogue

### `_shared` — universal

| Skill | When to use | Requires | Owners |
|---|---|---|---|
| **web-harvest** | Fetching page content when a plain request may be blocked, rendered, or paginated | `web.fetch`, `web.render`, `web.screenshot` | researcher |
| **stuck-diagnosis** | An executor has declared STUCK or circling was detected, and no stored solution matched | `solutions.find`, `repo.diff` | admin, coder, researcher, critic |
| **constructive-critique** | Reviewing a plan or work order before anyone acts on it | `repo.diff`, `documents.read` | critic |
| **refutation** | Verifying a stated research claim against its cited evidence, after the fact | `web.fetch`, `documents.read` | researcher |
| **report-writing** | Producing the capped synthesis an orchestrator sends upward | — | admin, coder, researcher |
| **decomposition** | Splitting a work order into routed, dependency-ordered issue documents | `documents.write` | admin |

### `vto` — the try-on domain

| Skill | When to use | Requires | Owners |
|---|---|---|---|
| **visual-diff** | Reading per-clip video output into structured observations about placement, occlusion and stability | `video.frames`, `image.compare` | claude, coder |
| **accuracy-interpretation** | Explaining what a composite score means given which terms were active | `accuracy.read` | claude |
| **patent-teardown** | Inferring backend behaviour from patent claims plus observed API traffic | `web.fetch`, `web.har` | researcher |
| **competitor-probe** | Instrumenting a competitor demo to capture request/response and bundle behaviour | `web.render`, `web.har` | researcher |

### `shopify` — the platform

| Skill | When to use | Requires | Owners |
|---|---|---|---|
| **project-scaffold** | Generating a skeleton or boilerplate that must match this platform's conventions | `repo.write`, `build.widget` | coder |
| **theme-extension** | Changing anything inside a theme app extension | `repo.write`, `build.widget` | coder |

### Knowledge packs

| Pack | Contains |
|---|---|
| **vto-domain** | Try-on vocabulary, the fit-geometry model, what the accuracy terms mean, the competitor landscape as settled fact |
| **shopify-conventions** | App structure, theme extension rules, review constraints, what is forbidden on the storefront |
| **swarm-protocol** | Message header grammar, the four STUCK fields, the report contract, escalation semantics |

`swarm-protocol` is loaded by **every** agent. It is the one pack with no domain — it describes how agents talk, and an agent that gets it wrong is unroutable.

---

## 8. Worked example

```yaml
# skills/_shared/web-harvest/skill.yaml
name: web-harvest
version: 2.1.0
scope: _shared
when_to_use: >
  Fetching page content when a plain request may be blocked, rendered, or paginated.
applies_to: ["*"]
requires: [web.fetch, web.render, web.screenshot]
provides: web.harvest
owner_agents: [researcher]
knowledge: []
```

```markdown
<!-- skills/_shared/web-harvest/SKILL.md -->
# web-harvest v2.1.0

## When to use
You need the content of a page and cannot assume a plain request will return it.

**Do not use** for an API with a documented contract — call the operation directly.
**Do not use** to decide *whether* something is worth fetching. That is your judgment,
made before you load this.

## Inputs
- Target URL or URLs
- What you are looking for, in one sentence. You will need it at step 4.

## Procedure
1. `web.fetch` the URL.
2. If the response is non-empty and contains the expected markers → return it. Done.
3. If empty, or a shell with no content → `web.render` (headless, wait for network idle).
4. If still empty, or a challenge page:
   > DECIDE: is this content obtainable another way — a sitemap, a JSON endpoint,
   > an archived copy, a different entry point? You know what you are looking for;
   > the fetch layer does not. Choose based on that, not on persistence.
5. If paginated, follow `rel=next` up to 20 pages, then stop and report the truncation.
6. On 429 or 503, back off 2s / 8s / 30s. After the third, stop.
7. Record every URL attempted and its outcome. Partial results are results.

## Failure modes
| Symptom | Cause | What to do |
|---|---|---|
| Empty body, 200 status | Client-rendered | Step 3 |
| Challenge interstitial | Bot protection | Step 4 — do not attempt evasion |
| Content behind login | Not public | Stop. Report as unobtainable. |
| Repeated 429 after backoff | Rate limited | Stop. Report with the URLs attempted. |

If none apply, emit STUCK with all four fields.

## Output contract
{ url, method_used, status, content | null, urls_attempted[], truncated: bool, notes }
```

Note what step 4 does: it hands the decision **back to the agent**, because the agent knows why it is fetching and the skill does not. That is the whole justification for Scout being a skill rather than an agent ([[ADR-001]]), expressed as a procedure step.

---

## 9. Authoring rules

1. **One procedure per skill.** Two procedures means two skills.
2. **A skill may invoke operations; it may not invoke agents.** Agents invoke skills, never the reverse — the call graph stays acyclic.
3. **Decision steps are marked `> DECIDE:`** and state what information the decision needs. An unmarked decision reads as a step and gets executed without thought.
4. **Failure modes are mandatory** and end with the STUCK fallback.
5. **No domain facts inside a procedure.** They belong in a knowledge pack, or they get copied and diverge.
6. **Bodies are immutable at a version.** Edit means bump.
7. **A skill nobody pins is dead.** Remove it — an unpinned skill is untested surface.

---

## Related

[[ADR-002-skills-architecture]] · [[ADR-003-multi-codebase]] · [[AGENT-SPECS]] · [[WORKFLOWS]]
