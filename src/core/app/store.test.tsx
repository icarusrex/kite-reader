// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { test, expect, vi, beforeEach, afterEach } from 'vitest';
import { StoreProvider, useStore } from './store';
import { Parent } from '../../modules/reading/screens/Parent';
import { householdFromLegacy } from './household';
import { freshProgress, jumpTo } from '../../modules/reading/engine/progress';
const db = vi.hoisted(() => ({ values: new Map<string, unknown>(), failRead: false, failWrite: false, writes: 0 }));
vi.mock('idb-keyval', () => ({
  get: async (key: string) => { if (db.failRead && key === 'kite:household') throw Error('read failed'); return structuredClone(db.values.get(key)); },
  set: async (key: string, value: unknown) => { if (db.failWrite) throw Error('quota'); db.writes++; db.values.set(key, structuredClone(value)); },
  setMany: async (entries: [string, unknown][]) => { if (db.failWrite) throw Error('quota'); db.writes++; for (const [k, v] of entries) db.values.set(k, structuredClone(v)); },
  del: vi.fn(), keys: async () => [],
}));
(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let store: ReturnType<typeof useStore>;
let root: Root;
let el: HTMLDivElement;
function Probe() { store = useStore(); return <span>{store.household.profiles[store.activeProfileId].name}</span>; }
async function mount() { el = document.createElement('div'); document.body.append(el); root = createRoot(el); await act(async () => root.render(<React.StrictMode><StoreProvider><Probe /></StoreProvider></React.StrictMode>)); }
const saved = () => db.values.get('kite:household') as ReturnType<typeof householdFromLegacy>;
const click = async (name: string) => { const button = Array.from(el.querySelectorAll('button')).find(b => b.textContent === name); expect(button).toBeTruthy(); await act(async () => button!.click()); };
beforeEach(() => { db.values.clear(); db.failRead = false; db.failWrite = false; db.writes = 0; db.values.set('kite:household', householdFromLegacy(jumpTo(freshProgress('Existing'), 9))); });
afterEach(async () => { if (root) await act(async () => root.unmount()); el?.remove(); });
test('read failure never overwrites a household, and retry loads existing history', async () => {
  db.failRead = true; await mount(); expect(db.writes).toBe(0); expect(el.textContent).toContain('could not load');
  db.failRead = false; await click('Retry'); expect(el.textContent).toContain('Existing'); expect(saved().profiles['p-legacy'].modules.reading.levels[8].status).toBe('passed');
});
test('failed save is visible and retry saves the latest in-memory changes', async () => {
  await mount(); db.failWrite = true;
  await act(async () => store.renameProfile('p-legacy', 'Unsaved')); expect(el.textContent).toContain('not saved'); expect(saved().profiles['p-legacy'].name).toBe('Existing');
  await act(async () => store.renameProfile('p-legacy', 'Latest')); db.failWrite = false; await click('Retry saving');
  expect(saved().profiles['p-legacy'].name).toBe('Latest'); expect(el.textContent).not.toContain('not saved');
});
test('replacement keeps a recoverable previous household in the same write', async () => {
  await mount(); const replacement = householdFromLegacy(freshProgress('Imported'));
  await act(async () => store.replaceHousehold(replacement));
  expect(saved().profiles['p-legacy'].name).toBe('Imported');
  const recovery = db.values.get('kite:household:before-import') as typeof replacement;
  expect(recovery.profiles['p-legacy'].name).toBe('Existing'); expect(recovery.profiles['p-legacy'].modules.reading.levels[8].status).toBe('passed');
});
test('an invalid replacement leaves in-memory and persisted history unchanged', async () => {
  await mount(); expect(() => store.replaceHousehold({} as never)).toThrow(); expect(saved().profiles['p-legacy'].name).toBe('Existing'); expect(el.textContent).toContain('Existing');
});
test('absent data creates a first learner normally', async () => { db.values.clear(); await mount(); expect(Object.keys(saved().profiles)).toHaveLength(1); });

test('failed replacement keeps recovery through subsequent edits and retry', async () => {
  await mount(); db.failWrite = true;
  await act(async () => store.replaceHousehold(householdFromLegacy(freshProgress('Imported'))));
  await act(async () => store.renameProfile('p-legacy', 'Imported latest'));
  expect(saved().profiles['p-legacy'].name).toBe('Existing');
  db.failWrite = false; await click('Retry saving');
  expect(saved().profiles['p-legacy'].name).toBe('Imported latest');
  const recovery = db.values.get('kite:household:before-import') as ReturnType<typeof householdFromLegacy>;
  expect(recovery.profiles['p-legacy'].name).toBe('Existing');
});

async function backupUI() {
  const noop = () => {};
  el = document.createElement('div'); document.body.append(el); root = createRoot(el);
  await act(async () => root.render(<StoreProvider><Parent onClose={noop} onReadiness={noop} onExtraSession={noop} onPractice={noop} onExplore={noop} onPracticeBasics={noop} onExploreBasics={noop} onSwitchProfile={noop} /></StoreProvider>));
  await click('Backup');
}
async function importFile(value: unknown) {
  const input = el.querySelector('input[type=file]')!;
  Object.defineProperty(input, 'files', { configurable: true, value: [{ text: async () => JSON.stringify(value) }] });
  await act(async () => input.dispatchEvent(new Event('change', { bubbles: true })));
}
test('Backup rejects unrelated JSON without replacing history', async () => {
  const alert = vi.spyOn(window, 'alert').mockImplementation(() => {});
  await backupUI(); await importFile({});
  expect(saved().profiles['p-legacy'].modules.reading.levels[8].status).toBe('passed'); expect(alert).toHaveBeenCalled(); alert.mockRestore();
});
test('Backup previews replacement and respects cancellation', async () => {
  const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
  await backupUI(); await importFile(householdFromLegacy(freshProgress('Imported')));
  expect(confirm).toHaveBeenCalled(); expect(saved().profiles['p-legacy'].name).toBe('Existing'); confirm.mockRestore();
});
test('Backup can restore the previous household after accepted replacement', async () => {
  const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
  await backupUI(); await importFile(householdFromLegacy(freshProgress('Imported')));
  expect(saved().profiles['p-legacy'].name).toBe('Imported'); await click('Restore previous household');
  expect(saved().profiles['p-legacy'].name).toBe('Existing'); expect(saved().profiles['p-legacy'].modules.reading.levels[8].status).toBe('passed'); confirm.mockRestore();
});
