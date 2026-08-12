import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, existsSync, readdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { redact, createLogger } from './log.js';
import type { SwarmPaths } from './config.js';

function paths(): SwarmPaths {
  const d = mkdtempSync(join(tmpdir(), 'swarmlog-'));
  return { logDir: d, agentsDir: join(d, 'agents'), stateFile: join(d, 'state.json') };
}

test('redacts slack bot, slack app and openai style secrets', () => {
  assert.equal(redact('token xoxb-123456789012-abcdef ok'), 'token [REDACTED] ok');
  assert.equal(redact('app xapp-1-A00000-999999-zzzz ok'), 'app [REDACTED] ok');
  assert.equal(redact('key sk-abcdefghijklmnopqrst ok'), 'key [REDACTED] ok');
});

test('leaves ordinary text alone', () => {
  assert.equal(redact('the sky is blue'), 'the sky is blue');
});

test('writes exactly one line to swarm.log per event', () => {
  const p = paths();
  const log = createLogger(p);
  log.logEvent({
    task: 'T001', agent: 'admin', origin: 'cli', stage: 'received',
    level: 'info', message: 'hello',
  });
  log.logEvent({
    task: 'T001', agent: 'admin', origin: 'cli', stage: 'complete',
    level: 'info', outcome: 'success', durationMs: 12, message: 'done',
  });
  const lines = readFileSync(join(p.logDir, 'swarm.log'), 'utf8').split('\n').filter(Boolean);
  assert.equal(lines.length, 2);
  assert.match(lines[0]!, /T001/);
  assert.match(lines[0]!, /admin/);
  assert.match(lines[1]!, /outcome=success/);
});

test('a multi-line agent reply still occupies one log line', () => {
  const p = paths();
  createLogger(p).logEvent({
    task: 'T009', agent: 'admin', origin: 'cli', stage: 'complete',
    level: 'info', message: 'line one\nline two\nline three',
  });
  const lines = readFileSync(join(p.logDir, 'swarm.log'), 'utf8').split('\n').filter(Boolean);
  assert.equal(lines.length, 1);
});

test('writes valid JSONL per agent', () => {
  const p = paths();
  createLogger(p).logEvent({
    task: 'T002', agent: 'critic', origin: 'slack', stage: 'complete',
    level: 'info', outcome: 'success', durationMs: 5, message: 'ok',
  });
  const f = join(p.agentsDir, 'critic.jsonl');
  assert.ok(existsSync(f));
  const row = JSON.parse(readFileSync(f, 'utf8').trim());
  assert.equal(row.task, 'T002');
  assert.equal(row.outcome, 'success');
  assert.equal(row.duration_ms, 5);
});

test('each agent gets its own archive file', () => {
  const p = paths();
  const log = createLogger(p);
  log.logEvent({ task: 'T1', agent: 'admin', origin: 'cli', stage: 's', level: 'info', message: 'a' });
  log.logEvent({ task: 'T2', agent: 'coder', origin: 'cli', stage: 's', level: 'info', message: 'b' });
  assert.ok(existsSync(join(p.agentsDir, 'admin.jsonl')));
  assert.ok(existsSync(join(p.agentsDir, 'coder.jsonl')));
});

test('redacts in BOTH sinks', () => {
  const p = paths();
  createLogger(p).logEvent({
    task: 'T003', agent: 'admin', origin: 'cli', stage: 'complete', level: 'info',
    message: 'leaked xoxb-999999999999-secretvalue here',
  });
  assert.doesNotMatch(readFileSync(join(p.logDir, 'swarm.log'), 'utf8'), /secretvalue/);
  assert.doesNotMatch(readFileSync(join(p.agentsDir, 'admin.jsonl'), 'utf8'), /secretvalue/);
});

test('exactly one .log at the top level, so the Agent OS tail is deterministic', () => {
  const p = paths();
  const log = createLogger(p);
  log.logEvent({ task: 'T1', agent: 'admin', origin: 'cli', stage: 's', level: 'info', message: 'a' });
  log.logEvent({ task: 'T2', agent: 'coder', origin: 'cli', stage: 's', level: 'info', message: 'b' });
  // /api/activity does readdir().filter(/\.log$/).slice(0,3) -- a per-agent
  // .log layout would silently drop agents from the dashboard feed.
  const logs = readdirSync(p.logDir).filter((f) => f.endsWith('.log'));
  assert.deepEqual(logs, ['swarm.log']);
});

test('a sink failure never throws', () => {
  // A file where a directory must be: mkdir recursive fails with ENOTDIR.
  const base = mkdtempSync(join(tmpdir(), 'swarmbad-'));
  const asFile = join(base, 'blocker');
  writeFileSync(asFile, 'not a directory');
  const log = createLogger({
    logDir: asFile,
    agentsDir: join(asFile, 'agents'),
    stateFile: join(asFile, 'state.json'),
  });
  assert.doesNotThrow(() =>
    log.logEvent({ task: 'T004', agent: 'admin', origin: 'cli', stage: 'x', level: 'info', message: 'y' }),
  );
});
