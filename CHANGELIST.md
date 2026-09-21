# Changelog — Modular Architecture + Math MVP

## Added

### Kite Core
- Added a top-level **Kite launcher** so the application is no longer implicitly Reading-first.
- Added separate entry points for:
  - Reading
  - Math
- Established the architectural rule:
  - **Core owns the learner and the experience.**
  - **Modules own what learning means.**

### Modular subject structure
Added:

```text
src/
  core/
  modules/
    reading/
    math/
```

Reading and Math now live as independent learning modules rather than sharing one pedagogy/engine.

### Math module
Added a dedicated Math learning engine with:

- Dependency-graph curriculum rather than numbered levels.
- Per-skill learning states:
  - unseen
  - introduced
  - practicing
  - provisional
  - secure
  - maintenance
- Evidence tracking by:
  - task family
  - representation
  - response direction
  - independence/help level
  - delayed retrieval
  - transfer
  - misconception
- Active-frontier curriculum selection.
- Delayed/cold review scheduling.
- Guided, Practice and Explore modes.
- Physical/off-screen transfer prompts.
- Math-specific session planning.
- Math-specific mastery evaluation.
- Math-specific misconception tracking.
- Parent-visible Math progress.

### First 20 Math curriculum units
Implemented the initial learning trajectory covering:

1. Stable verbal count 1–5
2. One-to-one counting 1–3
3. Cardinality 1–3
4. Perceptual subitizing 1–3
5. Construct exact sets 1–3
6. Numeral ↔ quantity mapping 1–3
7. Compare quantities 1–3
8. Count/cardinality 1–5
9. Structured recognition of 4–5
10. Compare quantities 1–5
11. Compose/decompose 2–4
12. Compose/decompose 5
13. Numeral ↔ quantity mapping 1–5
14. Order quantities/numerals 1–5
15. Concrete addition within 5
16. Concrete subtraction within 5
17. One more / one less within 5
18. Basic shape properties
19. Shape composition
20. Direct length comparison

### Math task generation
Added generated task families for:

- verbal counting
- counting objects
- reporting cardinality
- recognizing quantities
- constructing quantities
- numeral/quantity mapping
- comparing sets
- ordering
- partitioning wholes
- combining sets
- separating sets
- successor/predecessor
- shape classification
- shape composition
- length comparison
- physical transfer

### Math representations
Added explicit representation metadata for concepts including:

- real/physical objects
- on-screen objects
- random dots
- structured dots
- five-frame
- fingers where genuinely represented
- numerals
- basic shapes

### Math misconception model
Added error categories including:

- skipped objects while counting
- double counting
- recounting instead of using cardinality
- memorizing dot patterns rather than quantity
- judging quantity by spatial spread
- numeral disconnected from quantity
- confusion around more/fewer
- changing the whole during partitioning
- hidden-part misunderstanding
- prototype-only shape recognition
- length comparison without aligned origins
- guessing

### Math strategy evidence
Added support for tracking strategies such as:

- count-all
- count-on
- subitizing
- structured subitizing
- decomposition
- fingers
- recall
- one-to-one matching

---

## Refactored

### Reading module
Moved Reading-specific code behind a module boundary.

Reading retains ownership of:

- Reading curriculum
- Basics B1–B10
- Reading levels
- decoding knowledge
- Reading progress
- Leitner/SRS logic
- checkout/cold-check rules
- Reading activity types
- stories/books
- phoneme activities
- Reading-specific audio

No attempt was made to convert Reading's pedagogy into a generic learning engine.

### Core
Moved genuinely shared product infrastructure into Core, including responsibility for:

- learner profiles
- household state
- persistence
- migrations
- top-level navigation
- shared app shell
- common UI
- subject/module selection

### Audio boundary
Changed the planned architecture after reviewing the real implementation.

Reading audio remains inside the Reading module because it understands:

- graphemes
- phoneme recordings
- Reading prompts
- Reading-specific playback rules

Core now contains only a small generic text-speech primitive suitable for Math and future modules.

---

## Changed

### Learner data model
Changed learner state conceptually from:

```ts
profile.progress
profile.math
```

to:

```ts
profile.modules.reading
profile.modules.math
```

This establishes a clean place for future modules without introducing a plugin framework.

### Household migrations
Added migration support for:

- original Reading-only learner profiles
- interim Reading + Math format
- new modular profile format

Existing Reading progress is preserved during migration.

### Math progression
Math no longer behaves like Reading levels.

Removed the idea of:

```ts
currentMathLevel()
```

and replaced it with an active curriculum frontier determined from prerequisite mastery.

