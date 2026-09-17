import { PROMPTS, PromptId } from '../content/prompts';
import { GRAPHEME_BY_ID } from '../content/phonemes';
import { load } from '../engine/storage';

type Manifest = Record<string, string>;

let manifest: Manifest = {};
const recordings = new Map<string, string>(); // key -> object URL
let current: HTMLAudioElement | null = null;
let playing = false;
let finishCurrent: (() => void) | null = null;
let cancelToken = 0;

export const isPlaying = () => playing;

export async function initAudio() {
  try {
    const res = await fetch('/audio/manifest.json', { cache: 'no-cache' });
    if (res.ok) manifest = await res.json();
  } catch { /* offline: service worker has it */ }
  await refreshRecordings();
}

export async function refreshRecordings() {
  for (const url of recordings.values()) URL.revokeObjectURL(url);
  recordings.clear();
  for (const g of Object.keys(GRAPHEME_BY_ID)) {
    const blob = await load<Blob | null>(`rec:g:${g}`, null);
    if (blob) recordings.set(`phoneme:${g}`, URL.createObjectURL(blob));
  }
}

export const hasRecording = (g: string) => recordings.has(`phoneme:${g}`);
export const hasManifest = (key: string) => key in manifest;

/** Resolves true when the clip played, false if it couldn't load (e.g. offline). */
function playUrl(url: string, token: number): Promise<boolean> {
  return new Promise((resolve) => {
    if (token !== cancelToken) return resolve(true);
    const a = new Audio(url);
    current = a;
    playing = true;
    let settled = false;
    // Watchdog: a clip that stalls (network hiccup) or never reports "ended" must not freeze the activity.
    let watchdog = window.setTimeout(() => done(false)(), 12000);
    a.onloadedmetadata = () => { clearTimeout(watchdog); watchdog = window.setTimeout(() => done(true)(), (a.duration || 10) * 1000 + 1500); };
    const done = (ok: boolean) => () => { if (settled) return; settled = true; clearTimeout(watchdog); if (current === a) { playing = false; finishCurrent = null; } resolve(ok); };
    finishCurrent = done(true);
    a.onended = done(true);
    a.onerror = done(false);
    a.play().catch((e: Error) => done(e?.name === 'NotAllowedError')());
  });
}

export function stop() {
  cancelToken++;
  if (current) { current.pause(); current = null; }
  finishCurrent?.(); // let the interrupted say() finish right away
  finishCurrent = null;
  playing = false;
}

/**
 * Everything is spoken in the ElevenLabs voice, never the device voice:
 * the grown-up's recording → a pre-made clip → the same voice generated once on the server (worker/index.ts,
 * cached on the device afterwards, see vite.config.ts). Offline with nothing cached: silence.
 */
async function playKey(key: string, text: string, token: number) {
  const url = recordings.get(key) ?? (manifest[key] ? `/audio/${manifest[key]}` : undefined);
  if (url && await playUrl(url, token)) return;
  if (!key.startsWith('phoneme:')) await playUrl(`/api/say?text=${encodeURIComponent(text)}`, token);
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

export type Utter =
  | { p: PromptId }
  | { g: string }            // phoneme
  | { w: string }            // word
  | { key: string; text: string }  // any other clip in the manifest (e.g. split:sunflower)
  | { pause: number };

/** Speak a sequence; a new call cancels the previous one. */
export async function say(...parts: Utter[]) {
  stop();
  const token = cancelToken;
  for (const part of parts) {
    if (token !== cancelToken) return;
    if ('p' in part) await playKey(`prompt:${part.p}`, PROMPTS[part.p], token);
    else if ('g' in part) await playKey(`phoneme:${part.g}`, GRAPHEME_BY_ID[part.g]?.tts ?? part.g, token);
    else if ('w' in part) await playKey(`word:${part.w.toLowerCase()}`, part.w, token);
    else if ('key' in part) await playKey(part.key, part.text, token);
    else await wait(part.pause);
  }
}

/** Oral blending: sounds with gaps, e.g. /f/ … /a/ … /n/ */
export async function saySegmented(graphemes: string[], gapMs = 180) {
  const parts: Utter[] = [];
  graphemes.forEach((g, i) => { if (i) parts.push({ pause: gapMs }); parts.push({ g }); });
  return say(...parts);
}

const YES: PromptId[] = ['yes_1', 'yes_2', 'yes_3'];
export const sayYes = () => say({ p: YES[Math.floor(Math.random() * YES.length)] });
