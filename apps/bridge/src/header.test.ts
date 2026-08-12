import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { HEADER_RE, formatHeader, parseHeader, nextTaskId } from './header.js';

test('the regex matches a real header', () => {
  // The test that would have caught bridge.config.yaml:155. That pattern was
  // double-escaped inside YAML single quotes, so the engine received an
  // escaped literal backslash followed by an open character class and could
  // not match anything -- while task_header.required was true.
  assert.ok(HEADER_RE.test('[T007 · loop 0 · stage=decompose]'));
});

test('matches a header embedded in a longer message', () => {
  assert.ok(HEADER_RE.test('prefix [T012 · loop 3 · stage=critique] suffix'));
});

test('separator is MIDDLE DOT, not a hyphen', () => {
  assert.equal(formatHeader('T007', 0, 'decompose'), '[T007 · loop 0 · stage=decompose]');
  assert.equal(parseHeader('[T007 - loop 0 - stage=decompose]'), null);
});

test('round-trips', () => {
  assert.deepEqual(parseHeader(formatHeader('T042', 3, 'critique')), {
    task: 'T042', loop: 3, stage: 'critique',
  });
});

test('rejects malformed headers', () => {
  assert.equal(parseHeader('no header here'), null);
  assert.equal(parseHeader('[T007 loop 0 stage=x]'), null);
});

test('task ids increment and persist across calls', () => {
  const f = join(mkdtempSync(join(tmpdir(), 'hdr-')), 'state.json');
  assert.equal(nextTaskId(f), 'T001');
  assert.equal(nextTaskId(f), 'T002');
  assert.equal(nextTaskId(f), 'T003');
  assert.equal(JSON.parse(readFileSync(f, 'utf8')).lastTask, 3);
});

test('a corrupt state file restarts the counter rather than killing the daemon', () => {
  const f = join(mkdtempSync(join(tmpdir(), 'hdr-')), 'state.json');
  writeFileSync(f, '{ this is not json', 'utf8');
  assert.equal(nextTaskId(f), 'T001');
});

test('ids stay zero-padded to three digits and keep growing past 999', () => {
  const f = join(mkdtempSync(join(tmpdir(), 'hdr-')), 'state.json');
  writeFileSync(f, JSON.stringify({ lastTask: 999 }), 'utf8');
  assert.equal(nextTaskId(f), 'T1000');
});
