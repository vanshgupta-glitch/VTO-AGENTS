---
tags: [vto, agents, orchestration, slack, opencode, build-tasks]
date: 2026-08-06
status: ready-to-assign
related: ["[[SLACK-ORCHESTRATION]]", "[[ENGINEERING-LOOP]]", "[[SOUL-OpenCode]]", "[[delegate-testing-to-opencode]]"]
---

# 🧱 OpenCode build-task briefs — Slack orchestration + accuracy

Assignable specs for **OpenCode** (free, `opencode/big-pickle`) to build the machinery in
[[SLACK-ORCHESTRATION]]. OpenCode does the mechanical scaffolding + runs the harness; **Claude Code
reviews every diff before it counts as done** ([[delegate-testing-to-opencode]]). Hand one brief at
a time via `#vto-command` / `#vto-dev`.

---

## Global constraints (apply to EVERY brief)

- **Never run git.** No `git add/commit/push/merge`. Committing is the human gate only.
- **Where code lives:** orchestration infra → `agent-os/slack/`. Product/test tooling →
  `rkumar-vto/tools/video-test/`. Do **not** put infra in `rkumar-vto` ([[code-in-rkumar-vto]]).
- **Secrets never in code or git.** Read tokens from `agent-os/slack/.secrets.env` (git-ignored).
  Commit only a `.secrets.env.example` with empty values.
- **New files over risky edits.** On a hard conflict, create `foo.v2.js` and note the swap; don't
  corrupt working code.
- **Incremental save.** Write files as you go; if blocked > ~10 min, post what you have + the
  blocker to `#vto-incidents` and stop — don't spin.
- **Report format (post to the task thread):** (1) files created/changed with paths, (2) how you
  verified (commands + output), (3) anything stubbed/incomplete, (4) `@VTO-Analyst please review`.
- **Prefer standard, well-documented libs.** Pin versions in `package.json` / a `requirements.txt`.
- **Ask, don't guess** exact external CLI flags (hermes/openclaw/claude) — leave them as config
  templates (see OC-1) rather than inventing them.

---

## OC-1 — Slack Orchestration Bridge  ·  `agent-os/slack/`

**Goal.** A long-running service that connects the CLI agents to Slack: it listens to channel
events, decides the next loop step, hands each agent the task's full Slack context, runs the agent's
runtime, and posts the result back **under that agent's own bot token**. It enforces the loop
(→≥98%) and halts at the human commit gate. Spec: [[SLACK-ORCHESTRATION]] §5, §6, §8.

**Stack.** Node.js (LTS), plain JavaScript (not TS). Deps: `@slack/web-api`,
`@slack/socket-mode`, `js-yaml`, `dotenv`. One `WebClient` **per agent token** (for posting as that
identity); one `SocketModeClient` with the app-level token (for events).

**Deliverables (exact paths):**
```
agent-os/slack/package.json
agent-os/slack/.gitignore              # ignores .secrets.env
agent-os/slack/.secrets.env.example    # every env var from SLACK-ORCHESTRATION §9 Phase D, empty
agent-os/slack/config/bridge.config.yaml   # copy the template from SLACK-ORCHESTRATION §8
agent-os/slack/bridge.js               # entry point
agent-os/slack/lib/config.js           # load yaml + .secrets.env; fail loudly on missing token
agent-os/slack/lib/protocol.js         # parse/build the message protocol
agent-os/slack/lib/slackio.js          # post-as-agent, react, history, canvas
agent-os/slack/lib/runtimes.js         # dispatch to hermes/openclaw/opencode/claude/shell
agent-os/slack/lib/loop.js             # the state machine / controller
agent-os/slack/README.md               # run + verify instructions
```

**`lib/protocol.js` (build this FIRST — it is pure + unit-testable):**
- `parseHeader(text)` → `{ taskId, loop, stage, agent }` from a first line like
  `[T042 · loop 7 · stage=VIDEO] VTO VideoTester` (regex; tolerate missing fields → nulls).
- `parseMentions(text)` → array of mentioned agent keys from `@VTO-<Name>` (map display→key via
  config).
- `buildHeader({taskId, loop, stage, agentDisplay})` → the canonical first line.
- `STAGES = ['RESEARCH','PLAN','CODE','TEST','VIDEO','ACCURACY','REVIEW','HUMAN']` and
  `nextStage(stage)`.
