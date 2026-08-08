---
okf: 1
id: vto-agents-index
type: protocol
project: VTO
status: active
created: 2026-08-03
updated: 2026-08-03
tags: [index, swarm]
---

# VTO-Agents — swarm knowledge base (index)

Everything here is [[OKF-FORMAT]] (plain markdown + YAML frontmatter): diffable, GitHub-ready, loadable by future agents.

## Souls (who the agents are)

- [[SOUL-Hermes]] — the Orchestrator (`deepseek-v4-pro`, evolving memory): decides, assigns, absorbs, synthesizes. Includes the swarm-firing playbook.
- [[SOUL-OpenClaw]] — the complex-coding Worker (`claude-haiku-4-5` via claude-cli): executes missions, spawns parallel sub-sessions (`sessions_spawn`), writes findings.
- [[SOUL-OpenCode]] — the FREE arm (`opencode/big-pickle`): all web fetch/scrape + simple coding + new-file scaffolding.
- [[SOUL-Opus]] — the Analyst (`claude-opus-4-8`): per-change code review + the validation-gate verdict.
- [[SOUL-Fable]] — the Boss (`claude-fable-5`): final holistic sign-off before the human commits.

Wired into the live agents: Hermes's `SOUL.md` and OpenClaw's `AGENTS.md` both point here.

## Engineering loop (autonomous build machine)

- [[ENGINEERING-LOOP]] — **the autonomous code→test→video-test→review loop**: the full agent roster + canonical model map, the 8-stage state machine, cron-driven autonomy, and the hard rules (git commit stays human, new-files-over-edits on conflict). This is the source of truth for model routing — where older docs disagree, it wins.
- [[VIDEO-TEST]] harness lives in `rkumar-vto/tools/video-test/` (Playwright + fake camera → logs only).

## System flow

- [[System Flow]] — **what actually happens when Rohit gives a feature command** (e.g. "improve frame detection/removal"): master flowchart, dashboard-visibility map, validation state machine, model fallback ladder, and the full edge-case map — all as Mermaid diagrams.

## Loop (automation contract)

- [[Loop Protocol Spec]] — **source of truth for the automation contract**: each of the four stages (dispatcher handoff, Hermes-assign, OpenClaw-execute, validate.ps1) with exact inputs / outputs / triggers / failure modes. Read this first when implementing automation.
- [[Loop State Machine]] — **transition + payload contract** on top of the protocol spec: two layered state models (kanban card ↔ vault task note), the event → transition table, the exact JSON payloads for `claim` / `worker_return` / `heartbeat` / `verdict_approved` / `verdict_rework`, retry rules, and a mermaid sequence diagram. Read this when wiring automation to the kanban dispatcher.
- [[LOOP-ENGINEER]] — the validated output loop: OpenClaw executes → Hermes compiles → **Catalyst adversarial review (cheap model) → Claude final verdict (Opus)**. Gate runner: `C:\Users\ankur.singh\catalyst-env\vto\validate.ps1`.

## Research agents (missions ready to fire)

| Agent | Attacks |
|---|---|
| [[Medical-Researcher]] | Iris prior validity, PD gold standards, regulatory line, anatomy of fit |
| [[Device-Researcher]] | LiDAR/TrueDepth/ToF device map, web depth-API reality, capability ladder |
| [[Competitor-Researcher]] | Full vendor map + quality/pricing scores; the quality-per-dollar wedge |
| [[Software-Researcher]] | Tracking libs, tiny segmentation models vs the 250KB budget, inpainting |
| [[Mathematical-Researcher]] | Error budgets, yaw plateau, One-Euro tuning, rotation-stable texturing |
| [[Physics-Researcher]] | Lens optics, frame materials PBR, lighting estimation, shadows |
| [[Patent-Researcher]] | Fittingbox's 16 frame-removal patents, FTO map, design-arounds, prior art |
| [[FittingBox-Researcher]] | Client-side teardown of their demos: bundles, models, what ships |
| [[Orchestration-Researcher]] | Automating this very swarm; refute-style verification; context hygiene |
| [[Testing-Researcher]] | Caliper PD study, jitter metrics, perceptual gates, device matrix |
| [[Rendering-Researcher]] | Draco/KTX2 decoder contradiction, fit-safe optimization, 40MB→3MB |

## Findings

Completed research lands in `Findings/` as `F<NNN> <topic>.md` (`type: finding`) — the accumulating knowledge of the project.

## Related

- [[VTO]] — project hub · [[VTO Agent Architecture]] — task protocol · [[VTO Task Log]] — task index
- Source repo: `C:\Users\ankur.singh\shopify\nmg-vto` (CLAUDE.md + Decisions.md are ground truth; README/.claude set is stale)
