/**
 * Worker in front of the static app (behind Cloudflare Access). One API:
 *   GET /api/say?text=honey  → Liam's voice (ElevenLabs), generated once and cached in KV.
 * Used for words in books and read-aloud chapters that have no pre-generated clip.
 * Secret: ELEVENLABS_API_KEY (`npx wrangler secret put ELEVENLABS_API_KEY`).
 */
interface Env {
  ASSETS: { fetch(req: Request): Promise<Response> };
  SAY_CACHE: {
    get(key: string, type: 'arrayBuffer'): Promise<ArrayBuffer | null>;
    put(key: string, value: ArrayBuffer): Promise<void>;
  };
  ELEVENLABS_API_KEY: string;
}

import { withPronunciation } from '../src/modules/reading/content/pronounce';

// Same voice and model as scripts/gen-audio.ts
const VOICE = 'TX3LPaxmHKxFdv7VOQHJ';
const MODEL = 'eleven_v3';

const audio = (body: ArrayBuffer, hit: boolean) => new Response(body, {
  headers: { 'Content-Type': 'audio/mpeg', 'Cache-Control': 'private, max-age=31536000, immutable', 'X-Say-Cache': hit ? 'hit' : 'miss' },
});

async function say(req: Request, env: Env): Promise<Response> {
  const raw = new URL(req.url).searchParams.get('text') ?? '';
  const text = raw.replace(/[’‘]/g, "'").replace(/\s+/g, ' ').trim();
  // Words and short phrases only (letters, spaces, basic punctuation)
  if (!text || text.length > 200 || !/^[A-Za-z0-9][A-Za-z0-9 '"().,!?;:-]*$/.test(text)) return new Response('bad text', { status: 400 });
  const plain = /[.!?]$/.test(text) ? text : `${text}.`;
  // Homographs said on their own (wind, tears, live) are respelled so they're said in the books' sense
  const spoken = withPronunciation(plain);
  const key = `${VOICE}:${MODEL}:${spoken.toLowerCase()}`;
  const cached = await env.SAY_CACHE.get(key, 'arrayBuffer');
  if (cached) return audio(cached, true);
  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${VOICE}?output_format=mp3_44100_128`, {
    method: 'POST',
    headers: { 'xi-api-key': env.ELEVENLABS_API_KEY, 'Content-Type': 'application/json', Accept: 'audio/mpeg' },
    body: JSON.stringify({ text: spoken, model_id: MODEL, voice_settings: { stability: 0.5, similarity_boost: 0.8 } }),
  });
  if (!res.ok) return new Response(`tts ${res.status}`, { status: 502 });
  const body = await res.arrayBuffer();
  await env.SAY_CACHE.put(key, body);
  return audio(body, false);
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    if (new URL(req.url).pathname === '/api/say') return say(req, env);
    return env.ASSETS.fetch(req);
  },
};
