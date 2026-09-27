/**
 * The child's own voice as the reference for letter sounds.
 *
 * Every letter sound a grown-up lets through (✓, or an automatic "Yes!" nobody corrected with ✗) is kept as an
 * example for that learner. A new try is compared with all of them using MFCCs + dynamic time warping: the classic way
 * to recognise a small set of sounds from one speaker, which is exactly this job. It needs no model download and no
 * network, and it gets better the more the child plays. Stored per learner, on this device only.
 */
import { fft } from './soundCheck';
import { load, remove, save } from '../../../core/storage';

const RATE = 16000;
const WIN = 400;   // 25 ms
const HOP = 160;   // 10 ms
const NFFT = 512;
const MELS = 26;
const CEPS = 12;   // c1…c12; c0 (loudness) is dropped so a quiet and a loud "sss" look the same
const MAX_FRAMES = 60;
/** Examples kept per sound (newest win), so the model follows the child's voice as it changes. */
export const KEEP = 8;
/** Examples of a sound needed before the child's voice is used for it. */
export const MIN_EXAMPLES = 3;

type Feats = number[][];
export interface VoiceStore { ex: Record<string, Feats[]>; auto: number; corrected: number }
export type Verdict = 'match' | 'mismatch' | 'unsure';

const key = (profileId: string) => `voice:${profileId}`;
const empty = (): VoiceStore => ({ ex: {}, auto: 0, corrected: 0 });
const cache = new Map<string, VoiceStore>();

export async function loadVoice(profileId: string): Promise<VoiceStore> {
  if (!cache.has(profileId)) cache.set(profileId, { ...empty(), ...(await load<VoiceStore | null>(key(profileId), null)) });
  return cache.get(profileId)!;
}
async function commit(profileId: string, v: VoiceStore) { cache.set(profileId, v); await save(key(profileId), v); }

export async function addExample(profileId: string, sound: string, f: Feats, auto: boolean) {
  const v = await loadVoice(profileId);
  await commit(profileId, { ...v, ex: { ...v.ex, [sound]: [...(v.ex[sound] ?? []), f].slice(-KEEP) }, auto: v.auto + (auto ? 1 : 0) });
}
/** The grown-up tapped ✗ during an automatic "Yes!" window. */
export async function noteCorrected(profileId: string) {
  const v = await loadVoice(profileId);
  await commit(profileId, { ...v, corrected: v.corrected + 1 });
}
export async function forgetVoice(profileId: string) { cache.delete(profileId); await remove(key(profileId)); }

let melBank: number[][] | null = null;
function mel() {
  if (melBank) return melBank;
  const toMel = (hz: number) => 2595 * Math.log10(1 + hz / 700);
  const toHz = (m: number) => 700 * (10 ** (m / 2595) - 1);
  const lo = toMel(100), hi = toMel(RATE / 2);
  const pts = Array.from({ length: MELS + 2 }, (_, i) => Math.floor(((NFFT + 1) * toHz(lo + ((hi - lo) * i) / (MELS + 1))) / RATE));
  melBank = Array.from({ length: MELS }, (_, m) => {
    const w = new Array(NFFT / 2 + 1).fill(0);
    for (let k = pts[m]; k < pts[m + 1]; k++) w[k] = (k - pts[m]) / Math.max(1, pts[m + 1] - pts[m]);
    for (let k = pts[m + 1]; k < pts[m + 2]; k++) w[k] = (pts[m + 2] - k) / Math.max(1, pts[m + 2] - pts[m + 1]);
    return w;
  });
  return melBank;
}

