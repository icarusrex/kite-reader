import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { MIN_EXAMPLES, VoiceStore, judge, mfcc } from './ownVoice';

function wav(file: string) {
  const b = readFileSync(file);
  const rate = b.readUInt32LE(24), data = b.indexOf('data') + 8, n = Math.floor((b.length - data) / 2);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) out[i] = b.readInt16LE(data + i * 2) / 32768;
  return { samples: out, rate };
}
/** One "try": pitched up like a child's voice, held longer or shorter, louder or quieter, with room noise and a bit of silence around it. */
function variant(x: Float32Array, rate: number, seed: number) {
  let r = seed * 7919 + 1;
  const rand = () => ((r = (r * 1103515245 + 12345) % 2147483648) / 2147483648);
  const pitch = 1.25 + rand() * 0.15, gain = 0.4 + rand() * 0.8, noise = 0.002 + rand() * 0.006;
  const up = new Float32Array(Math.floor(x.length / pitch));
  for (let i = 0; i < up.length; i++) { const p = i * pitch, k = Math.floor(p), t = p - k; up[i] = (x[k] ?? 0) * (1 - t) + (x[k + 1] ?? 0) * t; }
  // hold the middle longer or shorter (repeat / drop 20 ms slices)
  const slice = Math.round(rate * 0.02), stretch = 0.7 + rand() * 0.9;
  const parts: Float32Array[] = [];
  const n = Math.floor(up.length / slice);
  for (let s = 0; s < n * stretch; s++) parts.push(up.subarray(Math.min(n - 1, Math.floor(s / stretch)) * slice, (Math.min(n - 1, Math.floor(s / stretch)) + 1) * slice));
  const pad = Math.round(rate * 0.15);
  const out = new Float32Array(pad * 2 + parts.length * slice);
  let o = pad; for (const p of parts) { out.set(p, o); o += p.length; }
  for (let i = 0; i < out.length; i++) out[i] = out[i] * gain + (rand() * 2 - 1) * noise;
  return out;
}

const ids = 'a m s t f d g i n p h b l j c v w r k o u e'.split(' ');
const raw = Object.fromEntries(ids.map((g) => [g, wav(`public/audio/phonemes/${g}.wav`)]));
const tries = (g: string, from: number, count: number) => Array.from({ length: count }, (_, i) => mfcc(variant(raw[g].samples, raw[g].rate, from + i + ids.indexOf(g) * 100), raw[g].rate)!);
// Learnt from 4 accepted tries of each sound; judged on 3 new tries
const store: VoiceStore = { ex: Object.fromEntries(ids.map((g) => [g, tries(g, 0, 4)])), auto: 0, corrected: 0 };
const fresh = Object.fromEntries(ids.map((g) => [g, tries(g, 50, 3)]));

describe("the child's own voice", () => {
  it('stays unsure until it has enough examples', () => {
    const few: VoiceStore = { ex: { s: store.ex.s.slice(0, MIN_EXAMPLES - 1), a: store.ex.a, m: store.ex.m }, auto: 0, corrected: 0 };
    expect(judge('s', fresh.s[0], few)).toBe('unsure');
  });

  it('says yes to the right sound, and rarely to a different one', () => {
    let right = 0, rightN = 0, wrongYes = 0, wrongN = 0;
    const leaks: string[] = [];
    for (const t of ids) {
      for (const f of fresh[t]) { rightN++; if (judge(t, f, store) === 'match') right++; }
      for (const g of ids) if (g !== t) for (const f of fresh[g]) { wrongN++; if (judge(t, f, store) === 'match') { wrongYes++; leaks.push(`${g}→${t}`); } }
    }
    console.log(`right sound → yes ${right}/${rightN}; different sound → yes ${wrongYes}/${wrongN} (${leaks.join(' ')})`);
    expect(right / rightN).toBeGreaterThanOrEqual(0.7);
    expect(wrongYes / wrongN).toBeLessThanOrEqual(0.03);
  });
});
