import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { createRunner } from './runtimes.js';
import { loadConfig } from './config.js';

const ROOT = resolve(import.meta.dirname, '..', '..', '..');

/**
 * Live tests. These spend real OpenRouter tokens, so they are opt-in:
 *
 *     $env:SWARM_LIVE=1; pnpm test
 *
 * They exist because every template in runtimes.yaml was wrong before being
 * checked against real --help output, and a unit test with a fake runtime
 * cannot catch an invented flag.
 */
const LIVE = process.env.SWARM_LIVE === '1';

/**
 * Checks run on a free model, never the agent's registry model.
 *
 * Owner directive: any invocation whose purpose is merely to verify an agent
 * works must cost effectively nothing. Overridden per call rather than by
 * editing agents/*.yaml, because those values are hashed by setup.py verify
 * and a permanent downgrade would be a cost lever the cost spec forbids.
 */
const CHECK_MODEL = process.env.SWARM_CHECK_MODEL ?? 'nvidia/nemotron-3.5-lightning:free';

test('refuses an over-long prompt for an inline-prompt runtime', async () => {
  const config = loadConfig(ROOT);
  const runner = createRunner(ROOT, 30);
  const admin = config.agents.get('admin')!;
  const r = await runner.run(admin, 'x'.repeat(40_000));
  assert.equal(r.ok, false);
  assert.match(r.stderr, /command line/);
});

test('hermes admin answers a real one-shot', { skip: !LIVE }, async () => {
  const config = loadConfig(ROOT);
  const runner = createRunner(ROOT, 300);
  const admin = config.agents.get('admin')!;
  const r = await runner.runRaw(admin, [
    '-p', admin.id,
    '-m', CHECK_MODEL,
    '--provider', 'openrouter',
    '-z', 'Reply with exactly one word: PONG',
  ]);
  assert.equal(r.timedOut, false);
  assert.equal(r.ok, true, `hermes failed: ${r.stderr}`);
  assert.match(r.stdout, /PONG/i);
});
