# Memory — how this vault is organized

> **Standing instruction (from Rohit, 2026-08-03):** Every task done with Claude/agents gets noted in this vault. Notes are organized into folders and connected with `[[wikilinks]]` based on the **task**, its **context**, and the **client or project** it belongs to.

## Folder conventions

- `Projects/<Project Name>/` — one folder per project. Each project has a **hub note** (same name as the folder) linking to all its task/log notes.
- `Clients/<Client Name>/` — one folder per client. Client hub note links to that client's projects and tasks.
- `Daily/` — (optional) day notes that link to whatever was worked on that day.
- Task/log notes live inside their project folder, named `<topic> YYYY-MM-DD.md`.

## Linking rules

- Every task note links **up** to its project hub (`[[Agent OS]]`) and, if applicable, its client.
- Hub notes link **down** to every task note, newest first.
- Cross-reference related notes liberally with `[[wikilinks]]` — connections are the point.

## Current map

- Project: [[Agent OS]] — the AI command-center dashboard (setup + customization)
  - [[Agent OS Setup Log 2026-08-03]] — full install & configuration record
- Project: [[VTO]] — eyewear virtual try-on for Shopify; Hermes orchestrates, OpenClaw executes
  - [[VTO Agent Architecture]] — roles + task protocol · [[VTO Task Log]] — task index & template
  - [[VTO-Agents]] — swarm knowledge base: [[SOUL-Hermes]], [[SOUL-OpenClaw]], 11 research agents, findings ([[OKF-FORMAT]], GitHub-ready)
  - [[LOOP-ENGINEER]] — validation gate: Catalyst review (cheap) → Claude verdict (Opus); `catalyst-env\vto\validate.ps1`
  - [[System Flow]] — end-to-end diagrams: what a feature command triggers, edge cases, fallbacks, dashboard visibility
  - [[ENGINEERING-LOOP]] — the autonomous code→test→video-test→review loop: agent roster + canonical model map, 8 stages, cron-driven, human commits only. Souls: [[SOUL-Fable]] (boss), [[SOUL-Opus]] (analyst), [[SOUL-OpenCode]] (free). Video harness in rkumar-vto/tools/video-test/.
- `Agentic OS/` — the dashboard's own write-space: `Goals.md` (Goals tab), `Journal/` (Journal tab), `Memories/` (Jarvis chat memory), `Projects/<slug>/Memories/` (per-project), Agent Room + Pipeline outputs. Dashboard reads/writes here live.
- Kanban: Hermes board **vto** mirrors VTO work (`hermes kanban --board vto list`) — assign a card to a profile to fire it; unassigned cards never auto-run.
- [[Welcome]] — how to open this vault in Obsidian
