# Ops Log

## 2026-08-25 — Verification VERDICT: loop READY (Test D passed; one transient Slack event drop noted)

- **Test D (real operator ingest, U0BNAE1V7TM):** all three addressing forms proven live from Rohit's Slack — real @-mention → researcher (33s reply), `!critic` (19s), `coder:` → Haiku/OpenClaw ("D3 pong", 38s); every reply + department report SENT under the right bot identity. NOTE: the FIRST @-mention message never reached the gateway (slack_events has no row — Slack-side delivery drop, not a parse/dedup bug); the identical resend worked. Low-frequency socket-delivery loss is a known cost of the single Socket-Mode connection — if it recurs, that's the trigger to revisit D-036 dual gateways.
- **Live-content bonus proof:** lap 2 ran ANALYSIS(CONTINUE)→DOCS→ADMIN→TASKS→SUBTASKS→RESEARCH→CRITIC where the critic BLOCKED on a real gap (no GPU for the 3-class BiSeNet retrain) → dispatcher routed back to SUBTASKS with block_rounds=1. Decision routing, block caps, and lap counters all exercised on real work, not pings.
- **READY FOR DEVELOPMENT.** Run #16 (frame removal rebuild) continues autonomously under the full guard set: 40-lap cap, 3-strike rework→human, block cap 2/lap, empty-retry 3, 25-min video op, 40-min claim VT, tree-killed timeouts, stdin-safe runtimes. Deferred by operator choice: service watchdog + pg pool error handlers (a dropped DB connection can still kill a service silently — restart via `swarm-logs\start-swarm-service.ps1 <svc>`); Vansh-machine cutover.

## 2026-08-25 — Loop verification campaign: 6 defects found live, fixed, full lap proven end-to-end

