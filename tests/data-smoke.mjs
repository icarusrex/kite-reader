// Real-browser backup/reload and Math evidence checks, using a disposable context.
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { assertNoErrors } from './smoke-assertions.mjs';
const browser = await chromium.launch(process.env.CHANNEL ? { channel: process.env.CHANNEL } : {});
try {
  const context = await browser.newContext({ serviceWorkers: 'block' });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(process.env.BASE ?? 'http://127.0.0.1:4173');
  await page.locator('button.card', { hasText: 'Reading' }).waitFor();
  const read = key => page.evaluate(key => new Promise((resolve, reject) => {
    const q = indexedDB.open('keyval-store');
    q.onerror = () => reject(q.error);
    q.onsuccess = () => { const db = q.result; const r = db.transaction('keyval').objectStore('keyval').get(key); r.onsuccess = () => { resolve(r.result); db.close(); }; r.onerror = () => reject(r.error); };
  }), key);
  const household = () => read('kite:household');
  const waitSaved = async predicate => { for (let i = 0; i < 100; i++) { const h = await household(); if (h && predicate(h)) return h; await page.waitForTimeout(50); } throw Error('Expected progress was not persisted'); };
  await waitSaved(h => !!h.profiles[h.activeProfileId]);
  const parent = async tab => { await page.locator('.corner').dispatchEvent('pointerdown'); await page.getByRole('button', { name: tab, exact: true }).click(); };
  await parent('Settings');
  await page.locator('select').selectOption('9');
  const before = await waitSaved(h => h.profiles[h.activeProfileId].modules.reading.levels[8].status === 'passed');
  await page.getByRole('button', { name: 'Backup', exact: true }).click();
  const dialogs = [];
  page.on('dialog', async d => { dialogs.push({ type: d.type(), message: d.message() }); await d.accept(); });
  const upload = value => page.locator('input[type=file]').setInputFiles({ name: 'audit.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(value)) });
  await upload({});
  await page.waitForFunction(() => document.querySelector('input[type=file]').value === '');
  assert.ok(dialogs.some(d => d.type === 'alert'), 'Invalid import must alert');
  assert.deepEqual(await household(), before, 'Invalid import changed the household');
  const imported = structuredClone(before);
  const profile = imported.profiles[imported.activeProfileId];
  profile.name = profile.modules.reading.settings.childName = 'Imported test';
  await upload(imported);
  await waitSaved(h => h.profiles[h.activeProfileId].name === 'Imported test');
  assert.deepEqual(await read('kite:household:before-import'), before, 'Recovery snapshot missing');
  await page.reload();
  await page.locator('button.card', { hasText: 'Reading' }).waitFor();
  await parent('Backup');
  await page.getByRole('button', { name: 'Restore previous household', exact: true }).click();
  await waitSaved(h => h.profiles[h.activeProfileId].name === before.profiles[before.activeProfileId].name);
  assert.deepEqual(await household(), before, 'Recovery did not restore full history');
  await page.getByRole('button', { name: 'Back to child', exact: true }).click();
  await page.locator('button.card', { hasText: 'Math' }).click();
  const lesson = page.locator('.row').filter({ has: page.locator('span', { hasText: 'Numerals 1–5 mean quantities' }) });
  await lesson.getByRole('button', { name: 'Start', exact: true }).click();
  await page.getByRole('button', { name: '→', exact: true }).click();
  for (const target of [1, 2, 3, 4]) {
    if (target % 2) {
      for (let n = 0; n < target; n++) await page.getByRole('button', { name: '🍓', exact: true }).nth(n).click();
      await page.getByRole('button', { name: 'Done', exact: true }).click();
    } else await page.getByRole('button', { name: String(target), exact: true }).click();
  }
  await page.getByRole('heading', { name: 'Math', exact: true }).waitFor();
  const afterMath = await waitSaved(h => h.profiles[h.activeProfileId].modules.math.attempts.length === 4);
  const math = afterMath.profiles[afterMath.activeProfileId].modules.math;
  assert.equal(math.sessions.length, 1);
  assert.deepEqual(math.attempts.map(a => a.target), [1, 2, 3, 4]);
  assert.ok(math.attempts.every(a => a.correct));
  await page.reload(); await page.locator('button.card', { hasText: 'Math' }).waitFor();
  assert.deepEqual((await household()).profiles[afterMath.activeProfileId].modules.math, math, 'Reload lost Math evidence');
  assertNoErrors(errors);
  console.log('Backup rejection, recovery, reload, Math evidence: passed');
} finally { await browser.close(); }
