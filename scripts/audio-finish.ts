/**
 * Letter-sound clean-up (macOS: uses afconvert): decode to 22 kHz mono, trim leading silence,
 * fade in/out so clips don't click or cut off, and add a short silent tail.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, rmSync, writeFileSync } from 'node:fs';

/** cutAtGap: keep only the part before the first silence (e.g. the vowel of "it", dropping the t). */
export function finishClip(mp3: string, wavOut: string, cutAtGap = false) {
  const tmp = `${wavOut}.raw.wav`;
  execFileSync('afconvert', ['-f', 'WAVE', '-d', 'LEI16@22050', '-c', '1', mp3, tmp]);
  const buf = readFileSync(tmp);
  rmSync(tmp);
  const dataAt = buf.indexOf('data') + 8;
  const rate = 22050;
  const pcm = new Int16Array(buf.buffer.slice(buf.byteOffset + dataAt, buf.byteOffset + buf.length - ((buf.length - dataAt) % 2)));
  let peak = 0;
  for (const v of pcm) peak = Math.max(peak, Math.abs(v));
  let start = pcm.findIndex((v) => Math.abs(v) > peak * 0.04);
  start = Math.max(0, start - Math.round(rate * 0.02));
  let end = pcm.length;
  if (cutAtGap) {
    const win = Math.round(rate * 0.01);
    let quiet = 0, voiced = false;
    for (let i = start; i + win < pcm.length; i += win) {
      let e = 0;
      for (let j = i; j < i + win; j++) e = Math.max(e, Math.abs(pcm[j]));
      if (e > peak * 0.15) { voiced = true; quiet = 0; } else if (voiced && ++quiet >= 3) { end = i - (quiet - 1) * win; break; }
    }
  }
  const body = Float32Array.from(pcm.slice(start, end), (v) => v / 32768);
  const fadeIn = Math.round(rate * 0.01), fadeOut = Math.min(body.length, Math.round(rate * 0.12));
  for (let i = 0; i < fadeIn; i++) body[i] *= i / fadeIn;
  for (let i = 0; i < fadeOut; i++) body[body.length - 1 - i] *= Math.sin((i / fadeOut) * Math.PI / 2);
  const out = new Float32Array(body.length + Math.round(rate * 0.2));
  out.set(body);
  const data = Buffer.alloc(out.length * 2);
  out.forEach((s, i) => data.writeInt16LE(Math.round(Math.max(-1, Math.min(1, s)) * 32767), i * 2));
  const h = Buffer.alloc(44);
  h.write('RIFF', 0); h.writeUInt32LE(36 + data.length, 4); h.write('WAVE', 8); h.write('fmt ', 12);
  h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22); h.writeUInt32LE(rate, 24);
  h.writeUInt32LE(rate * 2, 28); h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34); h.write('data', 36); h.writeUInt32LE(data.length, 40);
  writeFileSync(wavOut, Buffer.concat([h, data]));
}
