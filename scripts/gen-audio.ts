/**
 * Generate instruction + word audio with ElevenLabs.
 *   ELEVENLABS_API_KEY=... ELEVENLABS_VOICE_ID=... npm run audio
 * Options: --force (regenerate all), --only=prompts|words|phonemes
 * Writes public/audio/{prompts,words,phonemes}/*.mp3 and public/audio/manifest.json.
 * Commit the mp3s: the app works offline and needs no API key at runtime.
 *
 * Phonemes are OFF by default: TTS tends to add a schwa ("muh"). Record pure sounds in
 * Parent > Sounds instead, or pass --only=phonemes to try and then listen critically.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { PROMPTS } from '../src/content/prompts';
import { LEVELS } from '../src/content/levels';
import { GRAPHEMES } from '../src/content/phonemes';
import { PICTURES } from '../src/content/pictures';

const KEY = process.env.ELEVENLABS_API_KEY;
const VOICE = process.env.ELEVENLABS_VOICE_ID ?? 'XrExE9yKIg1WjnnlVkGX'; // replace with a warm, slow voice you like
const MODEL = process.env.ELEVENLABS_MODEL ?? 'eleven_multilingual_v2';
const force = process.argv.includes('--force');
const only = process.argv.find((a) => a.startsWith('--only='))?.split('=')[1];

if (!KEY) { console.error('Set ELEVENLABS_API_KEY'); process.exit(1); }

const OUT = 'public/audio';
const manifestPath = join(OUT, 'manifest.json');
const manifest: Record<string, string> = existsSync(manifestPath) ? JSON.parse(readFileSync(manifestPath, 'utf8')) : {};

async function tts(text: string, file: string, settings = { stability: 0.6, similarity_boost: 0.8, style: 0.15, speed: 0.9 }, attempt = 0): Promise<void> {
  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${VOICE}?output_format=mp3_44100_128`, {
    method: 'POST',
    headers: { 'xi-api-key': KEY!, 'Content-Type': 'application/json', Accept: 'audio/mpeg' },
    body: JSON.stringify({ text, model_id: MODEL, voice_settings: settings }),
  });
  if (res.status === 429 && attempt < 8) {
    // Free tier gets "system_busy" under load; back off and retry.
    await new Promise((r) => setTimeout(r, 2000 * 2 ** attempt));
    return tts(text, file, settings, attempt + 1);
  }
  if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
  writeFileSync(file, Buffer.from(await res.arrayBuffer()));
}

async function job(key: string, dir: string, name: string, text: string) {
  const rel = `${dir}/${name}.mp3`;
  const abs = join(OUT, rel);
  if (!force && manifest[key] && existsSync(abs)) return;
  mkdirSync(join(OUT, dir), { recursive: true });
  process.stdout.write(`${key} … `);
  await tts(text, abs);
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
  if (only === 'phonemes') for (const g of GRAPHEMES) await job(`phoneme:${g.id}`, 'phonemes', g.id, g.tts);
  console.log(`manifest: ${Object.keys(manifest).length} entries`);
})().catch((e) => { console.error(e); process.exit(1); });
