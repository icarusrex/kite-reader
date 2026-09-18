/**
 * The grown-up's letter-sound recordings as references for the sound check: this device's recordings first,
 * else the built-in ones. Features + a loudness envelope (for the comparison picture), loaded once.
 */
import { SOUNDS as GRAPHEMES } from '../content/phonemes';
import { load } from '../../../core/storage';
import { SoundFeatures, extract } from './soundCheck';

export interface Reference { features: SoundFeatures; envelope: number[] }

let cache: Promise<Record<string, Reference>> | null = null;

/** Loudness per 20 ms of the loud part, 0–1. */
export function envelope(samples: Float32Array, rate: number): number[] {
  const hop = Math.round(rate * 0.02);
  const env: number[] = [];
  for (let s = 0; s + hop <= samples.length; s += hop) {
    let sum = 0;
    for (let i = 0; i < hop; i++) sum += samples[s + i] ** 2;
    env.push(Math.sqrt(sum / hop));
  }
  const peak = Math.max(1e-6, ...env);
  const norm = env.map((v) => v / peak);
  const first = norm.findIndex((v) => v > 0.1);
  let last = norm.length - 1;
  while (last > 0 && norm[last] <= 0.1) last--;
  return first < 0 ? [] : norm.slice(first, last + 1);
}

export function loadReferences(): Promise<Record<string, Reference>> {
  cache ??= (async () => {
    const ctx = new AudioContext();
    const manifest: Record<string, string> = await fetch('/audio/manifest.json').then((r) => r.json()).catch(() => ({}));
    const out: Record<string, Reference> = {};
    for (const g of GRAPHEMES) {
      try {
        const blob = await load<Blob | null>(`rec:g:${g.id}`, null);
        const bytes = blob ? await blob.arrayBuffer() : manifest[`phoneme:${g.id}`] ? await fetch(`/audio/${manifest[`phoneme:${g.id}`]}`).then((r) => r.arrayBuffer()) : null;
        if (!bytes) continue;
        const audio = await ctx.decodeAudioData(bytes);
        const samples = audio.getChannelData(0);
        const features = extract(samples, audio.sampleRate);
        if (features) out[g.id] = { features, envelope: envelope(samples, audio.sampleRate) };
      } catch { /* skip this sound */ }
    }
    ctx.close();
    return out;
  })();
  return cache;
}

/** Recordings changed (Grown-ups → Sounds): reload next time. */
export function resetReferences() { cache = null; }
