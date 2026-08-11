---
okf: 1
id: agent-profiles
type: specification
status: active
created: 2026-08-10
updated: 2026-08-10
implements: "[[ADR-001-agent-boundaries]]"
tags: [agents, models, hermes, openclaw, runtimes, profiles]
---

# AGENT-PROFILES — model registry and runtime profile bootstrap

Source of truth for **which model runs each agent** and **how to materialise that as a real profile** in the two runtimes that hold them: **Hermes** (orchestrators) and **OpenClaw** (executor).

Claude (strategist) reads this document to create or repair runtime profiles so the Slack bridge can dispatch to a running process with the pinned model. Every value below was verified against the live installs on this machine on 2026-08-10.

> ⚠ **CORRECTION (2026-08-10, verified by live heartbeat).** In a **Hermes** profile's
> `model.default`, use the **bare** OpenRouter slug **without** the `openrouter/` prefix —
> `deepseek/deepseek-v4-flash`, `qwen/qwen3-coder-flash`. Hermes sends `model.default` **verbatim**
> to the OpenRouter API, and `openrouter/deepseek/…` returns `HTTP 400 — not a valid model ID`. The
> `openrouter/` routing is expressed by `provider: openrouter` (set separately), not in the slug.
> The §1/§2 tables show the namespace for readability; the value written to `config.yaml` is the
> **bare** slug. **OpenClaw/OpenCode keep their provider-prefixed form (§4).** Profiles
> `admin`/`researcher` (deepseek-v4-flash) + `critic`/`coder` (qwen3-coder-flash) + the `openclaw`
> agent (claude-haiku-4-5) were created and heartbeat-verified `pong` on 2026-08-10.

---

## 1. Agent → model roster

| Agent | Tier | Runtime | Model | Primary channel |
|---|---|---|---|---|
| claude | 1 | claude | claude-opus-4-8 | swarm-planning |
| admin | 2 | hermes | openrouter/deepseek/deepseek-v4-flash | swarm-admin |
| researcher | 2 | hermes | openrouter/deepseek/deepseek-v4-flash | swarm-research |
| critic | 2 | hermes | openrouter/qwen/qwen3-coder-flash | swarm-critique |
| coder | 2 | hermes | openrouter/qwen/qwen3-coder-flash | swarm-code |
| openclaw | 3 | openclaw | anthropic/claude-haiku-4-5 | (executor) |
| opencode | 3 | opencode | opencode/big-pickle | swarm-dev |

- Executors (openclaw, opencode) run on behalf of coder/researcher — they are process hosts, not deciders (ADR-001).
- Coder's executor is `openclaw`; researcher's executor is `opencode`.
- Model pins live in `agents/<id>/agent.yaml`; the rendered bridge config mirrors them.

---

## 2. Model registry

Verified 2026-08-10 against OpenRouter listings. Prices per 1M tokens.

| Model slug | Provider | $/1M in | $/1M out | Context | Notes |
|---|---|---|---|---|---|
| claude-opus-4-8 | Claude (subscription) | $5 | $25 | 1M | Strategist — draws on Max 20x plan |
| claude-haiku-4-5 | Claude (subscription) | $1 | $5 | 200K | OpenClaw executor — lowest subscription tier |
| openrouter/deepseek/deepseek-v4-flash | OpenRouter | $0.08 | $0.252 | 1.05M | Admin + Researcher |
| openrouter/qwen/qwen3-coder-flash | OpenRouter | $0.195 | $0.975 | 1M | Critic + Coder |
| opencode/big-pickle | local/free | $0 | $0 | — | OpenCode executor |

Daily cost estimate at ~10 work orders × 2 loops: ≈ $11 (base) to ≈ $22 (with revise loops). Claude-family ≈ $10.80–21.60/day ≈ 9–18% of the Max 200 weekly cap. Binding constraint is the $50/day OpenRouter cap, not Claude.

---

## 3. Creating a Hermes profile

Hermes isolates each agent as a **profile** — an independent HERMES_HOME directory (own config.yaml, .env, SOUL.md, memory, sessions). On this machine profiles live under the hermes install:

```
C:\Users\ankur.singh\AppData\Local\hermes\profiles\<name>\
```

### 3.1 Profile layout (per agent)

Each profile is a directory containing:

| File | Purpose |
|---|---|
| `config.yaml` | Model pin: `model.default`, `model.provider`, `model.base_url` |
| `.env` | Per-profile API keys (e.g. `OPENROUTER_API_KEY`) |
| `SOUL.md` | Identity/system prompt — rendered from `soul/<id>.md` + constraints |
| `memories/`, `sessions/`, `skills/`, `state.db` | Runtime state (auto-created) |

### 3.2 Create commands

```powershell
hermes profile create admin
hermes profile create researcher
hermes profile create critic
hermes profile create coder
```

Or clone an existing working profile to inherit config + .env + skills:

```powershell
hermes profile create critic --clone-from main
```

Options (verified `hermes profile create --help`): `--clone` (copy config.yaml/.env/SOUL.md/skills from active), `--clone-all`, `--clone-from SOURCE`, `--no-alias`, `--no-skills`, `--description`.

### 3.3 Pinning the model

Write the model into the profile's `config.yaml`:

```yaml
model:
  default: openrouter/qwen/qwen3-coder-flash
  provider: openrouter
  base_url: https://openrouter.ai/api/v1
```

Per-agent model map:

| Profile | model.default (bare slug — no `openrouter/` prefix) |
|---|---|
| admin | deepseek/deepseek-v4-flash |
| researcher | deepseek/deepseek-v4-flash |
| critic | qwen/qwen3-coder-flash |
| coder | qwen/qwen3-coder-flash |

