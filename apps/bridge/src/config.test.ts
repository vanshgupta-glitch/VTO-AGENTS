import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadConfig } from './config.js';
import { resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..', '..', '..');

test('loads all 13 channels with their IDs', () => {
  const c = loadConfig(ROOT);
  assert.equal(c.channels.size, 13);
  assert.match(c.channels.get('swarm-command')!, /^C0/);
});

test('loads the full agent roster from the registry', () => {
  const c = loadConfig(ROOT);
  // Asserted by name, not by count: a bare count fails uninformatively the
  // moment an agent is added, and does not catch one being swapped for another.
  assert.deepEqual(
    [...c.agents.keys()].sort(),
    ['admin', 'claude', 'coder', 'critic', 'openclaw', 'opencode', 'researcher'],
  );
  assert.equal(c.agents.get('admin')!.runtime, 'hermes');
  assert.equal(c.agents.get('admin')!.tokenEnv, 'SLACK_BOT_ADMIN');
});

test('openclaw shares Coder\'s Slack identity, having no app of its own', () => {
  const c = loadConfig(ROOT);
  assert.equal(c.agents.get('openclaw')!.tokenEnv, 'SLACK_BOT_CODER');
  assert.equal(c.agents.get('openclaw')!.runtime, 'openclaw');
});

test('tier-1 claude runs on Claude Code, never OpenRouter', () => {
  const c = loadConfig(ROOT);
  const claude = c.agents.get('claude')!;
  assert.equal(claude.runtime, 'claude');
  assert.equal(claude.model, 'claude-opus-5');
  assert.doesNotMatch(claude.model, /openrouter/);
});

test('agent model matches the registry, not a stale copy', () => {
  const c = loadConfig(ROOT);
  assert.equal(c.agents.get('admin')!.model, 'openrouter/deepseek/deepseek-v4-flash');
  assert.equal(c.agents.get('coder')!.model, 'openrouter/qwen/qwen3-coder-flash');
});

test('exposes never_run so the daemon can refuse git', () => {
  const c = loadConfig(ROOT);
  assert.ok(c.control.neverRun.some((x) => x.startsWith('git commit')));
});

test('paths point inside ~/.agentic-os/swarm-logs', () => {
  const c = loadConfig(ROOT);
  assert.match(c.paths.logDir.replace(/\\/g, '/'), /\.agentic-os\/swarm-logs$/);
  assert.match(c.paths.agentsDir.replace(/\\/g, '/'), /swarm-logs\/agents$/);
});

test('throws a useful error when the config directory is wrong', () => {
  assert.throws(() => loadConfig(resolve(ROOT, 'apps')), /missing config/);
});
