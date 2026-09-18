// End-to-end smoke test: node tests/smoke.mjs (needs `npm run preview` on :4173)
// Simulates a child voice with tests/voice.wav and a grown-up tapping ✓.
import { chromium } from 'playwright';
const BASE = process.env.BASE ?? 'http://127.0.0.1:4173';
const SHOTS = process.env.SHOTS ?? '/tmp/kite-shots';
import { existsSync, mkdirSync } from 'node:fs';
mkdirSync(SHOTS, { recursive: true });
// Browser choice: CHANNEL=chrome uses the installed Chrome (handy on a Mac), CHROMIUM=/path points at a specific
// build, and with neither set Playwright launches the chromium it downloaded itself (what CI does).
const explicitChromium = [process.env.CHROMIUM, '/opt/pw-browsers/chromium'].find((p) => p && existsSync(p));
const browser = await chromium.launch({
  ...(process.env.CHANNEL ? { channel: process.env.CHANNEL } : explicitChromium ? { executablePath: explicitChromium } : {}),
  args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', '--autoplay-policy=no-user-gesture-required'],
});
const ctx = await browser.newContext({ viewport: { width: 1180, height: 820 }, hasTouch: true, permissions: ['microphone'] });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
await page.goto(BASE + '/?simvoice');
await page.addInitScript(() => { window.speechSynthesis && (window.speechSynthesis.speak = (u) => setTimeout(() => u.onend && u.onend(), 400)); });
const idb = (fn, arg) => page.evaluate(fn, arg);
const yesterday = new Date(Date.now() - 864e5).toISOString().slice(0, 10);
// Seed the household store directly: the app writes `kite:household` on first load, so a legacy `progress`
// record written afterwards would never be migrated. One profile, on the Levels track, L1 in cold check.
// Wait for that first-load write to land, or it races the fixture and the app starts a fresh Basics learner.
await page.waitForTimeout(1200);
await idb((y) => new Promise((r) => {
  const req = indexedDB.open('keyval-store');
  req.onupgradeneeded = () => req.result.createObjectStore('keyval');
  req.onsuccess = () => {
    const levels = {}; for (let n = 1; n <= 20; n++) levels[n] = { status: n === 1 ? 'cold' : 'locked', sessions: n === 1 ? 1 : 0 };
    levels[1].checkoutPassedOn = y;
    const basics = {}; for (let n = 1; n <= 10; n++) basics[n] = { status: 'passed', sessions: 1, passedOn: y };
    const p = {
      version: 2, curriculumVersion: 'reading-2026-09-18-v2', track: 'levels', basics,
      settings: { childName: 'Test', capMinutes: 15, parentScoring: true, readinessPassed: true, micSensitivity: 3, rev: 2 },
      levels, items: {}, sessions: [], errors: {}, readAloud: {}, readiness: { date: y, blending: 4, tracking: 4 },
    };
    const household = {
      version: 1, activeProfileId: 'p-test',
      profiles: { 'p-test': { id: 'p-test', name: 'Test', createdAt: y + 'T12:00:00.000Z', progress: p } },
    };
    const store = req.result.transaction('keyval', 'readwrite').objectStore('keyval');
    store.put(household, 'kite:household');
    store.transaction.oncomplete = () => r();
  };
}), yesterday);
await page.reload(); await page.waitForTimeout(1200);

const kindOf = () => page.evaluate(() => {
  const st = document.querySelector('.stage'); if (!st) return '?';
  if (st.querySelector('.track')) return st.innerHTML.includes('👾') ? 'alien' : 'glide';
  if (st.querySelector('.slots')) return 'build';
  if (st.querySelector('.sentence')) return 'sentence';
  if (st.querySelector('.story .chip')) return 'story';
  if (st.innerHTML.includes('❤️')) return 'heart';
  if (st.querySelector('.title')) return 'banner';
  if (st.innerHTML.includes('👂')) return 'ear';
  if (st.querySelector('.prompt-word')) return 'readMatch';
  if (st.querySelector('.kite')) return 'hold';
  if (st.querySelector('.tile.big')) return 'bigtile';
  if (st.querySelector('.tile.word')) return 'whichWord';
  return 'hearTap';
});

