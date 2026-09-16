/**
 * Generate instruction + word audio with ElevenLabs.
 *   ELEVENLABS_API_KEY=... ELEVENLABS_VOICE_ID=... npm run audio
 * Options: --force (regenerate all), --only=prompts|words|phonemes
 * Writes public/audio/{prompts,words,phonemes}/*.mp3 and public/audio/manifest.json.
 * Commit the mp3s: the app works offline and needs no API key at runtime.
 *
 * Phonemes use IPA phoneme tags (see PHONEME_MODEL) so there's no schwa ("muh"). A grown-up's recording
 * (Parent > Sounds) still overrides any sound that isn't right.
 */
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { finishClip } from './audio-finish';
import { join } from 'node:path';
import { PROMPTS } from '../src/content/prompts';
import { LEVELS } from '../src/content/levels';
import { GRAPHEMES } from '../src/content/phonemes';
import { PICTURES } from '../src/content/pictures';

const KEY = process.env.ELEVENLABS_API_KEY;
// Liam (energetic young American man), chosen by ear on 2026-09-16 over Matilda, Jessica, Sarah, Will and Chris.
const VOICE = process.env.ELEVENLABS_VOICE_ID || 'TX3LPaxmHKxFdv7VOQHJ';
const MODEL = process.env.ELEVENLABS_MODEL || 'eleven_v3';
// Letter sounds: eleven_v3 turns spellings like "sss" or "t" into silence, but the flash model follows IPA phoneme
// tags exactly, which gives a pure sound with no "uh" after it.
const PHONEME_MODEL = 'eleven_flash_v2';
// Per-sound overrides. i: the parent chose "aye" (2026-09-16, over "eye" and a short i cut from "it") because no generated short /ɪ/
// sounded right. To switch to the short i ("it" cut before the t), set i: 'it' and pass cutAtGap for it in job().
const PHONEME_TEXT: Record<string, string> = { i: 'aye' };
const force = process.argv.includes('--force');
const only = process.argv.find((a) => a.startsWith('--only='))?.split('=')[1];

if (!KEY) { console.error('Set ELEVENLABS_API_KEY'); process.exit(1); }

const OUT = 'public/audio';
const manifestPath = join(OUT, 'manifest.json');
const manifest: Record<string, string> = existsSync(manifestPath) ? JSON.parse(readFileSync(manifestPath, 'utf8')) : {};

async function tts(text: string, file: string, model = MODEL, attempt = 0): Promise<void> {
  // eleven_v3 only accepts stability 0 / 0.5 / 1; 0.5 ("natural") suits short classroom lines.
  // Letter sounds use the slowest speed so a 4-year-old hears them clearly.
  const settings = model === 'eleven_v3' ? { stability: 0.5, similarity_boost: 0.8 } : { stability: 0.6, similarity_boost: 0.8, speed: model === PHONEME_MODEL ? 0.7 : 0.9 };
  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${VOICE}?output_format=mp3_44100_128`, {
    method: 'POST',
    headers: { 'xi-api-key': KEY!, 'Content-Type': 'application/json', Accept: 'audio/mpeg' },
    body: JSON.stringify({ text, model_id: model, voice_settings: settings }),
  });
  if (res.status === 429 && attempt < 8) {
    // Free tier gets "system_busy" under load; back off and retry.
    await new Promise((r) => setTimeout(r, 2000 * 2 ** attempt));
    return tts(text, file, model, attempt + 1);
  }
  if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
  writeFileSync(file, Buffer.from(await res.arrayBuffer()));
}

async function job(key: string, dir: string, name: string, text: string, model = MODEL) {
  // Letter sounds are cleaned up into WAV (slowed at generation, faded so they don't cut off).
  const finish = model === PHONEME_MODEL;
  const rel = `${dir}/${name}.${finish ? 'wav' : 'mp3'}`;
  const abs = join(OUT, rel);
  if (!force && manifest[key] && existsSync(abs)) return;
  mkdirSync(join(OUT, dir), { recursive: true });
  process.stdout.write(`${key} … `);
  if (finish) {
    const mp3 = abs.replace(/\.wav$/, '.mp3');
    await tts(text, mp3, model);
    finishClip(mp3, abs);
    rmSync(mp3);
  } else await tts(text, abs, model);
  manifest[key] = rel;
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  console.log('ok');
}

const words = new Set<string>();
for (const l of LEVELS) {
  [...l.words, ...l.nonsense, ...l.heartWords, ...(l.pairs?.flat() ?? [])].forEach((w) => words.add(w.toLowerCase()));
  [...l.sentences, ...(l.story ?? [])].forEach((s) => s.split(/\s+/).forEach((w) => words.add(w.replace(/[^A-Za-z]/g, '').toLowerCase())));
}
Object.keys(PICTURES).forEach((w) => words.add(w));
// onset-rime pieces used by the ear game
Object.keys(PICTURES).forEach((w) => words.add(w.slice(1)));
['dogfish', 'fishdog'].forEach((w) => words.add(w));

(async () => {
  if (!only || only === 'prompts') for (const [id, text] of Object.entries(PROMPTS)) await job(`prompt:${id}`, 'prompts', id, text);
  if (!only || only === 'words') for (const w of [...words].filter(Boolean).sort()) await job(`word:${w}`, 'words', w, `${w}.`);
  // Continuous sounds are held (mː = "mmm"); stop sounds stay short.
  if (!only || only === 'phonemes') for (const g of GRAPHEMES) await job(`phoneme:${g.id}`, 'phonemes', g.id, PHONEME_TEXT[g.id] ?? `<phoneme alphabet="ipa" ph="${g.ipa}${g.continuous ? 'ːː' : ''}">${g.id}</phoneme>`, PHONEME_MODEL);
  console.log(`manifest: ${Object.keys(manifest).length} entries`);
})().catch((e) => { console.error(e); process.exit(1); });
