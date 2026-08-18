/**
 * The EXECUTOR DAEMON — runs on BOTH machines. Registers a worker per role, polls the shared
 * queue (`claimTask` = FOR UPDATE SKIP LOCKED, capacity-gated), runs the local runtime, writes
 * the run, and enqueues the reply into `post_queue` (the gateway posts it). This is where the
 * cross-machine overflow physically happens: whichever machine has a free worker claims next.
 */
import { hostname } from 'node:os';
import { writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import {
  registerMachine,
  registerWorker,
  heartbeatWorker,
  heartbeatMachine,
  claimTask,
  finishTask,
  enqueuePost,
  enqueueTask,
  recoverStale,
  type Task,
} from '@vto-swarm/db';
import { execute, type Operation, type OpConfig } from '@vto-swarm/operations';
import { loadSecrets, loadMachine } from './config.js';
import { runRuntime, type WorkerDef } from './runtimes.js';

loadSecrets();
const machine = loadMachine();
const MACHINE_ID = machine.machineId ?? `worker-${process.platform}-${hostname()}`;
// Stable per-host key for machine-pinning (loop affinity) — matches the gateway's key on the same host.
const MACHINE_KEY = `${process.platform}-${hostname()}`;
const inFlight = new Map<string, number>();

const workerId = (w: WorkerDef): string => `${MACHINE_ID}:${w.role}`;

interface TaskPayload {
  text?: string;
  ts?: string;
  channel?: string;
  file?: string;
  loop?: boolean;
  fixCount?: number; // OpenClaw auto-fix attempts used so far in this loop run
  pinnedMachine?: string; // HARD pin — the chain runs ONLY on this machine (Slack work + the code loop)
  preferMachine?: string; // SOFT pin — this machine's agents get first dibs; overflow to others after a grace
  taskDoc?: string; // doc-loop: the shared per-run .md this stage reads + updates (repo-relative path)
  goal?: string; // the run's goal — seeds the task-doc skeleton the first time it's materialised
}

/**
 * doc-loop: materialise the shared per-run task .md (repo-relative) if it doesn't exist yet, so the
 * admin/SEED agent has a skeleton to fill and every later stage reads + updates the SAME local file.
 * All doc-loop stages are hard-pinned to the origin machine, so this file is shared across them.
 */
function ensureTaskDoc(cwd: string, rel: string, goal: string): void {
  const abs = join(cwd, rel);
  if (existsSync(abs)) return;
  mkdirSync(dirname(abs), { recursive: true });
  const skel = [
    `# Task: ${goal || '(no goal)'}`,
    '',
    '> Shared swarm task file. Each agent READS this, does its part, and UPDATES its own `## <STAGE>` section so the next agent can pick it up.',
    '',
    '## Goal', goal || '', '',
    '## Context', '_(admin: known state, constraints, success criteria)_', '',
    '## SEED', '', '## ROUTE', '', '## RESEARCH', '', '## CODE', '', '## REPORT', '',
  ].join('\n');
  writeFileSync(abs, skel, 'utf8');
}

/**
 * Which bot identity an operation worker posts under (LLM workers post under their own role).
 * The op-persona bots (testrunner/videotester/accuracy) are now members of #swarm-command, so ops
 * post under their own identities. `deploy` has no dedicated bot → admin (the orchestrator).
 */
const OP_POST_BOT: Record<string, string> = {
  build: 'testrunner',
  lint: 'testrunner',
  test: 'testrunner',
  deploy: 'admin', // no dedicated deploy bot
  video: 'videotester',
  accuracy: 'accuracy',
};
/** LLM roles without their own Slack bot post under a stand-in (openclaw = Claude-haiku coder → coder). */
const LLM_POST_BOT: Record<string, string> = { openclaw: 'coder' };
const postAgentFor = (w: WorkerDef): string =>
  w.runtime === 'operation' ? (OP_POST_BOT[w.role] ?? 'admin') : (LLM_POST_BOT[w.role] ?? w.role);

function buildOperation(w: WorkerDef, payload: TaskPayload): Operation {
  switch (w.op) {
    case 'build':
      return { op: 'build', file: payload.file };
    case 'lint':
      return { op: 'lint', file: payload.file ?? 'packages/vto-core/src/engine/landmark-debug-engine.ts' };
    case 'test':
      return { op: 'test' };
    case 'deploy':
      return { op: 'deploy' };
    case 'video':
      return { op: 'video', url: machine.storeUrl ?? '', password: machine.storePassword ?? '', seconds: 20 };
    case 'accuracy':
      return { op: 'accuracy' };
    default:
      throw new Error(`operation worker ${w.role} has no op configured`);
  }
}

/**
 * Advance the engineering loop on success (only for loop-tagged tasks). STRICTLY SEQUENTIAL so each
 * step sees the previous step's fresh output: improve→build→deploy→video→accuracy→report. The improve
 * step is a hermes agent running in the repo cwd — it EDITS the files directly (proven on simple
 * changes; hermes has write tools and doesn't scaffold like OpenClaw). For genuinely complex work,
 * seed an `implement` task (role=openclaw, workspace-synced) instead; it also →build. Accuracy runs
 * only after video (fresh logs), then reports the verdict to admin (the workflow dispatcher owns any
 * below-target loop-back).
 * NOTE: the loop is single-machine — code-edit + build + deploy must run on the SAME machine (the one
 * with the repo + operation workers). Don't rely on cross-machine overflow for the loop pipeline.
 */
async function chainNext(task: Task, resultText: string): Promise<void> {
  const p = task.payload as TaskPayload;
  if (!p.loop) return;
  const carry = {
    channel: task.channel,
    requestedBy: 'loop',
    // A loop is single-machine: hard-pin the whole chain to its origin (or to THIS machine if unset).
    payload: { loop: true, text: p.text, ts: p.ts, file: p.file, fixCount: p.fixCount, pinnedMachine: p.pinnedMachine ?? MACHINE_KEY, preferMachine: p.preferMachine },
  };
  switch (task.kind) {
    // improve = a hermes agent in the repo cwd; it EDITS the files directly, then → build.
    case 'improve': await enqueueTask({ ...carry, role: 'build', kind: 'build' }); break;
    // implement = OPT-IN OpenClaw path (workspace-synced) for complex changes; also → build.
    case 'implement': await enqueueTask({ ...carry, role: 'build', kind: 'build' }); break;
    case 'fix': await enqueueTask({ ...carry, role: 'build', kind: 'build' }); break; // patched → re-verify from build
    case 'build': await enqueueTask({ ...carry, role: 'deploy', kind: 'deploy' }); break;
    case 'deploy': await enqueueTask({ ...carry, role: 'video', kind: 'video' }); break;
    case 'video': await enqueueTask({ ...carry, role: 'accuracy', kind: 'accuracy' }); break;
    case 'accuracy': {
      // Accuracy just analyzed the fresh video-tester results — report the verdict forward to admin.
      const reportPrompt =
        `Report this VTO try-on run to the team. The video UI-test ran, then accuracy analyzed its ` +
        `results:\n\n${resultText}\n\nState whether we hit the 0.98 target vs FittingBox, and if below, ` +
        `name the single most useful next improvement.`;
      await enqueueTask({
        channel: task.channel,
        requestedBy: 'loop',
        role: 'admin',
        kind: 'report',
        payload: { loop: false, text: reportPrompt, ts: p.ts, pinnedMachine: p.pinnedMachine ?? MACHINE_KEY },
      });
      break;
    }
  }
}

/** Max OpenClaw auto-fix attempts per loop run before it halts for a human. */
const MAX_FIX_ATTEMPTS = 2;

/**
 * On a loop step failing, route the error to a hermes `coder` agent (in the repo cwd) to diagnose +
 * patch the repo, then re-enter the loop at build. Only for steps a code patch can fix (build/test/
 * video), capped so it can't spin. (hermes edits in-repo directly and doesn't scaffold like OpenClaw.)
 */
async function chainOnFailure(task: Task, failureText: string): Promise<void> {
  const p = task.payload as TaskPayload;
  if (!p.loop) return;
  if (!['build', 'test', 'video'].includes(task.kind)) return;
  const fixCount = p.fixCount ?? 0;
  if (fixCount >= MAX_FIX_ATTEMPTS) {
    if (task.channel) {
      await enqueuePost({
        channel: task.channel,
        agent: 'admin',
        text: `:octagonal_sign: loop halted at *${task.kind}* after ${fixCount} fix attempts — needs a human.`,
        threadTs: p.ts ?? null,
      });
    }
    return;
  }
  const fixPrompt =
    `The VTO engineering loop FAILED at the "${task.kind}" step. Diagnose the root cause and FIX it ` +
    `directly in the repo (edit files, keep the change minimal), then say what you changed:\n\n${failureText}`;
  await enqueueTask({
    channel: task.channel,
    requestedBy: 'loop',
    role: 'coder',
    kind: 'fix',
    payload: { loop: true, text: fixPrompt, ts: p.ts, file: p.file, fixCount: fixCount + 1, pinnedMachine: p.pinnedMachine ?? MACHINE_KEY },
  });
}

async function handleTask(w: WorkerDef, task: Task): Promise<void> {
  const payload = task.payload as TaskPayload;
  try {
    let ok = true;
    let text: string;
    if (w.runtime === 'operation') {
      const cfg: OpConfig = {
        repoPath: machine.repoPath ?? '',
        storeUrl: machine.storeUrl,
        storePassword: machine.storePassword,
      };
      const res = await execute(buildOperation(w, payload), cfg);
      ok = res.ok;
      const secs = Math.round(res.durationMs / 1000);
      text = `*[${res.op}]* ${res.summary}  _(${secs}s)_${ok ? '' : `\n\`\`\`${res.tail.slice(-900)}\`\`\``}`;
    } else {
      const cwd = machine.repoPath?.replace(/\//g, '\\') ?? process.cwd(); // cwd so agents edit the repo
      const base = (payload.text ?? '').replace(new RegExp(`@vto-${w.role}`, 'ig'), '').trim();
      // doc-loop: make sure the shared task file exists locally before the agent reads it by path.
      if (payload.taskDoc) ensureTaskDoc(cwd, payload.taskDoc, payload.goal ?? base);
      const persona = payload.taskDoc
        ? `\n\n(You are the VTO ${w.role} agent. Coordinate through the task file: read it, do your part in the repo, and update it. Keep your chat reply to a short status.)`
        : `\n\n(You are the VTO ${w.role} agent. Respond concisely, for a Slack reply.)`;
      text = await runRuntime(w, `${base}${persona}`, machine.runtimes, cwd);
    }
    await finishTask(task.id, workerId(w), ok ? 'done' : 'failed', { ok, text });
    if (task.channel) {
      await enqueuePost({
        channel: task.channel,
        agent: postAgentFor(w),
        text: (text || '(empty)').slice(0, 2800),
        threadTs: payload.ts ?? null,
      });
    }
    console.log(`[daemon] ${w.role} ${ok ? 'DONE' : 'FAILED'} task ${task.id}`);
    if (ok) await chainNext(task, text);
    else await chainOnFailure(task, text);
  } catch (e) {
    const msg = (e as Error).message;
    await finishTask(task.id, workerId(w), 'failed', null, msg);
    if (task.channel) {
      await enqueuePost({
        channel: task.channel,
        agent: postAgentFor(w),
        text: `:warning: ${w.role} failed: ${msg.slice(0, 300)}`,
        threadTs: payload.ts ?? null,
      });
    }
    console.warn(`[daemon] ${w.role} ERROR task ${task.id}: ${msg.slice(0, 200)}`);
    await chainOnFailure(task, msg);
  }
}

async function tick(): Promise<void> {
  for (const w of machine.workers) {
    const id = workerId(w);
    const active = inFlight.get(id) ?? 0;
    if (active >= w.maxConcurrent) continue;
    const task = await claimTask(w.role, id, MACHINE_ID, MACHINE_KEY);
    if (!task) continue;
    inFlight.set(id, active + 1);
    console.log(`[daemon] ${w.role} claimed task ${task.id}`);
    void handleTask(w, task).finally(() => inFlight.set(id, Math.max(0, (inFlight.get(id) ?? 1) - 1)));
  }
}

async function main(): Promise<void> {
  await registerMachine(MACHINE_ID, machine.operator, 'worker');
  for (const w of machine.workers) {
    await registerWorker({
      id: workerId(w),
      machineId: MACHINE_ID,
      role: w.role,
      runtime: w.runtime,
      maxConcurrent: w.maxConcurrent,
    });
  }
  setInterval(() => {
    void heartbeatMachine(MACHINE_ID).catch(() => {});
    for (const w of machine.workers) void heartbeatWorker(workerId(w)).catch(() => {});
  }, 30_000);
  setInterval(() => void tick().catch((e) => console.warn('[daemon] tick', e)), 2000);
  setInterval(
    () =>
      recoverStale({ staleSeconds: 90, runMaxSeconds: 1_800 })
        .then((r) => {
          if (r.machinesOffline || r.workersReset || r.runsClosed || r.tasksRequeued || r.postsUnstuck) {
            console.log(`[daemon] recovery: ${JSON.stringify(r)}`);
          }
        })
        .catch((e) => console.warn('[daemon] recovery', e)),
    30_000,
  );
  await recoverStale({ staleSeconds: 90, runMaxSeconds: 1_800 }).then((r) => {
    if (r.machinesOffline || r.workersReset || r.runsClosed || r.tasksRequeued || r.postsUnstuck) {
      console.log(`[daemon] recovery (startup): ${JSON.stringify(r)}`);
    }
  });
  console.log(`[daemon] online as ${MACHINE_ID} — roles: ${machine.workers.map((w) => w.role).join(', ')}`);
}

void main().catch((e: unknown) => {
  console.error('[daemon] FATAL', e);
  process.exit(1);
});
