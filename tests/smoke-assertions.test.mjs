import { test, expect } from 'vitest';
import { assertSessionComplete, assertNoErrors } from './smoke-assertions.mjs';
const progress = () => ({ sessions: [{ endedBy: 'complete', answered: 4, level: 9 }] });
test('browser gates reject incomplete sessions, lost writes and unexpected errors', () => {
  expect(() => assertSessionComplete([], progress(), 0, 9)).toThrow();
  expect(() => assertSessionComplete(['DONE'], { sessions: [] }, 0, 9)).toThrow();
  expect(() => assertSessionComplete(['DONE'], { sessions: [{ endedBy: 'cap', answered: 4, level: 9 }] }, 0, 9)).toThrow();
  expect(() => assertSessionComplete(['DONE'], progress(), 0, 8)).toThrow();
  expect(() => assertNoErrors(['Uncaught failure'])).toThrow();
  expect(() => assertSessionComplete(['DONE'], progress(), 0, 9)).not.toThrow();
  expect(() => assertNoErrors([])).not.toThrow();
});
