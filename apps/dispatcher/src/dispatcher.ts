/**
 * THE DISPATCHER — runs the workflow engine on the shared queue.
 *
 * Claims `kind='workflow'` trigger tasks, creates a `workflow_runs` row, and advances it through
 * the stage graph (doc/WORKFLOWS.md) by creating stage tasks (claimed by the daemons on either
 * machine), enforcing gates, and applying transitions on success/fail/below_target. It never runs
 * a runtime itself — executors are the daemons; it only sequences.
 *
 * Gates:
 *   - critique (D-005): the gated stage task is created with needs_critique=true (invisible to the
 *     claim query until passed). A `:critic` sub-task is created; when it returns PASS the gate is
 *     unlocked; BLOCK routes per the stage's on_fail.
 *   - human (D-034): creates a human_gates row + a Slack post with a link_back id; the gateway's
 *     reaction handler approves/rejects; the dispatcher advances once the gate resolves.
 */
import {
  claimWorkflowTrigger,
  createWorkflowRun,
  finishTrigger,
  listActiveWorkflowRuns,
  getWorkflowRun,
  updateWorkflowRun,
  createStageTask,
  getStageTask,
  listStageTasks,
  listAliveWorkers,
  getRunOutputText,
  recordCritique,
  setCritiquePassed,
  markTaskBlocked,
  createGateForRun,
  getGateForRun,
  createEscalation,
  enqueuePost,
  acquireLease,
  type WorkflowRun,
  type WorkflowTask,
} from '@vto-swarm/db';
import { hostname } from 'node:os';
import { loadSecrets, loadChannelIds } from './config.js';
import { WORKFLOWS, type Stage, type WorkflowDef } from './workflows.js';

loadSecrets();
const CHANNELS = loadChannelIds();
const HUMAN_GATE_CHANNEL = CHANNELS['swarm-human-gate'] ?? '';
const INCIDENTS_CHANNEL = CHANNELS['swarm-incidents'] ?? '';
const LOG_TO_SLACK = true; // agents + workflow progress post to Slack — the user watches there, not a terminal
// Dispatcher singleton: only the lease holder processes workflows (two would double-create stage tasks).
const DISPATCHER_HOLDER = `${process.platform}-${hostname()}-${process.pid}`;
const LEASE_TTL_SECS = 30;
let holdsLease = false;

const PASS_RE = /\bPASS(ED)?\b/i;

/** Health-loop fans out to exactly the chat-capable agent roles (has a Slack bot; not an operation). */
const FANOUT_ROLES = ['admin', 'claude', 'critic', 'researcher', 'coder', 'opencode', 'testrunner', 'scout'];

function isPass(text: string): boolean {
  return PASS_RE.test(text);
}

function stageText(def: WorkflowDef, stage: Stage, run: WorkflowRun, extra?: string, role?: string): string {
  const carry = Object.keys(run.carry).length > 0 ? `\n\nEvidence so far:\n${JSON.stringify(run.carry)}` : '';
  const goal = run.goal ? `\n\nGoal: ${run.goal}` : '';
  const prompt = stage.prompt
    ? stage.prompt.replaceAll('{role}', role ?? 'agent')
    : stage.produces
      ? `Produce the ${stage.produces} for the ${def.name}. Be concise and concrete.`
      : 'Complete this stage. Be concise and concrete.';
  return `(${def.name} / ${stage.id}) ${prompt}${goal}${carry}${extra ? `\n\n${extra}` : ''}`;
}

async function post(kind: string, text: string, run?: WorkflowRun): Promise<void> {
  if (!LOG_TO_SLACK) return;
  const channel = run?.channel || 'swarm-command';
  await enqueuePost({ channel, agent: 'admin', text: `*[${kind}]* ${text.slice(0, 2000)}` });
}

// ── Stage task creation ───────────────────────────────────────────────────────
async function createStageWork(run: WorkflowRun, stage: Stage): Promise<number> {
  const extra = `Workflow ${run.workflow} stage ${stage.id}${run.channel ? ` (channel ${run.channel})` : ''}`;
  if (stage.executor.kind === 'fanout') {
    // Fan out to alive chat-capable workers: every healthy agent replies "OK WORKING".
    const alive = await listAliveWorkers(90);
    const roles = (stage.executor.roles?.length ? stage.executor.roles : FANOUT_ROLES).filter((r) => alive.includes(r));
    for (const role of roles) {
      await createStageTask({
        runId: run.id,
        stage: stage.id,
        role,
        kind: 'health',
        // `ts` = the originating Slack command's ts — the daemon posts every reply into that thread,
        // so the whole run reads as one conversation (0004_workflow_threads.sql).
        payload: { text: stageText(WORKFLOWS[run.workflow]!, stage, run, extra, role), goal: run.goal, channel: run.channel, ts: run.thread_ts ?? null },
        channel: run.channel,
      });
    }
    return roles.length;
  }
  if (stage.executor.kind !== 'agent' && stage.executor.kind !== 'operation') return 0;
  return createStageTask({
    runId: run.id,
    stage: stage.id,
    role: stage.executor.kind === 'agent' ? stage.executor.role : stage.executor.op,
    kind: stage.executor.kind === 'operation' ? stage.executor.op : stage.id.toLowerCase(),
    // `ts` = the originating Slack command's ts — the daemon posts every reply into that thread,
    // so the whole run reads as one conversation (0004_workflow_threads.sql).
    // `pinnedMachine` keeps every stage of the run on the machine that started it (4328176).
    payload: {
      text: stageText(WORKFLOWS[run.workflow]!, stage, run, extra),
      goal: run.goal,
      channel: run.channel,
      ts: run.thread_ts ?? null,
      pinnedMachine: run.carry['pinnedMachine'],
    },
    needsCritique: stage.gate === 'critique',
    channel: run.channel,
  });
}

// ── Transitions ───────────────────────────────────────────────────────────────
async function advanceTo(run: WorkflowRun, def: WorkflowDef, target: string, reason: string): Promise<void> {
  switch (target) {
    case 'end':
      await updateWorkflowRun(run.id, { status: 'done', currentStage: null, error: null });
      await post('DONE', `${def.name} finished — ${reason}`, run);
      break;
    case 'halt':
      await updateWorkflowRun(run.id, { status: 'halted', currentStage: null, error: reason });
      await post('HALT', `${def.name} halted — ${reason}`, run);
      break;
    case 'escalate':
      await createEscalation({ taskId: null, reason, toAgent: 'admin' });
      await updateWorkflowRun(run.id, { status: 'halted', currentStage: null, error: `escalated: ${reason}` });
      await post('ESCALATE', `${def.name} escalated — ${reason}`, run);
      break;
    default:
      await updateWorkflowRun(run.id, { currentStage: target });
  }
}

/** Consume a `route:<role>` failure: spawn a rework task for the target role, stay on the stage. */
async function routeTo(run: WorkflowRun, def: WorkflowDef, stage: Stage, role: string, reason: string): Promise<void> {
  await createStageTask({
    runId: run.id,
    stage: `${stage.id}:rework`,
    role,
    kind: 'rework',
    payload: {
      text: `(rework ${def.name}/${stage.id}) ${reason}\n\n${stageText(def, stage, run)}`,
      channel: run.channel,
      ts: run.thread_ts ?? null,
    },
    channel: run.channel,
  });
}

async function applyResult(run: WorkflowRun, def: WorkflowDef, stage: Stage, task: WorkflowTask, ok: boolean, output: string): Promise<void> {
  const failTarget = stage.transitions.on_fail ?? 'escalate';
  if (ok) {
    if (stage.transitions.below_target) {
      const m = output.match(/accuracy\s*=\s*(\d+(?:\.\d+)?)/i) ?? output.match(/(\d+(?:\.\d+)?)\s*%/);
      const score = m ? Number(m[1]) : null;
      const threshold = 0.98;
      if (score !== null && score < threshold) {
        await updateWorkflowRun(run.id, { carry: { ...run.carry, accuracy_score: score, last_artifact: output.slice(0, 2000) } });
        await post('BELOW-TARGET', `accuracy ${score} < ${threshold} → back to ${stage.transitions.below_target.target}`, run);
        return advanceTo(run, def, stage.transitions.below_target.target, `accuracy ${score} below ${threshold}`);
      }
    }
    await updateWorkflowRun(run.id, { carry: { ...run.carry, last_artifact: output.slice(0, 2000) } });
    return advanceTo(run, def, stage.transitions.on_success, `${stage.id} ok`);
  }
  const reason = `stage ${stage.id} failed: ${output.slice(0, 400) || (task.last_error ?? 'no output')}`;

  // ── Two-tier stuck escalation ──────────────────────────────────────────
  // Small stuck: Tier 3 executor fails → Tier 2 agent-level retry (local fix).
  // Big stuck:   Tier 2 agent fails or repeated small stuck → Tier 1 Claude replan.
  const smallStuckTarget = stage.transitions.on_small_stuck;
  const bigStuckTarget = stage.transitions.on_big_stuck;
  const legacyStuckTarget = stage.transitions.on_stuck; // backward compat

  if (smallStuckTarget || bigStuckTarget || legacyStuckTarget) {
    const smallCount = (run.carry.small_stuck_count as number | undefined) ?? 0;
    const bigCount = (run.carry.big_stuck_count as number | undefined) ?? 0;

    // If the stage has explicit tier routing, use it; otherwise fall back to legacy on_stuck
    if (smallStuckTarget || bigStuckTarget) {
      // Escalate to big stuck if: (a) stage declares big_stuck AND (b) small retries exhausted
      const smallRetriesExhausted = smallCount >= 2;
      const useBigStuck = bigStuckTarget && (smallRetriesExhausted || !smallStuckTarget);

      if (useBigStuck) {
        // ── Big stuck: route to Tier 1 (Claude) for full replan ──────────
        const totalBig = bigCount + 1;
        if (totalBig >= 3) {
          await createEscalation({ taskId: task.id, reason: `big stuck cap reached on ${stage.id}: ${reason}`, toAgent: 'admin' });
          await updateWorkflowRun(run.id, { status: 'halted', currentStage: null, error: `big stuck cap reached: ${reason}` });
          return post('ESCALATE', `big stuck cap (${totalBig}) on ${stage.id} — escalated: ${reason}`, run);
        }
        await updateWorkflowRun(run.id, {
          carry: { ...run.carry, big_stuck_count: totalBig, small_stuck_count: 0, stuck_stage: stage.id, stuck_reason: reason },
        });
        await post('BIG-STUCK', `stage ${stage.id} big stuck (${totalBig}) → Claude replan`, run);
        return advanceTo(run, def, bigStuckTarget, `stage ${stage.id} big stuck → ${bigStuckTarget}`);
      }

      // ── Small stuck: route to Tier 2 agent for local fix ───────────────
      const totalSmall = smallCount + 1;
      await updateWorkflowRun(run.id, {
        carry: { ...run.carry, small_stuck_count: totalSmall, stuck_stage: stage.id, stuck_reason: reason },
      });
      await post('SMALL-STUCK', `stage ${stage.id} small stuck (${totalSmall}) → agent retry`, run);
      // route: targets are handled below (routeTo); direct stage targets use advanceTo
      if (smallStuckTarget && smallStuckTarget.startsWith('route:')) {
        return routeTo(run, def, stage, smallStuckTarget.split(':')[1]!, reason);
      }
      if (smallStuckTarget) {
        return advanceTo(run, def, smallStuckTarget, `stage ${stage.id} small stuck → ${smallStuckTarget}`);
      }
      // Fallback: if no small target defined, use legacy stuck behavior
      return advanceTo(run, def, stage.transitions.on_stuck ?? 'escalate', `stage ${stage.id} small stuck → fallback`);
    }

    // Legacy on_stuck fallback (backward compat for stages without tier split)
    const legacyCount = (run.carry.stuck_count as number | undefined) ?? 0;
    if (legacyCount >= 2) {
      await createEscalation({ taskId: task.id, reason: `stuck cap reached on ${stage.id}: ${reason}`, toAgent: 'admin' });
      await updateWorkflowRun(run.id, { status: 'halted', currentStage: null, error: `stuck cap reached: ${reason}` });
      return post('ESCALATE', `stuck cap (${legacyCount}) on ${stage.id} — escalated: ${reason}`, run);
    }
    await updateWorkflowRun(run.id, {
      carry: { ...run.carry, stuck_count: legacyCount + 1, stuck_stage: stage.id, stuck_reason: reason },
    });
    return advanceTo(run, def, legacyStuckTarget!, `stage ${stage.id} stuck → ${legacyStuckTarget}`);
  }
  if (failTarget.startsWith('route:')) {
    return routeTo(run, def, stage, failTarget.split(':')[1]!, reason);
  }
  if (failTarget === 'escalate') {
    await createEscalation({ taskId: task.id, reason, toAgent: 'admin' });
    await post('FAIL', reason, run);
    return advanceTo(run, def, failTarget, reason);
  }
  await post('RETRY', `${stage.id} failed → ${failTarget}: ${reason}`, run);
  return advanceTo(run, def, failTarget, reason);
}

// ── Critique gate (D-005) ─────────────────────────────────────────────────────
async function handleCritiqueGate(run: WorkflowRun, def: WorkflowDef, stage: Stage, gated: WorkflowTask): Promise<void> {
  // Blocked gate markers are superseded by a fresh attempt after the rework task completes.
  if (gated.status === 'blocked') return;
  // Gated task finished (it ran once passed) — apply normal result.
  if (gated.status === 'done' || gated.status === 'failed') {
    const output = await getRunOutputText(gated.id);
    await markTaskBlocked(gated.id); // consume before applying the result
    return applyResult(run, def, stage, gated, gated.status === 'done', output);
  }
  if (gated.critique_passed) return; // unlocked; daemon will claim it
  const crit = await getStageTask(run.id, `${stage.id}:critic`);
  if (!crit || crit.status === 'blocked') {
    await createStageTask({
      runId: run.id,
      stage: `${stage.id}:critic`,
      role: 'critic',
      kind: 'critique',
      payload: {
        text: `(critique gate ${def.name}/${stage.id}) Review the work order/plan for correctness and risk before it ships. Reply with exactly "PASS" or "BLOCK" plus a one-line reason.\n\nTarget task #${gated.id}\n${stageText(def, stage, run)}`,
        channel: run.channel,
        ts: run.thread_ts ?? null,
      },
      channel: run.channel,
    });
    return;
  }
  if (crit.status === 'done') {
    const verdict = await getRunOutputText(crit.id);
    if (isPass(verdict)) {
      await recordCritique({ taskId: gated.id, verdict: 'pass', notes: verdict.slice(0, 500), critic: 'critic' });
      await setCritiquePassed(gated.id);
      await markTaskBlocked(crit.id); // tombstone the verdict; a re-entered stage spawns a fresh critic
      await post('CRITIQUE-PASS', `gate passed for task #${gated.id}`, run);
    } else {
      await recordCritique({ taskId: gated.id, verdict: 'block', notes: verdict.slice(0, 500), critic: 'critic' });
      await markTaskBlocked(crit.id); // tombstone the verdict first
      await markTaskBlocked(gated.id); // tombstone this attempt; re-entry spawns a fresh one
      const failTarget = stage.transitions.on_fail ?? 'escalate';
      const reason = `critique blocked: ${verdict.slice(0, 300)}`;
      await post('CRITIQUE-BLOCK', `gate blocked task #${gated.id} — ${failTarget}`, run);
      if (failTarget.startsWith('route:')) return routeTo(run, def, stage, failTarget.split(':')[1]!, reason);
      if (failTarget === 'escalate') return advanceTo(run, def, failTarget, reason);
      await updateWorkflowRun(run.id, { currentStage: failTarget });
    }
  }
}