Systematic verification (operator goal): local→Slack, per-agent-type execution, full doc-loop lap. Run #16 ("frame removal feature", Slack-triggered 08-24) was found FROZEN 16h at VIDEO_UI_TEST and became the live test vehicle. **Defects found + fixed, in order:**
1. **600s video-op timeout** killed the harness mid-run (already fixed to 25 min earlier today; run #16 hit the old one).
2. **Failed rework = permanent stage freeze** — dispatcher only handled rework done/blocked; a failed rework task stalled the run forever. Now: consume + re-route with the 3-strike counter.
3. **Rework prompts for op stages were wrong** ("produce the video_verdicts" sent the coder chasing the harness) — now a proper FIX brief; reworks also carry pinnedMachine (they could overflow to the other machine's repo before).
4. **Channel membership gaps** — docsmanager not in #swarm-command (its task replies FAILED silently), opencode not in #swarm-code. Fixed via admin-bot invites (scripts/swarm-join-channels.ts); channels.yaml members now match reality (#swarm-command = every reply-capable bot).
5. **THE BIG ONE — stdin pipe hang**: every openclaw/opencode daemon run hung until timeout because execFile gives the child an open stdin pipe and the runtimes block on it (proven: pipe=∞, ignore=27s). runtimes.ts now spawns with stdin IGNORED (execNoStdin), timeouts **taskkill /T** the whole tree (child.kill left grandchildren holding pipes), and openclaw's diagnostic preamble is filtered from replies. Also killed two 24h-stuck vto-researcher openclaw strays (same stdin cause, from the vto-research heartbeat).
6. **Stale worker capacity** — a daemon killed mid-claim leaves workers.active>0 forever, silently eating claim slots (analyst was blocked by it). registerWorker now resets active=0 on registration.
Plus: analyst `--model` override removed (5× latency for nothing — the agent's configured model IS opus); analyst got workspace+sync so it can read the task doc; ANALYSIS/DOCS gained on_fail route-retries (a single analyst timeout used to escalate-halt the run); orphan tasks cancelled (94, 276, 280, 312, 1659-1662); ops tooling added: `scripts/swarm-{audit,seed-task,check-tasks,inspect-run,requeue-task,join-channels}.ts` (requeue note: vto_send's arg is the ROLE — it prefixes vto\_ itself — and needs the 3-arg form).
**PROVEN LIVE:** post_queue→Slack (Test A); all 13 worker types execute + department-report under correct identities (Test B); run #16 traversed ADMIN→TASKS→SUBTASKS→RESEARCH→CRITIC→CODE→BUILD→CODE_TEST→VIDEO_UI_TEST(17 min, new timeout)→RESULTS(accuracy 0.00 baseline)→**ANALYSIS (Opus verdict: segmenter never initialized — integration failure, not model quality; DECISION: CONTINUE)**→DOCS→**lap 2** (counter=2, per-lap counters reset) →ADMIN→TASKS. DISTRIBUTED-ARCHITECTURE got an operational-status banner (single-machine reality vs D-036 design). Vansh's box offline since 08-21 — needs pull+rebuild+cutover before rejoining.

## 2026-08-25 — Lap cap 40, 3-strike rework guard, coder moved to OpenClaw/Haiku (operator directives)

- **MAX_LAPS 10 → 40** (dispatcher + swarm.config `max_loops_per_work_order`) — supports the operator's "20 iterations" runs with headroom.
- **Same-problem loop guard**: `routeTo` now counts rework cycles per stage per lap (`carry.rework_<STAGE>`, reset each lap). After **3** cycles on one stage the run HALTS, posts `:rotating_light: NEEDS HUMAN` to #swarm-human-gate, and files an escalation — no more unbounded fail→rework churn. Watchdog/pg-error-handler deliberately deferred (operator: "leave for now").
- **Coder = OpenClaw Haiku** (was hermes/qwen): worker → agent `vto-coder-rohit`, dedicated workspace `openclaw-ws\vto-coder-rohit` with mirror sync; **`.swarm-tasks` added to SYNC_DIRS** so the doc-driven coder reads + updates the shared task .md from its workspace (repo-relative path resolves both sides). Coder soul rewritten for the runtime (frontmatter runtime/model; mirror + no-deletions caveat), installed as vto-coder-rohit's SOUL.md + workspace AGENTS.md; **vto-analyst finally got its SOUL.md/AGENTS.md too** (was missing since creation). bridge.config + AGENT-PROFILES roster updated.
- tsc clean; daemon + dispatcher restarted (gateway untouched, healthy). Mirror caveat stands: robocopy is additive — coder file deletions don't propagate.

## 2026-08-25 — DEPLOY stage stitched into the doc-loop; video-op timeout raised; stack restarted

- **Why**: VIDEO_UI_TEST drives the LIVE storefront — without a per-lap dev deploy it tests the previous lap's code; and the video op's 10-min cap was shorter than a real 6-clip × 60s run (~16-18 min), so the harness would be killed mid-run every lap.
- **Loop**: doc-loop now … → CODE_TEST → **DEPLOY** (op:deploy, `--config vto-phase1` to the dev store, D-033; on_fail route:coder — theme-check/extension errors ARE code problems) → VIDEO_UI_TEST → … Task-doc skeleton gained `## DEPLOY`.
- **Timeouts**: video op 600s → **1500s** (25 min; under recoverStale's 30-min runMaxSeconds) in `packages/operations` (src + dist rebuilt — pnpm install fixed its missing @types/node so it now compiles standalone). **SWARM_CLAIM_VT=2400** set in `swarm-logs\start-swarm-service.ps1` (must exceed the longest op; read at db-module load, so .secrets.env is too late).
- **Souls/docs**: coder/claude/admin/analyst souls + system.md re-renders, WORKFLOWS.md §11, bridge.config.yaml comment updated to the deploy-before-video chain.
- **Restart**: daemon + dispatcher killed + relaunched (tsc clean); found the **gateway DEAD** — it had crashed on an unhandled pg socket error (dropped DB connection) — relaunched, all 11 bots resolved. FOLLOW-UP: add a pg pool 'error' handler / process watchdog so a dropped DB socket can't silently kill the gateway again.

## 2026-08-25 — Vansh's card-face-width built + deployed to ankurs-vto as vto-phase1-82

- Local tree already AT Vansh's latest (origin/card-face-width@58debab, 2026-08-17 "push before the agent") — nothing newer on any remote branch; pull was a no-op.
- Config alignment: committed shopify.app.toml = foreign "Rkumar_vto" app (403s); deploy ran with --config vto-phase1 (app vto-phase1, store ankurs-vto). Storefront password confirmed ayldu (operator).
- Verify chain: 	sc -b vto-core CLEAN, eslint engine CLEAN, widget build OK (shell chunk 3qCuges, 1.6 KB gz loader, bundle-size gate passed) → shopify app deploy → **vto-phase1-82 released**.
- Storefront verified serving the new bundle: product page loads to-widget.js referencing to-widget.shell-r3qCuges.js. OBSERVATION: the page loads the widget from TWO extension UUIDs (both apps installed provide the block) — double download, possible double init; consider removing the old Rkumar_vto app's block from the theme.

## 2026-08-24 — Baseline video UI-test run (manual, 6 clips × 60s) — frame removal ABSENT on deployed widget

- Target: ankurs-vto.myshopify.com tory-burch product page (operator's requested vto-phase1.myshopify.com is a DIFFERENT password-locked store — password unknown, not in secrets/configs; operator chose the ankurs-vto fallback).
- Widget core healthy: engine ready ~23s, MediaPipe landmarker + face detector load, try-on trigger clicks. Console errors are storefront noise (shop.app CSP, font 404, monorail), not widget faults.
- Frame removal: NO build stamp, NO segmenter ready/unavailable, 0 seg samples on all 6 clips — the card-face-width deploy has no segmenter (v1 scrapped). Harness: bare-face clips pass 2/6, OVERALL FAIL; ccuracy.py = **0.00 vs 0.98 → redo**. This is the baseline the doc-loop rebuild must beat. Logs: kumar-vto/tools/video-test/logs/ (prior logs archived to logs-archive-20260824-233331).

## 2026-08-24 — doc-loop restructured to the operator's lap pipeline; analyst (Opus/OpenClaw) added; stack restarted

- **New main-loop structure** (operator directive): ADMIN → TASKS → SUBTASKS → RESEARCH → CRITIC (DECISION PASS/BLOCK, ≤2 blocks/lap) → CODE → BUILD → CODE_TEST → VIDEO_UI_TEST (fake camera, every .y4m clip, **60s each**, frame-removal verdicts) → RESULTS (accuracy) → **ANALYSIS** (new nalyst role: OpenClaw agent to-analyst pinned to nthropic/claude-opus-4-8; DECISION CONTINUE/DONE) → **DOCS** (docsmanager updates documents after EVERY lap) → next lap, until DONE / error / 10-lap cap. doc-loop reworked in pps/dispatcher/src/workflows.ts; WORKFLOWS.md §11 documents it.
- **Dispatcher**: lap counter in run carry (lap), per-lap reset of empty_*/esearch_rounds/lock_rounds, BLOCK cap (2/lap), LAP/LAP-CAP/BLOCK-CAP posts, lap number in the ▶ stage heartbeat, capped last-artifact evidence appended to doc-driven stage prompts (so CRITIC/ANALYSIS see op results even off-doc).
- **Daemon**: task-doc skeleton now carries the new stage sections; operation results are APPENDED to the shared task doc (ops can't edit it themselves); nalyst posts under the claude bot (LLM_POST_BOT); department report channels now include nalyst→#swarm-analysis and docsmanager→#swarm-docs; video op observes **60s per clip** (was 20).
- **Configs**: machine.local.json + ~/.openclaw/openclaw.json gained the analyst worker/agent (workspace openclaw-ws\vto-analyst); ridge.config.yaml analyst block + main_loop_workflow: doc-loop.
- **Identities**: souls updated to the lap structure (admin/researcher/critic/coder/docsmanager/claude/openclaw) + NEW soul/analyst.md; gents/*/system.md re-rendered from souls (constraints tails kept); NEW gents/analyst/{agent.yaml,system.md}; personas/videotester.yaml notes the 30s–1min fake-camera clips. AGENT-PROFILES roster + analyst note added.
- **Cutover**: 	sc clean (db/bridge/daemon/dispatcher; note pre-existing: packages/operations won't build standalone — no @types/node); killed the tsx-src generation (gateway+daemon; dispatcher was already down), relaunched all three detached via swarm-logs\start-swarm-service.ps1. Verified: gateway resolves 11 bots, dispatcher ACTIVE on the lease with doc-loop, daemon registers all roles incl. nalyst. One gateway, no orphans.
- **Note**: analyst has no dedicated Slack app — it posts under the claude (Opus-tier) bot. If a dedicated @VTO-Analyst app is wanted later, add token + AgentKey (careful: do NOT reuse the claude token in the gateway's mention map, it would misroute @VTO-Claude mentions).

## 2026-08-22 — Swarm services moved to detached processes + operator scripts

- The session-attached background tasks running the stack were killed twice (session cleanup). The stack now runs as **detached hidden node processes** independent of any Claude session: gateway (`apps/bridge/dist/gateway.js`), daemon (`apps/daemon/dist/daemon.js`), dispatcher (`apps/dispatcher/dist/dispatcher.js`), logging to `logs/swarm/*.out.log`.
- Operator controls: **`tools\start-swarm.ps1`** (idempotent — skips running components) and **`tools\stop-swarm.ps1`** (safe — pgmq visibility timeout recovers in-flight claims; queue/runs persist in Postgres). No auto-start on login yet — add a login item like Hermes_Gateway.vbs if wanted.

## 2026-08-22 — First full doc-loop iteration (run #15) + two defects found and one fixed

- **Run #14 (real rebuild) halted at SEED**: the seeded goal was too heavy for a one-shot — hermes went deep-agentic and hit the 600s runtime cap. Re-seed with a leaner goal (put the reading list in the task doc, not the prompt).
- **Run #15 (flow test) completed a full iteration in ~6 min**: SEED→ROUTE(EXECUTE)→CODE→BUILD(pass)→TEST(pass, 11s)→REPORT→**HUMAN_GATE** — every stage posted to #swarm-command, gate card in #swarm-human-gate. Branch health bonus: build + unit tests are GREEN on `card-face-width`.
- **Defect caught AT the gate (= L4 live)**: CODE "succeeded" and REPORT claimed verification, but `docs/SWARM-FLOW-TEST.md` was never created and the task-doc sections were empty — `--ignore-rules` made the hermes coder *describe* the change instead of making it. **FIX applied**: `apps/daemon/src/runtimes.ts` now drops `--ignore-rules` for the `coder` role only (daemon rebuilt + restarted). Systemic follow-up for the loop: REPORT should verify definition-of-done mechanically (file exists / diff non-empty), not from the coder's claim.
- Correct operator verdict on run #15's gate card: **❌ reject** (definition of done not met).

## 2026-08-22 — Frame-removal v1 scrapped; rebuild seeded through the swarm

- **Learnings first**: post-mortem written at `Projects/VTO/LEARNINGS-frame-removal.md` (L1–L9: segmenter decorated instead of drove; 1-class model hacks; DEAD harness → unmeasured weeks; status ran ahead of git; fix-cascade = approach smell; detection robustness was the ceiling; platform gotchas; uncommitted wins; D3 order ignored). Keep-list: D3 plan, F001–F015, FittingBox fixtures, hosted bisenet model, harness knowledge, W001 insight.
- **Repo pivot**: `nmg-vto` working tree switched `distributed-swarm` → `card-face-width` (Vansh's latest, no frame-removal; v1 fully preserved on `origin/distributed-swarm@4b6d5b0`). Untracked survivors: `rkumar-vto/tools/` (video-test harness), `.swarm-tasks`, docs/issues+work-orders. `pnpm install` clean on the new branch.
- **Rebuild seeded through orchestration only**: dispatcher built + started (first time live — lease held, workflows doc-loop/improvement/research/recovery). Trigger task 1665 → **doc-loop run #14**; docsmanager pivot-ledger task 1666. No product code written by hand.

## 2026-08-22 — Souls re-linked into runtimes; docsmanager live (same day, later)

- **Hermes**: new souls installed as `SOUL.md` into profiles `admin/researcher/critic/coder` + NEW profile `docsmanager` (cloned from admin — deepseek-v4-flash pin + OPENROUTER key inherited). One-shot verified: docsmanager answers with its role + sole-writer file. NOTE: the daemon invokes hermes with `--ignore-rules` (skips SOUL injection for latency), so in-loop identity still comes from the task prompt; SOUL.md governs direct/one-shot/gateway sessions.
- **OpenClaw**: rendered openclaw soul installed as `agents/<id>/agent/SOUL.md` for `openclaw` + `vto-coder-rohit`, and as `AGENTS.md` in both workspaces (`.openclaw\workspace`, `openclaw-ws\vto-coder-rohit` — root files survive the robocopy mirror, which only syncs packages/extensions/app).
- **OpenCode**: rendered opencode soul installed as global `~\.config\opencode\AGENTS.md`.
- **Gateway/daemon wiring**: `docsmanager` added to `apps/bridge/src/config.ts` (AgentKey + SLACK_BOT_DOCSMANAGER), worker row in `config/machine.local.json` (hermes profile, ×1), stand-in post identity `docsmanager→admin` in daemon `LLM_POST_BOT` (remove once the real token exists), agent block + `@VTO-DocsManager` route in `bridge.config.yaml`, members updated in `channels.yaml` (#swarm-docs topic extended; docsmanager into swarm-docs + swarm-admin), `SLACK_BOT_DOCSMANAGER` in `.secrets.env.example`. Both apps `tsc` clean.
- **LIVE**: gateway + daemon started on NMG-D-82 (no prior instances running). Daemon roles now include docsmanager. E2E smoke test: task 1663 enqueued → claimed → DONE → reply posted to #swarm-docs (post 11097, status `sent`, agent `admin` stand-in).
- ~~**Still pending (1)**~~ **DONE (same day, evening):** DocsManager Slack app created by the operator; `SLACK_BOT_DOCSMANAGER` added to `.secrets.env` (its unused `xapp-` token parked as `SLACK_APP_TOKEN_DOCSMANAGER` — only the admin app listens); `LLM_POST_BOT` stand-in removed, daemon rebuilt; gateway + daemon restarted (no orphans). Bot = `vtodocsmanager` `U0BS49L8V6G`, invited to #swarm-docs + #swarm-admin via the admin bot. Gateway resolves all 11 bots. Identity smoke test: task 1664 → post 11098 `sent` under agent `docsmanager`.
- **Still pending**: (1) Vansh's machine: pull the vault, re-install souls into his profiles, optionally add a docsmanager worker; (2) compaction-detection hook that fires the docsmanager warning automatically.

## 2026-08-22 — Soul rewrite + Documents Manager agent added

- **What**: All swarm souls rewritten from scratch against the current architecture (dual peer gateways D-036, pgmq visibility-timeout claims D-037, autonomy through dev deploy D-033, human commit gate D-008/D-034). Flow and boundaries preserved; prose is new.
- **New agent**: `docsmanager` (VTO Documents Manager, tier 2, hermes, deepseek-v4-flash, `#swarm-docs`) — session ledger, task assignment/completion digests, mid-session checkpoints, compaction watch with fresh-session warning, sole writer of [[CONTEXT-HANDOFF]] (`doc/CONTEXT-HANDOFF.md`, ceiling 120 lines, rewrite-in-place).
- **Files**: `soul/*.md` (7 rewritten + `docsmanager.md` + README), `agents/<id>/system.md` re-rendered (soul + standing constraints, UTF-8 no-BOM) for all 6 + new `agents/docsmanager/{agent.yaml,system.md}`, [[AGENT-SPECS]] (now six agents, §7 added, ten Slack tokens), [[AGENT-PROFILES]] (roster + profile map), `doc/CONTEXT-HANDOFF.md` created.
- **Superseded**: `Projects/VTO/SOUL-Hermes.md`, `SOUL-OpenClaw.md`, `SOUL-Critic.md` banner-marked — pre-swarm drafts, history only.
- **Follow-ups (not done here)**: create the `docsmanager` hermes profile + Slack app (`SLACK_BOT_DOCSMANAGER`) + `#swarm-docs` channel; add the `docsmanager` role to gateway routing and daemon worker config; wire compaction detection to it.

## 2026-08-19 — Stopped the Slack gateway (Hermes)

- **What**: Closed the gateway connecting local orchestration with Slack.
- **Which process**: The **Hermes gateway** — `pythonw -m hermes_cli.main gateway run`, PID 18176. Its state lives in `%LOCALAPPDATA%\hermes\` (`gateway.pid`, `gateway_state.json` showed `slack: connected`, `telegram: connected`, `active_agents: 0`).
- **How**: `hermes gateway stop` → "drained cleanly", service stopped, process gone, `gateway_state: stopped`.
- **Side effect**: Telegram is disconnected too (same gateway process handles both platforms).
- **Not touched**: OpenClaw local gateway (PID 10232, port 18789) — no Slack config, left running. The swarm bridge gateway (`apps/bridge/src/gateway.ts` per [[SWARM-CATCHUP-2026-08-12]] / [[VANSH-ENV-SETUP]]) was **not running** on this machine at the time.
- **Restart**: `hermes gateway run` (or the hermes service start).
- **Update (same day)**: Restarted via `hermes gateway start` — new PID **16932**, `slack: connected`, `telegram: connected`. A Windows login item (`Hermes_Gateway.vbs`) was installed, so the gateway now auto-starts on login.

## 2026-08-24 — T036 "gate permission blocker" refuted; gate re-ran; round-2 REWORK

- **Claimed blocker** ("validation gate permission issue is systemic (Claude Code config), not a content defect; T036 ready for approval") **investigated and refuted**. Gate env permissions already allow all tools (no deny rules/hooks anywhere in the settings chain); the historical "exit 66 for all commands" failure (tmp/agent_friction_log.txt) does not reproduce — headless probes of the gate's exact claude invocation pass in BOTH sandboxed and unsandboxed launch modes.
- **Gate re-ran end-to-end** on the corrected T036 candidate (`validate.ps1 -Depth deep`): import → 7 Catalyst haiku reviews → Opus verdict. **VERDICT: REWORK** (theory T_20260824_111918_c46b99, report `catalyst-env/vto/validation-reports/20260824-041831-...verdict.md`).
- **The content was NOT approvable**: removal metrics constant across all 15 iterations (100.00%/0.00% presented as "measured variation — confirmed"), segmenter at chance (33.32% mIoU, std 0.083%), chance-mask→100%-removal claim incoherent, summary/table ranges inconsistent, Theory-ID provenance mismatch. LaMa size objections overruled (size caps retired); real-time latency budget still required.
- 7 rework items filed verbatim as **T048** (vault Tasks); T036 status → rework round 2. L5 applies: second fix-cascade on the same degenerate-metrics symptom — fix the measurement path, don't tune the report.