async function runSession(label, maxSteps, shots = []) {
  await page.locator('button[aria-label=Start]').dispatchEvent('pointerdown');
  const seen = [];
  for (let i = 0; i < maxSteps; i++) {
    await page.waitForTimeout(1500);
    if (await page.getByText('All done for today!').count()) { seen.push('DONE'); break; }
    const kind = await kindOf();
    if (seen[seen.length - 1] !== kind) {
      seen.push(kind);
      if (shots.includes(kind)) { await page.waitForTimeout(700); await page.screenshot({ path: `${SHOTS}/${label}-${kind}.png` }); shots = shots.filter((k) => k !== kind); }
    }
    if (['glide', 'alien', 'bigtile', 'hold', 'sentence', 'story', 'heart'].includes(kind)) await page.evaluate(() => window.__voice && window.__voice(2600));
    if (['glide', 'alien'].includes(kind)) await page.waitForTimeout(2800);
    const story = page.getByText('We read it ✓');
    if (await story.count()) { await story.dispatchEvent('pointerdown', { clientX: 500 + i, clientY: 600 }); continue; }
    if (await page.locator('.chip.next').count()) {
      for (let k = 0; k < 8 && await page.locator('.chip.next').count(); k++) { await page.locator('.chip.next').dispatchEvent('pointerdown', { clientX: 200 + k * 60, clientY: 300 + i }); await page.waitForTimeout(120); }
      continue;
    }
    const ok = page.locator('button[aria-label=Correct]');
    if (await ok.count() && await ok.isEnabled()) { await page.waitForTimeout(1200); if (await ok.count() && await ok.isEnabled()) await ok.dispatchEvent('pointerdown', { clientX: 1100, clientY: 100 + i }); continue; }
    const next = page.locator('button[aria-label=Next], button[aria-label=Skip]');
    if (await next.count()) { await page.waitForTimeout(2500); if (await next.count()) await next.dispatchEvent('pointerdown', { clientX: 1100, clientY: 120 + i }); continue; }
    const right = page.locator('[data-c="1"]:not(.good)');
    if (await right.count()) { await right.first().dispatchEvent('pointerdown', { clientX: 300 + i * 7, clientY: 500 + (i % 5) }); continue; }
  }
  return seen;
}
const readProg = () => idb(() => new Promise((r) => { const req = indexedDB.open('keyval-store'); req.onsuccess = () => { const g = req.result.transaction('keyval').objectStore('keyval').get('kite:household'); g.onsuccess = () => { const h = g.result; r(h && h.profiles[h.activeProfileId].progress); }; }; }));

// Fail fast if the fixture did not take: otherwise the whole run silently exercises a fresh Basics learner.
const seeded = await readProg();
if (seeded?.track !== 'levels' || seeded.levels[1].status !== 'cold') {
  throw new Error(`fixture not applied: track=${seeded?.track} L1=${JSON.stringify(seeded?.levels?.[1])}`);
}

const target = +(process.env.LEVEL ?? 9);
const s1 = await runSession('cold', 90, []);
let p = await readProg();
console.log('A:', s1.join(' > '));
console.log('A levels 1-2:', JSON.stringify([p.levels[1].status, p.levels[2]]), 'log', JSON.stringify(p.sessions.at(-1)));

await page.waitForTimeout(9500);
await page.locator('.corner').dispatchEvent('pointerdown');
await page.waitForTimeout(1800);
await page.getByText('Settings', { exact: true }).click();
await page.locator('select').selectOption(String(target));
await page.getByText("Clear today's recommendation").click();
await page.waitForTimeout(500);
const s2 = await runSession(`L${target}`, 220, ['glide', 'alien', 'build', 'sentence', 'readMatch', 'whichWord', 'hold', 'ear', 'banner', 'heart', 'hearTap']);
p = await readProg();
console.log('B:', s2.join(' > '));
console.log(`B L${target}:`, JSON.stringify(p.levels[target]), 'items', Object.keys(p.items).length, 'log', JSON.stringify(p.sessions.at(-1)));
console.log('B misses:', JSON.stringify(p.errors));
// Second session at the same level: the story replaces the sentence
await page.waitForTimeout(9500);
await page.locator('.corner').dispatchEvent('pointerdown'); await page.waitForTimeout(1800);
await page.getByText('Settings', { exact: true }).click();
await page.getByText("Clear today's recommendation").click();
await page.waitForTimeout(500);
const s3 = await runSession(`L${target}b`, 220, ['story', 'banner']);
p = await readProg();
console.log('C:', s3.join(' > '));
console.log(`C L${target}:`, JSON.stringify(p.levels[target]), 'log', JSON.stringify(p.sessions.at(-1)));
await page.waitForTimeout(9500);
await page.locator('.corner').dispatchEvent('pointerdown'); await page.waitForTimeout(1800);
await page.screenshot({ path: `${SHOTS}/parent-progress.png`, fullPage: true });
console.log('errors:', errors);
await browser.close();
