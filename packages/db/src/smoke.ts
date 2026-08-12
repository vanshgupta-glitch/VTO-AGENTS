/**
 * End-to-end smoke test of the coordination data layer against the LIVE DB.
 * Registers a worker, enqueues a task, claims it (SKIP LOCKED), finishes it,
 * verifies state, then deletes its own test rows. Needs SWARM_DATABASE_URL.
 * Run: `npx tsx src/smoke.ts`.
 */
import {
  getPool,
  closePool,
  registerMachine,
  registerWorker,
  enqueueTask,
  claimTask,
  finishTask,
} from './index.js';

const MACHINE = 'smoke-machine';
const WORKER = 'smoke-machine:researcher';

async function main(): Promise<void> {
  await registerMachine(MACHINE, 'test');
  await registerWorker({ id: WORKER, machineId: MACHINE, role: 'researcher', runtime: 'hermes', maxConcurrent: 2 });

  const taskId = await enqueueTask({ role: 'researcher', kind: 'research', payload: { q: 'smoke' }, requestedBy: 'smoke' });
  const claimed = await claimTask('researcher', WORKER, MACHINE);
  const claimedOk = claimed?.id === taskId;
  await finishTask(taskId, WORKER, 'done', { result: 'ok' });

  const pool = getPool();
  const t = (await pool.query<{ status: string }>('select status from tasks where id = $1', [taskId])).rows[0];
  const r = (await pool.query<{ status: string }>('select status from runs where task_id = $1', [taskId])).rows[0];
  const w = (await pool.query<{ active: number; status: string }>('select active, status from workers where id = $1', [WORKER])).rows[0];

  console.log('claimed matched enqueued:', claimedOk);
  console.log('task status:', t?.status, '(expect done)');
  console.log('run status:', r?.status, '(expect done)');
  console.log('worker active/status:', w?.active, '/', w?.status, '(expect 0 / idle)');

  await pool.query('delete from tasks where id = $1', [taskId]); // cascade removes the run
  await pool.query('delete from workers where id = $1', [WORKER]);
  await pool.query('delete from machines where id = $1', [MACHINE]);
  console.log('cleaned up test rows.');

  const pass = claimedOk && t?.status === 'done' && r?.status === 'done' && w?.active === 0 && w?.status === 'idle';
  console.log(pass ? 'SMOKE PASS' : 'SMOKE FAIL');
  await closePool();
  process.exit(pass ? 0 : 1);
}

main().catch((e: unknown) => {
  console.error('SMOKE ERROR', e);
  process.exit(1);
});
