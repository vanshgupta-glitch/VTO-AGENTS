/**
 * The EXECUTOR DAEMON — runs on BOTH machines. Registers a worker per role, polls the shared
 * queue (`claimTask` = FOR UPDATE SKIP LOCKED, capacity-gated), runs the local runtime, writes
 * the run, and enqueues the reply into `post_queue` (the gateway posts it). This is where the
 * cross-machine overflow physically happens: whichever machine has a free worker claims next.
 */
import { hostname } from 'node:os';
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
const inFlight = new Map<string, number>();

const workerId = (w: WorkerDef): string => `${MACHINE_ID}:${w.role}`;

interface TaskPayload {
  text?: string;
  ts?: string;
  channel?: string;
  file?: string;
  loop?: boolean;
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
const postAgentFor = (w: WorkerDef): string =>
  w.runtime === 'operation' ? (OP_POST_BOT[w.role] ?? 'admin') : w.role;

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

/** Advance the engineering loop on success (only for loop-tagged tasks). improve→build→deploy→video+accuracy. */
async function chainNext(task: Task): Promise<void> {
  const p = task.payload as TaskPayload;
  if (!p.loop) return;
  const carry = {
    channel: task.channel,
    requestedBy: 'loop',
    payload: { loop: true, text: p.text, ts: p.ts, file: p.file },
  };
  if (task.kind === 'improve') await enqueueTask({ ...carry, role: 'build', kind: 'build' });
  else if (task.kind === 'build') await enqueueTask({ ...carry, role: 'deploy', kind: 'deploy' });
  else if (task.kind === 'deploy') {
    await enqueueTask({ ...carry, role: 'video', kind: 'video' });
    await enqueueTask({ ...carry, role: 'accuracy', kind: 'accuracy' });
  }
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
      const base = (payload.text ?? '').replace(new RegExp(`@vto-${w.role}`, 'ig'), '').trim();
      text = await runRuntime(
        w,
        `${base}\n\n(You are the VTO ${w.role} agent. Respond concisely, for a Slack reply.)`,
        machine.runtimes,
      );
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
    if (ok) await chainNext(task);
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
  }
}

async function tick(): Promise<void> {
  for (const w of machine.workers) {
    const id = workerId(w);
    const active = inFlight.get(id) ?? 0;
    if (active >= w.maxConcurrent) continue;
    const task = await claimTask(w.role, id, MACHINE_ID);
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
