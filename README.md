# Kite Reader

A private, home-built early-reading tutor (Mentava-style systematic phonics, Direct Instruction delivery) for one 4-year-old. Offline-capable PWA for iPad.

Curriculum spec: `Curriculum v1.md` in the Obsidian vault (`04-personal/Mentava Clone`).

## Status — v0.1

- Readiness check (dogfish/fishdog directionality + oral blending)
- Levels 1–10: a, m, s, t, review, f, d, g, i, n
- Activities: Ear Game (oral PA), Sound Reveal, Hear & Tap, See & Say, Hold It, Glide Blend + Say It Fast, Alien Names, Read & Match, Which Word, Build It, Sentence Read, Story-time prompt
- Mastery engine: in-session re-injection of misses, Leitner spaced review, 10-item level checkout + next-day cold check, fatigue stop, active-time session cap
- Neutral error correction (My turn → Your turn), no points/streaks/currency
- Grown-ups area (press and hold 🔒 top-left 1.5 s): progress, trouble spots, **record pure sounds**, book decodability check, settings, backup/export

## Run locally

```bash
npm install
npm run dev          # http://localhost:5173 (mic works on localhost)
npm test             # unit tests (decoder, spaced repetition)
npm run validate     # every word/sentence decodable at its level
npm run build && npm run preview
node tests/smoke.mjs # end-to-end session with simulated voice (needs preview on :4173)
```

On the iPad: open the deployed HTTPS URL in Safari → Share → **Add to Home Screen** (fullscreen, offline, storage less likely to be evicted).

## Audio

Priority per sound: **your recording** (Grown-ups → Sounds) → generated mp3 in `public/audio` → device TTS.

- Pure letter sounds: record them in the app (≈10 min). TTS voices add a schwa ("muh"), which breaks blending.
- Instructions and words: ElevenLabs, generated once and committed:

```bash
ELEVENLABS_API_KEY=... ELEVENLABS_VOICE_ID=... npm run audio
git add public/audio && git commit -m "audio" && git push
```

No API keys are used at runtime.

## Deploy

### Cloudflare Pages (now)
1. Cloudflare dashboard → Workers & Pages → Create → Pages → Connect to Git → this repo.
2. Framework: Vite · Build command `npm run build` · Output `dist`.
3. Optional privacy: Zero Trust → Access → Applications → add the `*.pages.dev` domain, policy = your email (one-time PIN).

Every push to `main` redeploys.

### Home server (later)
```bash
docker compose up -d --build   # serves on :8080
```
Put it behind Cloudflare Tunnel or Tailscale for HTTPS (the mic requires HTTPS).

## Adding levels

1. Add graphemes to `src/content/phonemes.ts`, a level to `src/content/levels.ts`.
2. `npm run validate` must pass. Add pictures to `src/content/pictures.ts` where useful.
3. `npm run audio` for new words.

## Roadmap
- v0.2: real-device tuning on iPad (mic thresholds, timings), decodable mini-stories per level, story-time polish
- v0.3: Levels 11–20, parent weekly summary, recordings backup
- v0.4: Levels 21–50 (digraphs, clusters, heart words), fluency timing
- Math strand M0 (separate session)
