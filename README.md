# Kite Reader

A private, home-built early-reading tutor (Mentava-style systematic phonics, Direct Instruction delivery) for one 4-year-old. Runs locally on the family computer.

Curriculum spec: `Curriculum v1.md` in the Obsidian vault (`04-personal/Mentava Clone`).

## Status — v0.1

- Readiness check (dogfish/fishdog directionality + oral blending)
- Levels 1–10: a, m, s, t, review, f, d, g, i, n
- Activities: Ear Game (oral PA), Sound Reveal, Hear & Tap, See & Say, Hold It, Glide Blend + Say It Fast, Alien Names, Read & Match, Which Word, Build It, Sentence Read, Story-time prompt
- Mastery engine: in-session re-injection of misses, Leitner spaced review, 10-item level checkout + next-day cold check, fatigue stop, active-time session cap
- Neutral error correction (My turn → Your turn), no points/streaks/currency
- Grown-ups area (press and hold 🔒 top-left 1.5 s): progress, trouble spots, **record pure sounds**, book decodability check, settings, backup/export

## Books

Public-domain read-aloud books from the family library live in `src/content/readaloud/` (text only, lazy-loaded):

- *The Wonderful Wizard of Oz* (Baum, 1900): 24 chapters. Source ebook was an OCR scan; auto-corrected, and a few typos may remain. Swap in a clean copy (e.g. Project Gutenberg #55) and re-run the extraction if needed.
- *Winnie-the-Pooh* (Milne, 1926): introduction + 10 chapters. Public domain in the US; in the EU/Portugal from 1 Jan 2027.

What they power:
- **Story chair** (📚 on home): grown-up reads aloud; words he can already decode are highlighted, 3 vocabulary words per chapter, discussion prompts, chapters-read log.
- **Real-book sentences** in sessions once decodable (`npm run mine` → `src/content/bookSentences.json`).
- **Readability** per level in Grown-ups → Books.

`src/engine/wordLevel.ts` estimates the curriculum level (1–120) for any English word; `src/content/common-words.txt` enables compound splitting in scripts.

Owned books under copyright (Seuss, Eastman, Usborne Phonics Readers) are handled only through the local import below; nothing from them is in this repository.

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

Local (family computer):

```bash
npm install        # also copies the offline OCR engine into public/ocr
npm run local      # builds and serves http://127.0.0.1:5173
```

Web: https://reader.viableplanet.eu, a Cloudflare Worker (`kite-reader`) **behind Cloudflare Access**, so only allowed emails can open it. It must stay behind Access: *Winnie-the-Pooh* is under copyright in the EU until 1 Jan 2027. Pushing to `main` of the private repo `icarusrex/kite-reader` runs tests and deploys. Manual: `npm run build && npx wrangler deploy`.

## My books (owned books, local only)

Grown-ups → Books → **Import books…** and pick EPUB/PDF files from `~/Documents/eBooks`.

- Text is extracted in the browser: EPUB text directly; scanned picture books via on-device OCR (tesseract.js, bundled; no network).
- Page text and page images are stored **only in this browser’s IndexedDB** on this computer. They are not in the code, the build, git, or any export.
- **Review text** once per book to fix OCR mistakes and blank out non-story pages.
- The app works out each book’s level: *readable at* (≥95% of words decodable) and *with pre-teaching* (≥90%, ≤10 words). It then:
  - puts the book on the child’s **My books** shelf (picture + text, decodable words highlighted, tap a word to hear it), marked **★ Ready** when he can read it;
  - adds the book’s pre-teach words as **heart words** in sessions once the book is within 10 levels;
  - uses decodable sentences from his own books in sentence practice.

Clearing browser data deletes imported books; re-import from the original files.

## Adding levels

1. Add graphemes to `src/content/phonemes.ts`, a level to `src/content/levels.ts`.
2. `npm run validate` must pass. Add pictures to `src/content/pictures.ts` where useful.
3. `npm run audio` for new words.

## Roadmap
- v0.2: real-device tuning on iPad (mic thresholds, timings), decodable mini-stories per level, story-time polish
- v0.3: Levels 11–20, parent weekly summary, recordings backup
- v0.4: Levels 21–50 (digraphs, clusters, heart words), fluency timing
- Math strand M0 (separate session)
