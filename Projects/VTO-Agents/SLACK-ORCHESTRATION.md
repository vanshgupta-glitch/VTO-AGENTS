---
tags: [vto, agents, orchestration, slack, engineering-loop]
date: 2026-08-06
status: design
related: ["[[ENGINEERING-LOOP]]", "[[VTO-Agents]]", "[[SOUL-Hermes]]", "[[SOUL-Opus]]", "[[SOUL-Fable]]", "[[SOUL-OpenCode]]", "[[SOUL-OpenClaw]]"]
---

# 🛰️ VTO Slack Orchestration — full plan + setup procedure

> The build counterpart to [[ENGINEERING-LOOP]], moved onto **Slack**. Every agent
> becomes a Slack bot with **its own token**; agents talk **only in channels**; the
> loop runs **forever until the try-on video is ≥98% indistinguishable from FittingBox**;
> the **only** human touch is approving the commit.

---

## 0. TL;DR / the idea

- **Slack is the shared brain + the audit log.** Nothing happens off-channel. Every research
  finding, diff, test result, review verdict and hand-off is a Slack message. Because it is all
  written down, **every agent that starts work already has the full context** of what was
  researched, built, tested and why it failed — just by reading the channel/thread.
- **Each agent = one Slack app = one bot token = one identity.** Hermes, OpenCode, OpenClaw,
  Opus, Fable and the test/video/accuracy bots each post under their own name and avatar.
- **The loop never stops until the target is hit.** Test/validate finds the result is below the
  mark → it re-fires the loop from **research**, feeding the failure back so research *contradicts*
  the old assumptions → new plan → coder contrasts old-vs-new → implement → basic test → **video
  UI test** → measure accuracy vs FittingBox → repeat. Exit only at **≥98%** (a human can't tell
  our render from FittingBox; beat it if possible).
- **Human only at the end.** The loop halts at `#vto-human-gate`; a person eyeballs the diff +
  the accuracy proof, reacts ✅, and commits by hand. **git is never automated.**
