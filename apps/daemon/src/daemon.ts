/**
 * The EXECUTOR DAEMON — runs on BOTH machines. Registers a worker per role, polls the shared
 * queue (`claimTask` = FOR UPDATE SKIP LOCKED, capacity-gated), runs the local runtime, writes
 * the run, and enqueues the reply into `post_queue` (the gateway posts it). This is where the
 * cross-machine overflow physically happens: whichever machine has a free worker claims next.
 */
import { hostname } from 'node:os';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
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

// Claude Code is the only runtime that gets its full identity injected: `claude -p` spawns a fresh
// process with no memory, so the strategist soul + orchestration skill must travel with the prompt.
const VAULT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
function claudeKit(): string {
  try {
    const soul = readFileSync(resolve(VAULT, 'soul/claude.md'), 'utf8');
    const skill = readFileSync(resolve(VAULT, 'skills/vto/claude-orchestration/SKILL.md'), 'utf8');
    return `${soul}\n\n--- CLAUDE ORCHESTRATION SKILL (follow it) ---\n${skill}`;
  } catch (e) {
    console.warn('[daemon] could not load claude kit:', (e as Error).message);
    return '';
  }
}

interface TaskPayload {
  text?: string;
  ts?: string;
  channel?: string;
  file?: string;
  loop?: boolean;
  fixCount?: number; // OpenClaw auto-fix attempts used so far in this loop run
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
 * step sees the previous step's fresh output: improve→implement(OpenClaw)→build→deploy→video→accuracy→report. Accuracy
 * runs only after video, so it analyzes the video tester's just-written logs (not stale ones); it
 * then reports the verdict forward to admin (terminal in this simple chain — the workflow dispatcher
 * owns any below-target loop-back).
 */
async function chainNext(task: Task, resultText: string): Promise<void> {
  const p = task.payload as TaskPayload;
  if (!p.loop) return;
  const carry = {
    channel: task.channel,
    requestedBy: 'loop',
    payload: { loop: true, text: p.text, ts: p.ts, file: p.file, fixCount: p.fixCount },
  };
  switch (task.kind) {
    case 'improve': {
      // improve produced the plan; hand it to OpenClaw (Claude haiku, agentic) to actually edit the repo.
      const implementPrompt =
        `Implement this VTO change directly in the repo - edit the files, keep it minimal and correct, ` +
        `then briefly say what you changed:\n\n${resultText}`;
      await enqueueTask({
        channel: task.channel, requestedBy: 'loop', role: 'openclaw', kind: 'implement',
        payload: { loop: true, text: implementPrompt, ts: p.ts, file: p.file },
      });
      break;
    }
    case 'implement': await enqueueTask({ ...carry, role: 'build', kind: 'build' }); break;
    case 'fix': await enqueueTask({ ...carry, role: 'build', kind: 'build' }); break; // OpenClaw patched → re-verify from build
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
        payload: { loop: false, text: reportPrompt, ts: p.ts },
      });
      break;
    }
  }
}

/** Max OpenClaw auto-fix attempts per loop run before it halts for a human. */
const MAX_FIX_ATTEMPTS = 2;

/**
 * On a loop step failing, route the error to OpenClaw to diagnose + patch the repo, then re-enter the
 * loop at build. Only for steps a code patch can fix (build/test/video), and capped so it can't spin.
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
        text: `:octagonal_sign: loop halted at *${task.kind}* after ${fixCount} OpenClaw fix attempts — needs a human.`,
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
    role: 'openclaw',
    kind: 'fix',
    payload: { loop: true, text: fixPrompt, ts: p.ts, file: p.file, fixCount: fixCount + 1 },
  });
}

async function handleTask(w: WorkerDef, task: Task): Promise<void> {
  const payload = task.payload as TaskPayload;
  const threadTs = payload.ts ?? null;
  if (task.channel) {
    await enqueuePost({
      channel: task.channel,
      agent: postAgentFor(w),
      text: `:arrows_counterclockwise: ${w.role} running…`,
      threadTs,
    });
  }
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
      const kit = w.role === 'claude' ? `${claudeKit()}\n\n` : '';
      text = await runRuntime(
        w,
        `${kit}${base}\n\n(You are the VTO ${w.role} agent. Respond concisely, for a Slack reply.)`,
        machine.runtimes,
        machine.repoPath?.replace(/\//g, '\\'), // cwd so agentic coders (openclaw) edit the repo
      );
    }
    await finishTask(task.id, workerId(w), ok ? 'done' : 'failed', { ok, text });
    if (task.channel) {
      await enqueuePost({
        channel: task.channel,
        agent: postAgentFor(w),
        text: (text || '(empty)').slice(0, 2800),
        threadTs,
      });
      await enqueuePost({
        channel: task.channel,
        agent: postAgentFor(w),
        text: ok ? `:white_check_mark: ${w.role} done` : `:x: ${w.role} failed`,
        threadTs,
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
        text: `:x: ${w.role} failed: ${msg.slice(0, 300)}`,
        threadTs,
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
