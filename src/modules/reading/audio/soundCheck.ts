/**
 * Loose check that a spoken letter sound is the right *kind* of sound. No speech recognition: it measures what the
 * mic can reliably tell apart in a child's voice (hiss vs hum vs open vowel vs short burst) and compares with the
 * grown-up's recordings of all the sounds. Pure functions: used in the browser and in scripts/eval-soundcheck.ts.
 */

export interface SoundFeatures {
  voicedMs: number;     // how long the sound lasts
  periodicity: number;  // 0 noise … 1 clear pitch (hummed/voiced)
  zcr: number;          // zero crossings per sample (hiss is high)
  centroid: number;     // spectral centre of mass, Hz
  bands: [number, number, number, number]; // energy share: <400 Hz, 400–1500, 1500–4000, >4000
}

const FRAME = 1024;

function fft(re: Float64Array, im: Float64Array) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) { [re[i], re[j]] = [re[j], re[i]]; [im[i], im[j]] = [im[j], im[i]]; }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len, wr = Math.cos(ang), wi = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let cr = 1, ci = 0;
      for (let j = 0; j < len / 2; j++) {
        const ur = re[i + j], ui = im[i + j];
        const vr = re[i + j + len / 2] * cr - im[i + j + len / 2] * ci;
        const vi = re[i + j + len / 2] * ci + im[i + j + len / 2] * cr;
        re[i + j] = ur + vr; im[i + j] = ui + vi;
        re[i + j + len / 2] = ur - vr; im[i + j + len / 2] = ui - vi;
        const nr = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = nr;
      }
    }
  }
}

/** Features of the loud part of a clip (frames within 15% of the loudest). */
export function extract(input: Float32Array, rate: number): SoundFeatures | null {
  // High-pass ~150 Hz: room rumble and mic hum otherwise make a hiss look pitched
  const samples = new Float32Array(input.length);
  const rc = 1 / (2 * Math.PI * 150), dt = 1 / rate, alpha = rc / (rc + dt);
  for (let i = 1; i < input.length; i++) samples[i] = alpha * (samples[i - 1] + input[i] - input[i - 1]);
  const hop = FRAME / 2;
  const frames: { start: number; rms: number }[] = [];
  for (let s = 0; s + FRAME <= samples.length; s += hop) {
    let sum = 0;
    for (let i = 0; i < FRAME; i++) sum += samples[s + i] ** 2;
    frames.push({ start: s, rms: Math.sqrt(sum / FRAME) });
  }
  if (!frames.length) return null;
  const peak = Math.max(...frames.map((f) => f.rms));
  if (peak < 1e-4) return null;
  const loud = frames.filter((f) => f.rms >= peak * 0.15);
  let zcr = 0, periodicity = 0, centroid = 0;
  const bands = [0, 0, 0, 0];
  const re = new Float64Array(FRAME), im = new Float64Array(FRAME);
  const minLag = Math.floor(rate / 600), maxLag = Math.min(FRAME - 1, Math.ceil(rate / 70));
  for (const f of loud) {
    const x = samples.subarray(f.start, f.start + FRAME);
    let z = 0;
    for (let i = 1; i < FRAME; i++) if ((x[i] >= 0) !== (x[i - 1] >= 0)) z++;
    zcr += z / FRAME;
    // normalised autocorrelation peak in the pitch range
    let e0 = 0;
    for (let i = 0; i < FRAME; i++) e0 += x[i] * x[i];
    let best = 0;
    for (let lag = minLag; lag <= maxLag; lag++) {
      let c = 0;
      for (let i = 0; i + lag < FRAME; i++) c += x[i] * x[i + lag];
      best = Math.max(best, c / (e0 || 1));
    }
    periodicity += best;
    for (let i = 0; i < FRAME; i++) { re[i] = x[i] * (0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (FRAME - 1))); im[i] = 0; }
    fft(re, im);
    let tot = 0, wsum = 0;
    const b = [0, 0, 0, 0];
    for (let k = 1; k < FRAME / 2; k++) {
      const hz = (k * rate) / FRAME;
      const p = re[k] * re[k] + im[k] * im[k];
      tot += p; wsum += p * hz;
      b[hz < 400 ? 0 : hz < 1500 ? 1 : hz < 4000 ? 2 : 3] += p;
    }
    centroid += wsum / (tot || 1);
    for (let i = 0; i < 4; i++) bands[i] += b[i] / (tot || 1);
  }
  const n = loud.length;
  return {
    voicedMs: (n * hop * 1000) / rate,
    periodicity: periodicity / n,
    zcr: zcr / n,
    centroid: centroid / n,
    bands: bands.map((v) => v / n) as SoundFeatures['bands'],
  };
}

/** Broad kind of sound, robust across voices. */
export type SoundKind = 'hiss' | 'hum' | 'open' | 'burst';
export function kindOf(f: SoundFeatures): SoundKind {
  if (f.voicedMs < 140) return 'burst';
  if (f.zcr >= 0.17 || f.bands[3] >= 0.35) return 'hiss';
  if (f.zcr < 0.07 && f.bands[0] >= 0.7) return 'hum';
  return 'open';
}

/** Stop sounds (t, p, k…) are too short and varied to judge from a child's voice: any real sound counts. */
const STOPS = new Set(['t', 'p', 'k', 'c', 'd', 'g', 'b', 'j']);

function distance(a: SoundFeatures, b: SoundFeatures) {
  return Math.hypot(
    (Math.log(a.voicedMs + 50) - Math.log(b.voicedMs + 50)) * 0.8,
    (a.periodicity - b.periodicity) * 2,
    (a.zcr - b.zcr) * 6,
    (a.centroid - b.centroid) / 1500,
    ...a.bands.map((v, i) => (v - b.bands[i]) * 2.5),
  );
}

/** Reference sounds ranked by closeness to the child's sound. */
export function rank(child: SoundFeatures, refs: Record<string, SoundFeatures>) {
  return Object.entries(refs).map(([g, f]) => ({ g, d: distance(child, f) })).sort((x, y) => x.d - y.d).map((x) => x.g);
}

/**
 * Loose verdict. The expected kind comes from the grown-up's own recording of that sound (so it matches how the child
 * was taught it). Accept when the child's sound is that kind, or the target is among the 3 closest recordings;
 * reject only when both say it's clearly something else.
 */
export function acceptSound(target: string, child: SoundFeatures, refs: Record<string, SoundFeatures>, topK = 3): boolean {
  if (STOPS.has(target) || !refs[target]) return true;
  if (kindOf(child) === kindOf(refs[target])) return true;
  return rank(child, refs).slice(0, topK).includes(target);
}