- Emoji state map from §5.4 (`👀✅❌🔄🚦🧑‍⚖️`).

**`lib/slackio.js`:**
- `clientFor(agentKey)` → cached WebClient built from that agent's token.
- `postAs(agentKey, channel, text, {thread_ts})` → `chat.postMessage`.
- `react(agentKey, channel, ts, emoji)` → `reactions.add`.
- `taskHistory(taskId, channels)` → gather messages containing `[T<taskId>` across the given
  channels via `conversations.history` (+ `conversations.replies` for threads); return a single
  chronological context string. **This is how "all context is with every agent".**
- `updateScoreboard(fields)` → best-effort Canvas edit in `#vto-command` (guard with try/catch;
  if `canvases.*` scopes/methods unavailable, fall back to editing a pinned message).

**`lib/runtimes.js`:**
- Each agent in config has either `runtime` (hermes|openclaw|opencode|claude) or a shell `cmd`.
- `run(agent, {context, instruction})` → `Promise<string stdout>` via `child_process.execFile`
  with a timeout (default 600s) and captured stdout/stderr.
- Runtime → command comes from a **template in config** (`cmd_template`) with placeholders
  `{model} {context_file} {instruction_file}`; write context/instruction to temp files and
  substitute. **Do NOT invent CLI flags** — ship sensible template defaults but make them config-
  overridable and document that the human confirms each tool's exact CLI.
- **Git denylist:** before running any shell `cmd`, reject (throw) if it matches
  `control.never_run` patterns.

**`lib/loop.js` (controller — the state machine of §6):**
- On an inbound event, use `protocol.parseHeader` + mentions to decide the target agent + action.
- Idempotency: keep a Set of processed `event_id`/message `ts` (Slack retries) — skip duplicates.
- Transitions (MVP): a `stage=TEST ❌` → re-dispatch CODE; `stage=VIDEO` done → dispatch ACCURACY;
  ACCURACY `< target_accuracy` → post to `#vto-research` **quoting the failing message** + set 🔄
  + increment the task's attempt counter; ACCURACY `≥ target` → dispatch REVIEW; REVIEW signed off
  → post the "AWAITING HUMAN COMMIT" card to `#vto-human-gate` + 🧑‍⚖️.
- Attempt cap: if a theme exceeds `max_attempts_per_theme`, post 🧑‍⚖️ to human-gate and pause.
- **Never** advance past the human gate automatically; **never** call git.

**`bridge.js`:** load config → build clients → open Socket Mode → on each `message`/`app_mention`/
`reaction_added` event call `loop.handle(event)`. Log every action to stdout AND mirror to
`#vto-firehose` if configured.

**Build in this order (MVP → full):**
1. `protocol.js` + a tiny `test/protocol.test.js` (node:test) proving parse/build round-trips.
2. `config.js` + loads secrets + `--check` mode that prints the resolved agent→token map with
   tokens **masked** (never print full tokens).
3. `slackio.postAs` + `bridge.js --dry-run <sample-event.json>` that prints the dispatch decision
   **without** calling Slack.
4. Live: Socket Mode listener + `taskHistory` + `runtimes.run` + reactions.
5. `loop.js` controller + scoreboard.

**Acceptance criteria (verify + paste output):**
- `node --test agent-os/slack/test/` → protocol tests pass.
- `node agent-os/slack/bridge.js --check` → prints the masked agent/token/channel map; errors
  clearly if a token env is missing.
- `node agent-os/slack/bridge.js --dry-run agent-os/slack/test/sample-video-event.json` → prints:
  parsed header, chosen next stage, target agent — with **no** network calls.
- `README.md` documents install (`npm i`), `--check`, `--dry-run`, live run, and autostart.
- No token is ever printed in full or written outside `.secrets.env`.

---

## OC-2 — Accuracy harness  ·  `rkumar-vto/tools/video-test/accuracy.py`

**Goal.** Turn the video-test outputs into the single **accuracy number** the loop stops on
(≥0.98), per [[SLACK-ORCHESTRATION]] §7. Ship a useful score **now** from existing logs, and make
the perceptual/fit terms activate when reference frames exist.

