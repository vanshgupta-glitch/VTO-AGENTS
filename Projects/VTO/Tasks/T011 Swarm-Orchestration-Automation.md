# T011 — Swarm Orchestration Automation

project: [[VTO]]
status: done
assigned_by: Hermes
assigned_on: 2026-08-04
worker: OpenClaw

## Goal

Design the automation that makes the Hermes↔OpenClaw research loop self-driving — heartbeat polling, context hygiene, adversarial finding review, failure detection, and performance metrics.

## Context (from Hermes)

Load `Projects/VTO-Agents/Research Agents/Orchestration-Researcher.md` as your mission brief; deliver per its Output contract.

**Relevant context:**
- Current loop is human-triggered; goal is self-driving swarm
- nmg-vto repo (`C:\\Users\\ankur.singh\\shopify\\nmg-vto`) already practices adversarial multi-agent review (15-21 agent runs with refutation)
- Available machinery: OpenClaw sessions_spawn/cron/heartbeat, Hermes profiles/cron, Agent OS dashboard (Kanban, Loop, Mastermind), this OKF vault as context bus
- The Agent OS dashboard at localhost:3100 has Paperclip for agent+token-spend monitoring

**Priority ordering:**
1. Automation design — exact cron/heartbeat configs for OpenClaw to poll `Tasks/` for `status: assigned` and Hermes to review `done` notes
2. Context hygiene — note size limits, summarization cadence, index maintenance from published agent research
3. Adversarial finding review — adapt nmg-vto's refute-style review: when should a second agent try to refute before Hermes accepts?
4. Failure modes — dedup, stale claims, lost handoffs → detection + recovery
5. Performance metrics — what to log (duration, tokens, rework rate) and where

## Definition of done
- [x] Finding note `Findings/F011 orchestration-automation.md` — ready-to-apply cron/heartbeat configs
- [x] Finding note `Findings/F011 orchestration-context-hygiene.md` — size limits, summarization rules, index maintenance
- [x] Finding note `Findings/F011 orchestration-adversarial-review.md` — when/how to refute findings before acceptance
- [x] Finding note `Findings/F011 orchestration-failure-modes.md` — detection + recovery protocols for dedup/staleness/lost handoffs
- [x] Finding note `Findings/F011 orchestration-metrics.md` — logging schema for swarm performance

## Result & context returned (OpenClaw fills this)
- What was done: Executed Orchestration-Researcher mission per brief. Designed and wrote 5 finding notes covering automation (exact cron/heartbeat configs for OpenClaw to poll Tasks/ for assigned and Hermes to review done), context hygiene (size limits, summarization cadence, index maintenance, context window budgeting per agent), adversarial finding review (3-tier adaptation of nmg-vto's 15/20/21-agent refutation pattern to VTO research findings), failure modes (6 swarm-level failure modes: dedup, staleness, lost handoffs, concurrent writes, cron collision, swarm silence — each with detection+recovery protocols), and metrics (JSONL logging schema for swarm performance per task with Paperclip integration).
- Artifacts / paths:
  - `Projects/VTO-Agents/Findings/F011 orchestration-automation.md`
  - `Projects/VTO-Agents/Findings/F011 orchestration-context-hygiene.md`
  - `Projects/VTO-Agents/Findings/F011 orchestration-adversarial-review.md`
  - `Projects/VTO-Agents/Findings/F011 orchestration-failure-modes.md`
  - `Projects/VTO-Agents/Findings/F011 orchestration-metrics.md`
- Decisions made while executing:
  - OpenClaw poll interval: 5 min (not 2 or 10) — aligns with sub-session cadence and avoids wasteful re-scans
  - Hermes review interval: 10 min — gives slack for compile+validate cycles
  - Adversarial review: 3-tier (standard single-claim / candidate-level via validate.ps1 / deep multi-agent for milestones) — recognizing full 20-agent runs are cost-prohibitive for the VTO swarm's scale
  - Failure mode catalog: 6 FM entries with severity matrix — FM-3 (lost handoffs) and FM-6 (swarm silence) are the highest-risk
  - Write-partitioning discipline: Hermes exclusively owns hub/index files; workers own task notes and findings — prevents FM-4 concurrent writes
  - All proposals that change VTO Agent Architecture or SOULs are in each finding's "Implications" section for Hermes to accept/reject
- Problems / open questions:
  - verify `hermes cron add` on this host supports the exact syntax in F011-automation — the cron system is Hermes-specific; test with `--dry-run` before activating
  - Whether Paperclip API at localhost:3100 exposes per-agent spend endpoints (F011-metrics depends on this)
  - Tier 3 deep adversarial review (5+ sub-agents) has not been cost-modeled against actual token pricing; reserve for one milestone test before making it standard
  - The `cancelled` status for de-duplication (FM-1) is currently unused in the vault frontmatter — Hermes should formalize it
- What Hermes should know for the next decision:
  - All 5 finding files are ready; each carries an "Implications" list with concrete proposals for VTO Agent Architecture / SOUL changes — Hermes should accept/reject each before updating docs
  - The 3 cron configs in F011-automation are copy-paste ready; run `hermes cron add` to apply, then `hermes cron fire` to trigger the first cycle
  - The failure modes catalog (FM-1 through FM-6) is comprehensive for the swarm's current scale; add new FM entries as the swarm grows to more parallel agents

## Review (Hermes fills this)
- Verdict: done | rework
- Notes: