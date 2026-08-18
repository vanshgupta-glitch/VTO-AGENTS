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

function isPass(text: string): boolean {
  return PASS_RE.test(text);
}

function stageText(def: WorkflowDef, stage: Stage, run: WorkflowRun, extra?: string): string {
  const doc = run.carry['taskDoc'] as string | undefined;
  if (doc) {
    // Doc-driven: hand the agent the shared file by PATH — keeps the prompt tiny (no giant carry blob,
    // which is what overran hermes). The agent reads the doc, does its part, and updates its section.
    const who = stage.executor.kind === 'agent' ? stage.executor.role : 'stage';
    const produce = stage.produces ? `Produce the ${stage.produces}.` : 'Complete this stage.';
    const decide = stage.transitions.on_decision
      ? ` Then, based only on the evidence in the doc, END your reply with exactly one line: "DECISION: ${Object.keys(stage.transitions.on_decision).join(' or ')}".`
      : '';
    return [
      `You are the ${who} agent in the ${def.name}.`,
      run.goal ? `Goal: ${run.goal}` : '',
      `The shared task file is "${doc}" (relative to your current working directory).`,
      `FIRST read that file. ${produce} Do the work directly in the repo where relevant.`,
      `THEN update "${doc}": append/refresh your "## ${stage.id}" section with what you did or found so the next agent can pick it up. Keep your chat reply to a short status.${decide}`,
      extra ?? '',
    ].filter(Boolean).join('\n\n');
  }
  const carry = Object.keys(run.carry).length > 0 ? `\n\nEvidence so far:\n${JSON.stringify(run.carry)}` : '';
  const goal = run.goal ? `\n\nGoal: ${run.goal}` : '';
  const prompt = stage.produces
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
  if (stage.executor.kind !== 'agent' && stage.executor.kind !== 'operation') return 0;
  return createStageTask({
    runId: run.id,
    stage: stage.id,
    role: stage.executor.kind === 'agent' ? stage.executor.role : stage.executor.op,
    kind: stage.executor.kind === 'operation' ? stage.executor.op : stage.id.toLowerCase(),
    payload: { text: stageText(WORKFLOWS[run.workflow]!, stage, run, extra), goal: run.goal, channel: run.channel, pinnedMachine: run.carry['pinnedMachine'], taskDoc: run.carry['taskDoc'] },
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
    },
    channel: run.channel,
  });
}

async function applyResult(run: WorkflowRun, def: WorkflowDef, stage: Stage, task: WorkflowTask, ok: boolean, output: string): Promise<void> {
  const failTarget = stage.transitions.on_fail ?? 'escalate';
  if (ok) {
    // Doc-driven decision routing (ROUTE → RESEARCH vs EXECUTE), with a hard cap of 2 research rounds.
    if (stage.transitions.on_decision) {
      const m = output.match(/DECISION:\s*([A-Za-z_]+)/i);
      let key = (m?.[1] ?? '').toUpperCase();
      const rounds = (run.carry['research_rounds'] as number | undefined) ?? 0;
      if (key === 'RESEARCH' && rounds >= 2) key = 'EXECUTE'; // enough research → execute
      const target = stage.transitions.on_decision[key];
      if (target) {
        const nextCarry: Record<string, unknown> = { ...run.carry, last_artifact: output.slice(0, 2000) };
        if (key === 'RESEARCH') nextCarry['research_rounds'] = rounds + 1;
        await updateWorkflowRun(run.id, { carry: nextCarry });
        await post(stage.id, output.slice(0, 1500), run);
        await post('DECISION', `${stage.id}: ${key} → ${target}`, run);
        return advanceTo(run, def, target, `decision ${key}`);
      }
      // unparseable decision → fall through to on_success
    }
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
    await post(stage.id, output.slice(0, 1500), run); // the agent's OWN output → Slack (the user watches there)
    return advanceTo(run, def, stage.transitions.on_success, `${stage.id} ok`);
  }
  const reason = `stage ${stage.id} failed: ${output.slice(0, 400) || (task.last_error ?? 'no output')}`;
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
    const ex = stage.executor;
    const who = ex.kind === 'agent' ? ex.role : ex.kind === 'operation' ? ex.op : 'human';
    await post(`▶ ${stage.id}`, `${who} working…`, run); // heartbeat: stage begun → visible progress in Slack
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
    const p = (trig.payload ?? {}) as { workflow?: string; goal?: string; channel?: string; pinnedMachine?: string };
    const wf = typeof p.workflow === 'string' && p.workflow in WORKFLOWS ? p.workflow : 'doc-loop';
    const run = await createWorkflowRun({
      workflow: wf,
      goal: p.goal ?? (trig.requested_by ? `triggered by ${trig.requested_by}` : 'no goal'),
      channel: trig.channel ?? p.channel ?? null,
    });
    // Pin the whole workflow to its origin machine (the gateway that ingested the Slack trigger), and
    // for doc-driven workflows give it a shared per-run task file (repo-relative → resolves on origin,
    // where every hard-pinned stage runs, so all agents read/write the same local .md).
    const carry: Record<string, unknown> = { ...run.carry };
    if (p.pinnedMachine) carry.pinnedMachine = p.pinnedMachine;
    if (WORKFLOWS[wf]?.docDriven) carry.taskDoc = `.swarm-tasks/run-${run.id}.md`;
    if (Object.keys(carry).length) await updateWorkflowRun(run.id, { carry });
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