**Context (existing files to read):**
- `rkumar-vto/tools/video-test/run_video_test.py` writes `logs/<name>.summary.json` (has
  `instance, seg_px_max, peakP_max, removal_applied, removal_blocked, removal_no_specs, pass`) and
  `logs/run.summary.json`. Also `logs/<name>.log` has per-frame `[vto] seg:` and `[vto] rm …`
  lines (verdict + `blocked=<bool>`).

**Deliverable:** `rkumar-vto/tools/video-test/accuracy.py` (Python 3, stdlib + optional
`scikit-image`/`numpy`; guard heavy imports).

**Part A — verdict + stability from existing logs (NO new deps, do this first):**
- Parse each `logs/<name>.log` for the post-warmup `[vto] rm …` verdict lines (after the first
  `glasses segmenter ready`). Classify each as `applied` / `BLOCKED` / `no specs`.
- **Verdict term (0..1):** fraction of post-ready frames whose verdict is the CORRECT one per
  instance: clear→applied, sunglasses→BLOCKED, no_glasses→(no specs / not applied & not blocked).
- **Stability term (0..1):** `1 − flip_rate`, where flip_rate = fraction of adjacent post-ready
  frames whose verdict category changed (penalizes the block↔remove flicker we saw on sunglasses).
- Overall instance accuracy = weighted mean; corpus accuracy = mean over instances.

**Part B — perceptual + fit (activate when references exist):**
- `--refs-dir <dir>` with FittingBox reference frames named `<instance>/<frame>.png`, and OUR
  captured frames in `logs/frames/<instance>/<frame>.png` (see OC-2B).
- **Perceptual term:** mean **SSIM** (via `skimage.metrics.structural_similarity`) over the
  eye/frame region, ours vs reference. Optional **LPIPS** if `lpips`+`torch` importable (guarded);
  if present, blend `0.5·(1−LPIPS) + 0.5·SSIM`, else SSIM only.
- **Fit term:** if a `logs/<name>.fit.json` exists (frame position/scale/roll vs reference),
  compute normalized error → 0..1; else mark inactive.

**Graceful degradation:** compute only the terms whose inputs exist; report `active_terms`;
**renormalize weights over active terms**; never crash on missing refs.

**Weights (default, from §7):** verdict 0.30, fit 0.25, perceptual 0.35, stability 0.10 —
overridable via `--weights verdict=..,fit=..,perceptual=..,stability=..`.

**CLI:** `python accuracy.py --logs-dir logs [--refs-dir refs] [--weights ...] [--out logs/accuracy.json]`

**Output:**
- `logs/accuracy.json`: `{ accuracy, target:0.98, pass, terms:{...}, active_terms:[...], per_instance:{...}, notes:[...] }`.
- **stdout one-liner for Slack** (the VTO Accuracy bot posts this verbatim):
  `accuracy=0.71 (verdict 0.80 · stability 0.55 · fit n/a · perceptual n/a) < 0.98 → redo`.

**Acceptance:** run it against the CURRENT `logs/` (clear/no_glasses/sunglasses from today) and
paste `accuracy.json` + the one-liner. It must run with **stdlib only** when no refs are present
(Part A active, Part B `n/a`), and must not crash on a missing `--refs-dir`.

---

## OC-2B — Frame capture in the video harness  ·  edit `run_video_test.py`

**Goal.** Give OC-2's perceptual term real "our" frames to compare. (Small, additive edit.)

- Add `--save-frames N` (default 0 = off). When >0, during the observe window capture N evenly
  spaced screenshots of the **try-on canvas region** via Playwright `page.screenshot(clip=…)` (or
  `locator('.vto-try-on canvas').screenshot()`), saving to `logs/frames/<instance>/<idx>.png`.
- Must be **off by default** and must not change existing behavior/exit codes when `--save-frames 0`.
- **Acceptance:** `--save-frames 5 --only clear` produces 5 PNGs under `logs/frames/clear/`; a
  normal run (no flag) is byte-for-byte unchanged in behavior.

---

## OC-3 — Slack workspace bootstrap helper  ·  `agent-os/slack/bootstrap.js`

**Goal.** After the Slack **apps** exist and tokens are in `.secrets.env`, automate the rest of
[[SLACK-ORCHESTRATION]] §9 Phase A/B/C: create channels, set topics, invite the right bots, and
print the channel-ID map to paste into `bridge.config.yaml`. (App creation stays manual — it needs
browser OAuth.)

