# Agent OS Setup Log — 2026-08-03

Project: [[Agent OS]] · Conventions: [[memory]]

Full record of the initial setup session (2026-08-02 → 2026-08-03).

## What's running

| Piece                          | Status       | Where                                                                                                                               |
| ------------------------------ | ------------ | ----------------------------------------------------------------------------------------------------------------------------------- |
| Dashboard                      | ✅ live       | http://localhost:3737 (Next.js 16, port 3737)                                                                                       |
| OmniRoute gateway              | ✅ live       | http://localhost:20128 — powers Free Claude Code + OmniRoute tabs, $0, no key                                                       |
| Ollama                         | ✅            | local models `qwen2.5-coder:14b`, `qwen2.5vl:3b`, `stable-code` + cloud `minimax-m3:cloud` (524k context, signed in)                |
| Hermes                         | ✅            | native install at `%LOCALAPPDATA%\hermes`, default model → `minimax-m3:cloud` via ollama-launch                                     |
| OpenClaw                       | ✅            | v2026.7.1-2, gateway as Scheduled Task "OpenClaw Gateway", model `ollama/minimax-m3:cloud`, smoke-tested                            |
| Claude tab                     | ✅            | wired to real Claude Code at `C:\Users\ankur.singh\.local\bin\claude.exe` (uses `claude login`, pinned to Opus 4.8)                 |
| Jarvis voice                   | ✅ key set    | ElevenLabs key in `%LOCALAPPDATA%\hermes\.env` **and** `%LOCALAPPDATA%\hermes\profiles\main\.env` (dashboard reads the profile one) |
| Voice building (Agent Factory) | ✅            | `~\.fcc\.env` → `MODEL="ollama/qwen2.5-coder:14b"`                                                                                  |
| Obsidian vault                 | ✅ this vault | `C:\Users\ankur.singh\Obsidian Vault`, wired via `vaultRoot` in `~\.agentic-os\config.json`                                         |

## Key decisions & why