// ── Human gate (D-034) ────────────────────────────────────────────────────────
async function handleHumanGate(run: WorkflowRun, def: WorkflowDef, stage: Stage): Promise<void> {
  let gate = await getGateForRun(run.id);
  if (!gate) {
    const gateId = await createGateForRun(run.id, run.channel, { workflow: run.workflow, goal: run.goal, stage: stage.id });
    await enqueuePost({
      channel: HUMAN_GATE_CHANNEL || run.channel || 'swarm-command',
      agent: 'admin',
      text: `:stop_sign: *HUMAN GATE* — ${def.name} reached ${stage.id}.\nGoal: ${run.goal ?? '(no goal)'}\n\nApprove with :white_check_mark: (commit authority, D-034) or reject with :x:.`,
      threadTs: run.thread_ts ?? null,
      linkGateId: gateId,
    });
    return;
  }
  if (gate.status === 'approved') {
    await updateWorkflowRun(run.id, { carry: { ...run.carry, human_approved: true } });
    return advanceTo(run, def, stage.transitions.on_success, 'human gate approved');
  }
  if (gate.status === 'rejected') {
    return advanceTo(run, def, stage.transitions.on_fail ?? 'halt', 'human gate rejected');
  }
}

// ── One stage advance ─────────────────────────────────────────────────────────
async function advanceRun(run: WorkflowRun): Promise<void> {
  const def = WORKFLOWS[run.workflow];
  if (!def) {
    await updateWorkflowRun(run.id, { status: 'failed', error: `unknown workflow ${run.workflow}` });
    return;
  }
  const stageId = run.current_stage ?? def.entry;
  if (!run.current_stage) await updateWorkflowRun(run.id, { currentStage: stageId });

  const stage = def.stages[stageId];
  if (!stage) {
    await updateWorkflowRun(run.id, { status: 'failed', error: `unknown stage ${stageId}` });
    return;
  }

  // Human gate stage — no task, just a gate row + post.
  if (stage.executor.kind === 'human') {
    return handleHumanGate(run, def, stage);
  }

  // Fan-out stage (health-loop): one task per alive chat-capable worker, all under this stage id.
  if (stage.executor.kind === 'fanout') {
    const tasks = await listStageTasks(run.id, stageId);
    if (tasks.length === 0) {
      await createStageWork(run, stage);
      return;
    }
    const done = tasks.filter((t) => t.status === 'done').length;
    const failed = tasks.filter((t) => t.status === 'failed' || t.status === 'blocked').length;
    if (done === tasks.length) {
      return advanceTo(run, def, stage.transitions.on_success, `all ${done} agents replied OK`);
    }
    if (failed > 0) {
      return advanceTo(run, def, stage.transitions.on_fail ?? 'end', `${failed} agent(s) failed health check`);
    }
    return; // still running — daemons are on the remaining tasks
  }

  // Claude stuck review (CLAUDE_REVIEW): a failed stage routed here with stuck_stage in the carry.
  // Claude analyses the failure; its verdict becomes the Admin rework directive on the stuck stage
  // — Claude decides, Admin schedules. If Claude's review fails, the run halts.
  // If Claude signals "needs full replan", the loop goes back to ANALYSE (Tier 1 replan).
  if (stage.executor.kind === 'agent' && stage.executor.role === 'claude' && run.carry.stuck_stage) {
    const task = await getStageTask(run.id, stageId);
    if (!task) {
      await createStageWork(run, stage);
      return;
    }
    if (task.status === 'done') {
      const analysis = await getRunOutputText(task.id);
      const stuckId = String(run.carry.stuck_stage);
      const stuckReason = String(run.carry.stuck_reason ?? '');
      const stuck = def.stages[stuckId];
      await markTaskBlocked(task.id); // consume the review marker so it never re-fires

      // Detect if Claude is requesting a full replan vs. a targeted rework.
      // Claude signals replan by including [REPLAN] or "full replan" in its analysis,
      // or when the big_stuck_count is high (repeated failures = need fresh approach).
      const bigCount = (run.carry.big_stuck_count as number | undefined) ?? 0;
      const wantsReplan = /\[REPLAN\]|full\s+replan|restart\s+from\s+analysis/i.test(analysis) || bigCount >= 2;

      await updateWorkflowRun(run.id, {
        carry: { ...run.carry, stuck_stage: undefined, stuck_reason: undefined, small_stuck_count: 0 },
        error: null,
      });

      if (wantsReplan) {
        // ── Big stuck recovery: Claude says "replan" → back to Tier 1 ANALYSE ──
        await updateWorkflowRun(run.id, {
          carry: { ...run.carry, replan_reason: analysis.slice(0, 2000) },
        });
        await post('REPLAN', `Claude review requests full replan → back to ANALYSE`, run);
        return advanceTo(run, def, 'ANALYSE', 'claude review → full replan from ANALYSE');
      }

      // ── Small stuck recovery: Claude analysis → Admin rework on the stuck stage ──
      if (!stuck) {
        await updateWorkflowRun(run.id, { status: 'halted', currentStage: null, error: `claude review of unknown stage ${stuckId}` });
        return;
      }
      const reason = `[claude stuck review]\n${(analysis || '(no analysis)').slice(0, 2500)}\n\n[original failure]\n${stuckReason}`;
      await routeTo(run, def, stuck, 'admin', reason);
      return advanceTo(run, def, stuckId, 'claude review done → admin rework');
    }
    if (task.status === 'failed' || task.status === 'blocked') {
      const output = await getRunOutputText(task.id);
      // Claude review itself failed → escalate (can't recover without Tier 1)
      await updateWorkflowRun(run.id, {
        status: 'halted',
        currentStage: null,
        error: `${stageId} review failed: ${output || (task.last_error ?? 'no output')}`,
      });
      await post('ESCALATE', `${stageId} review failed for run #${run.id}`, run);
      return;
    }
    return; // queued / claimed / running — the daemon is on it.
  }

  // Handle a pending rework first: a `route:` failure spawned a rework task for this stage.
  const rework = await getStageTask(run.id, `${stageId}:rework`);
  if (rework && rework.status !== 'blocked') {
    if (rework.status === 'done') {
      await markTaskBlocked(rework.id); // consume the marker so this branch never re-fires
      await updateWorkflowRun(run.id, { error: null });
      await createStageWork(run, stage); // fresh attempt after rework
    }
    return; // rework pending or in-flight — stay on this stage
  }

  const task = await getStageTask(run.id, stageId);
  // A `blocked` task is a tombstone (consumed attempt or blocked gate): no active work exists,
  // so spawn a fresh attempt. This is what lets a critique BLOCK loop back (PLAN→ANALYSE→…→PLAN).
  if (!task || task.status === 'blocked') {
    const id = await createStageWork(run, stage);
    if (stage.gate === 'critique') {
      const gated = await getStageTask(run.id, stageId);
      if (gated) await handleCritiqueGate(run, def, stage, gated);
      void id;
    }
    return;
  }

  if (stage.gate === 'critique') return handleCritiqueGate(run, def, stage, task);

  if (task.status === 'done') {
    const output = await getRunOutputText(task.id);
    if (!output.trim()) {
      // RETRY an empty stage a few times before giving up — a single transient empty output (a runtime
      // hiccup) must NOT halt the whole loop (that was the "halt bug"). Only after N empties do we take
      // the stage's on_empty/on_fail transition.
      await markTaskBlocked(task.id); // consume so re-entry spawns a fresh attempt
      const key = `empty_${stage.id}`;
      const tries = ((run.carry[key] as number | undefined) ?? 0) + 1;
      if (tries < 3) {
        await updateWorkflowRun(run.id, { carry: { ...run.carry, [key]: tries } });
        await post('RETRY', `${stage.id} produced no output → retry ${tries}/3`, run);
        return; // stay on this stage; next tick spawns a fresh stage task
      }
      const emptyTarget = stage.transitions.on_empty ?? stage.transitions.on_fail ?? 'halt';
      await post('EMPTY', `${stage.id} still empty after ${tries} tries → ${emptyTarget}`, run);
      return advanceTo(run, def, emptyTarget, `${stage.id} empty x${tries}`);
    }
    await markTaskBlocked(task.id); // consume before advancing
    return applyResult(run, def, stage, task, true, output);
  }
  if (task.status === 'failed') {
    const output = await getRunOutputText(task.id);
    await markTaskBlocked(task.id); // consume before advancing
    return applyResult(run, def, stage, task, false, output || (task.last_error ?? 'failed'));
  }
  // queued / claimed / running → daemons are on it.
}

