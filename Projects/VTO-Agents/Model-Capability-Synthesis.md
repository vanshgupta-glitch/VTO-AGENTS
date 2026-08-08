---
okf: 1
id: model-capability-synthesis
type: finding
project: VTO
role: orchestrator-analysis
status: draft
created: 2026-08-07
updated: 2026-08-07
tags: [cost, models, orchestration, capability, decision]
source: OpenRouter live pricing API (2026-08-07, 152 models) + orchestrator model knowledge
---

# Model Capability Synthesis — cheapest-sufficient per VTO role

Confidence key: **[H]** published leaderboard / well-known · **[M]** model-family estimate · **[L]** guess (needs verification).

## Live price anchors (OpenRouter, 2026-08-07, per 1M tokens)

| Model | in $ | out $ | ctx | Tier |
|---|---|---|---|---|
| gemini-2.5-flash-lite | 0.10 | 0.40 | 1.05M | ultra-cheap |
| qwen3-30b-a3b-instruct | 0.048 | 0.19 | 262k | ultra-cheap |
| mistral-small-24b | 0.05 | 0.08 | 32k | ultra-cheap |
| deepseek-v4-flash | 0.088 | 0.176 | 1.05M | ultra-cheap, huge ctx |
| gpt-4o-mini | 0.15 | 0.60 | 128k | budget |
| gemini-2.5-flash | 0.30 | 2.50 | 1.05M | budget |
| qwen3-32b | 0.08 | 0.28 | 131k | budget |
| deepseek-v3.2 | 0.269 | 0.40 | 164k | mid |
| **deepseek-v4-pro (CURRENT)** | **0.435** | **0.870** | 1.05M | mid — the one we're moving OFF |
| claude-haiku-4.5 | 1.00 | 5.00 | 200k | premium-cheap |
| claude-opus-4 (gate) | ~15 | ~75 | 200k | anchor — keep |

**Headline:** `deepseek-v4-flash` ($0.088 in / 1.05M ctx) is ~5× cheaper than `deepseek-v4-pro` ($0.435) with the same context window. If flash clears the orchestrator/worker capability floor, that's the single biggest saving for weeks-long runs.

## Capability read (per role floor)

### R1 Orchestrator (Hermes) — floor: strong multi-step reasoning + long ctx + instruction-following
- deepseek-v4-flash: **[M]** flash tier trades some deep reasoning for speed/cost; planning + synthesis is borderline. Big ctx (1.05M) is ideal for whole-vault. **Verify: reasoning depth on multi-finding synthesis.**
- gemini-2.5-flash: **[H]** strong instruction-following + 1M ctx, solid mid-reasoning. Good orchestrator floor at $0.30.
- deepseek-v3.2 ($0.269): **[M]** stronger reasoning than flash, cheaper than v4-pro, 164k ctx. Safe orchestrator downgrade from v4-pro.
- **Provisional R1: gemini-2.5-flash** (safety) OR **deepseek-v4-flash** (aggressive) with a reversion trigger.

### R2 Worker / build (OpenClaw) — floor: solid tool-calling + coding + reliable instruction-following
- qwen3-coder-30b ($0.07): **[H]** purpose-built for coding + tool-use, very cheap. Strong worker candidate.
- deepseek-v3.2 ($0.269): **[H]** excellent coding/tool-use, near-frontier SWE-bench for the price.
- gpt-4o-mini ($0.15): **[H]** reliable tool-calling, weaker on hard coding.
- gemini-2.5-flash ($0.30): **[H]** strong tool-calling + coding, huge ctx.
- **Provisional R2: qwen3-coder-30b or deepseek-v3.2** (verify BFCL tool-call reliability in a loop).

### R3 Research specialists — floor: reading + summarization + web tool-use
- qwen3-30b-a3b ($0.048) / mistral-small-24b ($0.05) / gemini-2.5-flash-lite ($0.10): **[H]** all clear this easily.
- **Provisional R3: gemini-2.5-flash-lite** (1M ctx for long pages, cheap).

### R4 Scraping (OpenCode) — FREE `opencode/big-pickle`. **Keep. Zero cost.** (backend flaky today but free.)

### R5 Adversarial reviewer (Catalyst) — floor: critique + instruction-following
- Already Haiku-tier / cheap. Candidates: gemini-2.5-flash, claude-3.5-haiku. **Keep cheap.**

### R6 Final validator (Claude Opus gate) — **DO NOT OPTIMIZE.**
Low frequency (once per candidate, few/day). Quality anchor. Cost is trivial vs continuous R1/R2. Leave alone.

## Claims requiring verification (fired to OpenCode)
1. deepseek-v4-flash reasoning depth vs deepseek-v4-pro on planning/synthesis (SWE-bench + Arena reasoning).
2. qwen3-coder-30b + deepseek-v3.2 tool-calling reliability (BFCL v3).
3. gemini-2.5-flash-lite long-context instruction adherence.

## Provisional decision (act now, revise on evidence)

| Role | Was | → Provisional | in $/M | Reversion trigger |
|---|---|---|---|---|
| R1 Orchestrator | deepseek-v4-pro (0.435) | **gemini-2.5-flash (0.30)** | 0.30 | if synthesis quality drops → deepseek-v3.2 |
| R2 Worker | (heavy) | **deepseek-v3.2 (0.269)** | 0.269 | if tool-calls malform 3 loops → gemini-2.5-flash |
| R3 Research | (heavy) | **gemini-2.5-flash-lite (0.10)** | 0.10 | if summaries miss brief → qwen3-32b |
| R4 Scraping | opencode free | **keep (free)** | 0 | — |
| R5 Reviewer | Haiku | **keep cheap** | ~0.30 | — |
| R6 Validator | Opus | **keep Opus** | anchor | never |

**Rationale:** stay one tier above the aggressive floor on R1/R2 (they run continuously and errors compound), go rock-bottom on R3 (bursty, low-risk), keep the Opus gate as the quality anchor. This drops the continuous-cost roles from v4-pro-tier to ~$0.27–0.30/M — a ~30–75% cut — without betting the loop on an unproven flash-tier planner.
