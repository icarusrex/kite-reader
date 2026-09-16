/**
 * Package this device's pure-sound recordings for the app build: each clip is decoded, trimmed of
 * leading/trailing silence and encoded as 22 kHz mono WAV. `npm run sounds -- <file>` bakes them into
 * public/audio/phonemes so every device gets them and a browser wipe can't lose them.
 */
import { GRAPHEMES } from '../content/phonemes';
import { load } from '../engine/storage';

const RATE = 22050;

function trim(data: Float32Array, rate: number) {
  let peak = 0;
  for (const v of data) peak = Math.max(peak, Math.abs(v));
  const gate = peak * 0.06;
  const pad = Math.round(rate * 0.03);
  let a = data.findIndex((v) => Math.abs(v) > gate);
  let b = data.length - 1;
  while (b > 0 && Math.abs(data[b]) <= gate) b--;
  if (a < 0) return data;
  a = Math.max(0, a - pad); b = Math.min(data.length, b + pad);
  const out = data.slice(a, b);
  const fade = Math.min(out.length, Math.round(rate * 0.01));
  for (let i = 0; i < fade; i++) { out[i] *= i / fade; out[out.length - 1 - i] *= i / fade; }
  return out;
}

function wav(samples: Float32Array, rate: number): Uint8Array {
  const buf = new ArrayBuffer(44 + samples.length * 2);
  const v = new DataView(buf);
  const str = (o: number, s: string) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
  str(0, 'RIFF'); v.setUint32(4, 36 + samples.length * 2, true); str(8, 'WAVE');
  str(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, rate, true); v.setUint32(28, rate * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true);
  str(36, 'data'); v.setUint32(40, samples.length * 2, true);
  samples.forEach((s, i) => v.setInt16(44 + i * 2, Math.max(-1, Math.min(1, s)) * 0x7fff, true));
  return new Uint8Array(buf);
}

export async function exportSounds(): Promise<number> {
  const out: Record<string, string> = {};
  for (const g of GRAPHEMES) {
    const blob = await load<Blob | null>(`rec:g:${g.id}`, null);
    if (!blob) continue;
    const decoded = await new AudioContext().decodeAudioData(await blob.arrayBuffer());
    const offline = new OfflineAudioContext(1, Math.ceil(decoded.duration * RATE), RATE);
    const src = offline.createBufferSource();
    src.buffer = decoded; src.connect(offline.destination); src.start();
    const mono = (await offline.startRendering()).getChannelData(0);
    const bytes = wav(trim(mono, RATE), RATE);
    let bin = '';
    bytes.forEach((b) => { bin += String.fromCharCode(b); });
    out[g.id] = btoa(bin);
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([JSON.stringify(out)], { type: 'application/json' }));
  a.download = 'kite-sounds.json';
  a.click();
  return Object.keys(out).length;
}
