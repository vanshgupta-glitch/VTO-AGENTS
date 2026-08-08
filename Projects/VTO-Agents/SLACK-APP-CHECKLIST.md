---
tags: [vto, agents, orchestration, slack, setup, track-a]
date: 2026-08-07
status: ready-to-do
related: ["[[SLACK-ORCHESTRATION]]", "[[AGENT-HIERARCHY]]", "[[OPENCODE-BRIEFS]]"]
---

# ✅ Track A — create the Slack workspace + apps (checklist)

The one manual, human-only step to take the orchestration live: create the Slack apps that mint the
bot tokens. Everything else (channels, invites, the bridge) is automated by `bootstrap.js` + the
bridge. Est. ~30–40 min. Full context: [[SLACK-ORCHESTRATION]].

> **Key simplification:** only **ONE** app needs Socket Mode + the app-level token — make it
> **Hermes**, since Hermes is already in every channel (the bridge's reader) and is the admin that
> creates channels. The other 9 apps only need to **post** (bot token). So there are two app types:
> **Hermes (listener+admin)** and **worker** (×9).

---

## 0. Prerequisites
- A Slack workspace where you're an admin. Create one at slack.com if needed — name it
  **`NMG-VTO-Lab`** (a dedicated workspace keeps bot chatter isolated).
- The repo checkout with `agent-os/slack/` (the bridge — already built).

---

## 1. The 11 apps to create

| # | App / display name | `.secrets.env` var | Type |
|---|---|---|---|
| 1 | **VTO Hermes** | `SLACK_BOT_HERMES` + `SLACK_APP_TOKEN` | **listener + admin** |
| 2 | VTO Scout | `SLACK_BOT_SCOUT` | worker |
| 3 | VTO Researcher | `SLACK_BOT_RESEARCH` | worker |
| 4 | VTO Coder | `SLACK_BOT_CODER` | worker |
| 5 | VTO Scaffolder | `SLACK_BOT_SCAFFOLD` | worker |
| 6 | VTO TestRunner | `SLACK_BOT_TEST` | worker |
| 7 | VTO VideoTester | `SLACK_BOT_VIDEO` | worker |
| 8 | VTO Accuracy | `SLACK_BOT_ACCURACY` | worker |
| 9 | VTO Opus | `SLACK_BOT_OPUS` | worker |
| 10 | VTO Fable | `SLACK_BOT_FABLE` | worker |

*(Hermes doubles as the higher-tier brain per [[AGENT-HIERARCHY]]; its **subagents** are internal
model routing, not separate Slack apps — no extra apps needed for them.)*

---

## 2. Fast path — create each app "From a manifest"

For every app: **api.slack.com/apps → Create New App → From an app manifest →** pick `NMG-VTO-Lab`
→ paste the YAML below (change the two name lines per app) → Create.

### Manifest A — **VTO Hermes** (listener + admin) — use ONCE
```yaml
display_information:
  name: VTO Hermes
features:
  bot_user:
    display_name: VTO Hermes
    always_online: true
oauth_config:
  scopes:
    bot:
      - chat:write
      - chat:write.customize
      - channels:read
      - channels:history
      - channels:manage
      - groups:read
      - groups:history
      - groups:write
      - reactions:read
      - reactions:write
      - files:read
      - files:write
      - app_mentions:read
      - users:read
      - pins:write
settings:
  event_subscriptions:
    bot_events:
      - message.channels
      - message.groups
      - app_mention
      - reaction_added
  socket_mode_enabled: true
  org_deploy_enabled: false
  token_rotation_enabled: false
```

### Manifest B — **worker bots** (apps 2–10) — change BOTH name lines each time
```yaml
display_information:
  name: VTO Scout          # ← change per app (VTO Researcher, VTO Coder, …)
features:
  bot_user:
    display_name: VTO Scout # ← change per app to match
    always_online: true
oauth_config:
  scopes:
    bot:
      - chat:write
      - chat:write.customize
      - channels:read
      - channels:history
      - groups:read
      - groups:history
      - reactions:read
      - reactions:write
      - files:read
      - files:write
      - app_mentions:read
      - users:read
settings:
  org_deploy_enabled: false
  token_rotation_enabled: false
```

---

## 3. Per-app finish steps

**For Hermes (app 1):**
1. **Basic Information → App-Level Tokens → Generate Token and Scopes** → name `socket`, add scope
   `connections:write` → **Generate** → copy the **`xapp-…`** → paste into `.secrets.env` as
   `SLACK_APP_TOKEN`.
2. **Install App → Install to Workspace → Allow** → copy **Bot User OAuth Token `xoxb-…`** →
   `.secrets.env` as `SLACK_BOT_HERMES`.
3. (Optional) **App Home** → upload a distinct avatar.

**For each worker (apps 2–10):**
1. **Install App → Install to Workspace → Allow** → copy **`xoxb-…`** → `.secrets.env` as that
   app's var (see the table).
2. (Optional) avatar.

> No Socket Mode / event subscriptions on the workers — they only post; Hermes receives all events.

---

## 4. Fill `.secrets.env`
```powershell
cd C:\Users\ankur.singh\agent-os\slack
Copy-Item .secrets.env.example .secrets.env   # if not already present
notepad .secrets.env                            # paste the 10 xoxb- + 1 xapp- (+ VTO_STORE_PASSWORD, OPENROUTER_API_KEY)
```
`.secrets.env` is git-ignored. **Never commit it; never paste tokens into chat.**

---

## 5. Bring it up
```powershell
cd C:\Users\ankur.singh\agent-os\slack
node bootstrap.js whoami            # every agent should show ✅ user=… id=… (no "(missing)")
node bootstrap.js create-channels   # creates the 11 channels, sets topics, invites the bots
node bootstrap.js ids               # prints the channels: id block
#  → paste that block into config\bridge.config.yaml under `channels:`
node bridge.js --check              # every token ✅, channel ids filled
npm start                            # bridge live (Socket Mode)
```
Then post in `#vto-command`: `@VTO-Hermes new goal [T001]: <first task>` and watch the loop flow.

---

## 6. Security
- Tokens live ONLY in `.secrets.env` (git-ignored, chmod/ACL to you). Rotate via the app's
  *OAuth → Reinstall* if ever exposed.
- Least privilege: workers deliberately lack `channels:manage`/`groups:write`/Socket Mode.
- `#vto-human-gate` is created **private**; the bridge's git/deploy denylist is the hard backstop.

---

## Gotchas
- A bot only **receives** `message.channels` events for channels it's **in** — that's why Hermes
  (the listener) is invited to **every** channel by `bootstrap.js` (see `config/channels.yaml`).
- If `whoami` shows `not_authed`/`invalid_auth` for an app, you copied the wrong token (use the
  **Bot User** OAuth token `xoxb-`, not the app-level `xapp-` or the signing secret).
- `create-channels` needs Hermes to have `channels:manage` + `groups:write` (Manifest A includes
  them). If channel creation is blocked, your workspace may restrict channel creation to admins —
  run it as a workspace admin.
