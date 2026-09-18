# Kite Reader

A private, home-built early-reading tutor for a household: systematic phonics, explicit instruction, parent-confirmed scoring, spaced review, connected text and read-aloud books. It is designed to work offline once loaded and is normally served behind Cloudflare Access.

## Current architecture

- **Multiple learner profiles.** Each learner has isolated Basics/Level progress, SRS items, errors, readiness, read-aloud history and session logs. Recorded phoneme audio, bundled books and app assets are shared on the device.
- **Basics B1–B10.** Oral blending/listening, left-to-right tracking, rhyme, and first letter sounds. New sounds now require both receptive and productive mastery probes before the lesson passes.
- **Reading Levels 1–20.** Jolly-informed/adapted early sequence, not a claim of exact Jolly fidelity. Kite uses `a,t,s` first to unlock `at`, then converges on the familiar early sound set.
- **Learner-aware knowledge.** Connected text and book highlighting use what the active learner has actually been taught, especially heart words; being “at Level 14” no longer automatically makes all L14 heart words known.
- **Heart words.** At most three new heart words are introduced per session. A level cannot enter checkout until every heart word assigned to that level has been introduced and answered correctly at least once.
- **Three navigation modes.** Guided writes normal progress; Practice is for reached material and may feed SRS but never unlocks levels; Explore is an unlimited sandbox and writes no learner state at all.
- **Encoding and decoding are separate representations.** Build It preserves orthography (`h-i-ss`, `h-i-ll`, `o-ff`) while blending may collapse doubled consonants phonemically.
- **Mastery.** In-session reinjection, Leitner spaced review, checkout, next-day cold check, and required probes for newly taught concepts.
- **Daily/session limits are recommendations, not locks.** A guided session can stop at its active-minute target, but Home always allows another. Explore ignores caps.

## Run locally

```bash
npm install
npm run dev
npm test
npm run validate
npm run build
npm run preview -- --port 4173 --strictPort
npm run test:e2e
```

CI runs unit tests, content validation, the production build and the Playwright smoke test.

## Audio

Priority for phonemes is:

1. a grown-up's recording from **Grown-ups → Sounds**
2. baked audio in `public/audio`
3. device fallback where available

The app does **not** use ElevenLabs to judge phoneme correctness. The acoustic checker is deliberately loose and is coaching-only; scored spoken answers require grown-up confirmation.

`worker/index.ts` can generate missing **word/phrase** audio at runtime using the server-side `ELEVENLABS_API_KEY` secret and KV caching. The secret is never shipped to the browser.

For pure phonemes, record the sounds yourself and bake them into the app with `npm run sounds`. The generator fallback uses IPA; it must never substitute a letter name (for example, `i` must be short /ɪ/, not “aye”).

## Books

`src/content/readaloud/` contains read-aloud text. `public/books/` may contain page images/text extracted from family-owned commercial books.

Book readiness, Book Check, Story Chair highlighting and session sentence selection now share learner-aware decodability logic. Recurring proper names are pre-teach candidates; they are not silently counted as already readable.

## Persistence and backups

Kite stores a household object in IndexedDB under `kite:household`. An existing legacy `progress` object is automatically migrated into the first learner profile without discarding history.

Backups from **Grown-ups → Backup** contain all learner profiles. Device-level phoneme recordings remain separate and can be exported/baked with the sound workflow.

Progress includes both a schema version and a curriculum version so future curriculum resequencing can be migrated deliberately rather than silently reinterpreting old mastery.

## Adding curriculum

When adding or resequencing material, preserve these invariants:

- connected text must be readable from actual learner knowledge plus concepts explicitly introduced earlier in that same session;
- no level may enter checkout while a required concept remains unintroduced/unmastered;
- encoding tiles represent spelling, not phoneme count;
- a spelling/pronunciation mismatch must never be modelled with the wrong isolated phoneme;
- Explore must never write learner state;
- content validation, Book Check, book highlighting and runtime sentence eligibility should use the same decodability rules where they answer the same question.

See `CHANGELIST.md` for the audit-driven changes in this revision.
