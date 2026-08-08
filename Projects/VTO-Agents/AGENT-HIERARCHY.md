---
tags: [vto, agents, orchestration, hierarchy, subagents, openrouter]
date: 2026-08-07
status: design
related: ["[[SLACK-ORCHESTRATION]]", "[[ENGINEERING-LOOP]]", "[[OPENCODE-BRIEFS]]", "[[SOUL-Hermes]]", "[[SOUL-OpenClaw]]", "[[SOUL-OpenCode]]"]
---

# 🪜 Agent hierarchy — two tiers, one cycle

Refines the roster in [[ENGINEERING-LOOP]] / [[SLACK-ORCHESTRATION]] with Rohit's direction
(2026-08-07): the orchestration runs as a **cycle** between a **higher tier** (brain) and a **lower
tier** (hands), and each tier is made of **subagents on different OpenRouter LLMs**, chosen for
output-per-dollar.

---

## 1. The principle

> **Higher agent = command + analysis + code quality.** **Lower agent = controls the product +
> does the coding.** They run in a loop: the higher tier commands and judges; the lower tier builds;
> the higher tier analyzes the result and commands again — around and around until the bar (≥98% vs
> FittingBox) is met, then the human commits.

```
        ┌──────────────────────  HIGHER TIER (brain)  ──────────────────────┐
        │  command · analysis · code-quality · tool-calling                  │
        │  Hermes subagents (OpenRouter, skilled/tools) + Opus + Fable       │
        └───────────────┬───────────────────────────▲──────────────────────┘
             commands ▼ (plan, assign, critique)     │ analysis + quality verdict
        ┌───────────────┴───────────────────────────┴──────────────────────┐
        │  LOWER TIER (hands): builds the product + the code + runs tests    │
        │  OpenClaw subagents (OpenRouter, redundant coding) + OpenCode(free)│
        └───────────────────────────────────────────────────────────────────┘
                     ↺  loop until accuracy ≥ 0.98  → HUMAN COMMIT
```

**Routing rule (who gets a task):**
1. **Analysis / tool-calling / judgment / orchestration → Hermes** (it *is* the skilled agent:
   `toolsets: [hermes-cli, web]`, evolving memory). This is the higher tier's default.
2. **Cheap / non-serious / mechanical / can-be-done-for-free → OpenCode** (`big-pickle`, free) — the
   **fallback** and the runner for fetch + tests + video + accuracy.
3. **Redundant / low-analysis coding (boilerplate, mechanical edits, bulk changes) → OpenClaw**
   subagents on cheap OpenRouter models.
4. **Premium quality gate → Opus (per-change) → Fable (holistic)** — higher tier, review only.

Cost discipline (unchanged): free where possible (OpenCode), cheap OpenRouter for bulk coding
(OpenClaw), Hermes' cheap-but-capable OpenRouter models for analysis, premium Claude only to review.
See [[delegate-testing-to-opencode]].

---

## 2. HIGHER TIER — Hermes subagents (analysis / command / quality)

Hermes already routes through OpenRouter (`base_url: https://openrouter.ai/api/v1`) and has tools.
Create **named subagent profiles**, each pinned to a different OpenRouter model by job:

| Subagent | Job | Suggested OpenRouter model† | Why |
|---|---|---|---|
| **Hermes-Commander** | orchestrate: open tasks, assign, route, keep the scoreboard | `openrouter/deepseek/deepseek-v4-pro` | cheap, strong tool-use + reasoning |
| **Hermes-Analyst** | deep analysis / diagnosis / read failures & contradict research | `openrouter/deepseek/deepseek-r1` *(or v4-pro)* | best reasoning per dollar |
| **Hermes-QualityKeeper** | maintain code quality: pre-Opus lint of design, spot regressions | `openrouter/qwen/qwen-2.5-coder-32b-instruct` | coding-aware, cheap |
| **Hermes-Researcher** | analytical web research + tool calling (with OpenCode-Scout doing the raw fetch) | `openrouter/deepseek/deepseek-v4-pro` | reasons over fetched material |

† **Confirm exact IDs against your OpenRouter dashboard** — model slugs change; pick the current
best output-per-dollar in each class. `deepseek-v4-pro` and `deepseek-v4-flash-0731` are already
referenced in the local configs, so they're safe anchors.

**How to add them (Hermes config `%LOCALAPPDATA%\hermes\config.yaml`):** the config already has a
`providers:` map, a top-level `model:` and `agent.personalities`. Add an **OpenRouter provider** and
one **agent profile per subagent** bound to a model + a focused personality/system prompt, e.g.:
```yaml
providers:
  openrouter:
    api: https://openrouter.ai/api/v1
    api_key_env: OPENROUTER_API_KEY      # key already configured
    models:
      - deepseek/deepseek-v4-pro
      - deepseek/deepseek-r1
      - qwen/qwen-2.5-coder-32b-instruct
# then a profile per subagent (schema per Hermes v0.18 — confirm with `hermes --help` / docs):
agents:            # (or the equivalent "profiles"/"subagents" key Hermes uses)
  commander:   { provider: openrouter, model: deepseek/deepseek-v4-pro,  personality: concise,   toolsets: [hermes-cli, web] }
  analyst:     { provider: openrouter, model: deepseek/deepseek-r1,      personality: technical, toolsets: [hermes-cli, web] }
  quality:     { provider: openrouter, model: qwen/qwen-2.5-coder-32b-instruct, personality: technical }
  researcher:  { provider: openrouter, model: deepseek/deepseek-v4-pro,  personality: technical, toolsets: [web] }
```
> Hermes' exact subagent/profile key needs confirming in v0.18 (the head we read shows
> `providers` + `model` + `agent.personalities`); the shape above is the intent — bind each named
> identity to a distinct OpenRouter model + toolset. Keep tool-calling ON for Hermes subagents.

