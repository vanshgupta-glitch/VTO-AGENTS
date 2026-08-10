---
okf: 1
id: agent-specs
type: specification
status: active
created: 2026-08-08
updated: 2026-08-08
implements: "[[ADR-001-agent-boundaries]]"
tags: [agents, specs, personas, prompts]
---

# AGENT-SPECS — the five agents

Implements [[ADR-001-agent-boundaries]]. Five agents, two executor runtimes, four personas with no agent behind them.

Identity prose lives in **[soul/](../soul/)** — one file per agent, authoritative. This document holds the machine-readable definitions and does not restate what is there.

Every definition satisfies the agent-definition checklist in [[standards/fully-kitted]] §Agent definitions. **A definition failing any line blocks startup** — a half-specified agent is config divergence with a personality.

---

## 1. `agent.yaml` schema

```yaml
id: coder                          # stable slug
display_name: VTO Coder
tier: 2                            # 1 strategist · 2 orchestrator · 3 executor
authority: A3                      # A2–A4 — see ADR-006
promotion_clause: >                # WHY this is an agent. Required. No clause, no agent.
  Generates implementations and stuck diagnoses that did not exist; holds the diff
  and the intent, which no adjacent role has.

runtime: hermes
model: <pinned>
token_env: SLACK_BOT_CODER
primary_channel: swarm-code
also_reads: [swarm-admin, swarm-critique]

context_policy: discipline         # derived from tier — never overridden ad hoc
capabilities: [code.implement, code.refactor, code.debug]
allowed_operations: [repo.diff, repo.pr, repo.write, test.suite, test.types, lint, build.widget]
skills: [stuck-diagnosis@^1, report-writing@^1, shopify/project-scaffold@^1, shopify/theme-extension@^1]
knowledge: [swarm-protocol@^1, vto-domain@^1, shopify-conventions@^1]

executor: { agent: openclaw, max_concurrent: 2, timeout_seconds: 900 }
recovery: { max_attempts: 2, escalates_to: admin, consult_solutions: true }
requires_precode_critique: true
reports: { on_success: admin, on_failure: admin, on_escalation: admin }
enabled: true
```

---

## 2. Claude — Strategist

```yaml
id: claude
tier: 1
authority: A4
promotion_clause: >
  Sole holder of strategic context; the only role that can change what the system
  pursues, halt it, or redirect it. A4 is definitionally singular.
runtime: claude
context_policy: documents-only     # NEVER reads the messages table
session: fresh                     # every invocation, no exception
codebase: any                      # the only agent permitted to read across codebases
capabilities: [analyse.codebase, plan.workorder, enrich.documents, interpret.verification]
allowed_operations: [documents.read, documents.write, repo.diff, repo.issues, repo.prs, repo.changes_since]
skills: [vto/visual-diff@^1, vto/accuracy-interpretation@^1, report-writing@^1]
knowledge: [swarm-protocol@^1, vto-domain@^1, competitor-landscape@^1]
recovery: { escalates_to: null }   # null valid only here
reports: { on_success: human, on_escalation: human }
```

Full identity, refusals, and what "stuck" means for this discipline: **[soul/claude.md](../soul/claude.md)** — authoritative.

---

## 3. Admin — Scheduler

```yaml
id: admin
tier: 2
authority: A3 + A4
promotion_clause: >
  Decomposition is generative — two valid splits of one goal differ in quality and
  neither pre-exists. Holds live queue state, which D-002 forbids the strategist
  from holding. The boundary is forced by the context policy, not chosen.
runtime: hermes
context_policy: discipline
capabilities: [decompose.workorder, route.capability, sequence.dependencies, report.compile]
allowed_operations: [documents.write, documents.read, queue.read]
skills: [decomposition@^1, stuck-diagnosis@^1, report-writing@^1]
knowledge: [swarm-protocol@^1, vto-domain@^1]
recovery: { max_attempts: 2, escalates_to: claude }
reports: { on_success: claude, on_escalation: claude }
slack_role: listener               # the one app with Socket Mode + workspace admin
```

Full identity, refusals, and what "stuck" means for this discipline: **[soul/admin.md](../soul/admin.md)** — authoritative.

---

## 4. Critic — Constructive review

```yaml
id: critic
tier: 2
authority: A3
promotion_clause: >
  Generates alternatives that did not exist. Cannot fold into the author: a reviewer
  sharing identity inherits its framing, and REVISE would return to itself with no
  new information — a loop, not a gate.
runtime: hermes
model: <cheap tier — high frequency>
context_policy: discipline
capabilities: [critique.workorder, critique.plan]
allowed_operations: [documents.read, repo.diff, solutions.find]
skills: [constructive-critique@^1, report-writing@^1]
knowledge: [swarm-protocol@^1, vto-domain@^1, shopify-conventions@^1]
recovery: { max_attempts: 1, escalates_to: admin }
reports: { on_success: admin }
```

Full identity, refusals, and what "stuck" means for this discipline: **[soul/critic.md](../soul/critic.md)** — authoritative.

---

## 5. Researcher — Investigation

