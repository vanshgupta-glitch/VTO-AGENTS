import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createDispatcher } from './dispatch.js';
import type { BridgeConfig } from './config.js';
import type { RunResult, Runner } from './runtimes.js';
import type { LogEvent } from './log.js';

function fixture(result: Partial<RunResult> = {}) {
  const d = mkdtempSync(join(tmpdir(), 'disp-'));
  const config: BridgeConfig = {
    root: d,
    channels: new Map([['swarm-command', 'C01']]),
    agents: new Map([
      ['admin', { id: 'admin', runtime: 'hermes', model: 'm', tokenEnv: 'SLACK_BOT_ADMIN', primaryChannel: 'swarm-command' }],
      ['ghost', { id: 'ghost', runtime: 'hermes', model: 'm', tokenEnv: 'X', primaryChannel: 'swarm-command' }],
    ]),
    control: { humanGateChannel: 'swarm-human-gate', neverRun: [], runTimeoutSeconds: 900 },
    paths: { logDir: d, agentsDir: join(d, 'agents'), stateFile: join(d, 'state.json') },
    secrets: new Map(),
  };
  let seenPrompt = '';
  const runner: Runner = {
    async run(_agent, prompt) {
      seenPrompt = prompt;
      return { ok: true, stdout: 'work order', stderr: '', code: 0, durationMs: 5, timedOut: false, ...result };
    },
    async runRaw() {
      throw new Error('runRaw not used by dispatch');
    },
  };
  const events: LogEvent[] = [];
  const logger = { logEvent: (e: LogEvent) => { events.push(e); } };
  return {
    dispatcher: createDispatcher({ config, runner, logger }),
    events,
    prompt: () => seenPrompt,
  };
}

test('happy path returns the reply and a task id', async () => {
  const f = fixture();
  const r = await f.dispatcher.dispatch({ agent: 'admin', text: 'improve smoothing', origin: 'cli' });
  assert.equal(r.ok, true);
  assert.equal(r.reply, 'work order');
  assert.match(r.taskId, /^T\d{3,}$/);
  assert.equal(r.outcome, 'success');
});

test('logs exactly one received and one complete event', async () => {
  const f = fixture();
  await f.dispatcher.dispatch({ agent: 'admin', text: 'x', origin: 'cli' });
  assert.equal(f.events.filter((e) => e.stage === 'received').length, 1);
  assert.equal(f.events.filter((e) => e.stage === 'complete').length, 1);
});

test('the agent receives the task header ahead of the request', async () => {
  const f = fixture();
  const r = await f.dispatcher.dispatch({ agent: 'admin', text: 'improve smoothing', origin: 'cli' });
  assert.ok(f.prompt().startsWith(`[${r.taskId} · loop 0 · stage=decompose]`));
  assert.match(f.prompt(), /improve smoothing/);
});

test('unknown agent fails without spawning anything', async () => {
  const f = fixture();
  const r = await f.dispatcher.dispatch({ agent: 'nobody', text: 'x', origin: 'cli' });
  assert.equal(r.ok, false);
  assert.equal(r.outcome, 'error');
  assert.match(r.error!, /unknown agent/);
  assert.equal(f.prompt(), '');
});

test('a STUCK reply is reported as stuck, not success', async () => {
  const f = fixture({ stdout: '[STUCK]\nATTEMPTED: a\nERROR: b\nRESOURCES: c\nHYPOTHESIS: d' });
  const r = await f.dispatcher.dispatch({ agent: 'admin', text: 'x', origin: 'slack' });
  assert.equal(r.outcome, 'stuck');
  assert.equal(r.ok, false);
});

test('a STUCK reply is preserved verbatim, never summarised', async () => {
  const body = '[STUCK]\nATTEMPTED: a\nERROR: verbatim error text\nRESOURCES: c\nHYPOTHESIS: d';
  const f = fixture({ stdout: body });
  const r = await f.dispatcher.dispatch({ agent: 'admin', text: 'x', origin: 'slack' });
  assert.equal(r.reply, body);
});

test('a timeout is reported as timeout', async () => {
  const f = fixture({ ok: false, timedOut: true, stdout: '', stderr: 'killed' });
  const r = await f.dispatcher.dispatch({ agent: 'admin', text: 'x', origin: 'cli' });
  assert.equal(r.outcome, 'timeout');
});

test('a non-zero exit is reported as error', async () => {
  const f = fixture({ ok: false, code: 2, stdout: '', stderr: 'boom' });
  const r = await f.dispatcher.dispatch({ agent: 'admin', text: 'x', origin: 'cli' });
  assert.equal(r.outcome, 'error');
  assert.match(r.error!, /boom/);
});

test('origin is propagated into every log event', async () => {
  const f = fixture();
  await f.dispatcher.dispatch({ agent: 'admin', text: 'x', origin: 'slack', channel: 'swarm-command' });
  assert.ok(f.events.length > 0);
  assert.ok(f.events.every((e) => e.origin === 'slack'));
  assert.ok(f.events.every((e) => e.channel === 'swarm-command'));
});

test('task ids do not repeat across dispatches', async () => {
  const f = fixture();
  const a = await f.dispatcher.dispatch({ agent: 'admin', text: 'x', origin: 'cli' });
  const b = await f.dispatcher.dispatch({ agent: 'admin', text: 'y', origin: 'cli' });
  assert.notEqual(a.taskId, b.taskId);
});

test('a failure logs at err level with the outcome recorded', async () => {
  const f = fixture({ ok: false, code: 1, stdout: '', stderr: 'nope' });
  await f.dispatcher.dispatch({ agent: 'admin', text: 'x', origin: 'cli' });
  const failed = f.events.find((e) => e.stage === 'failed');
  assert.ok(failed);
  assert.equal(failed.level, 'err');
  assert.equal(failed.outcome, 'error');
});
