# Kite Reader

A private, home-built early-reading tutor (Mentava-style systematic phonics, Direct Instruction delivery) for one 4-year-old. Private web app behind Cloudflare Access; works offline once loaded.

Curriculum spec: `Curriculum v1.md` in the Obsidian vault (`04-personal/Mentava Clone`).

## Status — v0.2

- Readiness check (dogfish/fishdog directionality + oral blending, using only unambiguous pictures)
- Levels 1–20 (Stage 1): a, m, s, t, review, f, d, g, i, n, p, h, b, l, j, c, v, w, r, k
- Activities: Ear Game (rhyme, onset-rime, blending, first and final sound), Sound Reveal, Hear & Tap (+ confusable pairs b/d, f/v, r/w), See & Say, Hold It, Glide Blend + Say It Fast, Alien Names, Read & Match, Which Word, Build It, Sentence Read, **Story** (levels 5–20), Heart Word (modelled first, then read cold; tricky part marked)
- Watercolour illustrations for every picture word and story (`npm run pictures`, Gemini with approved character sheets)
- Themed stories remixed from public-domain characters: Pooh and Pig (Winnie-the-Pooh), Tin Man (Oz). Vocabulary cues from *Teach Your Child to Read in 100 Easy Lessons*; no text copied.
- Mastery engine: in-session re-injection of misses, Leitner spaced review, 10-item level checkout + next-day cold check, fatigue stop, active-time session cap, level-complete celebration
- DI error correction: My turn → Together → Your turn. No points/streaks/currency
- Grown-ups area (press and hold 🔒 top-left 1.5 s): progress, trouble spots, record pure sounds and **export them into the app** (`npm run sounds`), books, settings, backup/import
- Content validator checks letters taught **and** patterns taught (clusters, -s, heart words) via `wordLevel.ts`

**Manual steps for the grown-up: see `MANUAL-TASKS.md`.**

## Books

Public-domain read-aloud books from the family library live in `src/content/readaloud/` (text only, lazy-loaded):

- *The Wonderful Wizard of Oz* (Baum, 1900): 24 chapters. Source ebook was an OCR scan; auto-corrected, and a few typos may remain. Swap in a clean copy (e.g. Project Gutenberg #55) and re-run the extraction if needed.
- *Winnie-the-Pooh* (Milne, 1926): introduction + 10 chapters. Public domain in the US; in the EU/Portugal from 1 Jan 2027.

What they power:
- **Story chair** (📚 on home): grown-up reads aloud; words the child can already decode are highlighted, 3 vocabulary words per chapter, discussion prompts, chapters-read log.
- **Real-book sentences** in sessions once decodable (`npm run mine` → `src/content/bookSentences.json`).
- **Readability** per level in Grown-ups → Books.

`src/engine/wordLevel.ts` estimates the curriculum level (1–120) for any English word; `src/content/common-words.txt` enables compound splitting in scripts.

## Run locally

```bash
npm install
npm run dev          # http://127.0.0.1:5173 (mic works on localhost)
npm test             # unit tests (decoder, spaced repetition)
npm run validate     # every word/sentence decodable at its level
npm run build && npm run preview
node tests/smoke.mjs # end-to-end session with simulated voice (needs preview on :4173)
```


## Audio

Priority per sound: **your recording** (Grown-ups → Sounds) → generated mp3 in `public/audio` → device TTS.

- Pure letter sounds: record them in the app (≈10 min). TTS voices add a schwa ("muh"), which breaks blending.
- Instructions and words: ElevenLabs, generated once and committed:

```bash
ELEVENLABS_API_KEY=... ELEVENLABS_VOICE_ID=... npm run audio
git add public/audio && git commit -m "audio" && git push
```

No API keys are used at runtime.

## Running it

Web: https://reader.viableplanet.eu, a Cloudflare Worker (`kite-reader`) **behind Cloudflare Access**, so only allowed emails can open it. Private family app.

Deploy: `npm run build && npx wrangler deploy` from the Mac. GitHub only runs the tests. Local: `npm run local` → http://127.0.0.1:5173.

## My books (family's own copies)

Picture books from `~/Documents/eBooks` are bundled into `public/books/` (page pictures, text, readability):

```bash
npm run books                      # rebuild all (macOS: PDFKit + Apple Vision OCR)
npm run books -- green-eggs-and-ham  # just one
```

- Books are listed in `scripts/books/build.ts`. OCR mistakes are fixed in `scripts/books/overrides.json` (page index → text, `null` hides a page), so fixes survive rebuilds.
- Each book gets *readable at* (≥95% of words decodable) and *with pre-teaching* (≥90%, ≤10 words). The app puts it on the child's **My books** shelf (decodable words highlighted, tap a word to hear it), marks it **★ Ready** when he can read it, adds its pre-teach words as **heart words** once it's within 10 levels, and uses its decodable sentences in practice.
- Pages are precached by the service worker, so books work offline on the tablet.
- Not bundled: *Teach Your Child to Read in 100 Easy Lessons* (a parent's manual, not a reader), and the Oz/Pooh EPUBs (already in `src/content/readaloud/`).

## Adding levels

1. Add graphemes to `src/content/phonemes.ts`, a level to `src/content/levels.ts`.
2. `npm run validate` must pass. Add pictures to `src/content/pictures.ts` where useful.
3. `npm run audio` for new words.

## Roadmap
- v0.2: real-device tuning on iPad (mic thresholds, timings), decodable mini-stories per level, story-time polish
- v0.3: Levels 11–20, parent weekly summary, recordings backup
- v0.4: Levels 21–50 (digraphs, clusters, heart words), fluency timing
- Math strand M0 (separate session)