// ── Intake: turn trigger tasks into workflow runs ─────────────────────────────
async function intake(): Promise<void> {
  for (let i = 0; i < 5; i++) {
    const trig = await claimWorkflowTrigger();
    if (!trig) break;
    const p = (trig.payload ?? {}) as {
      workflow?: string;
      goal?: string;
      channel?: string;
      ts?: string; // originating Slack ts → workflow_runs.thread_ts → every stage reply threads
      pinnedMachine?: string; // origin machine key → every stage stays on that machine
    };
    const wf = typeof p.workflow === 'string' && p.workflow in WORKFLOWS ? p.workflow : 'improvement-loop';
    const run = await createWorkflowRun({
      workflow: wf,
      goal: p.goal ?? (trig.requested_by ? `triggered by ${trig.requested_by}` : 'no goal'),
      channel: trig.channel ?? p.channel ?? null,
      threadTs: p.ts ?? null,
    });
    // Pin the whole workflow to its origin machine (the gateway that ingested the Slack trigger).
    if (p.pinnedMachine) await updateWorkflowRun(run.id, { carry: { ...run.carry, pinnedMachine: p.pinnedMachine } });
    await finishTrigger(trig.id, run.id);
    await post('START', `${wf} started — run #${run.id}`, run);
    console.log(`[dispatcher] run #${run.id} ${wf} started (trigger task #${trig.id})`);
  }
}

async function tick(): Promise<void> {
  // Singleton guard: only the lease holder advances workflows; standbys idle until the holder dies.
  const held = await acquireLease('dispatcher', DISPATCHER_HOLDER, LEASE_TTL_SECS);
  if (!held) {
    if (holdsLease) { console.log('[dispatcher] -> STANDBY (another dispatcher holds the lease)'); holdsLease = false; }
    return;
  }
  if (!holdsLease) { console.log('[dispatcher] -> ACTIVE (holding the singleton lease)'); holdsLease = true; }
  await intake();
  for (const run of await listActiveWorkflowRuns()) {
    try {
      await advanceRun(run);
    } catch (e) {
      console.warn(`[dispatcher] advance run #${run.id}`, (e as Error).message);
    }
  }
}

async function main(): Promise<void> {
  setInterval(() => void tick().catch((e) => console.warn('[dispatcher] tick', e)), 2000);
  console.log(`[dispatcher] online — workflows: ${Object.keys(WORKFLOWS).join(', ')}; human-gate channel: ${HUMAN_GATE_CHANNEL}`);
}

void main().catch((e: unknown) => {
  console.error('[dispatcher] FATAL', e);
  process.exit(1);
});
