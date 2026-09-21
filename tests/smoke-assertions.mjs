import assert from 'node:assert/strict';
export function assertSessionComplete(seen, progress, beforeCount, expectedLevel) {
  assert.ok(seen.includes('DONE'), 'Session did not reach its completion screen');
  assert.equal(progress.sessions.length, beforeCount + 1, 'Expected exactly one saved session');
  const log = progress.sessions.at(-1);
  assert.equal(log.endedBy, 'complete', 'Session stopped before completion');
  assert.ok(log.answered > 0, 'Session did not record answers');
  if (expectedLevel !== undefined) assert.equal(log.level, expectedLevel);
}
export function assertNoErrors(errors) { assert.deepEqual(errors, [], 'Unexpected browser errors'); }