/** MFCC frames of the loud part of a clip; null when there is no real sound in it. */
export function mfcc(input: Float32Array, rate: number): Feats | null {
  // Resample to 16 kHz (box-filter average: good enough as an anti-alias for this)
  const ratio = rate / RATE;
  const n = Math.floor(input.length / ratio);
  const x = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const a = Math.floor(i * ratio), b = Math.max(a + 1, Math.floor((i + 1) * ratio));
    let s = 0; for (let j = a; j < b && j < input.length; j++) s += input[j];
    x[i] = s / (b - a);
  }
  for (let i = n - 1; i > 0; i--) x[i] -= 0.97 * x[i - 1]; // pre-emphasis
  const frames: { start: number; rms: number }[] = [];
  for (let s = 0; s + WIN <= n; s += HOP) {
    let e = 0; for (let i = 0; i < WIN; i++) e += x[s + i] ** 2;
    frames.push({ start: s, rms: Math.sqrt(e / WIN) });
  }
  if (!frames.length) return null;
  const peak = Math.max(...frames.map((f) => f.rms));
  if (peak < 1e-4) return null;
  const first = frames.findIndex((f) => f.rms >= peak * 0.1);
  let last = frames.length - 1;
  while (last > first && frames[last].rms < peak * 0.1) last--;
  let loud = frames.slice(first, last + 1);
  if (loud.length < 3) return null;
  if (loud.length > MAX_FRAMES) { const step = loud.length / MAX_FRAMES; loud = Array.from({ length: MAX_FRAMES }, (_, i) => loud[Math.floor(i * step)]); }
  const bank = mel();
  const re = new Float64Array(NFFT), im = new Float64Array(NFFT);
  return loud.map(({ start }) => {
    re.fill(0); im.fill(0);
    for (let i = 0; i < WIN; i++) re[i] = x[start + i] * (0.54 - 0.46 * Math.cos((2 * Math.PI * i) / (WIN - 1)));
    fft(re, im);
    const logMel = bank.map((w) => { let s = 0; for (let k = 0; k <= NFFT / 2; k++) if (w[k]) s += w[k] * (re[k] * re[k] + im[k] * im[k]); return Math.log(s + 1e-10); });
    return Array.from({ length: CEPS }, (_, c) => { let s = 0; for (let m = 0; m < MELS; m++) s += logMel[m] * Math.cos((Math.PI * (c + 1) * (m + 0.5)) / MELS); return s; });
  });
}

/** Dynamic time warping distance, per step of the warp path (so long and short tries compare fairly). */
export function dtw(a: Feats, b: Feats): number {
  const n = a.length, m = b.length;
  let prev = new Float64Array(m + 1).fill(Infinity), cur = new Float64Array(m + 1);
  const len = (i: number, j: number) => i + j;
  prev[0] = 0;
  for (let i = 1; i <= n; i++) {
    cur.fill(Infinity);
    for (let j = 1; j <= m; j++) {
      let d = 0; const ai = a[i - 1], bj = b[j - 1];
      for (let k = 0; k < ai.length; k++) d += (ai[k] - bj[k]) ** 2;
      cur[j] = Math.sqrt(d) + Math.min(prev[j], cur[j - 1], prev[j - 1]);
    }
    [prev, cur] = [cur, prev];
  }
  return prev[m] / len(n, m);
}

const nearest = (f: Feats, exs: Feats[]) => Math.min(...exs.map((e) => dtw(f, e)));

/**
 * Is this try the target sound, judged against this child's own accepted tries?
 * - unsure until the target has MIN_EXAMPLES examples and at least two other sounds have some to compare with;
 * - match when the target's examples are clearly the closest;
 * - mismatch when another sound's examples are clearly closer, or the try is far from anything the child has said
 *   for this sound before (a cough, a word, the telly).
 */
export function judge(target: string, f: Feats, v: VoiceStore): Verdict {
  const mine = v.ex[target] ?? [];
  const others = Object.entries(v.ex).filter(([g, e]) => g !== target && e.length);
  if (mine.length < MIN_EXAMPLES || others.length < 2) return 'unsure';
  const dT = nearest(f, mine);
  const dO = Math.min(...others.map(([, e]) => nearest(f, e)));
  // How far apart the child's own accepted tries of this sound are: what "the same sound" looks like for them
  const pairs: number[] = [];
  for (let i = 0; i < mine.length; i++) for (let j = i + 1; j < mine.length; j++) pairs.push(dtw(mine[i], mine[j]));
  const spread = pairs.sort((x, y) => x - y)[Math.floor(pairs.length / 2)];
  if (dO < dT * 0.85 || dT > spread * 2.5) return 'mismatch';
  if (dT < dO * 0.9) return 'match';
  return 'unsure';
}
