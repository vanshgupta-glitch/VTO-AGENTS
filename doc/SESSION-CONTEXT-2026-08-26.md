# SESSION-CONTEXT — 2026-08-24 → 2026-08-26 (for a fresh Claude session)

> Written at handoff, 2026-08-26. Read this top-to-bottom once; follow links only as needed.
> Companion docs: [[OPS-LOG]] (every change, dated) · [[WORKFLOWS]] §11 (the loop contract) ·
> [[VANSH-CUTOVER]] · [[DISTRIBUTED-ARCHITECTURE]] (status banner) · auto-memory
> `~/.claude/projects/C--Users-ankur-singh/memory/swarm-code-state.md`.

## ⚡ DO-FIRST: the trained model is WAITING

The Kaggle training kernel **COMPLETED** (checked 2026-08-26, after ~2-4 h on the pinned T4):

```powershell
$env:PYTHONUTF8='1'   # ALWAYS set this before kaggle CLI on Windows (charmap crash otherwise)
kaggle kernels output ankursking01/bisenet-3-class-frame-lens-face-vto-t042 -p C:\Users\ankur.singh\kaggle-t042-out
$env:BISENET3_OUT='C:\Users\ankur.singh\kaggle-t042-out'
python -m pytest C:\Users\ankur.singh\shopify\nmg-vto\rkumar-vto\tools\model-training\tests -q
```

- Gates green (mIoU>0.50, frame/lens IoU≥0.35, ONNX parity)? → copy `out/` contents into
  `C:\Users\ankur.singh\face-parsing.PyTorch\res\`, then re-trigger the loop from Slack
  (`@VTO-Admin improve the frame removal feature`) — T042b done, baton = T042c (bisenet.ts
  integration in `packages/vto-core/src/frame-detection/`).
- Gates red? Read `out/GATES.txt` + `metrics.json`; the trainer is
  `rkumar-vto/tools/model-training/kaggle/bisenet3_kaggle.py`, push via `push_kernel.ps1`
  (pins `--accelerator NvidiaTeslaT4`).

## What this session built (2 days, all COMMITTED + PUSHED)

1. **Doc-loop restructured to the operator's lap pipeline** — ADMIN→TASKS→SUBTASKS→RESEARCH→
   CRITIC(PASS/BLOCK, ≤2 blocks/lap)→CODE→BUILD→CODE_TEST→**DEPLOY(dev store)**→VIDEO_UI_TEST
   (60s/clip fake camera)→RESULTS(accuracy)→**ANALYSIS(new `analyst` role: Opus via OpenClaw
   `vto-analyst`, DECISION CONTINUE/DONE)**→DOCS(docsmanager EVERY lap)→next lap. 40-lap cap,
   3-strike rework→`#swarm-human-gate` halt, per-lap counter resets, op results appended to the
   shared task doc `.swarm-tasks/run-<id>.md`. Coder = OpenClaw **Haiku** (`vto-coder-rohit`,
   workspace-synced incl `.swarm-tasks`); hermes/qwen coder retired.
2. **Verification campaign** (Tests A–D all passed live) — found+fixed: stdin-pipe hang (all
   openclaw/opencode daemon runs blocked forever → `execNoStdin` + taskkill /T tree-kill),
   failed-rework stage freeze, channel-membership gaps (docsmanager/opencode), stale
   workers.active eating claim capacity, rework prompts/pinning, video-op 600s→1500s,
   SWARM_CLAIM_VT=2400 (set in launchers, NOT .secrets.env — read at db-module load).
3. **Hardening** — pg pool 'error' handler (a dropped pooler connection had killed the gateway);
   **SwarmWatchdog** scheduled task (2-min: relaunches dead services, reaps >30-min openclaw
   strays). PAUSE it before manual service bounces: `Disable-ScheduledTask SwarmWatchdog`.
4. **Deployed Vansh's code** to the dev store as **vto-phase1-82** (`shopify app deploy --config
   vto-phase1`; store ankurs-vto, password `bayldu`). Baseline video run: widget loads, frame
   removal ABSENT → accuracy 0.00 (the number the rebuild must beat).
5. **T042 Kaggle training package** `rkumar-vto/tools/model-training/` — 5 kernel versions of
   debugging (see Gotchas); v5 COMPLETED. Datasets: Kaggle `mantasu/glasses-segmentation-
   synthetic-dataset` (= the Lyu CVPR-2022 set, flat `img-…-<TYPE>.png` in train/val/test;
   **frame=seg, lens=sgseg−seg — exact labels, validated locally**), `ipythonx/celebamaskhq`,
   private `ankursking01/vto-bisenet-code` (model.py+resnet.py+79999_iter.pth warm-start).
   Kaggle account `ankursking01`, phone-verified (internet ON for API pushes).

## Live state at handoff

- Services: gateway+dispatcher+daemon UP (single instances, tsx from src via
  `swarm-logs\start-swarm-service.ps1`); SwarmWatchdog **Ready**. Logs: `C:\Users\ankur.singh\swarm-logs\*.log`.
- **Run #16 (`frame removal feature`, doc-loop): HALTED** at lap-2 RESEARCH — hermes researcher
  hit its 600s timeout → escalated (13:01Z 08-25). The task doc `.swarm-tasks/run-16.md` is
  well-groomed (T042a marked SOLVED, phase table present). Halted runs don't auto-resume:
  after the model lands, just re-trigger fresh from Slack.
- Vansh's machine: offline since 08-21, pre-pgmq code — [[VANSH-CUTOVER]] is his runbook; vault
  `main` has everything.
- Repos: vault `main`/`pgmq-dual-gateway` = `f60ed84`+ (this file not yet); product
  `card-face-width` = `96d1df7`. `tools/eyewear-llm-relay/` deliberately uncommitted (not
  reviewed for secrets).

## Gotchas learned (don't relearn these)

- **kaggle CLI on Windows**: without `PYTHONUTF8=1` its log/output downloads die on charmap and
  leave 0-byte files. Push slug comes from the TITLE, not metadata id (kernel =
  `bisenet-3-class-frame-lens-face-vto-t042`); metadata JSON must be BOM-less.
- **Kaggle kernels**: API pushes get internet only on phone-verified accounts (done). Kaggle's
  torch 2.10 dropped Pascal — P100 dies "no kernel image"; always `--accelerator NvidiaTeslaT4`
  (script also self-guards). Failed kernels publish NO output files → nothing after training
  may be allowed to throw (v3-v5 lesson, now enforced in the script).
- **Daemon runtimes**: child processes MUST get stdin ignored + tree-kill on timeout; openclaw
  reply needs its `[agents/…]` log preamble filtered; never give an openclaw agent `--model`
  overrides it doesn't need (5× latency).
- **Queue**: `vto_send` takes the ROLE (it prefixes `vto_` itself) and needs the 3-arg form;
  requeue tool = `scripts/swarm-requeue-task.ts`. Ops tooling: `scripts/swarm-{audit,seed-task,
  check-tasks,inspect-run,join-channels,recent-events}.ts` (vault root, `npx tsx`).
- Slack: one Socket-Mode event was lost in delivery once (resend worked) — recurrence = the
  trigger to revisit D-036 dual gateways.

## Standing rules that shaped everything

Code only in `nmg-vto\rkumar-vto` · commits stay human-gated (this session's were
operator-directed by Rohit) · vault = source of truth, log work to OPS-LOG · validated
replacements become PRIMARY · never point an OpenClaw workspace at a live repo.