### 3.4 Writing SOUL.md

`SOUL.md` is composed from `soul/<id>.md` + knowledge packs + skill index + standing constraints (see [[AGENT-SPECS]] §10).

> ⚠ **CORRECTION (2026-08-10).** `swarmctl config:render` (`apps/cli/dist/swarmctl.js`, v3.0.0) is currently a **stub** — it logs what it would compose but writes nothing, and it reads `agents/<id>/system.md`, which does not exist on this tree. Until it is implemented, **install the authoritative soul directly**: copy `soul/<id>.md` verbatim into `profiles/<id>/SOUL.md` and append the §10 standing-constraints block. Use UTF-8 I/O that does not mangle non-ASCII (PowerShell 5.1 `Get-Content`/`Set-Content` default to ANSI and corrupt em-dashes; use `[System.IO.File]::ReadAllText`/`WriteAllText` with a no-BOM `UTF8Encoding`). Done 2026-08-10 for admin/researcher/critic/coder — verified em-dash-clean, no mojibake.

### 3.5 Running a profile one-shot

The bridge invokes Hermes via runtimes.yaml:

```
["-p", "{profile}", "--prompt-file", "{instruction_file}"]
```

Verified CLI form (see `hermes --help`): `-z/--oneshot PROMPT`, `-m/--model MODEL`, `-p/--profile`. Example:

```powershell
hermes -p coder -z "Implement the work order in instruction.md" -m openrouter/qwen/qwen3-coder-flash
```

---

## 4. Creating an OpenClaw agent

OpenClaw config lives at `C:\Users\ankur.singh\.openclaw\openclaw.json`. Agents are managed via the `openclaw agents` subcommand and store state under `C:\Users\ankur.singh\.openclaw\agents\<name>\`.

### 4.1 Create an agent

```powershell
openclaw agents add openclaw --model anthropic/claude-haiku-4-5 --workspace C:\Users\ankur.singh\.openclaw\workspace
```

Verified flags (`openclaw agents add --help`): `--agent-dir <dir>`, `--bind <channel[:accountId]>`, `--json`, `--model <id>`, `--non-interactive`, `--workspace <dir>`. Listing: `openclaw agents list`; delete: `openclaw agents delete <name>`.

### 4.2 Model override per run

The bridge invokes OpenClaw via runtimes.yaml:

```
["--agent", "{agent}", "--prompt-file", "{instruction_file}"]
```

Model is resolved from openclaw.json agent defaults, or overridden with the `--model` flag:

```powershell
openclaw agent --agent openclaw --model anthropic/claude-haiku-4-5 --message-file instruction.md
```

Verified flags (`openclaw agent --help`): `--agent <id>`, `--channel <channel>`, `--json`, `--local`, `-m/--message <text>`, `--message-file <path>`, `--model <id>`, `--session-id`, `--session-key`, `--thinking <level>`, `--timeout <seconds>`, `--verbose <on|off>`.

### 4.3 openclaw.json structure (agent model block)

```json
"agents": {
  "defaults": {
    "workspace": "C:\\Users\\ankur.singh\\.openclaw\\workspace",
    "model": {
      "primary": "anthropic/claude-haiku-4-5",
      "fallbacks": ["openrouter/deepseek/deepseek-v4-flash-0731", "ollama/minimax-m3:cloud"]
    },
    "models": {
      "anthropic/claude-haiku-4-5": { "agentRuntime": { "id": "claude-cli" } }
    }
  }
}
```

Key facts verified 2026-08-10:
- `agents.defaults.model.primary` is already `anthropic/claude-haiku-4-5` (lowest Claude subscription tier currently present).
- Every Claude model entry routes through `agentRuntime.id = "claude-cli"` (the subscription CLI).
- `openclaw config` helpers: `get`, `set`, `patch`, `schema`, `validate`, `file` (see `openclaw config --help`).

### 4.4 Version note

Runtimes.yaml pins openclaw `expected_version: 2026.7.1-2` and the installed binary reports `OpenClaw 2026.7.1-2 (0790d9f)` — matched.

---

## 5. Runtime paths (verified)

| Runtime | Actual binary | runtimes.yaml (stale?) |
|---|---|---|
| hermes | `C:\Users\ankur.singh\AppData\Local\hermes\hermes-agent\venv\Scripts\hermes.exe` | points to `vansh.gupta` — **stale** |
| openclaw | `C:\Users\ankur.singh\AppData\Local\hermes\node\openclaw.ps1` | points to `vansh.gupta` — **stale** |

The current `config/runtimes.yaml` still points at `C:/Users/vansh.gupta/...`. On this machine the real paths live under `ankur.singh`. If the bridge can't find the binaries, correct `runtimes.yaml` before running.

## 6. Invocation summary (bridge → runtime)

| Runtime | Template | Example |
|---|---|---|
| hermes | `-p {profile} --prompt-file {instruction_file}` | `hermes -p coder -z "..." -m <model>` |
| openclaw | `--agent {agent} --prompt-file {instruction_file}` | `openclaw agent --agent openclaw --model claude-haiku-4-5 --message-file task.md` |
| opencode | `run {message} -m {model}` | `opencode run "task" -m opencode/big-pickle` |
| claude | `-p {instruction} --model {model}` | `claude -p "plan" --model claude-opus-4-8` |

## 7. Related

[[AGENT-SPECS]] · [[ADR-001-agent-boundaries]] · [[TECHNICAL-ARCHITECTURE]] · [[WORKFLOWS]] · [[standards/fully-kitted]]
