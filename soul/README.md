---
okf: 1
id: soul-index
type: index
status: active
created: 2026-08-08
updated: 2026-08-22
tags: [soul, persona, prompts]
---

# soul/ — agent identities

One file per agent. **These are the authoritative persona artifacts** — the `persona.md` component of the composition in [[ADR-002-skills-architecture]]:

```
system prompt = soul/<id>.md            ← this folder
              + knowledge packs          (in full)
              + skill index              (one line each)
              + standing constraints     (appended last)
```

[[AGENT-SPECS]] holds each agent's machine-readable `agent.yaml`. It does not restate what is here. One home per fact.

| Soul | Runtime | Tier | Authority |
|---|---|---|---|
| [claude.md](claude.md) | claude | 1 | A4 — directive |
| [admin.md](admin.md) | hermes | 2 | A3 + A4 |
| [critic.md](critic.md) | hermes | 2 | A3 |
| [researcher.md](researcher.md) | hermes | 2 | A3 + A2 |
| [coder.md](coder.md) | hermes | 2 | A3 + A2 |
| [docsmanager.md](docsmanager.md) | hermes | 2 | A3 — ledger |
| [openclaw.md](openclaw.md) | openclaw | 3 | A0 — executes |
| [opencode.md](opencode.md) | opencode | 3 | A0 — executes |

Rewritten from scratch 2026-08-22 against the current architecture — dual peer gateways (D-036), pgmq claims with visibility timeouts (D-037), autonomy through dev deploy (D-033), the human commit gate (D-008/D-034) — and extended with **docsmanager**, the Documents Manager, sole writer of [[CONTEXT-HANDOFF]]. The pre-swarm soul drafts under `Projects/VTO/SOUL-*.md` are superseded and banner-marked.

## Rules for editing a soul

1. **Identity only.** Procedures go in [[SKILLS]]; facts go in knowledge packs; sequence goes in [[WORKFLOWS]]. A soul that grows a procedure is a soul that will contradict a skill.
2. **Second person, imperative.** These are read by the agent, not about it.
3. **Every soul states what it refuses.** A role with no stated boundary will eventually do a neighbour's job badly.
4. **Every soul defines "stuck" concretely for its discipline.** A generic definition produces generic, undiagnosable declarations.
5. **Every soul names the rule its role is most likely to break.** The predictable failure, named in advance, is the cheapest correction the system owns.
6. **Corrections land here, not in chat.** A mistake corrected in a session dies with the session. Written here it applies to every future run.
7. **Souls are composed, never hand-loaded.** `swarmctl config:render` builds the prompt and hashes it; `config:verify` fails on drift. (While the renderer is a stub, install verbatim + append the standing-constraints block — see [[AGENT-PROFILES]] §3.4.)

## What is deliberately absent

No soul contains the standing constraints — those are appended last, identically, to every agent, because recency beats primacy in a long context. No soul contains its own skill list; that comes from `agent.yaml`, so a skill change does not require a soul edit. No soul contains session state — that is the Documents Manager's ledger, in [[CONTEXT-HANDOFF]], precisely so souls never rot when the work moves.

---

[[AGENT-SPECS]] · [[SKILLS]] · [[WORKFLOWS]] · [[ADR-001-agent-boundaries]] · [[standards/fully-kitted]] · [[CONTEXT-HANDOFF]]