- **Token economy (unchanged, now enforced by the bridge):** OpenCode (free) does ALL mechanical
  work — web fetch, rebuilds, `tsc`/`eslint`/`vitest`, the video + accuracy harness. Haiku (via
  OpenClaw) does complex coding. Opus + Fable **only** review. Hermes only orchestrates. The human
  (and Claude Code as the human's analyst) **analyzes outputs — does not run the harness by hand.**

---

## 1. Principles

1. **Channel-only interaction.** An agent may not message another agent except by posting in a
   Slack channel. The bridge feeds the relevant channel/thread history into every agent
   invocation, so "talking in Slack" literally *is* how context is shared.
2. **One task = one task-id.** Every message carries a tag like `[T042]`. Threads keep a task's
   conversation together within a channel; the task-id ties it across channels. The bridge indexes
   by task-id so any agent can be handed the *entire* cross-channel history for a task.
3. **Everything is documented.** Research → dev → test → video → review are separate channels;
   the full trail is permanent and searchable. Re-runs quote the exact failure they are reacting to.
4. **Loop to a number, not to "done".** The exit condition is a measured **accuracy ≥ 0.98**
   (§7), not an agent's opinion. Below it → automatic redo from research.
5. **Human = commit gate only.** No auto-commit, no auto-merge, no auto-deploy-to-prod without a
   human ✅. (Deploys to the **dev** store for testing are allowed and are the harness's job.)
6. **Least privilege + secrets off-repo.** Bot tokens live in a git-ignored secrets file; each app
   gets only the scopes it needs.

---

## 2. Roles & the token economy

| Actor | Runs as | Model / cost | Does |
|---|---|---|---|
| **Human (Rohit)** | Slack app + eyes | — | Sets goals in `#vto-command`; approves commit in `#vto-human-gate`. |
| **Claude Code (analyst)** | this CLI | premium | **Reads** results from Slack and **analyzes/diagnoses/decides**. Does **not** run rebuilds/tests by hand ([[delegate-testing-to-opencode]]). |
| **Hermes** | `hermes` gateway | deepseek-v4-pro (cheap) | Orchestrator: assigns, tracks, decides next stage, keeps the scoreboard. Evolving memory. |
| **OpenCode** | `opencode` CLI | big-pickle (**free**) | Web fetch/scrape + simple/new-file coding + **runs TestRunner + VideoUITester + Accuracy harness**. |
| **OpenClaw** | `openclaw` (claude-cli) | claude-haiku-4-5 (cheap Claude) | Complex coding. |
| **Opus** | `claude -p` | claude-opus-4-8 (premium) | Per-change review + validation-gate verdict. Review only. |
| **Fable** | `claude -p` | claude-fable-5 (premium) | Final holistic boss sign-off before the human. Review only. |
| **TestRunner / VideoTester / Accuracy** | shell via OpenCode | free | No LLM — run commands, post numbers. |

**Hard rule:** premium models (Opus, Fable, Claude Code) never do mechanical work. If it can be a
shell command or a free-model call, OpenCode does it and posts the raw result.

### 2.1 Two-tier cycle + subagents (see [[AGENT-HIERARCHY]])

The roster runs as a **cycle between two tiers**:
- **HIGHER (brain) = command + analysis + code quality + tool-calling.** Hermes (the *skilled*
  agent) with **named subagents on different OpenRouter LLMs** — Commander (orchestrate), Analyst
  (diagnosis/contradict-research), QualityKeeper (code-quality), Researcher — plus Opus + Fable as
  the premium quality gate.
- **LOWER (hands) = controls the product + does the coding + runs tests.** OpenClaw with **named
  subagents on cheap OpenRouter LLMs** for redundant/low-analysis coding (Coder, Refactorer,
  Boilerplate) + **OpenCode** (free `big-pickle`) as the mechanical runner and fallback.

**Routing:** analysis/judgment/tool-calling → **Hermes**; redundant coding → **OpenClaw**
subagents; cheap/mechanical/fallback → **OpenCode** (free); premium review → **Opus→Fable**. Each
tier's subagents, model choices, and the exact config edits (hermes `providers`+profiles; openclaw
`agents.<name>.model.primary`) are in **[[AGENT-HIERARCHY]]**. NB: OpenCode's gateway is **free-tier
only** here — paid models come from Hermes/OpenClaw (OpenRouter) or Claude, never OpenCode.

---

## 3. Channel architecture

Workspace: **`NMG-VTO-Lab`** (new, dedicated — keeps bot noise out of any human workspace).

| # | Channel | Vis | Purpose | Primary posters |
|---|---|---|---|---|
| 1 | `#vto-command` | public | Human ↔ Hermes. Goals in, status/digest out. Holds the **loop scoreboard Canvas**. | Human, Hermes |
| 2 | `#vto-research` | public | Findings; **re-research** fires here with the failure quoted. | Scout, Researcher, Hermes |
| 3 | `#vto-planning` | public | Hermes compiles the candidate plan; Opus gates it. | Hermes, Opus |
| 4 | `#vto-dev` | public | Coders post diffs / "created FooV2.ts" / **old-vs-new contrast**. | Coder, Scaffolder |
| 5 | `#vto-tests` | public | `tsc` + `eslint` + `vitest` + widget build results. | TestRunner (OpenCode) |
| 6 | `#vto-video-ui` | public | Per-instance video results (clear / no_glasses / sunglasses): seg px, peakP, verdict, log artifacts. | VideoTester (OpenCode) |
| 7 | `#vto-accuracy` | public | **The number.** Current % vs 98%, trend, FittingBox delta. Decides continue/stop. | Accuracy (OpenCode) |
| 8 | `#vto-review` | public | Opus per-change review → Fable holistic sign-off. | Opus, Fable |
| 9 | `#vto-human-gate` | private | Terminal "AWAITING HUMAN COMMIT" cards + diff + accuracy proof. Human reacts ✅. | Hermes, Fable, Human |
| 10 | `#vto-incidents` | public | Errors, stuck loops, attempt-cap breaches, watchdog alerts. | any + Sentinel |
| 11 | `#vto-firehose` | public | Optional raw mirror of every agent action for full auditability. | bridge |

**Per-channel settings to set on creation** (Channel → Settings):
- **Topic**: one-line purpose (copy the table's "Purpose").
- **Posting permissions**: `#vto-command` and `#vto-human-gate` → keep open (human posts);
  the machine channels can stay open too (bots post via API regardless).
- **Retention**: keep **forever** (this is the audit log). Admin → Workspace settings → Message
  retention → "Keep all messages".
- **Members**: invite the bots each channel needs (§4 "channels" column) with
  `/invite @VTO-Hermes` etc. A bot can only read/post in channels it has been invited to.
- **Canvas** (`#vto-command`, `#vto-accuracy`): create a channel Canvas as the live scoreboard
  (loop #, stage, current accuracy, last 5 verdicts). Hermes/Accuracy update it via
  `canvases.edit`.

---

## 4. Agents ↔ bot tokens (one Slack app each)

Create **one Slack app per row** → each yields one **Bot User OAuth Token** (`xoxb-…`). Give each
its own display name + avatar so the channel reads like a team. ~10 apps = 5–10+ agents as asked.

| App name | env var | Runtime | Model | Channels it joins | Role |
|---|---|---|---|---|---|
| **VTO Hermes** | `SLACK_BOT_HERMES` | hermes | deepseek-v4-pro | 1,2,3,4,8,9,10 | orchestrator + scoreboard |
| **VTO Scout** | `SLACK_BOT_SCOUT` | opencode | big-pickle (free) | 2 | web fetch / scrape |
| **VTO Researcher** | `SLACK_BOT_RESEARCH` | openclaw | haiku (or deepseek-flash) | 2,3 | research analysis / synthesis |
| **VTO Coder** | `SLACK_BOT_CODER` | openclaw | claude-haiku-4-5 | 4 | complex coding |
| **VTO Scaffolder** | `SLACK_BOT_SCAFFOLD` | opencode | big-pickle (free) | 4 | boilerplate / new files |
| **VTO TestRunner** | `SLACK_BOT_TEST` | opencode→shell | free | 5 | tsc/eslint/vitest/build |
| **VTO VideoTester** | `SLACK_BOT_VIDEO` | opencode→shell | free | 6 | Playwright video UI test |
| **VTO Accuracy** | `SLACK_BOT_ACCURACY` | opencode→shell | free | 7 | accuracy vs FittingBox |
| **VTO Opus** | `SLACK_BOT_OPUS` | claude -p | claude-opus-4-8 | 3,8 | review + gate |
| **VTO Fable** | `SLACK_BOT_FABLE` | claude -p | claude-fable-5 | 8,9 | boss sign-off |
| *(opt)* **VTO Sentinel** | `SLACK_BOT_SENTINEL` | bridge | — | 10 | watchdog / stuck-loop alerts |

**Bot Token Scopes** (add under *OAuth & Permissions → Bot Token Scopes* for every app; superset —
prune per role if you want tighter least-privilege):

```
chat:write            # post messages (all)
chat:write.customize  # per-message name/icon (fallback identity)
channels:read         # list/join public channels
channels:history      # READ others' messages = the shared context
groups:read           # private channels (#vto-human-gate)
groups:history
reactions:read        # read ✅/❌/🔄 state signals
reactions:write       # set state signals
files:read
files:write           # upload logs / frames / video artifacts
app_mentions:read     # respond to @VTO-<agent>
users:read
pins:write            # Hermes pins the current loop root
canvases:write        # Hermes/Accuracy scoreboard (canvases:read too)
```

**App-Level Token** (only the app that runs the bridge's event listener needs this — or give each
its own if you run per-agent listeners): *Basic Information → App-Level Tokens → Generate* with
scope `connections:write` → yields `xapp-…` → env `SLACK_APP_TOKEN`.

**Event Subscriptions** (Socket Mode; no public URL needed): enable **Socket Mode**, then *Event
Subscriptions → Subscribe to bot events*:

```
message.channels      # new messages in public channels
message.groups        # private channels
app_mention           # @VTO-<agent>
reaction_added        # ✅ approvals, 🔄 redo
```

---

## 5. Interaction protocol (how agents talk to each other)

Everything is plain Slack text with a small, parseable convention so bots (and you) can read it.

**5.1 Task-id + stage header.** First line of every substantive message:

```
[T042 · loop 7 · stage=VIDEO] VTO VideoTester
```

**5.2 Structured result bodies** (so the next agent parses, not guesses):

```
[T042 · loop 7 · stage=VIDEO] VTO VideoTester
clear:      applied  seg=10983px peakP=0.98
no_glasses: none     seg=27px    peakP=0.45
sunglasses: FAIL     block=43% (should be dominant)   ← regressor
→ @VTO-Accuracy score this
```

**5.3 @mention = hand-off.** `@VTO-Coder implement plan [T042] …`. The bridge routes the mention
to that agent's runtime, hands it the task's full history, and posts its reply under that bot's
token.

**5.4 Emoji reactions = cheap state machine.** Bots and humans react on the task's root message:

| emoji | meaning | who sets |
|---|---|---|
| 👀 | picked up / in progress | the working agent |
| ✅ | passed / approved | TestRunner, Opus, Fable, human |
| ❌ | failed | TestRunner, VideoTester |
| 🔄 | redo — restart from research | Accuracy, Opus |
| 🚦 | at a gate, awaiting verdict | Hermes |
| 🧑‍⚖️ | needs human | Hermes/Fable |

**5.5 Threads = the task diary.** Each channel's first message for a task is the root; all follow-up
for that task in that channel replies in-thread (`thread_ts`). Re-runs **quote** the failing
message so the causal chain ("re-researching because sunglasses blocked only 43%") is explicit.

**5.6 Persistent state = Canvas + pins.** Hermes pins the active loop root in `#vto-command` and
keeps the `#vto-command` **Canvas** as the scoreboard (loop #, stage, accuracy, last verdicts).
`#vto-accuracy` Canvas holds the accuracy trend.

---

## 6. The autonomous loop, over Slack

```
 (human posts a goal in #vto-command)
        │
        ▼
 ┌──────────────┐   Hermes opens [T] , posts LOOP n START (target=0.98)
 │  RESEARCH    │◄──────────────────────────────────────────────┐
 │ #vto-research│  @Scout fetch + @Researcher synthesize.        │
 └──────┬───────┘  On a redo: QUOTE the failure; research must   │
        │          contradict/repair the old assumption.         │
        ▼                                                         │
 ┌──────────────┐   Hermes compiles candidate → @Opus gates it   │
 │  PLAN #vto-  │   (APPROVED/▶ or REVISE).                       │
 │  planning    │                                                │
 └──────┬───────┘                                                │
        ▼                                                         │
 ┌──────────────┐   @Coder (Haiku) complex · @Scaffolder (free)  │
 │  CODE #vto-  │   simple/new files. Post diff + CONTRAST vs     │
 │  dev         │   the previous build. New file on hard conflict.│
 └──────┬───────┘                                                │
        ▼                                                         │
 ┌──────────────┐   @VTO-TestRunner (OpenCode): tsc+eslint+vitest │
 │  TEST #vto-  │   +widget build. ❌ → back to CODE (or RESEARCH  │
 │  tests       │   if design-level).                            │
 └──────┬───────┘                                                │
        ▼                                                         │
 ┌──────────────┐   @VTO-VideoTester (OpenCode) runs the 3-clip  │
 │  VIDEO #vto- │   fake-camera harness; posts per-instance       │
 │  video-ui    │   verdicts + artifacts.                        │
 └──────┬───────┘                                                │
        ▼                                                         │
 ┌──────────────┐   @VTO-Accuracy scores vs FittingBox (§7).      │
 │ ACCURACY     │   < 0.98 → 🔄 redo ─────────────────────────────┘
 │ #vto-accuracy│   ≥ 0.98 → advance
 └──────┬───────┘
        ▼
 ┌──────────────┐   @Opus per-change review → @Fable holistic
 │ REVIEW #vto- │   sign-off.
 │ review       │
 └──────┬───────┘
        ▼
 ┌──────────────┐   Hermes posts "AWAITING HUMAN COMMIT [T]" +
 │ HUMAN GATE   │   diff + accuracy proof. Human ✅ → commits by
 │ #vto-human-  │   hand. git NEVER automated.
 │ gate         │
 └──────────────┘
```

**Failure handling:** same-theme rework is capped (`max_attempts_per_theme = 2`); on the 3rd try
the bridge posts 🧑‍⚖️ to `#vto-human-gate` and pauses that task. A watchdog (Sentinel) reclaims a
stage stuck > N minutes and re-posts it. This mirrors the [[ENGINEERING-LOOP]] state machine.

---

## 7. Accuracy: what "98% = indistinguishable from FittingBox" means, measurably

A loop can only stop on a **number**, so the abstract goal is turned into a computed score the
Accuracy bot posts every loop. Build this as an extension of `rkumar-vto/tools/video-test`
(call it the **accuracy harness**).

**Inputs**
- The same 3 fake-camera clips (clear / no_glasses / sunglasses), plus any added footage.
- **FittingBox reference captures**: one-time — run the same clips (or the same model + poses)
  through FittingBox and save frames as ground-truth references. (Manual/one-time setup.)

**Composite score (0..1), weighted:**
1. **Verdict correctness** (30%): clear→remove, sunglasses→block, no_glasses→neither — fraction of
   post-warmup frames with the correct verdict.
2. **Fit geometry** (25%): frame position / scale / roll error of our GLB vs the reference,
   normalized (smaller error → higher score).
3. **Perceptual similarity** (35%): **LPIPS** (learned perceptual) + **SSIM** on the eye/frame
   region, ours vs the FittingBox reference frame. This is the "can a human tell?" proxy.
4. **Stability** (10%): temporal jitter / flicker penalty (verdict and placement must not oscillate).

`accuracy = 0.30·verdict + 0.25·fit + 0.35·perceptual + 0.10·stability`. Target **≥ 0.98**;
"beat FittingBox" = perceptual/fit deltas favor us.

**Honest caveats (write these in `#vto-accuracy` so no one over-trusts the number):**
- The composite is a **proxy** for "a human can't tell". It must be **calibrated by periodic human
  spot-checks** at the gate — the human is the ground truth; tune the weights/threshold so
  "0.98 proxy" reliably means "human can't distinguish".
- 100% is not reachable and not the goal; ≥98% with human sign-off is.
- FittingBox references must exist for a fair comparison; without them, only the verdict + stability
  + our-own-quality terms are meaningful (report which terms are active).

---

## 8. The Orchestration Bridge (the glue)

The agent runtimes are CLIs (hermes / openclaw / opencode / `claude -p`), not persistent Slack
apps. One small service — the **Bridge** — connects them to Slack.

**What it does**
1. Loads every bot token + the app-level token from the secrets file.
2. Opens **Socket Mode** (one listener) and subscribes to `message.*`, `app_mention`,
   `reaction_added`.
3. On each event: parse the `[T… · stage=…]` header + any `@VTO-<agent>` mention → decide the loop
   transition.
4. Pull the task's **full cross-channel history** (`conversations.history` / `.replies` filtered by
   task-id) → hand it to the target agent runtime as context (this is how "all context is with
   every agent").
5. Run that runtime (enforcing the token economy: mechanical → OpenCode; complex code → OpenClaw;
   review → Opus/Fable).
6. Post the runtime's output to the right channel **using that agent's bot token** (so it shows as
   "VTO Coder", etc.), set the reaction state, update the Canvas.
7. Enforce the loop: `< target` → re-post to `#vto-research` with the failure quoted; halt at the
   human gate; never call git.

**Config template** — `agent-os/slack/bridge.config.yaml`:

```yaml
control:
  app_token_env: SLACK_APP_TOKEN
  target_accuracy: 0.98
  max_attempts_per_theme: 2
  human_gate_channel: "#vto-human-gate"
  never_run: ["git commit", "git push", "git merge"]   # hard block

channels:                 # name → id (fill ids after creation)
  command: C0xxx
  research: C0xxx
  planning: C0xxx
  dev: C0xxx
  tests: C0xxx
  video-ui: C0xxx
  accuracy: C0xxx
  review: C0xxx
  human-gate: C0xxx
  incidents: C0xxx

agents:
  hermes:      { token_env: SLACK_BOT_HERMES,   runtime: "hermes",   model: "deepseek/deepseek-v4-pro", channels: [command,research,planning,dev,review,human-gate,incidents], role: orchestrator }
  scout:       { token_env: SLACK_BOT_SCOUT,    runtime: "opencode", model: "opencode/big-pickle",       channels: [research], role: fetch }
  researcher:  { token_env: SLACK_BOT_RESEARCH, runtime: "openclaw", model: "anthropic/claude-haiku-4-5", channels: [research,planning], role: research }
  coder:       { token_env: SLACK_BOT_CODER,    runtime: "openclaw", model: "anthropic/claude-haiku-4-5", channels: [dev], role: code-complex }
  scaffolder:  { token_env: SLACK_BOT_SCAFFOLD, runtime: "opencode", model: "opencode/big-pickle",       channels: [dev], role: code-simple }
  testrunner:  { token_env: SLACK_BOT_TEST,     runtime: "opencode", cmd: "pnpm -C rkumar-vto/packages/vto-core exec tsc -b && pnpm -C rkumar-vto eslint … && pnpm -C rkumar-vto --filter @nmg-vto/vto-widget build", channels: [tests], role: ci }
  videotester: { token_env: SLACK_BOT_VIDEO,    runtime: "opencode", cmd: "python rkumar-vto/tools/video-test/run_video_test.py --url … --trigger .vto-try-on__button --password $VTO_STORE_PASSWORD --seconds 40 --load-timeout 90", channels: [video-ui], role: video }
  accuracy:    { token_env: SLACK_BOT_ACCURACY, runtime: "opencode", cmd: "python rkumar-vto/tools/video-test/accuracy.py …", channels: [accuracy], role: accuracy }
  opus:        { token_env: SLACK_BOT_OPUS,     runtime: "claude",   model: "claude-opus-4-8", channels: [planning,review], role: review }
  fable:       { token_env: SLACK_BOT_FABLE,    runtime: "claude",   model: "claude-fable-5",  channels: [review,human-gate], role: boss }
```

**Deploy** the bridge as a long-running service (add to `agent-os` autostart so it survives reboot),
same pattern as the F011 pollers in [[ENGINEERING-LOOP]] — except the trigger is now a Slack event,
not a cron tick. (You can keep a slow cron heartbeat that nudges a stalled loop.)

> Build note: the bridge itself is orchestration infra → it lives in **`agent-os/slack/`**, NOT in
> `rkumar-vto` ([[code-in-rkumar-vto]] is for VTO product code only). The accuracy harness *is* test
> tooling for the product → it lives in `rkumar-vto/tools/video-test/`.

---

## 9. STEP-BY-STEP SETUP

### Phase A — Workspace & channels
1. Create a Slack workspace **`NMG-VTO-Lab`** (slack.com → Create a workspace).
2. Create channels 1–11 from §3. For each: set the **Topic**, invite the bots it needs (after
   Phase B), and in `#vto-command`/`#vto-accuracy` add a **Canvas**.
3. Admin → set **message retention = keep everything**.

### Phase B — Create the 10–11 agent apps (one at a time)
For **each** row in §4:
1. https://api.slack.com/apps → **Create New App → From scratch** → name = the app name → pick
   `NMG-VTO-Lab`.
2. **OAuth & Permissions → Bot Token Scopes** → add the scope list from §4.
3. **App Home** → set the **display name** + default username; upload an avatar (distinct per agent).
4. (Listener app, or every app) **Socket Mode → Enable**; **Basic Information → App-Level Tokens →
   Generate** scope `connections:write` → save the `xapp-…`.
5. **Event Subscriptions → Enable** → subscribe to the bot events in §4.
6. **Install to Workspace** → authorize → copy the **Bot User OAuth Token** `xoxb-…`.
7. Save both tokens to the secrets file (Phase D) under this agent's env var.
8. In Slack, `/invite @<AppName>` into each channel from its "Channels" column.

### Phase C — Fill channel IDs
For each channel: open it → channel name → **About** → copy the **Channel ID** (`C0…`) into
`bridge.config.yaml` under `channels:`.

### Phase D — Secrets
Create `agent-os/slack/.secrets.env` (chmod 600, **git-ignored**):
```
SLACK_APP_TOKEN=xapp-…
SLACK_BOT_HERMES=xoxb-…
SLACK_BOT_SCOUT=xoxb-…
SLACK_BOT_RESEARCH=xoxb-…
SLACK_BOT_CODER=xoxb-…
SLACK_BOT_SCAFFOLD=xoxb-…
SLACK_BOT_TEST=xoxb-…
SLACK_BOT_VIDEO=xoxb-…
SLACK_BOT_ACCURACY=xoxb-…
SLACK_BOT_OPUS=xoxb-…
SLACK_BOT_FABLE=xoxb-…
VTO_STORE_PASSWORD=…          # for the video harness (dev store)
OPENROUTER_API_KEY=…          # Hermes/OpenClaw models
```
Add `agent-os/slack/.secrets.env` and `*.secrets.*` to `.gitignore`. **Never commit tokens.**

### Phase E — The bridge
1. Scaffold `agent-os/slack/` (Node+`@slack/bolt` Socket Mode, or Python `slack_bolt`). *(Let
   OpenCode scaffold this — free — then Claude Code reviews.)*
2. Implement: load config + secrets → Socket Mode listener → task-id parser → history fetch →
   runtime dispatch (per `agents.*.runtime`/`cmd`/`model`) → post-as-agent-token → reaction/Canvas
   updates → loop controller (`target_accuracy`, `max_attempts_per_theme`, human-gate halt, git
   block).
3. `node agent-os/slack/bridge.js` (or `python -m agent_os.slack.bridge`); add to agent-os
   autostart.

### Phase F — Accuracy harness
1. `rkumar-vto/tools/video-test/accuracy.py` — reads the video-test logs + the FittingBox
   references, computes the §7 composite, prints JSON + a one-line summary.
2. One-time: capture the FittingBox reference frames.
3. Wire `agents.accuracy.cmd` to it.

### Phase G — Verify (dry run)
1. In `#vto-command` post: `@VTO-Hermes new goal [T001]: raise sunglasses block reliability`.
2. Watch: Hermes opens the task → Scout/Researcher post in `#vto-research` → plan + Opus gate in
   `#vto-planning` → Coder/Scaffolder diffs in `#vto-dev` → TestRunner in `#vto-tests` →
   VideoTester in `#vto-video-ui` → Accuracy `%` in `#vto-accuracy`.
3. Confirm a **sub-0.98** result posts 🔄 and the loop restarts from research **with the failure
   quoted**.
4. Confirm each message shows the **right bot identity**.
5. Confirm the loop **stops** at `#vto-human-gate` with a ✅-to-commit card and does **not** run git.

---

## 10. Security

- Tokens only in `.secrets.env` (git-ignored, chmod 600). Rotate immediately if leaked
  (Slack → app → OAuth → Revoke/Reinstall).
- Least privilege: prune scopes per agent (e.g., TestRunner needs `chat:write`, `files:write`,
  `channels:history` — not `canvases:write`).
- `#vto-human-gate` private; the git block in the bridge config is a hard denylist.
- The bridge must **refuse** any agent instruction to run git/deploy-to-prod — that path only ever
  ends in a human ✅.

---

## 11. Open decisions / caveats (surface, don't hide)

- **FittingBox references** must be captured for a true "indistinguishable" score; until then the
  accuracy number runs on the verdict + stability + our-own-quality terms only — say so in-channel.
- **98% is a calibrated proxy**, validated by human spot-checks at the gate; it is not a literal
  guarantee a human is fooled.
- **Slack rate limits**: `chat.postMessage` ~1 msg/sec/channel (Tier). Keep the firehose optional
  and batch chatty logs into threaded summaries + file uploads, not 100 tiny messages.
- **First-load latency** of the segmenter (~16 s single-threaded WASM) is a real UX cost the video
  loop already surfaced; a worker/off-main-thread or a smaller model is a candidate research task
  the loop can pick up.
- The bridge is a single point of failure — keep it under the agent-os watchdog; a slow cron
  heartbeat can restart a stalled loop.

---

## 12. Where things live
- **This plan / procedure**: vault `Projects\VTO-Agents\SLACK-ORCHESTRATION.md` (here).
- **Build-task briefs for OpenCode** (bridge, accuracy harness, bootstrap, cleanup): [[OPENCODE-BRIEFS]].
- **Bridge code + config + secrets**: `agent-os/slack/`.
- **Accuracy harness + video harness**: `rkumar-vto/tools/video-test/`.
- **Model map / loop spec / souls**: [[ENGINEERING-LOOP]], [[VTO-Agents]], the `SOUL-*` notes.
- **Memory**: [[slack-orchestration]], [[delegate-testing-to-opencode]], [[eng-loop]].