---

## 3. LOWER TIER — OpenClaw subagents (redundant coding)

OpenClaw config (`~/.openclaw/openclaw.json`) has OpenRouter **enabled** and defines agents under
`agents:` with `model.primary` + `fallbacks`. Add one **named agent per coding subagent**:

| Subagent | Job | Suggested OpenRouter model† |
|---|---|---|
| **OpenClaw-Coder** | main feature coding (moderate) | `openrouter/deepseek/deepseek-v4-flash-0731` (already configured) |
| **OpenClaw-Refactorer** | mechanical refactors, rename/move, bulk edits | `openrouter/deepseek/deepseek-v4-flash-0731` |
| **OpenClaw-Boilerplate** | scaffolds, config, repetitive files | free local `ollama/minimax-m3:cloud` or `openrouter/qwen/qwen-2.5-coder-32b-instruct` |

**How to add them (`openclaw.json` → `agents`):** mirror `defaults`, override the model:
```json
{
  "agents": {
    "defaults": { "model": { "primary": "anthropic/claude-haiku-4-5", "fallbacks": ["openrouter/deepseek/deepseek-v4-flash-0731", "ollama/minimax-m3:cloud"] } },
    "coder":       { "model": { "primary": "openrouter/deepseek/deepseek-v4-flash-0731", "fallbacks": ["ollama/minimax-m3:cloud"] } },
    "refactorer":  { "model": { "primary": "openrouter/deepseek/deepseek-v4-flash-0731" } },
    "boilerplate": { "model": { "primary": "ollama/minimax-m3:cloud" } }
  }
}
```
Invoke a subagent with `openclaw --agent coder …` (confirm the exact flag with `openclaw --help`).
Keep `tools.profile: coding`. Anthropic Haiku stays available as the higher-quality fallback when a
redundant task turns out to need more care.

---

## 4. OpenCode — the free floor / fallback

`opencode/big-pickle` (free, verified live). Runs **all mechanical work**: web fetch (Scout), the
TestRunner / VideoTester / Accuracy harnesses, scaffolding, and **any task cheap enough not to
warrant a paid model**. It is the **fallback** when Hermes/OpenClaw are busy or the task is trivial.
⚠️ OpenCode's gateway serves ONLY the free tier for this account (paid models → "No payment
method"), so paid work must go to Hermes/OpenClaw's OpenRouter or Claude — **not** OpenCode.

---

## 5. Mapping tiers → Slack bots → loop stages

Slack bot identities ([[SLACK-ORCHESTRATION]] §4) stay the **roles**; the **subagent** is the model
that answers under the hood (the bridge picks it by task type).

| Loop stage | Tier | Bot (Slack) | Subagent / runtime |
|---|---|---|---|
| RESEARCH | lower fetch + higher analysis | Scout, Researcher | OpenCode(free) fetch → Hermes-Researcher analysis |
| PLAN | higher | Hermes | Hermes-Commander |
| CODE | lower | Coder, Scaffolder | OpenClaw-Coder / -Refactorer; OpenCode-Boilerplate(free) |
| TEST / BUILD | lower | TestRunner | OpenCode(free) shell |
| VIDEO | lower | VideoTester | OpenCode(free) shell |
| ACCURACY | lower→higher | Accuracy | OpenCode(free) computes → Hermes-Analyst reads |
| REVIEW | higher | Opus → Fable | Claude premium (quality gate) |
| quality-maintenance (continuous) | higher | Hermes | Hermes-QualityKeeper |
| HUMAN COMMIT | — | (human) | git, manual |

The **cycle**: Hermes-Commander assigns → lower tier builds + tests → Accuracy scores → Hermes-
Analyst + QualityKeeper judge → below bar → Hermes-Commander re-commands from RESEARCH with the
failure quoted → … → at/above bar → Opus+Fable sign off → human commits.

---

## 6. To do to make this real
1. Add the OpenRouter provider + Hermes subagent profiles to `hermes/config.yaml` (confirm v0.18
   subagent schema).
2. Add the OpenClaw subagents to `openclaw.json` `agents:`.
3. Pick/confirm the exact OpenRouter model slugs (output-per-dollar) on the OpenRouter dashboard.
4. Update `agent-os/slack/config/bridge.config.yaml` so each Slack agent's runtime invokes the right
   subagent (`hermes --agent <x>` / `openclaw --agent <x>` / `opencode run -m …`).
5. Heartbeat each new subagent (one cheap ping) before trusting it in the loop.

## Caveats
- Exact **OpenRouter model IDs** and the **Hermes subagent schema** must be confirmed on the system;
  the tables are the *intent* + safe anchors, not gospel slugs.
- Every paid subagent should get a one-line heartbeat (like the OpenCode/Haiku pings) before the loop
  relies on it — cheap insurance against an unfunded/renamed model.
