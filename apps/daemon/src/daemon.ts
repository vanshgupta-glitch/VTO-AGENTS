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
  type Task,
} from '@vto-swarm/db';
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
}

async function handleTask(w: WorkerDef, task: Task): Promise<void> {
  const payload = task.payload as TaskPayload;
  const base = (payload.text ?? '').replace(new RegExp(`@vto-${w.role}`, 'ig'), '').trim();
  const prompt = `${base}\n\n(You are the VTO ${w.role} agent. Respond concisely, for a Slack reply.)`;
  try {
    const out = await runRuntime(w, prompt, machine.runtimes);
    await finishTask(task.id, workerId(w), 'done', { chars: out.length });
    if (task.channel) {
      await enqueuePost({
        channel: task.channel,
        agent: w.role,
        text: (out || '(empty response)').slice(0, 2800),
        threadTs: payload.ts ?? null,
      });
    }
    console.log(`[daemon] ${w.role} DONE task ${task.id} (${out.length} chars)`);
  } catch (e) {
    const msg = (e as Error).message;
    await finishTask(task.id, workerId(w), 'failed', null, msg);
    if (task.channel) {
      await enqueuePost({
        channel: task.channel,
        agent: w.role,
        text: `:warning: ${w.role} failed: ${msg.slice(0, 300)}`,
        threadTs: payload.ts ?? null,
      });
    }
    console.warn(`[daemon] ${w.role} FAILED task ${task.id}: ${msg.slice(0, 200)}`);
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
  console.log(`[daemon] online as ${MACHINE_ID} — roles: ${machine.workers.map((w) => w.role).join(', ')}`);
}

void main().catch((e: unknown) => {
  console.error('[daemon] FATAL', e);
  process.exit(1);
});
