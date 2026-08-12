import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { stripAnsi, isStuck, createRunner } from './runtimes.js';
import type { AgentSpec } from './config.js';

const ROOT = resolve(import.meta.dirname, '..', '..', '..');
const ESC = '';

function spec(runtime: string): AgentSpec {
  return { id: 'x', runtime, model: '', tokenEnv: 'X', primaryChannel: 'c' };
}

test('strips ANSI escapes', () => {
  assert.equal(stripAnsi(`${ESC}[32mok${ESC}[0m`), 'ok');
  assert.equal(stripAnsi('plain'), 'plain');
});

test('detects STUCK in the ascii-folded form agents actually emit', () => {
  // tools/setup.py ascii_fold() maps the emoji to "[STUCK]" before the soul is
  // written, so an agent has never seen the unicode form in its own prompt.
  assert.ok(isStuck('[STUCK]\nATTEMPTED: x\nERROR: y\nRESOURCES: z\nHYPOTHESIS: w'));
});

test('detects STUCK in the unicode form too', () => {
  assert.ok(isStuck('⛔ STUCK\nATTEMPTED: x'));
});

test('does not see STUCK where there is none', () => {
  assert.equal(isStuck('all good, nothing wrong here'), false);
  assert.equal(isStuck('the build got stuck briefly then recovered'), false);
});

test('reports a missing runtime instead of throwing', async () => {
  const r = await createRunner(ROOT, 5).run(spec('nosuchruntime'), 'hello');
  assert.equal(r.ok, false);
  assert.match(r.stderr, /no runtime/);
});

test('runs a real process and captures stdout', async () => {
  // Uses the python runtime from the localised runtimes.yaml, proving the
  // spawn path works against a real binary on this machine.
  const r = await createRunner(ROOT, 30).runRaw(spec('python'), ['-c', 'print("hello from python")']);
  assert.equal(r.ok, true);
  assert.match(r.stdout, /hello from python/);
});

test('a non-zero exit is not reported as success', async () => {
  const r = await createRunner(ROOT, 30).runRaw(spec('python'), ['-c', 'import sys; sys.exit(3)']);
  assert.equal(r.ok, false);
  assert.equal(r.code, 3);
});

test('a timeout is reported as timedOut, not as a generic failure', async () => {
  const r = await createRunner(ROOT, 1).runRaw(spec('python'), ['-c', 'import time; time.sleep(20)']);
  assert.equal(r.timedOut, true);
  assert.equal(r.ok, false);
});

test('the prompt reaches the process through the prompt file', async () => {
  // cmd_template for hermes/openclaw passes {instruction_file}, so the prompt
  // never goes on the command line where it would hit the Windows arg limit.
  const r = await createRunner(ROOT, 30).runRaw(spec('python'), [
    '-c',
    'import sys; print(open(sys.argv[1], encoding="utf-8").read())',
    '{instruction_file}',
  ], 'PROMPT BODY 12345');
  assert.equal(r.ok, true);
  assert.match(r.stdout, /PROMPT BODY 12345/);
});
