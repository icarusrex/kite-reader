# Kite

Kite is a private, home-built early-learning tutor. The product shell is intentionally small and modular: **Core owns the learner and the experience; each learning module owns what learning means.**

Current modules:

- **Reading** — systematic phonics/early reading with its existing level, SRS, checkout and cold-check model.
- **Math** — a separate learning-trajectory engine for early number, operations, geometry and measurement.

This is not a plugin platform. Reading and Math are compiled into one app, share household infrastructure, and remain free to use different pedagogy and progress models.

## Architecture

```text
src/
  core/
    App.tsx
    app/                 household + store
    audio/               genuinely generic speech primitive
    screens/             module launcher
    ui/                  shared UI primitives
    storage.ts
    module.ts             tiny static module registry

  modules/
    reading/
      activities/
      audio/              phoneme/prompt/recording-specific audio
      books/
      content/
      engine/
      screens/
      ui/

    math/
      activities/
      content/
      engine/
      screens/
```

The boundary is deliberate:

- Core may know that Reading and Math modules exist at the composition/navigation layer.
- Core does **not** define a generic mastery model, lesson graph, Leitner system, skill state, or curriculum abstraction.
- Reading keeps its proven `Progress`, levels and checkout semantics.
- Math keeps its own dependency graph, evidence model, misconceptions, representations and mastery phases.
- Shared abstractions should be extracted only when two real modules genuinely need the same thing.

## Learner data

Each learner is now stored as:

```ts
interface LearnerProfile {
  id: string;
  name: string;
  createdAt: string;
  modules: {
    reading: ReadingProgress;
    math: MathProgress;
  };
}
```

Migration supports:

1. old single-user Reading `progress` data;
2. household v1 profiles containing `progress`;
3. household v2 profiles containing `progress` + `math`;
4. the current v3 `modules.reading` + `modules.math` format.

The core store still exposes `progress/update/replace` as temporary Reading compatibility aliases so the stable Reading module did not need a risky mass rewrite during this structural refactor. New code should use `reading/updateReading/replaceReading`.

## Reading module

- **Multiple learner profiles.** Each learner has isolated Basics/Level progress, SRS items, errors, readiness, read-aloud history and session logs. Recorded phoneme audio, bundled books and app assets are shared on the device.
- **Basics B1–B10.** Oral blending/listening, left-to-right tracking, rhyme, and first letter sounds. New sounds now require both receptive and productive mastery probes before the lesson passes.
- **Reading Levels 1–20.** Jolly-informed/adapted early sequence, not a claim of exact Jolly fidelity. Kite uses `a,t,s` first to unlock `at`, then converges on the familiar early sound set.
- **Learner-aware knowledge.** Connected text and book highlighting use what the active learner has actually been taught, especially heart words; being “at Level 14” no longer automatically makes all L14 heart words known.
- **Heart words.** At most three new heart words are introduced per session. A level cannot enter checkout until every heart word assigned to that level has been introduced and answered correctly at least once.
- **Three navigation modes.** Guided writes normal progress; Practice is for reached material and may feed SRS but never unlocks levels; Explore is an unlimited sandbox and writes no learner state at all.
- **Encoding and decoding are separate representations.** Build It preserves orthography (`h-i-ss`, `h-i-ll`, `o-ff`) while blending may collapse doubled consonants phonemically.
- **Mastery.** In-session reinjection, Leitner spaced review, checkout, next-day cold check, and required probes for newly taught concepts.
- **Daily/session limits are recommendations, not locks.** A guided session can stop at its active-minute target, but Home always allows another. Explore ignores caps.

## Math currently implemented

The first 20 teachable units are encoded as a dependency graph:

1. verbal count 1–5
2. one-to-one counting 1–3
3. cardinality 1–3
4. perceptual subitizing 1–3
5. construct 1–3
6. numeral mapping 1–3
7. compare quantities 1–3
8. count/cardinality 1–5
9. structured subitizing 4–5
10. compare quantities 1–5
11. compose/decompose 2–4
12. compose/decompose 5
13. numeral mapping 1–5
14. order 1–5
15. concrete addition/combine to 5
16. concrete subtraction/separate to 5
17. successor/predecessor to 5
18. basic shape properties
19. basic shape composition
20. direct length comparison

Math uses `unseen → introduced → practicing → provisional → secure → maintenance`, evidence across task forms/representations, delayed review, misconceptions and physical transfer. It does not inherit Reading levels or percentage checkout.

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

`src/modules/reading/content/readaloud/` contains read-aloud text. `public/books/` may contain page images/text extracted from family-owned commercial books.

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
## Design rule

> **Core owns the learner and the experience. Modules own what learning means.**

For personal use, keep this boring. Do not introduce dynamic plugins, package workspaces, dependency injection, a universal learning engine, or a generic curriculum DSL unless a real future module creates a concrete need.

### Recovery and save errors

Backup import validates the file and previews which learners will be replaced. A
single previous-household recovery copy is stored together with the replacement;
use **Restore previous household** in Backup to recover after an import or Reading
reset. This device-local copy supplements regular exported backups.

If storage cannot be read, Kite offers Retry without replacing the household.
If a write fails, keep the window open and use **Retry saving** or **Export household**
in the warning. A successful retry saves the latest changes.

Numerals 1–5 now records the assessed quantity and rotates both mapping directions
across short sessions. Older earned mastery is retained and labelled for a coverage
check where its historical evidence cannot prove all targets were assessed. Failed
retention checks return the following day instead of waiting the full long interval.
