import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { acceptSound, extract, kindOf, SoundFeatures } from './soundCheck';

function wav(file: string) {
  const b = readFileSync(file);
  const rate = b.readUInt32LE(24), data = b.indexOf('data') + 8, n = Math.floor((b.length - data) / 2);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) out[i] = b.readInt16LE(data + i * 2) / 32768;
  return { samples: out, rate };
}
/** A child copying the grown-up: pitch/formants ~30% higher, a little room noise. */
function childLike(x: Float32Array, factor = 1.3, noise = 0.003) {
  let r = 7;
  const rand = () => ((r = (r * 1103515245 + 12345) % 2147483648) / 2147483648) * 2 - 1;
  const out = new Float32Array(Math.floor(x.length / factor));
  for (let i = 0; i < out.length; i++) { const p = i * factor, k = Math.floor(p), t = p - k; out[i] = ((x[k] ?? 0) * (1 - t) + (x[k + 1] ?? 0) * t) * 0.8 + rand() * noise; }
  return out;
}

describe('letter sound check (loose)', () => {
  const ids = 'a m s f i n h l v w r o u e'.split(' ');
  const raw = Object.fromEntries(ids.map((g) => [g, wav(`public/audio/phonemes/${g}.wav`)]));
  const refs: Record<string, SoundFeatures> = Object.fromEntries(ids.map((g) => [g, extract(raw[g].samples, raw[g].rate)!]));
  const kid = Object.fromEntries(ids.map((g) => [g, extract(childLike(raw[g].samples), raw[g].rate)!]));

  it('accepts the right sound in a child-like voice (at least 12 of 14)', () => {
    expect(ids.filter((g) => acceptSound(g, kid[g], refs)).length).toBeGreaterThanOrEqual(12);
  });
  it('rejects a different kind of sound (hiss / hum / open) most of the time', () => {
    let rejected = 0, total = 0;
    for (const t of ids) for (const g of ids) if (kindOf(refs[g]) !== kindOf(refs[t])) { total++; if (!acceptSound(t, kid[g], refs)) rejected++; }
    console.log(`different kind rejected: ${rejected}/${total}`);
    expect(rejected / total).toBeGreaterThanOrEqual(0.8);
  });
  it('a hiss is never accepted for a vowel, and a vowel never for a hiss', () => {
    for (const vowel of ['a', 'o', 'u']) for (const hiss of ['s', 'f']) {
      expect(acceptSound(vowel, kid[hiss], refs), `${hiss} for ${vowel}`).toBe(false);
      expect(acceptSound(hiss, kid[vowel], refs), `${vowel} for ${hiss}`).toBe(false);
    }
  });
});
