---
okf: 1
id: slack-setup
type: runbook
status: active
created: 2026-08-10
related: ["[[AGENT-SPECS]]", "[[AGENT-PROFILES]]", "[[TECHNICAL-ARCHITECTURE]]"]
tags: [slack, setup, bootstrap, tokens, runbook]
---

# SLACK-SETUP — stand up the swarm's Slack workspace

Runbook to complete the Slack side of the swarm. Token roster derived from the authoritative
`agents/*/agent.yaml` + `personas/*.yaml` (reconciles the drift: TAD §7.1 said 12, AGENT-SPECS §9
said 9 — the real count is **10 bot tokens + 1 app token**).

## Status (2026-08-10)
- ✅ `config/{swarm,channels,runtimes,bridge}.config` present; `runtimes.yaml` paths fixed to `ankur.singh`.
- ✅ `agents/<id>/system.md` generated for all 6 agents (soul + §10 constraints) → `swarmctl check` passes agent checks.
- ✅ `config/.secrets.env.example` written with the exact token set.
- ⛔ **You must create the 10 Slack apps** (browser OAuth) and fill `config/.secrets.env`.
- ⚠ `swarmctl check` crashes in the CLI-version step (a `runtimes.yaml` entry → `spawnSync(undefined)`); fix pending, does not block bootstrap.
- ⛔ **Bridge control plane not built** — `apps/` has only `cli/`; TAD §9 steps for `packages/*` + `apps/bridge` remain. Apps+channels+tokens can be set up now; the loop won't autonomously *run* until the bridge exists.

---

## 1. The 10 apps

| # | App display name | token env | Type | Posts in |
|---|---|---|---|---|
| 1 | **VTO Admin** | `SLACK_BOT_ADMIN` (+ `SLACK_APP_TOKEN`) | **listener + admin** | all channels |
| 2 | VTO Claude | `SLACK_BOT_CLAUDE` | worker | swarm-command, -analysis, -docs, -human-gate, -incidents, -research, -video, -accuracy |
| 3 | VTO Critic | `SLACK_BOT_CRITIC` | worker | swarm-critique, -admin, -code |
| 4 | VTO Researcher | `SLACK_BOT_RESEARCH` | worker | swarm-research, -admin, -scout |
| 5 | VTO Coder | `SLACK_BOT_CODER` | worker | swarm-code, -admin, -critique, -tests, -video |
| 6 | VTO OpenCode | `SLACK_BOT_OPENCODE` | worker | swarm-scout, -research, -code, -tests, -accuracy |
| 7 | VTO TestRunner | `SLACK_BOT_TEST` | persona | swarm-tests |
| 8 | VTO VideoTester | `SLACK_BOT_VIDEO` | persona | swarm-video |
| 9 | VTO Accuracy | `SLACK_BOT_ACCURACY` | persona | swarm-accuracy |
| 10 | VTO Scout | `SLACK_BOT_SCOUT` | persona | swarm-scout |

*(No `openclaw` app — it has no `agent.yaml`; it runs under Coder. `admin` is the sole Socket-Mode listener, so it alone needs the app-level token + `channels:manage`/`groups:write`.)*

## 2. Create each app — api.slack.com/apps → Create New App → From an app manifest

### Manifest A — **VTO Admin** (listener) — once
```yaml
display_information:
  name: VTO Admin
features:
  bot_user:
    display_name: VTO Admin
    always_online: true
oauth_config:
  scopes:
    bot:
      - app_mentions:read
      - channels:history
      - channels:manage
      - channels:read
      - chat:write
      - chat:write.customize
      - files:read
      - files:write
      - groups:history
      - groups:read
      - groups:write
      - pins:write
      - reactions:read
      - reactions:write
      - users:read
settings:
  event_subscriptions:
    bot_events:
      - app_mention
      - message.channels
      - message.groups
      - reaction_added
  socket_mode_enabled: true
  org_deploy_enabled: false
  token_rotation_enabled: false
```

### Manifest B — the 9 workers/personas — change **both** name lines each time
```yaml
display_information:
 
  # name: VTO Scout
features:
  bot_user:
 
    # display_name: VTO Scout
    always_online: true
oauth_config:
  scopes:
    bot:
      - app_mentions:read
      - channels:history
      - channels:read
      - chat:write
      - chat:write.customize
      - files:read
      - files:write
      - groups:history
      - groups:read
      - reactions:read
      - reactions:write
      - users:read
settings:
  org_deploy_enabled: false
  token_rotation_enabled: false
```

### Per-app finish
- **Admin:** Basic Information → App-Level Tokens → Generate (`connections:write`) → `SLACK_APP_TOKEN`. Then Install → copy `xoxb-` → `SLACK_BOT_ADMIN`.
- **Each worker/persona:** Install → copy `xoxb-` → its env var (table above).

## 3. Fill secrets
```powershell
cd "C:\Users\ankur.singh\Obsidian Vault\config"
Copy-Item .secrets.env.example .secrets.env
notepad .secrets.env    # paste the 10 xoxb + 1 xapp (+ OPENROUTER_API_KEY, VTO_STORE_PASSWORD)
```
`config/.secrets.env` is git-ignored. Never commit; never paste tokens into chat.

## 4. Bootstrap + verify
> swarmctl derives its repo root as **`resolve(process.cwd(), '..')`** — run it from a **child** of the
> repo (e.g. `apps/`), or via the top-level `swarm.cmd`. From `apps/`:
```powershell
cd "C:\Users\ankur.singh\Obsidian Vault\apps"
node cli\dist\swarmctl.js bootstrap all     # whoami → create-channels(13) → invite-bots → ids → verify-tokens → generate-bridge-config
node cli\dist\swarmctl.js check             # expect all ✅
```
Creates the 13 `swarm-*` channels from `config/channels.yaml`, invites the right bots (Admin to all), writes channel IDs back, and regenerates `bridge.config.yaml` from source (clearing the current drift — it references `swarm-planning`/`swarm-review`/`swarm-dev`/`swarm-video-ui` that aren't in `channels.yaml`).

## 5. After Slack is up — the real remaining work
The **Bridge** (`apps/bridge`, the Socket-Mode control plane) is not built yet — that's TAD §9 steps 1–10 (`packages/core, db, context, operations, runtimes, slack, orchestration` + `apps/bridge`). Options: build it per the TAD, or adapt the existing offline-verified Node bridge (`agent-os/slack/`) as an interim to get a minimal loop live. Decide after the workspace exists.