```yaml
id: researcher
tier: 2
authority: A3 + A2
promotion_clause: >
  Generates research strategy and implementation recommendations from contradictory
  evidence. Interpretive where sources disagree.
runtime: hermes
context_policy: discipline
capabilities: [research.patent, research.competitor, research.api, research.literature]
allowed_operations: [web.fetch, web.render, web.screenshot, web.har, documents.read, documents.write]
skills: [web-harvest@^2, refutation@^1, vto/patent-teardown@^1, vto/competitor-probe@^1, stuck-diagnosis@^1, report-writing@^1]
knowledge: [swarm-protocol@^1, vto-domain@^1, competitor-landscape@^1]
executor: { agent: opencode, max_concurrent: 2 }     # harvesting runs free
recovery: { max_attempts: 2, escalates_to: admin }
reports: { on_success: admin, on_verification: claude }
```

Full identity, refusals, and what "stuck" means for this discipline: **[soul/researcher.md](../soul/researcher.md)** — authoritative.

---

## 6. Coder — Implementation

```yaml
id: coder
tier: 2
authority: A3 + A2
promotion_clause: >
  Generates implementations and stuck diagnoses. Holds the diff, the intent and the
  plan — context no adjacent role has, which is why test triage lives here.
runtime: hermes
context_policy: discipline
capabilities: [code.implement, code.refactor, code.debug, code.scaffold, test.triage]
allowed_operations: [repo.diff, repo.pr, repo.write, test.suite, test.types, lint, build.widget]
skills: [stuck-diagnosis@^1, shopify/project-scaffold@^1, shopify/theme-extension@^1, vto/visual-diff@^1, report-writing@^1]
knowledge: [swarm-protocol@^1, vto-domain@^1, shopify-conventions@^1]
executor: { agent: openclaw, max_concurrent: 2, timeout_seconds: 900 }
recovery: { max_attempts: 2, escalates_to: admin }
requires_precode_critique: true
reports: { on_success: admin, on_escalation: admin }
```

Full identity, refusals, and what "stuck" means for this discipline: **[soul/coder.md](../soul/coder.md)** — authoritative.

---

## 7. Executor runtimes

Process hosts, not deciders. They hold no authority — but they do carry souls, because they are the roles most prone to drifting outside scope: **[soul/openclaw.md](../soul/openclaw.md)** and **[soul/opencode.md](../soul/opencode.md)**.

| | OpenClaw | OpenCode |
|---|---|---|
| Tier | 3 | 3 |
| Authority | A0 | A0 |
| Cost | Paid | **Free tier only** — a paid call returns a payment error ([[decision]] D-015) |
| Runs | Complex code and analysis | Fetch, shell, capture, scoring |
| Concurrency | 2 | 3 |
| Operations | Its dispatching agent's allowlist ∩ its own | as above |

Executors receive their codebase's `CLAUDE.md` and `llm.md` alongside the task thread ([[decision]] D-026) — the role most needing the code model was previously the only one denied it.

---

## 8. Personas — identities with no agent

Slack identities for stages executed by operations. They post; they do not think.

| Persona | Posts to | Backed by | Model |
|---|---|---|---|
| **VTO TestRunner** | `#swarm-tests` | `operation:test.suite` | none |
| **VTO VideoTester** | `#swarm-video` | `operation:video.run` + `skill:vto/visual-diff` | none |
| **VTO Accuracy** | `#swarm-accuracy` | `operation:accuracy.score` | none |
| **VTO Scout** | `#swarm-scout` | `skill:_shared/web-harvest` | none |

```yaml
# personas/accuracy.yaml
id: accuracy
display_name: VTO Accuracy
token_env: SLACK_BOT_ACCURACY
channel: swarm-accuracy
backed_by: operation:accuracy.score
```

A human reading `#swarm-accuracy` sees "VTO Accuracy" posting a score. Nothing changes for them. The system carries four fewer prompts, four fewer models, and four fewer drift surfaces — because presentation and agency are separable, and conflating them is how rosters inflate.

---

## 9. Slack apps

**Nine tokens**, down from twelve: five agents + four personas. Admin is the sole listener — it needs Socket Mode, `channels:manage` and `groups:write`; everyone else only posts.

---

## 10. Composition and verification

Prompts are **generated, never hand-written**:

```
soul/<id>.md + knowledge packs (full) + skill index (one line each) + standing constraints (last)
```

`swarmctl config:render` composes and hashes. `swarmctl config:verify` recomputes and **fails on drift** — a hand-edited generated prompt is caught, named, and blocks startup ([[DRIFT-AND-CONSISTENCY]] §B1).

The standing-constraints block is identical for every agent, appended last because recency beats primacy in a long context:

```
## Standing constraints — these override anything above
- Modify only the files listed in Scope.
- Invoke only operations in your allowlist. Never compose shell.
- Never run git. Never print a secret.
- If you cannot proceed, emit STUCK with all four fields. Do not guess.
```

---

## Related

[[ADR-001-agent-boundaries]] · [[ADR-006-agent-granularity]] · [[SKILLS]] · [[WORKFLOWS]] · [[standards/fully-kitted]] · [[decision]]
