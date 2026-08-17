# Vansh machine — environment setup for the VTO swarm (2026-08-17)

Everything your machine needs to run the current swarm (branch **`pgmq-dual-gateway`**) as a healthy peer,
in order. Pairs with [[SWARM-CATCHUP-2026-08-12]] (what changed) and [[ORCHESTRATION-DIAGRAM]] (how it works).

## 1. Sync the code
```
git fetch && git checkout pgmq-dual-gateway && git pull       # latest ≥ e454eab
pnpm install                                                  # if deps changed
npx tsc -p packages/db/tsconfig.json                          # rebuild the shared lib (daemon/gateway import its dist)
```

## 2. Database connection — `config/.secrets.env` (git-ignored, per-machine)
- `SWARM_DATABASE_URL` **MUST** use the transaction pooler port **`:6543`**, NOT `:5432`. The session
  pooler is hard-capped at 15 clients and errors `EMAXCONNSESSION`. Change ONLY the port.
- Migrations `0002` + `0003` are **already applied** to the shared DB — do **NOT** re-run them.

## 3. Your workers — `config/machine.local.json` (git-ignored, per-machine)
- Keep `researcher` / `coder` / `opencode` / `admin` for overflow (independent tasks still load-balance).
- **Do NOT add an `openclaw` worker** unless you've done §5 — the default loop does not use OpenClaw.
- **Running the full eng-loop on YOUR machine (optional):** the loop is single-machine and *pinned to its
  origin*, so a loop you start pins to your host and needs the whole pipeline locally: operation workers
  (`build`/`lint`/`test`/`deploy`/`video`/`accuracy`), `repoPath` → your `rkumar-vto`, `storeUrl`/
  `storePassword`, and a working hermes. If you just want to be a worker/overflow node, skip the op workers
  and let loops run on Rohit.

## 4. Fix your hermes runtime — REQUIRED for your LLM workers
Your hermes was failing (`nvidia/nemotron-3.5-lightning:free` via OpenRouter exits non-zero).
- See the real error: `hermes.exe -p researcher -z "say hi" --ignore-rules`.
- Set a known-good model in your hermes profile config (e.g. `deepseek/deepseek-v4-flash`) with a valid
  OpenRouter key. Verify a manual call returns text.
- The swarm now calls hermes with **`--ignore-rules`** (skips AGENTS/memory injection → fast, direct
  answers, 11s vs >5min). The loop's `improve`/`fix` steps run hermes **in the repo cwd** and it EDITS
  files directly — that's intended.

## 5. OpenClaw — only if you'll run the OPT-IN complex-coder path
- ⚠️ **Your `vto-coder` agent's workspace points at your LIVE `rkumar_vto`.** An OpenClaw agent scaffolds
  (`SOUL.md`/`IDENTITY.md`/…) and `git init`s its workspace on first run — it WILL pollute/break your repo.
  **Repoint it** to a throwaway dir in `~/.openclaw/openclaw.json` (`agents.list[].workspace`) BEFORE
  running any OpenClaw agent. Never `openclaw agents delete` while a workspace is a real dir (it prunes it).
- The default loop uses hermes-in-repo, so you can **skip OpenClaw entirely** unless you want the complex
  path. If you do: `openclaw agents add vto-coder-vansh --workspace "<throwaway dir>" --model
  anthropic/claude-haiku-4-5 --non-interactive`, then add the worker with a matching `workspace` field:
  `{ "role":"openclaw", "runtime":"openclaw", "agent":"vto-coder-vansh", "workspace":"<throwaway dir>", "maxConcurrent":1 }`.
  The daemon mirrors `packages/extensions/app` code repo↔workspace around each run.

## 6. Restart — order matters
- **Kill ALL old daemon/gateway node processes FIRST** — a running process holds the OLD `@vto-swarm/db`
  in memory (a rebuild won't fix it), and an old-code daemon double-claims:
  `Get-CimInstance Win32_Process -Filter "Name='node.exe'" | ? { $_.CommandLine -like '*daemon*' -or $_.CommandLine -like '*gateway*' } | Select ProcessId, CommandLine` → `taskkill /F /T /PID <each>`.
- Start ONE daemon: `npx tsx apps/daemon/src/daemon.ts`.
- Start your gateway (dual-peer is correct): `npx tsx apps/bridge/src/gateway.ts`. One gateway per machine.
- (Optional) Start a dispatcher: `npx tsx apps/dispatcher/src/dispatcher.ts`. Safe to run on both machines
  now — a **singleton lease** makes only one ACTIVE at a time (the other logs STANDBY and takes over if the
  active one dies). **But kill any OLD dispatcher first** (`dist/dispatcher.js` or a pre-lease one) — it
  ignores the lease and will double-create workflow stage tasks.

## 7. Verify
- Daemon logs `online as worker-... — roles: …`. Gateway logs `online …` with the 10 bot ids, no
  `EMAXCONNSESSION`.
- `@`-mention an agent in `#swarm-command` → it's claimed + answered; new `runs` rows have a non-null
  `msg_id` (proves pgmq claiming).

## Key facts
- **Loop machine-affinity:** a task with `payload.pinnedMachine=<host key>` routes to a per-machine queue
  `vto_<role>__<key>` and only that machine claims it; unpinned tasks overflow across machines (unchanged).
- **git commit is human-gated** — never automated; the loop halts at a report for a human to commit.
- All swarm code is on `pgmq-dual-gateway`; `main` is untouched.
