/**
 * Measure the letter-sound check. References: the grown-up's recordings (public/audio/phonemes).
 * Child stand-ins: those recordings pitched up 30% (child voice) with room noise, at two noise levels.
 * Wrong answers: other letters' sounds and whole words said instead of the sound.
 *   npx tsx scripts/eval-soundcheck.ts [folder with words/*.wav]
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { acceptSound, extract, kindOf, SoundFeatures } from '../src/modules/reading/audio/soundCheck';

function wav(file: string) {
  const b = readFileSync(file);
  const rate = b.readUInt32LE(24);
  const data = b.indexOf('data') + 8;
  const n = Math.floor((b.length - data) / 2);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) out[i] = b.readInt16LE(data + i * 2) / 32768;
  return { samples: out, rate };
}
/** Child-like: resample to raise pitch/formants by `factor`, add low noise, random gain. */
function childLike(x: Float32Array, factor: number, noise: number, seed: number) {
  let r = seed;
  const rand = () => ((r = (r * 1103515245 + 12345) % 2147483648) / 2147483648) * 2 - 1;
  const out = new Float32Array(Math.floor(x.length / factor));
  for (let i = 0; i < out.length; i++) { const p = i * factor, k = Math.floor(p), t = p - k; out[i] = ((x[k] ?? 0) * (1 - t) + (x[k + 1] ?? 0) * t) * 0.8 + rand() * noise; }
  return out;
}
const ids = 'a m s t f d g i n p h b l j c v w r k o u e'.split(' ');
const checkable = ids.filter((g) => !'tpkcdgbj'.includes(g));
const refs: Record<string, SoundFeatures> = {};
const raw: Record<string, { samples: Float32Array; rate: number }> = {};
for (const g of ids) { raw[g] = wav(`public/audio/phonemes/${g}.wav`); refs[g] = extract(raw[g].samples, raw[g].rate)!; }
console.log('kinds of your recordings:', ids.map((g) => `${g}:${kindOf(refs[g])}`).join(' '));

for (const [label, factor, noise] of [['child voice, quiet room', 1.3, 0.003], ['child voice, noisier room', 1.35, 0.012]] as const) {
  const kid = Object.fromEntries(ids.map((g, i) => [g, extract(childLike(raw[g].samples, factor, noise, i + 7), raw[g].rate)!]));
  const ok = checkable.filter((g) => acceptSound(g, kid[g], refs));
  let rej = 0, tot = 0; const leaks: string[] = [];
  for (const t of checkable) for (const g of ids) { if (g === t) continue; tot++; if (!acceptSound(t, kid[g], refs)) rej++; else leaks.push(`${g}→${t}`); }
  console.log(`\n${label}: right sound accepted ${ok.length}/${checkable.length}${ok.length < checkable.length ? ' (missed: ' + checkable.filter((g) => !ok.includes(g)).join(' ') + ')' : ''}`);
  console.log(`  a different letter's sound rejected ${rej}/${tot} (${Math.round((100 * rej) / tot)}%); let through: ${leaks.join(' ')}`);
}
const dir = process.argv[2];
if (dir && existsSync(`${dir}/words`)) {
  let wr = 0, wt = 0; const leaks: string[] = [];
  for (const f of readdirSync(`${dir}/words`)) { const w = wav(`${dir}/words/${f}`); const feat = extract(w.samples, w.rate)!; for (const t of checkable) { wt++; if (!acceptSound(t, feat, refs)) wr++; else leaks.push(`${f.replace('.wav', '')}→${t}`); } }
  console.log(`\nwhole words said instead of a sound rejected ${wr}/${wt} (${Math.round((100 * wr) / wt)}%); let through: ${leaks.join(' ')}`);
}
