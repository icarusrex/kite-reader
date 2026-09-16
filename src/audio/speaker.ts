import { PROMPTS, PromptId } from '../content/prompts';
import { GRAPHEME_BY_ID } from '../content/phonemes';
import { load } from '../engine/storage';

type Manifest = Record<string, string>;

let manifest: Manifest = {};
const recordings = new Map<string, string>(); // key -> object URL
let current: HTMLAudioElement | null = null;
let playing = false;
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

function playUrl(url: string, token: number): Promise<void> {
  return new Promise((resolve) => {
    if (token !== cancelToken) return resolve();
    const a = new Audio(url);
    current = a;
    playing = true;
    const done = () => { playing = false; resolve(); };
    a.onended = done;
    a.onerror = done;
    a.play().catch(done);
  });
}

let voice: SpeechSynthesisVoice | null = null;
function pickVoice() {
  if (voice || typeof speechSynthesis === 'undefined') return voice;
  const vs = speechSynthesis.getVoices();
  voice = vs.find((v) => /en-(GB|US)/.test(v.lang) && /Samantha|Daniel|Karen|Google/.test(v.name)) ?? vs.find((v) => v.lang.startsWith('en')) ?? null;
  return voice;
}

function speakTts(text: string, token: number, rate = 0.9): Promise<void> {
  return new Promise((resolve) => {
    if (token !== cancelToken || typeof speechSynthesis === 'undefined') return resolve();
    const u = new SpeechSynthesisUtterance(text);
    const v = pickVoice();
    if (v) u.voice = v;
    u.lang = v?.lang ?? 'en-US';
    u.rate = rate;
    playing = true;
    const done = () => { playing = false; resolve(); };
    u.onend = done;
    u.onerror = done;
    speechSynthesis.speak(u);
    setTimeout(done, 6000); // safety for iOS
  });
}

export function stop() {
  cancelToken++;
  if (current) { current.pause(); current = null; }
  try { speechSynthesis.cancel(); } catch { /* ignore */ }
  playing = false;
}

async function playKey(key: string, fallback: string, token: number, rate?: number) {
  const url = recordings.get(key) ?? (manifest[key] ? `/audio/${manifest[key]}` : undefined);
  if (url) return playUrl(url, token);
  return speakTts(fallback, token, rate);
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

export type Utter =
  | { p: PromptId }
  | { g: string }            // phoneme
  | { w: string }            // word
  | { pause: number };

/** Speak a sequence; a new call cancels the previous one. */
export async function say(...parts: Utter[]) {
  stop();
  const token = cancelToken;
  for (const part of parts) {
    if (token !== cancelToken) return;
    if ('p' in part) await playKey(`prompt:${part.p}`, PROMPTS[part.p], token);
    else if ('g' in part) await playKey(`phoneme:${part.g}`, GRAPHEME_BY_ID[part.g]?.tts ?? part.g, token, 0.7);
    else if ('w' in part) await playKey(`word:${part.w.toLowerCase()}`, part.w, token, 0.85);
    else await wait(part.pause);
  }
}

/** Oral blending: sounds with gaps, e.g. /f/ … /a/ … /n/ */
export async function saySegmented(graphemes: string[], gapMs = 450) {
  const parts: Utter[] = [];
  graphemes.forEach((g, i) => { if (i) parts.push({ pause: gapMs }); parts.push({ g }); });
  return say(...parts);
}

const YES: PromptId[] = ['yes_1', 'yes_2', 'yes_3'];
export const sayYes = () => say({ p: YES[Math.floor(Math.random() * YES.length)] });
