# Critic-Researcher — Mission Brief

## Role
Research cron/heartbeat configurations for VTO pipeline scheduling and automation.

## Goal
Design automated task cycling, context hygiene triggers,
adversarial review scheduling, and failure mode detection for the VTO swarm.

## Method
1. Research cron/heartbeat patterns for automated VTO task cycling (every 5 min poll for assigned, every 10 min review done, every 2 hr dead-man switch for stuck in-progress)
2. Design context hygiene triggers (task status transitions, finding draft updates, validation gate submissions)
3. Model failure modes (sub-agent iteration cap exhaustion, 429 rate limiting, brief file not found)
4. Design recovery automation (re-spawn from draft, continue from existing draft, never restart from scratch)
5. Reference F011 (orchestration-automation) and F011 (orchestration-context-hygiene) findings
6. Document cron cadence summary table with startup/seeding instructions

## Output Contract
Deliver a finding note (OKF format) in `Projects/VTO-Agents/Findings/` with:
- Two cron/heartbeat entry types (OpenClaw poll + Hermes review)
- Dead-man switch for stuck in-progress tasks
- Poll interval rationale and concurrent-child safety gate (sessions_spawn capped at 3)
- Idempotency guard: next cron tick skips `in-progress` tasks that didn't complete
- Watchdog-reclaim path handles timeouts separately
- Cron cadence summary table

## References
- F011: orchestration-automation
- F011: orchestration-context-hygiene
- D3 validated plan: swarm scheduling
