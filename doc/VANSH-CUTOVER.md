# VANSH-CUTOVER — rejoin the swarm on current code (written 2026-08-25)

Your machine (nmg-d-102) has been offline since 2026-08-21 and its services run **pre-pgmq
code**. The cutover rule is absolute: an old-code daemon and a new-code daemon double-claim the
same tasks — so everything old dies BEFORE anything new starts. Steps, in order:

## 1. Kill everything old
```powershell
Get-CimInstance Win32_Process -Filter "Name='node.exe'" |
  Where-Object { $_.CommandLine -match '(gateway|daemon|dispatcher)\.(js|ts)' } |
  ForEach-Object { Stop-Process -Id $_.ProcessId -Force }
```
Also disable any old scheduled task / login item that could relaunch them.

## 2. Pull + build
```powershell
cd <vault clone>            # github vanshgupta-glitch/VTO-AGENTS
git checkout main; git pull  # brings 54d0647+ (lap pipeline, analyst, hardening)
pnpm install
cd packages\db; npx tsc -b; cd ..\operations; npx tsc; cd ..\..
cd apps\bridge; npx tsc -b; cd ..\daemon; npx tsc -b; cd ..\dispatcher; npx tsc -b; cd ..\..
```
Product repo: `git pull` on `card-face-width` (a87ba32+ — video harness, model-training, docs).

## 3. Per-machine config (git-ignored — yours to create/update)
- `config/.secrets.env`: shared Slack tokens + `SWARM_DATABASE_URL` (transaction pooler :6543)
  + `SLACK_BOT_DOCSMANAGER`. Ask Rohit for any you're missing — never commit them.
- `config/machine.local.json`: start with hermes roles + ops only —
  `admin, researcher, critic, docsmanager` (hermes profiles; install the new souls from
  `soul/*.md` as each profile's SOUL.md) and `build, test, deploy, video, accuracy` ops.
  **Do NOT enable `coder`/`openclaw`/`analyst` workers yet**: your OpenClaw agent `vto-coder`
  still has `workspace` pointed at your LIVE repo — the known landmine (OpenClaw scaffolds +
  git-inits its workspace). Repoint it to a dedicated dir (e.g. `openclaw-ws\vto-coder`) in
  `~/.openclaw/openclaw.json` first, and create a `vto-analyst` agent the same way if you want
  the analyst role redundant.
- Hermes daemon spawns now IGNORE stdin — no config needed, but your hermes/openclaw/opencode
  CLI paths in machine.local.json must be your own absolute paths (D-035).

## 4. Start services
`tools\start-swarm.ps1` (sets `SWARM_CLAIM_VT=2400` and starts from `dist\`). Start the
**daemon** (and optionally the dispatcher — the singleton lease makes it a hot standby).
**Do NOT start a gateway yet**: current operational mode is single-gateway on Rohit's box;
starting a second requires agreeing to flip to D-036 dual-gateway mode together.

## 5. Verify
From the vault root: `npx tsx scripts/swarm-audit.ts` — your machine + workers should show
`online` with fresh heartbeats, and a test task (`npx tsx scripts/swarm-seed-task.ts --role
researcher --text "vansh cutover ping" --pin win32-<YOUR-HOSTNAME>`) should claim + reply.

## 6. Watchdog (recommended)
Copy the pattern from Rohit's `swarm-logs\swarm-watchdog.ps1` (see OPS-LOG 2026-08-25):
a 2-minute scheduled task that relaunches dead services and reaps >30-min openclaw strays.

---
[[DISTRIBUTED-ARCHITECTURE]] (see the operational-status banner) · [[WORKFLOWS]] §11 ·
[[AGENT-PROFILES]] · [[OPS-LOG]]
