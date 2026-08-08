---
okf: 1
id: model-optimization-plan
type: decision-draft
project: VTO
role: orchestrator-analysis
status: draft
created: 2026-08-07
updated: 2026-08-07
tags: [cost, models, orchestration, decision]
---

# Model Optimization Plan — cheapest-sufficient model per role

**Trigger (Rohit, 2026-08-07):** Orchestration may run for weeks at a time. Heavy models
like `deepseek-v4-pro` are overkill for most roles. Goal: for each subagent/role in the VTO
loop, pick the **best cheapest model that is *enough*** for that role's task — capability
floor, not ceiling. Research live capability + pricing via OpenCode (free `opencode/big-pickle`,
web-enabled), analyze, then decide.

## Roles in the VTO orchestration loop (capability floors)

| # | Role | Who | What it must do | Capability floor | Cost sensitivity |
|---|------|-----|-----------------|------------------|------------------|
| R1 | **Orchestrator** | Hermes (this agent) | Plan, decide, split tasks, synthesize findings, judge against DoD, hold whole-vault context | Strong multi-step reasoning + long context + instruction-following. Does NOT execute tool-heavy work. | HIGH — runs continuously for weeks; every tick costs. |
| R2 | **Worker / build executor** | OpenClaw | Follow a task note, use tools (files/shell/git/browser), write + debug code to spec, verify | Solid tool-calling + coding (SWE-bench-lite tier), reliable instruction-following. Frontier NOT required. | HIGH — long tool-heavy sessions = many tokens. |
| R3 | **Research specialists** | 11 briefs via OpenClaw sub-sessions | Read a self-contained brief, web-research, summarize into a findings note per an output contract | Reading comprehension + summarization + web tool-use. Light reasoning. | MED — bursty, run per-wave not continuously. |
| R4 | **Scraping arm** | OpenCode | Fetch/scrape web, extract structured data | Basic tool-use + extraction. | ZERO — already free (`opencode/big-pickle`). Keep. |
| R5 | **Adversarial reviewer (Catalyst)** | Catalyst gate stage 1 | Adversarial critique of a candidate against rules, structured feedback | Instruction-following + critique. Cheap by design. | LOW — already on Haiku-tier. |
| R6 | **Final validator** | Claude Opus (gate stage 2) | Ultimate verdict — adjudicate reviewer findings, APPROVED/REWORK | Highest-quality judgment. Kept deliberately expensive but LOW frequency (only on candidates). | LOW freq / HIGH unit — leave alone unless research says otherwise. |

**Optimization targets (by $ impact):** R1 (Hermes) and R2 (OpenClaw) dominate cost because they
run continuously/long. R3 is bursty. R4 is free. R5/R6 are low-frequency gate stages — R6 (Opus)
stays as the quality anchor unless a strong-cheap replacement is proven.

## Research inputs (filled by OpenCode + live API)
<!-- pricing-live.json : exact OpenRouter prices (source of truth) -->
<!-- pricing-benchmarks.md : OpenCode web research on cheap capable models -->
<!-- orchestration-capabilities.md : OpenCode research on small-LLM-in-orchestration evidence -->

## Decision table (per role → model)
<!-- filled after analysis -->

## Cost estimate (weeks of runtime)
<!-- filled after analysis -->
