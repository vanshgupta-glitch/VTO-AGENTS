---
okf: 1
id: spec-swarm-io-wiring
type: spec
status: draft
created: 2026-08-12
updated: 2026-08-12
tags: [bridge, slack, logging, agent-os, dispatch, setup]
---

# Swarm I/O wiring — Slack as the bus, Agent OS as the log store

**Status:** draft, awaiting review
**Supersedes:** nothing. Adds `apps/bridge`; corrects `config/runtimes.yaml` and
`config/bridge.config.yaml`; retires 14 legacy Hermes profiles.
**Governing constraint:** no change may contradict the recorded guidance of Eean Ovens.

## 1. Problem

Six agents are defined, four Hermes profiles are installed and individually callable
(`hermes -p admin -z "..."` returns an answer in the agent's own voice), and thirteen Slack
channels exist with real IDs in [config/channels.yaml](../../../config/channels.yaml).

Nothing connects them. There is no path by which a human request reaches an agent, and no
path by which an agent's output reaches a human. Specifically:

- **No inbound Slack listener.** [doc/SLACK-SETUP.md](../../SLACK-SETUP.md) L137 states an
  interim bridge exists at `agent-os/slack/`. It does not. The only Slack code in the
  Agent OS tree is `source/src/app/api/slack/notify/route.ts`, which is outbound-only.
- **Hermes cannot supply the listener.** `hermes gateway` supports Telegram, Discord,
  WhatsApp and Weixin. It has no Slack adapter, and the venv contains no `slack_sdk` or
  `slack_bolt` — the only `slack` files present belong to `requests_oauthlib` and `tqdm`.
- **No terminal entry point.** Nothing lets a request originate from Claude Code.
- **No log surface.** The Agent OS activity feed tails `config.hermesLogs`, which defaults
  to `%LOCALAPPDATA%\hermes\cache` — a directory containing zero `.log` files. The feed is
  empty and always has been.

Three configuration defects block any implementation and are fixed here (§7, §10).

## 2. Scope

**In scope.** One request, from either entry point, reaching the Admin agent and returning
a decomposed work order — posted to Slack and recorded in two log sinks.

**Out of scope**, deferred to later phases and named so they are not smuggled in:

| Deferred | Belongs to |
|---|---|
| Critic, Coder, Researcher routing | Phase 1b |
| Executor dispatch (OpenClaw, OpenCode) | Phase 1b |
| Recovery engine, circling detection, escalation ladder | Phase 1b |
| Workflow engine and the four declared pipelines | ADR-004 |
| Solutions store and the memory tier | [spec-cost-minimal-memory](2026-08-12-cost-minimal-memory-and-context-design.md) |
| Personas (TestRunner, VideoTester, Accuracy, Scout) | Phase 2 |
| Human commit gate | Phase 1b |

Admin-only is not a reduced ambition. It is the smallest change that exercises both entry
points, both log sinks and the Slack transport end to end; everything deferred above
attaches to a dispatch core that this spec proves works.

## 3. Governing constraints

Inherited and not revisited:

1. **Slack is the medium.** Human-to-agent and agent-to-agent communication both pass
   through a channel. Owner directive 2026-08-12: *"the communication of agents with human
   and agent must be done using slack; agent os is just to maintain the logs of each
   agent."* This restates [TECHNICAL-ARCHITECTURE](../../TECHNICAL-ARCHITECTURE.md)'s
   *"every message passes through a channel, so the whole thing is auditable and
   interruptible."*
2. **Agent OS is a passive log store.** It observes. It is never in the request path, and
   its unavailability must not affect a task.
3. **Git is never automated** — `swarm.config.yaml` `never_run`.
4. **No failure in the log tier may change the outcome of a task**, mirroring
   [spec-cost-minimal-memory](2026-08-12-cost-minimal-memory-and-context-design.md) §6.
5. **Documents remain the only channel between tiers** for Tier 1. This spec does not
   touch Tier 1; Admin is Tier 2.

## 4. Architecture

One Node daemon, `apps/bridge`. Two entry points, one core, three sinks.

```
  ENTRY POINTS                 apps/bridge                          SINKS

  Slack #swarm-command          +----------------------+
  @VTO-Admin <goal>  ------->   | slack.ts             |  ------->  Slack thread
                                |  Socket Mode listener|            (the conversation)
                                |  sole writer to Slack|
  Claude Code                   +----------------------+
  swarm ask "<goal>" --HTTP->   | http.ts 127.0.0.1    |
                                +----------------------+
                                | dispatch.ts          |  ------->  swarm.log
                                |  the core, Slack-blind|           (Agent OS tails)
                                +----------------------+
                                | runtimes.ts          |  ------->  agents/admin.jsonl
                                +----------+-----------+            (durable archive)
                                           |
                                           v
                          hermes -p admin --prompt-file <tmp>
```

### 4.1 Two decisions

**The bridge is the sole writer to Slack.** `swarm ask` does not post; it POSTs to the
daemon on loopback and the daemon writes both the request and the reply into the thread.
One component owns Slack state, and the CLI's own message cannot re-trigger the
`app_mention` listener. Cost: `swarm ask` requires the daemon, and says so plainly when it
is absent.

**Terminal requests still appear in Slack**, tagged `origin=cli`. Per §3.1 the audit trail
does not acquire a hole because a request started locally.

## 5. Components

Six modules. Each is independently testable and names its dependencies.

| Module | Purpose | Depends on |
|---|---|---|
| `config.ts` | Load and validate the four config files plus `.secrets.env`. Refuse to start on error — the contract `swarm.config.yaml` already declares. | fs, yaml |
| `dispatch.ts` | **The core.** `dispatch({agent, text, origin}) -> {ok, taskId, reply, error}`. Knows nothing of Slack or HTTP. | runtimes, log |
| `runtimes.ts` | Spawn a CLI from `runtimes.yaml` `cmd_template`. Prompt file, timeout, ANSI strip, exit-code capture. | config |
| `log.ts` | The two sinks plus redaction. | config |
| `slack.ts` | Socket Mode listener and `chat.postMessage`. The only file importing `@slack/*`. | dispatch, log |
| `cli.ts` | `swarm ask "..."` — a thin loopback HTTP client. | http |

`dispatch.ts` is deliberately transport-blind. Adding Critic in Phase 1b is a change to
what dispatch calls, not to how requests arrive.

## 6. Data flow

### 6.1 Slack path

```
1. Human posts "@VTO-Admin improve landmark smoothing" in #swarm-command
2. Socket Mode delivers app_mention -> bridge ACKs immediately (< 3s)
3. Bridge allocates T###, dedupes on event_id
4. Posts to thread: [T007 · loop 0 · stage=decompose] working
5. logEvent(stage=received, origin=slack)
6. dispatch -> runtimes -> hermes -p admin --prompt-file <tmp>   [10s - 15min]
7. Reply posted into the same thread; logEvent(stage=complete)
8. STUCK or non-zero exit -> #swarm-incidents; logEvent(level=err)
```

The ack-then-work split at step 2 is mandatory. Slack retries any event not acknowledged
within three seconds; a Hermes call routinely exceeds that. Without the split a single
request is answered three times.

### 6.2 Claude Code path

Identical from step 3 onward.

```
1. swarm ask "improve landmark smoothing"
2. CLI -> POST 127.0.0.1:<port>/ask -> bridge posts the request into
   #swarm-command tagged origin=cli, then continues at 6.1 step 3
9. CLI also prints the reply locally
```

### 6.3 Task identity

`[T### · loop N · stage=X]` per [config/bridge.config.yaml](../../../config/bridge.config.yaml).
The separator is U+00B7 MIDDLE DOT throughout, not a hyphen — §10.1 depends on this.
The counter is a monotonic integer in `~/.agentic-os/swarm-logs/state.json`. When
`data/runs.db` arrives ([spec-cost-minimal-memory](2026-08-12-cost-minimal-memory-and-context-design.md) §5.6)
the counter moves there; the JSON file is an interim with one field, chosen so this spec
does not take a dependency on unbuilt work.

In v1 the **bridge** generates the header, not the agent. Agents are not yet asked to emit
it, which matters because `tools/setup.py` ASCII-folds every rendered soul — an agent's
prompt therefore never contains the `·` separator the header uses.

## 7. Prerequisites

Four items block the daemon. Three are pre-existing defects found during analysis.

### 7.1 Localise `config/runtimes.yaml`

Every `bin` path names `C:/Users/ankur.singh/...`. That user does not exist on this
machine; all five paths resolve to nothing. The file was copied from a second engineer's
setup — confirmed by `agent-os/VTO-FLEET-VS-TEAMMATE-COMPARISON.md`, which documents Ankur
running a parallel fleet on `nmg-vto` — and never localised.

Correct values already exist in `~/.agentic-os/config.json`, which the Agent OS dashboard
maintains: `hermes`, `openclaw`, `claude` and `codex` are all recorded there with valid
local paths. `runtimes.yaml` is rewritten from that file rather than by hand, so the two
cannot disagree.

`expected_version` values are reconciled at the same time. `runtimes.yaml` pins claude
`2.1.216` while `tools/setup.py` pins `2.1.226`; installed is `2.1.228`. Two pins for one
tool in one repository is itself the defect.

### 7.2 Resolve the model drift

The live Hermes profiles do not match the registry, and the drift checker reports success.

| Agent | `agent.yaml` | live `config.yaml` |
|---|---|---|
| admin | `deepseek-v4-flash` | `deepseek-v4-pro` |
| researcher | `deepseek-v4-flash` | `deepseek-v4-pro` |
| coder | `qwen3-coder-flash` | `deepseek-v4-flash` |
| critic | `qwen3-coder-flash` | `deepseek-v4-flash` |

Cause: `12f65d1` rendered the profiles; `cf36fc0` then changed every model line in
`agent.yaml`; `apply` was never re-run.

Why `verify` misses it: `cmd_verify` ([tools/setup.py](../../../tools/setup.py) L306)
recomputes the hash of the composed `SOUL.md` only. `cmd_plan(apply=True)` writes **two**
files per profile, and the model lives exclusively in the unhashed one. The fix is to
extend the stamp-and-verify treatment to `config.yaml`, so this class of drift is
mechanically caught rather than noticed. This matters more once the bridge exists, because
Admin then runs on every request.

### 7.3 Create `config/.secrets.env`

Ten `xoxb-` bot tokens plus one `xapp-` app-level token, per
[doc/SLACK-SETUP.md](../../SLACK-SETUP.md) §1. Git-ignored. Never echoed to a terminal, a
log or a channel.

### 7.4 Retire the legacy fleet

§11.

## 8. Logging

### 8.1 Layout

```
~/.agentic-os/swarm-logs/
├── swarm.log            <- the ONLY .log in this directory
├── state.json           <- task counter
└── agents/
    ├── admin.jsonl      <- per-agent durable archive
    └── ...
```

`hermesLogs` in `~/.agentic-os/config.json` points at `swarm-logs/`. No Agent OS code is
modified.

### 8.2 Why this layout

`source/src/app/api/activity/route.ts` L36 reads:

```js
const files = items.filter((f) => /\.log$/.test(f)).slice(0, 3);
```

It takes whichever **three** `.log` files `readdir` returns first, at 20 lines each. Five
per-agent `.log` files in one directory would silently drop two agents from the feed, with
the victims chosen by filesystem ordering. Exactly one `.log` at the top level makes the
feed deterministic; the per-agent archive sits in a subdirectory with a different
extension, so it is complete and invisible to the tail at once.

Nothing is displaced. `%LOCALAPPDATA%\hermes\cache`, the current `hermesLogs` default,
contains zero `.log` files — the feed shows nothing today.

### 8.3 Update safety

`agent-os/SETUP-GUIDE.md` states updates *"only ever replace the app code"* and that
`~/.agentic-os/config.json`, `~/.hermes/` and the vault are never touched. Both the logs
and the single configuration key that exposes them therefore survive every Agent OS
update. Any equivalent built inside `agent-os/source/` would not.

### 8.4 Record shape

`logEvent()` appends one human-readable line to `swarm.log` and one object to
`agents/<id>.jsonl`:

```json
{"ts":"2026-08-12T14:02:11Z","task":"T007","agent":"admin","origin":"slack",
 "stage":"complete","level":"info","channel":"swarm-command","duration_ms":8412,
 "outcome":"success","message":"..."}
```

`outcome` takes the same four values as the `runs` table — `success | stuck | timeout |
error`. It and `duration_ms` are named to match the `runs` table in
[spec-cost-minimal-memory](2026-08-12-cost-minimal-memory-and-context-design.md) §5.6, so
that spec's measurement work can ingest this archive rather than re-instrument.

## 9. Error handling

| Condition | Behaviour |
|---|---|
| Slack unreachable | Keep serving the CLI; both sinks still written. The record does not depend on Slack being up. |
| Hermes non-zero exit or timeout | Post stderr tail to `#swarm-incidents`, mark failed, `level=err`. **No retry in v1.** |
| `STUCK` block in output | Route verbatim to `#swarm-incidents`. Never summarised — the four fields are the diagnostic. |
| Log write fails | Warn, never fail the run (§3.4). |
| Duplicate `event_id` | Dropped. In-memory set plus an on-disk tail, so a restart mid-retry does not double-answer. |
| Agent OS not running | No effect. It reads files; it is never in the request path. |
| Secret in any output | Redacted at the sink (§9.1). |

No retry in v1 is deliberate. Recovery is a Phase 1b concern with a designed escalation
ladder; a blind retry bolted on here would present itself as that mechanism working.

### 9.1 Redaction is mechanical, not instructed

`tools/setup.py` `STANDING_CONSTRAINTS` tells the model *"Never print a secret at any log
level."* That is an instruction to a model. The bridge captures that model's raw stdout and
writes it to two files and a Slack channel, so an instruction the agent may ignore becomes
a leak the moment a logger exists behind it. `log.ts` strips `xox[baprs]-` and `sk-`
patterns before either write. The instruction stays; the enforcement moves to the sink.

## 10. Defects corrected

Beyond §7:

### 10.1 The task-header regex cannot match

[config/bridge.config.yaml](../../../config/bridge.config.yaml) L155:

```yaml
pattern: '\\[T(\\d+) \\· loop (\\d+) \\· stage=(\\w+)\\]'
```

YAML single quotes do not process backslash escapes, so the regex engine receives `\\[` —
an escaped literal backslash — followed by `[T(\\d+)...`, which opens a character class. It
cannot match `[T007 · loop 0 · stage=decompose]`. The pattern is double-escaped for a
JavaScript string literal that never occurs. Because `task_header.required: true`, an
implementation faithful to this file rejects every message.

Corrected to single escaping, with a unit test asserting a real header matches (§12).

### 10.2 `agents/openclaw/` does not exist

`soul/openclaw.md` exists, `bridge.config.yaml` defines an `openclaw` agent, and Coder's
`executor: { agent: openclaw }` targets it — but there is no registry entry, so
`tools/setup.py` never renders it. Already flagged in
[spec-cost-minimal-memory](2026-08-12-cost-minimal-memory-and-context-design.md) §5.0.
**Not fixed here** — executor dispatch is out of scope (§2) and the two should be resolved
together. Recorded so the gap is not rediscovered.

### 10.3 Out of scope, recorded

Not fixed here; each is real and none blocks this work.

- `swarmctl check` crashes: it iterates `Object.entries(runtimes)` over a file whose top
  level is a single `runtimes:` key, yielding one entry with `bin` undefined, and reads a
  `version_flag` field no entry defines.
- `swarmctl agent:new` reads `_template/agent.yaml` and `_template/system.md`;
  `agents/_template/` contains only `handlers.ts`.
- `swarmctl config:verify` prints `No drift detected` unconditionally with no check behind
  it.
- `agents/<id>/system.md` duplicates `soul/<id>.md` with a **weaker** standing-constraints
  block that omits the exact STUCK field names. Two prompt sources, and the duplicate
  carries the degraded copy of the rule recovery depends on.
- [doc/trajectory.md](../../trajectory.md) states *"specification complete, nothing
  implemented"* and is verified against `d68f868`. Four commits of implementation have
  landed since. It should be enriched once this work is done.

## 11. Legacy fleet removal

Fourteen Hermes profiles from the 14-agent research fleet documented in
`agent-os/VTO-AGENT-SYSTEM.md`, superseded by the roster cut recorded in
[doc/trajectory.md](../../trajectory.md) but never removed at the runtime layer:

```
mathematics  physics  patent  medical  privacy  reconstruction  device
media  competitor  fittingbox  testing  pipeline  frontend  orchestrator
```

287 MB total. Verified safe to remove: no Hermes gateway is running, and no
`Hermes_Gateway_orchestrator.vbs` exists in the Startup folder.

**Not touched:** `main` — Hermes' own default profile, whose removal risks the CLI itself —
and the four swarm profiles.

### 11.1 Sequence

1. **Sweep for unsaved work.** List every `.md` under the 14 profile trees with no
   counterpart in the Obsidian vault, and present it before anything is deleted.
2. Zip to `%LOCALAPPDATA%\hermes\_archive\legacy-fleet-2026-08-12.zip`.
3. Verify the archive opens and lists 14 roots.
4. Delete.

Never the reverse order.

### 11.2 Why the sweep is not optional

`VTO-AGENT-SYSTEM.md` §11 documents `vto-collect-findings.ps1`, whose stated job is
*"rescue findings written to scratch"* — a standing admission that agents sometimes wrote
findings into profile workspaces rather than the vault. §14's watch-list says the same from
the other direction: *"`done` rises alone -> findings landing in scratch workspaces — run
the collector."* That findings all live in the vault is the intended design, not a verified
fact, and these 14 directories are precisely where the exceptions would be.

### 11.3 Left alone

Separate calls, none costing anything idle: the `vto-research` kanban board and its audit
history; the seven `vto-*.ps1` scripts in `%LOCALAPPDATA%\hermes\bin\`; the OpenClaw
`vto-spec` agent.

### 11.4 Side effect

`VTO-AGENT-SYSTEM.md` §15 records that both OpenRouter keys were exposed in a chat
transcript and need rotating, and §12 records that Hermes profiles do not inherit `.env`.
Rotation is therefore a per-profile edit. Removing 14 profiles takes that from 19 files to
5.

## 12. Testing

Everything except the model call is provable without spending a token.

| Test | Asserts |
|---|---|
| Dispatch core, fake runtime | Task-ID allocation, `origin` propagation, `{ok,reply,error}` shape. No model, no tokens. |
| Log sinks | One `swarm.log` line per event; `agents/admin.jsonl` is valid JSONL; a planted `xoxb-` string is redacted in **both** |
| Task header | The corrected regex matches `[T007 · loop 0 · stage=decompose]` — the test that would have caught §10.1 |
| Slack adapter | Recorded `app_mention` payloads: acks within budget, targets the correct thread, drops a duplicate `event_id` |
| `--dry-run` | Full path minus the model spawn and the Slack post |
| Live smoke | `swarm ask "reply with OK"` reaches the Slack thread and both log files |

Only the last costs anything.

## 13. Build order

Each step is independently verifiable.

0. §7.1 localise `runtimes.yaml`; §7.2 resolve model drift and extend `verify` to
   `config.yaml`. Nothing runs correctly before this.
1. §11 legacy removal — sweep, archive, delete. Independent of everything else; done early
   so later steps run against a clean profile list.
2. `config.ts` + `log.ts` + the log layout (§8), with tests. No Slack, no model.
3. `runtimes.ts` + `dispatch.ts` against a fake runtime, with tests.
4. §7.3 secrets; `slack.ts` outbound only — post a fixed message to `#swarm-command`.
   Proves credentials independently of the listener.
5. `slack.ts` inbound: Socket Mode, ack, dedupe, §10.1 regex fix.
6. `http.ts` + `cli.ts` — the `swarm ask` entry point.
7. Point `hermesLogs` at `swarm-logs/`; confirm the Agent OS activity feed shows swarm
   entries.
8. Live smoke.

Step 4 before step 5 is deliberate: a token problem and a Socket Mode problem present
identically from the outside, and separating them costs one step.

## 14. Risks

| Risk | Mitigation |
|---|---|
| Socket Mode unavailable or blocked on the workspace | Transport swap to polling `conversations.history`; `dispatch.ts` is unchanged because it is transport-blind (§5) |
| Deleting a profile destroys an uncollected finding | §11.1 sweep, then archive, then delete — in that order |
| A long Hermes call breaches Slack's 3s ack | Ack precedes work (§6.1 step 2) |
| Admin runs on the wrong model, silently | §7.2 extends drift verification to `config.yaml` |
| A secret reaches a log or channel | §9.1 redaction at the sink, tested (§12) |
| Agent OS update breaks the log surface | §8.3 — logs and config live in preserved locations; no dashboard code touched |
| Admin-only proves the transport but not the swarm | Acknowledged. §2 states what is deferred; the core is built so Phase 1b changes callees, not transport |
| OpenRouter balance negative, blocking even free models | Check before step 8; `VTO-AGENT-SYSTEM.md` §14 records this exact failure |

## 15. Open questions

None blocking. Three to settle during implementation:

- Which loopback port `http.ts` binds, and whether it needs a shared-secret header. Local
  only, but any process on the machine can reach loopback.
- Whether `swarm ask` should accept `--agent` to address Critic or Researcher directly
  before Phase 1b routing exists. Cheap; possibly a distraction from Admin-only.
- Whether `swarm.log` rotates by size or by day. Neither matters at v1 volume; the Agent OS
  feed reads the tail regardless.

---

[[2026-08-12-cost-minimal-memory-and-context-design]] · [[../../SLACK-SETUP]] ·
[[../../TECHNICAL-ARCHITECTURE]] · [[../../DRIFT-AND-CONSISTENCY]] ·
[[../../standards/fully-kitted]]
