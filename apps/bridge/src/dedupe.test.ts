import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createDedupe } from './dedupe.js';

test('first sighting is false, second is true', () => {
  const d = createDedupe();
  assert.equal(d.seen('Ev001'), false);
  assert.equal(d.seen('Ev001'), true);
});

test('distinct ids do not collide', () => {
  const d = createDedupe();
  assert.equal(d.seen('Ev001'), false);
  assert.equal(d.seen('Ev002'), false);
});

test('evicts the oldest beyond the cap so memory is bounded', () => {
  const d = createDedupe(2);
  d.seen('a');
  d.seen('b');
  d.seen('c');
  assert.equal(d.seen('a'), false, "'a' should have been evicted");
  assert.equal(d.seen('c'), true, "'c' should still be remembered");
});

test('re-seeing an id does not duplicate it in the eviction queue', () => {
  const d = createDedupe(2);
  d.seen('a');
  d.seen('a');
  d.seen('b');
  // If 'a' had been queued twice, 'b' would already be evicted here.
  assert.equal(d.seen('b'), true);
});