**Deliverable:** `agent-os/slack/bootstrap.js` (Node, `@slack/web-api`, `js-yaml`, `dotenv`).

**Behavior / subcommands:**
- `bootstrap.js whoami` → for each agent token call `auth.test`; print `agentKey → botUserId,
  botName` (masks token). Confirms every token is valid + which bot user it is.
- `bootstrap.js create-channels` → for each channel in a `channels.yaml` (name, private?, topic,
  members[]): `conversations.create` (skip if exists), `conversations.setTopic`, then invite each
  member bot via `conversations.invite` using the user ids from `whoami`. Uses an **admin token**
  (a bot with `channels:manage`/`groups:write`) — read from `.secrets.env` as `SLACK_BOT_HERMES`
  or a dedicated `SLACK_ADMIN_TOKEN`; document the required scope.
- `bootstrap.js ids` → print `name → C0…` for every channel, formatted as the `channels:` block
  ready to paste into `bridge.config.yaml`.

**Idempotent:** re-running must not error on already-existing channels/members (catch
`name_taken` / `already_in_channel`).

**Acceptance:** dry-run against the workspace prints the whoami table and (if run) creates channels
+ prints the id map. Paste the whoami table + id block. Never print full tokens.

---

## OC-4 — Strip temp diagnostics + rebuild + video-retest  ·  `rkumar-vto`

**Goal.** Remove ONLY the temporary `seg-dbg` diagnostics I added while debugging, keep every real
fix, rebuild the widget, and re-run the video harness. **This is a delicate edit — post the full
diff for Claude review before considering it done.**

**REMOVE (only these — every line whose text contains `seg-dbg`, plus the vars that then go
unused):**
- `packages/vto-core/src/engine/landmark-debug-engine.ts`: the `let segDbg = 0;` line; the
  `if (segDbg < 8) {…}` "processRemoval→process() call" block; the `if (segDbg <= 8) console.warn(
  … process() resolved …)` line; and the three `seg-dbg` console.warn lines inside the primary-
  detector block (`segment() started`, `segment() returned …`, `segment() threw`).
- `packages/vto-core/src/frame-detection/GlassesSegmenter.ts`: the two `seg-dbg` console.warn lines
  in `createOrtSession` (`ort imported …`, `InferenceSession.create OK …`) and the now-unused
  timing vars `t0`/`tS` they used.

**KEEP (do NOT touch — these are the real fixes):**
- The **moved primary-detector block** itself (segment() running every pass before the
  blocked/no-specs returns) and its `[vto] seg: … glasses px … peakP=…` counter log.
- The `[vto] rm …` **verdict mirror** log in the render loop and `lastVerdictLogMs`.
- `resizeRegionSourceNearest` + the `segForProcess` resize.
- `glassesProb` default `0.5` in `GlassesSegmenter.ts`.
- The `?vtoForceCapture` seam (`CaptureController.bypassAlignment` + engine wiring).

**Then (mechanical, OpenCode's job):**
1. `cd rkumar-vto/packages/vto-core && npx tsc -b`
2. `cd rkumar-vto && npx eslint packages/vto-core/src/engine/landmark-debug-engine.ts packages/vto-core/src/frame-detection/GlassesSegmenter.ts` (fix any now-unused-var lint from the removals).
3. Delete stale shells, `pnpm --filter @nmg-vto/vto-widget build`, confirm exactly one shell.
4. Re-run: `python tools/video-test/run_video_test.py --url <product-url> --trigger ".vto-try-on__button" --password $VTO_STORE_PASSWORD --seconds 40 --load-timeout 90` and then `accuracy.py`.

**Acceptance:** tsc + eslint + build green; the retest still shows clear→applied, no_glasses→none,
sunglasses detected; **paste the full diff + the video summary + accuracy one-liner** and
`@VTO-Analyst please review`. **Do not commit.**

---

## Suggested assignment order
1. **OC-1** (bridge — protocol/config/dry-run MVP first; it unblocks everything).
2. **OC-2** + **OC-2B** (accuracy number + frame capture).
3. **OC-3** (bootstrap — once the apps/tokens exist).
4. **OC-4** (cleanup + retest — anytime; independent of Slack).

Each returns to Claude Code for review; nothing reaches the human commit gate without tsc+eslint+
build+video green and Fable/Opus sign-off (once the loop is live).
