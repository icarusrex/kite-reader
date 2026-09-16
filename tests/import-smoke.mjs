// Import smoke test: node tests/import-smoke.mjs <book.pdf|book.epub>... (needs `npm run preview` on 127.0.0.1:4173). Book files stay local.
import { chromium } from 'playwright';
const files = process.argv.slice(2);
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const page = await (await browser.newContext({ viewport: { width: 1180, height: 820 }, hasTouch: true })).newPage();
const errors = []; page.on('pageerror', (e) => errors.push(e.message)); page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
await page.goto('http://127.0.0.1:4173/?simvoice');
await page.evaluate(() => new Promise((r) => { const req = indexedDB.open('keyval-store'); req.onupgradeneeded = () => req.result.createObjectStore('keyval'); req.onsuccess = () => {
  const levels = {}; for (let n = 1; n <= 10; n++) levels[n] = { status: n < 9 ? 'passed' : n === 9 ? 'active' : 'locked', sessions: 1 };
  const p = { version: 1, settings: { childName: 'Test', capMinutes: 15, parentScoring: true, readinessPassed: true, micSensitivity: 3 }, levels, items: {}, sessions: [], errors: {}, readAloud: {} };
  const tx = req.result.transaction('keyval', 'readwrite'); tx.objectStore('keyval').put(p, 'progress'); tx.oncomplete = () => r(); }; }));
await page.reload(); await page.waitForTimeout(800);
await page.locator('.corner').dispatchEvent('pointerdown'); await page.waitForTimeout(1800);
await page.getByText('Books', { exact: true }).click();
await page.locator('input[type=file]').first().setInputFiles(files);
const t0 = Date.now();
for (;;) {
  await page.waitForTimeout(3000);
  const st = await page.locator('.card span').first().textContent().catch(() => '');
  if (st === 'Done.' || Date.now() - t0 > 480000) { console.log('status', st, Math.round((Date.now() - t0) / 1000) + 's'); break; }
}
await page.screenshot({ path: '/tmp/kite-shots/imp1-admin.png', fullPage: true });
const rows = await page.locator('.card table').first().locator('tbody tr').allInnerTexts();
console.log(rows.join('\n'));
const lib = await page.evaluate(() => new Promise((r) => { const req = indexedDB.open('keyval-store'); req.onsuccess = () => { const g = req.result.transaction('keyval').objectStore('keyval').get('lib:index'); g.onsuccess = () => r(g.result); }; }));
for (const b of lib) console.log(b.id, b.pages, JSON.stringify({ ready95: b.analysis.ready95, pre: b.analysis.readyPreteach, preteach: b.analysis.preteach, names: b.analysis.names, sentences: b.analysis.sentences.length, firstSentLevels: b.analysis.sentences.slice(0, 8).map((s) => s.level) }));
// child shelf + reader
await page.getByText('Back to child').click(); await page.waitForTimeout(500);
await page.locator('[aria-label="Story chair"]').dispatchEvent('pointerdown', { clientX: 11, clientY: 12 }); await page.waitForTimeout(1500);
await page.screenshot({ path: '/tmp/kite-shots/imp2-shelf.png' });
await page.locator('.bookcard').first().dispatchEvent('pointerdown', { clientX: 21, clientY: 22 }); await page.waitForTimeout(1500);
for (let k = 0; k < 4; k++) { await page.locator('[aria-label="Next page"]').dispatchEvent('pointerdown', { clientX: 1100, clientY: 600 + k * 20 }); await page.waitForTimeout(900); }
await page.screenshot({ path: '/tmp/kite-shots/imp3-reader.png' });
console.log('errors', errors.slice(0, 5));
await browser.close();