### Mastery behavior
Corrected several issues discovered during stress testing:

- Provisional skills no longer monopolize sessions while waiting for delayed review.
- Provisional mastery can unlock dependent concepts.
- Cold checks are scheduled through the review system.
- Single-form concepts such as verbal counting can become provisional without impossible representation requirements.
- `Construct 1–3` no longer requires physical prompts to become masterable.
- Physical transfer remains stronger evidence without being an accidental hard dependency.
- Representation metadata now reflects what the child actually sees.
- Weak distractor generation was tightened to avoid artificially easy mastery evidence.

---

## Validation and safeguards

### Curriculum validation
Added validation for:

- missing skill IDs
- missing prerequisite IDs
- hard-prerequisite cycles
- unreachable curriculum nodes
- unsupported task families
- unsupported representations
- invalid misconception references

Current Math graph:

- 20 implemented skills
- 4 root skills
- no hard-prerequisite cycles

### Generator validation
Added checks ensuring generated activities:

- use a task family permitted by the skill
- use a representation permitted by the skill
- produce valid answer choices
- do not leak the answer
- stay inside representation bounds

### Progress invariants
Added/defined safeguards such as:

- modeled answers cannot independently establish mastery
- delayed evidence must actually be delayed
- critical misconceptions can block secure mastery
- representation diversity matters for appropriate skills
- Explore does not modify learner state
- Practice cannot silently create brand-new curriculum progression
- Reading and Math progress remain isolated
- separate learner profiles remain isolated

### Migration tests
Added tests for:

- Reading-only → modular profile migration
- retention of Reading progress
- creation of fresh Math state
- learner isolation
- profile switching
- invalid active-profile repair

---

## Architecture decisions intentionally *not* implemented

To keep this appropriate for a personal-use application, the refactor deliberately does **not** add:

- dynamic plugins
- runtime module loading
- npm workspace packages
- dependency injection frameworks
- a universal mastery engine
- a universal curriculum format
- a universal session planner
- generic `Skill` abstractions forced onto Reading
- separate deployable Reading/Math packages

The app remains one simple application with strongly separated subject modules.

---

## Math intentionally deferred

Not yet implemented:

- numbers 6–10
- ten-frame
- rekenrek/bead representation
- missing-part problems
- count-on strategies
- flexible bonds to 5/10
- zero
- number line 0–10
- ordinal numbers
- spatial position/routes
- repeating patterns
- classification
- mass/capacity
- symmetry
- simple data graphs
- mixed story problems

These can now be added inside `modules/math` without changing Core or Reading.

---

## Result

Kite has changed from:

```text
Reading app
  + a Math feature
```

into:

```text
Kite
├── Core
├── Reading
└── Math
```

while remaining a single, relatively simple personal-use application.

The important outcome is that future subjects can be added without forcing them into Reading's learning model, while the product infrastructure only has to be built once.

---

## Fixes made when applying to the repo (base `a2a5121`)

- `MathActivities.tsx`: tap-counting called an unimported `say()`; now uses core `speakText` (same `/api/say?text=` endpoint).
- Hard-coded `src/content/` paths moved to `src/modules/reading/content/` in `wordLevel.test.ts`, `scripts/mine-books.ts`, `scripts/books/build.ts`, `scripts/pictures/generate.ts`.
- `tests/smoke.mjs`: steps through the new launcher into Reading, reads `profile.modules.reading` (falls back to `progress`), and uses the renamed `Start reading` button.
- README: kept the existing Reading/Run/Audio/Books/Persistence/Curriculum sections and merged in the new Architecture, Learner data, Math and Design rule sections.

## 2026-09-21: Audit reliability fixes

- Validate imported Reading and household backups before migration or replacement. Preserve supported old formats, reject malformed/future formats, and show a replacement confirmation.
- Keep the previous household with the replacement in one IndexedDB transaction. Backup offers restoration after an import or Reading reset.
- Distinguish failed reads from empty storage. Loading errors no longer initialize over existing data. Serialize saves and show an unsaved warning with retry and export when persistence fails.
- Rotate saved Numerals 1–5 tasks across every numeral in both directions while retaining four-task sessions. Record assessed targets and require full coverage for new secure status; retain old earned status with an explicit coverage-check note.
- Schedule next-day reviews after failed secure/maintenance attempts. An easy answer in the same session cannot clear the retry; recovery requires independent success on the failed target/direction in a later session/day.
- Assert browser session completion, saved logs, cold-check progression and unexpected errors. Add a browser journey for backup validation, recovery, reload, and Math evidence.