- **Local copy**: OneDrive sync broke builds (cloud-placeholder error 389), so everything runs from `C:\Users\ankur.singh\agent-os`; the synced pack folder is left untouched.
- **Vault location**: home root, NOT Documents — Documents is OneDrive-redirected on this machine.
- **Model routing**: big cloud model (`minimax-m3:cloud`) for Hermes + OpenClaw agents; local `qwen2.5-coder:14b` only for the free on-device Agent Factory builds (per the pack's model-routing rule).
- **Windows spawn patch**: the dashboard spawns CLIs without a shell, so npm `.cmd` shims fail on Windows. Patched `source/src/lib/runner.ts` (local copy) — `.js/.mjs` bins now run through Node. OpenClaw is configured by its `.mjs` entry path in `~\.agentic-os\config.json`.

## Config file map

- `~\.agentic-os\config.json` — CLI paths (claude, hermes, openclaw), `vaultRoot`, `hermesHome`
- `~\.fcc\.env` — Agent Factory local model
- `%LOCALAPPDATA%\hermes\.env` + `profiles\main\.env` — ElevenLabs key now; OpenRouter key goes here later (commented slots ready)
- `%LOCALAPPDATA%\hermes\config.yaml` — Hermes model/provider
- `~\.openclaw\openclaw.json` — OpenClaw config (Ollama provider)

## NotebookLM (Notebook tab) — added 2026-08-03

- Installed `notebooklm-mcp-cli` 0.9.4 via uv (Hermes's bundled `uv.exe`) → executables at `C:\Users\ankur.singh\.local\bin\` (`nlm.exe`, `notebooklm-mcp.exe`)
- `nlmBin` set in `~\.agentic-os\config.json` (Windows auto-detect can't find it)
- ✅ Logged in via `nlm login` (account: ankur.singh@nmgtechnologies.com; Chrome had to be fully closed first — the login needs Chrome's remote-debugging mode). Notebook tab verified: authenticated, notebooks listing.
- Credentials live at `C:\Users\ankur.singh\.notebooklm-mcp-cli\profiles\default`

## Auto-start at boot — 2026-08-03

Agent OS now starts itself at every logon. The full autostart map:

| Piece | Autostart mechanism |
|---|---|
| Dashboard (:3737) + OmniRoute (:20128) | **`Agent OS.vbs`** in the user Startup folder → runs `agent-os\Start Agent OS Silent.ps1` hidden (idempotent — only starts what's down) |
| OpenClaw gateway (:18789) | Scheduled Task "OpenClaw Gateway" (logon trigger — installed by its onboard) |
| Ollama | `Ollama.lnk` in Startup (pre-existing) |
| Hermes messaging gateway | `Hermes_Gateway.vbs` in Startup (pre-existing) |
| Hermes / Claude / ant CLIs | No service needed — dashboard spawns them per request |

Also removed a **dead** `AgenticOS.lnk` from Startup (pointed at nonexistent `C:\Users\ankur.singh\agentic-os\start.bat` — leftover from an older install). Manual start (with browser) remains `Start Agent OS.ps1`.

## deepseek-v4-flash:0731-cloud attempt — 2026-08-03

- Pulled `deepseek-v4-flash:0731-cloud` (304B params, **1M context**, tools+thinking) and registered it in OpenClaw's ollama provider (`~\.openclaw\openclaw.json`).
- ❌ Live test → `403: this model requires a subscription` — needs a **paid ollama.com plan** (free tier allows minimax-m3:cloud but not this one). Failover chain worked: run auto-fell-back to claude-opus-4-8 and succeeded.
- Primary restored to `anthropic/claude-opus-4-8` (fallback `ollama/minimax-m3:cloud`). The deepseek entry stays registered — after upgrading at https://ollama.com/upgrade, switch with one line: set `agents.defaults.model.primary` to `ollama/deepseek-v4-flash:0731-cloud`.

## Claude Platform CLI (`ant`) installed — 2026-08-03

- Native Windows binary v1.21.0 from github.com/anthropics/anthropic-cli releases → `C:\Users\ankur.singh\.local\bin\ant.exe` (no Go/npm needed; PowerShell download needed curl.exe due to TLS)
- Wired via `"ant"` in `~\.agentic-os\config.json`; dashboard Claude → **Ant CLI** tab reports connected (v1.21.0)
- ⏳ Waiting on user: `ant auth login` (browser OAuth to platform.claude.com — needs an interactive terminal; times out otherwise). Config/credentials dir: `%APPDATA%\Anthropic`
- Powers Claude → Ant CLI + Agents (Managed Agents: `ant beta:agents list` etc.)

## OpenClaw switched to system Claude — 2026-08-03

- `openclaw onboard --non-interactive --auth-choice anthropic-cli` → OpenClaw now runs on **`anthropic/claude-opus-4-8` via the Claude CLI backend** (reuses the machine's `claude login`; runs `claude -p` under the hood). Sonnet 5 / Opus 4.7 / 4.6 / Sonnet 4.6 also mapped to claude-cli in `~\.openclaw\openclaw.json`.
- Added fallback `ollama/minimax-m3:cloud` (free) — kicks in if the Claude plan hits usage limits.
- ⚠ Billing note: OpenClaw's Claude runs draw from the Claude **subscription's usage limits** (same pool as Claude Code itself).
- Gateway restarted; smoke test passed (`provider: claude-cli, model: claude-opus-4-8`).

## Fresh-start cleanup (inherited data removed) — 2026-08-03

The pack was copied from a senior's Mac (user `nmg`, via the Lalit Chaudhary OneDrive share) and carried their data. Removed from the **local copy only**:

- `.remember\` + `source\.remember\` — the senior's Claude memory system (now.md/recent.md/archive.md + weeks of logs; their Mac hooks still write to the synced folder **today**). Reset to empty structure.
- `.claude\settings.local.json` — Mac-only permission grants (`/Users/nmg`, `sysctl`).
- `Start Agent OS.command`, `Check My Setup.command`, `Update Agent OS.command` — Mac-only launchers (Windows uses `Start Agent OS.ps1`).
- `source\.netlify\` — the senior's Netlify deploy state.

Kept (verified clean/needed): `source\.mcp.json` (env-placeholder MCP servers, no personal data), `source\.claude\agents+skills` (pack machinery), `source\public\*` (pack UI assets incl. seo-pack.zip), `member-pack\` (redistribution material). Set `userName: "Rohit"` in `~\.agentic-os\config.json`. All agents re-verified green after restart (claude / openclaw / hermes).

⚠ Note: the senior is still actively working in the shared OneDrive folder — our local copy is a frozen snapshot and won't receive their changes (by design).

## Imbue Catalyst installed (VTO validation gate) — 2026-08-04

- Cloned github.com/imbue-ai/catalyst (branch `stable`) → `C:\Users\ankur.singh\catalyst` + submodules (darwinian_evolver, templates).
- **Windows patches** (server/dashboard needs WSL2 — we use CLI-skills mode only): `context_manager.py` fcntl→msvcrt lock, `run_experiment.py` resource/preexec_fn POSIX-conditional, 36 symlink-stub scripts + 1 dir-symlink replaced with real copies.
- Validation environment created at `C:\Users\ankur.singh\catalyst-env\vto` (40 skills in `.claude\skills`, uv-synced venv incl. torch-cpu, `GUIDANCE.txt` = VTO review criteria, scoped `.claude\settings.json` permissions, env marked trusted in `~\.claude.json` — backup at `.claude.json.bak-catalyst`).
- Token-free smoke test passed: DB init / store / create_context / list all work on Windows Python 3.14.
- Gate runner `catalyst-env\vto\validate.ps1`: Catalyst review on **Haiku** → Claude **Opus** final APPROVED/REWORK verdict. Full system doc: vault `Projects\VTO-Agents\LOOP-ENGINEER.md`.

## Kanban board + full Obsidian wiring — 2026-08-04

**Kanban tab (Hermes kanban):** DB initialized (`%LOCALAPPDATA%\hermes\kanban.db`), board **vto** created (own DB under `hermes\kanban\boards\vto\`). Seeded 4 research-mission cards (ready, **unassigned = won't run**; `hermes kanban --board vto assign <id> default` fires one). ⚠ The board's auto-decomposer picked up the "automate the loop" triage card within minutes and spawned a design+implementation chain — the design doc task ran (wrote vault `Projects\VTO-Agents\Loop Protocol Spec.md`); the 5 implementation/test cards were **unassigned + comment-held** until the first manual VTO loops pass cleanly. Dispatcher verified (dry-run): skips unassigned cards.

**Obsidian → dashboard (all features):** `vaultRoot` was already set; now added the write-side structures the tabs expect — `Agentic OS\{Journal, Memories, Goals.md, Projects\vto\Memories, Projects\agent-os\Memories}` (Agent Room + Pipeline folders already existed from dashboard writes). Goals.md seeded in the dashboard's checkbox format (4 goals); today's Journal seeded. Registered dashboard projects **vto** + **agent-os** (`~\.agentic-os\projects\`); pre-existing `research-vto` (made 2026-08-03 via dashboard) left untouched. Verified live: `/api/hermes/kanban/board?board=vto` ok, `/api/goals` + `/api/journal` return seeds, `/api/memory/graph` = 28 nodes / 100 links (galaxy includes the new notes).

## Paperclip installed (token-spend monitoring) — 2026-08-04

- `npx paperclipai onboard --yes` → v2026.722.0 at **http://localhost:3100** (`local_trusted` mode, embedded Postgres, hourly DB backups; state in `~\.paperclip\instances\default\`).
- Runs detached (`npx paperclipai run` via hidden Start-Process) + added to `Start Agent OS Silent.ps1` → **starts at every logon** with the rest of Agent OS.
- Dashboard **Paperclip tab connected**: created `source\.env.local` with `PAPERCLIP_API` + `PAPERCLIP_COMPANY` (company **NMG**, id `a86fe77c-f28d-40c4-b019-b54e51ece43e`), dashboard restarted — overview API `reachable: true`.
- **Token-expend monitoring**: the tab shows per-agent `spent / budget` (cents) live. Agents in company NMG: Loop Engineer (running, claude_local), Reflection Coach + Summarizer (paused). Budgets currently **0 = uncapped** — set monthly caps per agent in Paperclip (agent settings) to make them hard stops; CLI: `npx paperclipai cost` / `budget`.
- ⚠ claude_local agents draw from the Claude subscription's usage pool when running.

## All agents in Paperclip + OpenCode scraping arm — 2026-08-04

- **Every agent now visible in the dashboard's Paperclip tab** (company NMG): created **Claude** (Ultimate Validator, `claude_local`) ← **Hermes** (VTO Orchestrator, `hermes_local`) ← **OpenClaw** (Working Agent, `openclaw_gateway`) ← **OpenCode** (Web Scraper, `opencode_local`), joining the user's Loop Engineer / Reflection Coach / Summarizer / Forge = **8 agents**, org chart + per-agent token spend in one view. (Role field uses Paperclip's fixed enum; real roles are in titles.)
- **OpenCode CLI connected** (v1.18.10, hermes-bundled: `…\node_modules\opencode-ai\bin\opencode.exe`, registered as `"opencode"` in `~\.agentic-os\config.json`). Config `~\.config\opencode\opencode.json`: default model **`opencode/big-pickle`** (OpenCode's own free high-limit model — smoke-tested headless, no auth needed), fallbacks `ollama/minimax-m3:cloud` + local qwen.
- **Token-saving scraping rule** wired into both souls (vault SOUL-OpenClaw + SOUL-Hermes) and OpenClaw's live `AGENTS.md`: ALL web-scraping operations are delegated to OpenCode (`opencode run "…"` via exec → output file → reason over it with Claude). Claude tokens = analysis only, never fetching.
- Where everything is visible in the dashboard: agents → **Paperclip tab** + Vitals · tasks → **Kanban tab** (vto board) · projects → **Projects** · goals/journal/notes → **Goals / Journal / Memory** tabs.

## Kanban visibility fix — 2026-08-04

- **Root cause of the "empty Kanban":** the Kanban tab opens the *current* hermes board, which was still `default` (empty) — the seeded VTO board existed but wasn't current. Fixed: `hermes kanban boards switch vto` → the tab now opens straight onto the VTO board (11 cards: 4 research missions ready, automation design done, implementation held unassigned). Default board got a pointer card; the tab also has a board dropdown + deep link `/kanban?board=vto`.
- **Board = live status mirror now:** both souls (vault + live SOUL.md/AGENTS.md) mandate mirroring — Hermes creates an **unassigned** card per assigned task (`--idempotency-key T<NNN>`; never assign → dispatcher would execute it), OpenClaw comments IN PROGRESS / DONE / BLOCKED, Hermes comments the review verdict. All VTO updates are therefore visible in the dashboard Kanban tab as they happen.
- **"Agent Kanban" tab clarified:** that tab is a separate local build-team demo (type a goal → Ollama planner/builder makes small HTML builds). It starts empty by design and is unrelated to the research agents; it works whenever Ollama is up (autostarted).

## Open items

- [x] **OpenRouter LIVE — 2026-08-04.** Key provided by Rohit and installed. **Hermes → `deepseek/deepseek-v4-pro`** (smoke-tested OK; Rohit finalized). **OpenClaw → `openrouter/deepseek-v4-flash-0731`** (#22) — set via `openclaw models set` (the plain JSON edit wasn't enough: the model must be registered, and onboard resets primary to `openrouter/auto`), onboard needed `--accept-risk` (script updated), gateway restarted, **fresh-session smoke test verified: provider=openrouter, model=deepseek/deepseek-v4-flash-0731**. Fallbacks: free minimax → claude-cli opus (claude-cli auth marker shows "missing" after the openrouter onboard but the runtime still works — it shells to the logged-in claude binary). Old `main` chat session stays on its previous binding until its daily/idle reset; all new sessions (incl. kanban/task work) use deepseek. Key also staged in both Hermes .env files. Backups: `*.bak-openrouter`.
- [ ] User's real Obsidian notes to be dropped into this vault
- [ ] Set per-agent monthly budgets in Paperclip (currently uncapped)
- [x] Dashboard rebuild with the Windows spawn patch → restart → OpenClaw verified in vitals (gateway live, agent `main`) ✅ 2026-08-03

## Windows patches made to the local copy (source/src)

1. `lib/runner.ts` — `.js/.mjs` CLI entries spawn via Node (npm `.cmd` shims can't be spawned shell-less on Windows); on win32, PATH is left untouched and no fake POSIX `HOME`/`SHELL` is injected (the fake HOME broke OpenClaw's auth lookup).
2. `app/api/vitals/route.ts` — OpenClaw health-check timeout 6s → 30s (cold CLI start on Windows exceeds 6s).
