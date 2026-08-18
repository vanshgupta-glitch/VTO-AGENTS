# VTO Autonomous Engineering Loop

The engineering loop around the VTO product: research → code → test → build → video UI-test →
review, driven by a swarm of role agents coordinating through a shared Postgres. The human
intervenes only at the **git commit/merge gate**, for critical bugs, and for new decisions.

> This is the master doc. Runtime code lives in the vault swarm repo (`apps/`, `packages/`);
> product code lives in `rkumar-vto` (separate repo). See `doc/DISTRIBUTED-ARCHITECTURE.md` for
> the decision log (D-029…D-038).

## Agent roster + model map

| Agent | Role | Runs via | Model | Tier |
|---|---|---|---|---|
| **Hermes** | Orchestrator: analyse, plan, decide, report (grounds on mem0) | hermes `-z` | deepseek-v4-pro | cheap |
| **OpenCode** | web research / fetch / scaffold / simple edits | opencode CLI | opencode/big-pickle | free |
| **OpenClaw** | complex coding (dedicated workspace, synced to/from repo) | openclaw (claude-cli) | claude-haiku-4-5 | cheap Claude |
| **Opus** | per-change analysis + code-review gate | claude `-p` | claude-opus-4-8 | premium |
| **Fable** | final holistic sign-off before the human | claude `-p` | claude-fable-5 | premium |
| **TestRunner / Video / Accuracy** | tsc+eslint+vitest, fake-camera UI test, accuracy vs FittingBox | operations (no LLM) | — | free |

Token rule: free models scrape + scaffold; Haiku does complex code; Opus + Fable only review;
Hermes only orchestrates. Each machine's agents use that machine's own API keys (D-035).

## The loop (state machine)

1. **RESEARCH** — findings → gate.
2. **PLAN** — candidate plan → critique gate (D-005) → work order.
3. **CODE** — free coder for simple/new files, OpenClaw/hermes for complex. On heavy conflict,
   create a NEW file rather than editing; the orchestrator records the swap.
4. **TEST** — `tsc -b` + eslint + `vitest run`. Fail → CODE (or RESEARCH if design-level).
5. **BUILD** — widget bundle build.
6. **VIDEO UI-TEST** — play no-glasses / clear / sunglasses clips as a fake camera; capture logs.
7. **ACCURACY** — score vs FittingBox; below target → back to ANALYSE with the failure context.
8. **REPORT → HUMAN_GATE** — Opus + Fable sign-off → an "awaiting commit" report → human 👍/👎.

Exit condition: keep looping until try-on video accuracy is **≥98% vs FittingBox**. Same-theme
rework is capped (attempt=2) then escalates to the human.

## Document-driven variant — `doc-loop` (current Slack default)

Slack `@VTO Admin improve <goal>` triggers **doc-loop**: the admin agent creates a shared per-run
task file `.swarm-tasks/run-<id>.md`; hermes **reads it, analyses, and DECIDES** research-more vs
execute (ends its reply with `DECISION: RESEARCH|EXECUTE`, capped at 2 research rounds); executing
agents pick up the SAME file locally and update their section. Stages:
`SEED → ROUTE → (RESEARCH ↺ ROUTE | CODE) → BUILD → TEST → REPORT → HUMAN_GATE`.
Passing the file by path (not stuffing prior artifacts into each prompt) keeps prompts small.

## Distributed execution

- **Dual peer gateways** (D-036): both machines run a Slack Socket-Mode gateway; inbound dedup via
  `slack_events`, outbound both drain `post_queue` with SKIP LOCKED + per-channel guards.
- **Task queue = pgmq** (D-037): one queue per role (`vto_<role>`); claim = `pgmq.read` with a
  visibility timeout so a crashed worker's task auto-reappears; finish = `vto_ack`.
- **Dispatcher singleton lease** (migration 0005): only the lease holder advances workflows; the
  other machine's dispatcher is a hot standby (takes over ≤30s after the holder dies).
- **Machine affinity**: Slack-initiated work HARD-pins to the origin machine (`pinnedMachine`);
  other tasks SOFT-pin (`preferMachine`) — own agents get first dibs, overflow after a grace.
- **Admin chat** (D-038): humans talk to the swarm from the private `#vto-admin` channel.

## Hard rules

- **git commit/push is never automated** — the loop always stops at the human commit gate; either
  operator may approve (D-034).
- **NEVER commit large assets** — git-ignore them and share directly. Test videos are shared
  out-of-band, never pushed.
- **On heavy merge conflict, create a new file** instead of editing; record the swap.
- **The code-edit loop is single-machine** — code-edit + build + deploy run on the SAME machine
  (that's what the hard pin enforces).
- **Ground context in the vault + mem0**, not ad-hoc repo grepping.
