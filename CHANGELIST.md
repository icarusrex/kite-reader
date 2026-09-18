# Kite Reader — Audit + Multi-user Revision Changelist

**Base commit:** `d92c8a3618230acfbf6b21c31bec894b8181ef41`  
**Revision:** `reading-2026-09-18-v2`  
**Scope:** audit fixes, learner-state correctness, Explore mode, multi-user profiles, book/readability consistency, test/CI hardening.

## 1. Multi-user profiles

- Added a household store above the existing `Progress` model.
- Each learner has isolated:
  - curriculum position / Basics / Levels
  - Leitner/SRS items
  - errors / trouble spots
  - readiness result
  - session history
  - read-aloud history
  - learner settings/name
- Device-level sound recordings, bundled books, generated audio and other app assets remain shared.
- Existing single-user `progress` data automatically migrates into the first profile (`p-legacy`) without discarding history.
- Added Grown-ups → **Profiles** for add, rename, switch and delete.
- Added launch profile chooser when more than one learner exists.
- Household backup exports/imports all profiles together; legacy single-profile backups still import into the active learner.

Key files: `src/app/household.ts`, `src/app/store.tsx`, `src/screens/parent/ProfilesTab.tsx`.

## 2. Guided / Practice / Explore modes

- Added explicit session modes:
  - **Guided** — normal learning; writes progress, SRS, errors, sessions and progression.
  - **Practice** — extra work on already-reached material; may update SRS and logs a `practice` session, but cannot unlock/progress levels.
  - **Explore** — parent/development sandbox; never writes learner progress, SRS, errors, sessions or progression.
- Explore is available for every Basics lesson and every Level.
- Practice is only offered for material already reached/current, preventing future-level SRS contamination.
- Future-level Explore uses a non-persisted prerequisite sandbox so L20 can actually be exercised while the real learner is at L5.
- Practice sessions are excluded from weekly guided-session totals and story-time cadence.

Key files: `src/screens/Session.tsx`, `src/screens/parent/LessonsTab.tsx`, `src/App.tsx`.

## 3. Heart-word lifecycle fixed

Audit bug: the three-new-heart-words/session cap allowed a child to pass a level before later heart words were ever taught.

Changes:
- A level cannot enter checkout until **every heart word assigned to that level has been answered correctly at least once**.
- The three-new-word/session throttle remains, so L14 naturally takes enough sessions to introduce all nine words.
- Previously started but unmastered heart words continue to appear.
- Same-session correct heart words count toward the checkout gate immediately.
- Connected text uses only heart words already introduced to the learner plus words explicitly introduced earlier in the current session.
- Future/postponed heart words can no longer leak into sentences/stories merely because their nominal level has arrived.

Key files: `src/engine/knowledge.ts`, `src/engine/session.ts`, `src/screens/Session.tsx`.

## 4. Article `a` explicitly taught

Audit bug: `a` was treated as decodable because the letter `a` was known, even though the English article is not normally short /æ/.

Changes:
- `a` is a Level 5 heart word and is taught before Level 5 connected text uses it.
- `wordLevel` now places heart-word `a` at L5 instead of L1.
- `trickyParts` explicitly marks it for heart-word teaching.

Files: `src/content/levels.ts`, `src/engine/decodable.ts`, `src/engine/wordLevel.ts` (patch).

## 5. Encoding/spelling separated from phoneme segmentation

Audit bug: `segment()` intentionally collapses doubled consonants for reading, but Build It reused it for spelling, producing `h-i-s`, `m-e-s`, `h-i-l`, etc.

Changes:
- Added `encodingChunks()` for orthographic spelling chunks.
- `segment()` remains reading/phoneme-oriented.
- Build It now uses `h-i-ss`, `m-e-ss`, `h-i-ll`, `o-ff`, `p-u-ff`, `b-e-ll`, etc.
- Double-letter tiles play the underlying sound (`ss` → `/s/`) rather than requiring a nonexistent `ss` recording.

Files: `src/engine/decodable.ts`, `src/engine/session.ts`, `src/activities/Activities.tsx` (patch).

## 6. Voiced final `-s` no longer models the wrong phoneme

Audit bug: words such as `pins`, `pans`, `tins`, `digs` end in /z/, but segmented correction played the recorded /s/.

Changes:
- Added `hasVoicedFinalS()`.
- Early Build It excludes voiced-final-s words until the pronunciation can be represented properly.
- Glide does not play a false isolated `/s/` model for those words; correction models the whole correctly-pronounced word instead.
- Tapping the final tile on such a word plays the whole word rather than an incorrect `/s/` cue.

This avoids teaching a false sound-spelling correspondence without adding an unnecessary morphology lesson for a four-year-old yet.

## 7. Heart-word marking is learner/curriculum-relative

Audit bug: static marks made untaught spellings look regular (`th[e]` at L7, `sh[e]` at L14, `w[e]` at L14).

Changes:
- `trickyParts()` now combines permanent irregularity with whether a grapheme/pattern has actually been taught by that curriculum point.
- Examples:
  - L7 `the` → `[the]`
  - after `th` is taught → `th[e]`
  - L14 `she` → `[she]`
  - L14 `we` → `[we]`
  - `has` → `ha[s]`
  - `said` → `s[ai]d`

File: `src/engine/decodable.ts`.

## 8. Basics mastery hardened

Audit bug: Basics passed on aggregate ~80% even if the newly-taught grapheme itself was weak.

Changes:
- Every new-sound Basics lesson has required receptive (`Hear & Tap`) and productive (`See & Say`) probes.
- Basics can pass only when overall accuracy reaches the existing threshold **and** both target probes are correct.

Files: `src/engine/basics.ts`, `src/screens/Session.tsx`.

## 9. Readiness flow fixed

Audit bug: “Save result” on a failed readiness check stored `false`, but the next Start still entered Levels because only `null` was gated.

Changes:
- Failed readiness + **Save → Basics** explicitly switches to Basics.
- “Start Level 1 anyway” remains an explicit parent override.
- Readiness stores actual blending/tracking scores and date, not just a boolean.
- App gates Levels unless readiness is explicitly passed/overridden.

Files: `src/screens/Readiness.tsx`, `src/engine/progress.ts`, `src/App.tsx`.

## 10. Level 20 terminal state fixed

Audit bug: after passing L20 cold check, `currentLevel()` returned `MAX_LEVEL`, causing L20 to run again.

Changes:
- Final cold-check pass detects `allPassed()` and ends in a curriculum-complete state.
- Home shows “You finished everything built so far!” and keeps Books/Explore available instead of starting L20 again.

Files: `src/screens/Session.tsx`, `src/screens/Home.tsx`.

## 11. Session cap changed from lock to recommendation

- Guided sessions still stop at the configured active-minute target.
- Home no longer locks the learner out for the rest of the day.
- After the recommendation is met, Start remains available with softer “Nice work today / keep going if you want” copy.
- Practice and Explore ignore the guided-session cap.

Files: `src/screens/Home.tsx`, `src/screens/Session.tsx`.

## 12. Curriculum/schema versioning

- Progress schema bumped to version 2.
- Added explicit `curriculumVersion: "reading-2026-09-18-v2"` separately from data schema version.
- Legacy progress migrates forward while preserving learning history.
- Future curriculum resequences can now branch on `curriculumVersion` rather than silently interpreting old mastery against new content.
- `jumpTo()` now switches to Levels and seeds prerequisite heart words as known, so placement does not contradict learner-aware readability.

File: `src/engine/progress.ts`.

## 13. Book/readability logic hardened

Audit bugs:
- recurring proper names were counted as automatically known;
- analyzer and runtime disagreed about pre-teachable names;
- Book Reader highlighted all names green;
- Grown-ups → Book Check used the weaker grapheme-only model.

Changes:
- Proper names count as assistable/pre-teach words, not automatically decodable words.
- Runtime allows detected proper names through the explicit book pre-teach path.
- Book Reader highlighting uses actual learner knowledge.
- Story Chair read-aloud highlighting uses actual learner knowledge.
- Grown-ups → Book Check uses the same learner-aware decoder.
- Connected session text uses the learner-aware decoder too.

Files: `src/books/analyze.ts`, `src/books/extras.ts`, `src/books/BookReader.tsx`, `src/screens/StoryChair.tsx`, `src/screens/Parent.tsx`, `src/engine/knowledge.ts`.

Note: shelf-level “ready at level N” remains a build-time estimate; actual green highlighting is learner-aware. Proper-name inflation is removed from the build-time estimate.

## 14. Loose microphone classifier no longer gives false correctness praise

Audit issue: unscored Reveal/Meet/Hold activities could say “Yes!” merely because a broad acoustic classifier accepted an attempt (or because any sustained voice was detected).

Changes:
- Loose classifier remains useful for attempt/coaching flow.
- Automatic `sayYes()` was removed from those unscored acoustic gates.
- Scored activities still rely on grown-up ✓/✗ as the correctness source of truth.

File: `src/activities/Activities.tsx` (patch).

## 15. Generated `i` fallback corrected

Audit bug: `scripts/gen-audio.ts` explicitly generated `i` as the letter name “aye”.

Changes:
- Removed the `i: 'aye'` override.
- Generated fallback uses the IPA short /ɪ/ path.
- Personal recordings remain preferred.

File: `scripts/gen-audio.ts` (patch).

## 16. Progress/dashboard semantics cleaned up

- Practice sessions no longer inflate the weekly guided-session summary.
- Replaced the pseudo-diagnostic “Ehri phase inferred from level” label with a neutral **curriculum stage** label.
- Recent-session table still shows practice sessions explicitly for transparency.

File: `src/screens/Parent.tsx`.

## 17. Tests and CI hardening

Added tests for:
- doubled-consonant encoding chunks
- learner-relative heart-word marking
- all-heart-words-before-checkout invariant
- connected text excluding postponed hearts
- explicit article `a`
- voiced final-s Build exclusion
- Basics required target probes
- proper-name readiness behavior
- legacy → household profile migration
- profile isolation / rename / delete rules

Browser smoke test:
- fixed stale fixture so it explicitly starts in Levels and really exercises cold check;
- no longer assumes a hard-coded `/opt/pw-browsers/chromium` path;
- added `npm run test:e2e`;
- GitHub Actions now runs the browser smoke test after unit tests, validation and build;
- CI also runs on pull requests.

Files: `src/engine/audit-invariants.test.ts`, `src/app/household.test.ts`, `tests/smoke.mjs` (patch), `.github/workflows/test.yml`, `package.json`.

## 18. Documentation/hygiene

- README rewritten for profiles, Explore, learner-aware readability and current runtime TTS behavior.
- Removed claim that there is no runtime API key: the key remains server-side in the Cloudflare Worker for uncached TTS.
- Clarified that the early sequence is **Jolly-informed/adapted**, not an exact Jolly sequence.
- MANUAL-TASKS corrected: spoken answers are grown-up scored; short `/ɪ/` is required; Explore/profile/backup flows documented.
- Added `.wrangler/` and `.worktrees/` to `.gitignore`.

## Intentionally NOT auto-changed

### Dependency audit
Baseline CI reports 6 npm audit findings (4 moderate, 1 high, 1 critical). This package does **not** blindly run `npm audit fix --force` or rewrite the lockfile without verifying which advisories are runtime vs build/dev dependencies. After applying this revision, run:

```bash
npm audit
npm audit --omit=dev
```

Then upgrade the affected dependency chain deliberately.

### Tracked `.wrangler` files
`.wrangler/` is now ignored for future files. If it is already tracked, untrack it explicitly after reviewing the diff:

```bash
git rm -r --cached .wrangler
```

## Verification performed in ChatGPT environment

Because the chat runtime could read GitHub but could not clone/install the complete repository over DNS, verification was split:

- Baseline commit `d92c8a3` was already green in GitHub CI: 114 tests, content validator and production build.
- Reconstructed pure engine compiled with TypeScript **strict**, target **ES2020**, libs **ES2021/DOM**.
- Reconstructed UI/state integration compiled with the same ES2020 strict target using typed React/browser stubs.
- New test source files type-check.
- Executable invariant harness passed heart gating, article `a`, double-consonant spelling, voiced-final-s exclusion, jump semantics and profile isolation.
- `remaining.patch` parses successfully with `git apply --stat`.
- `apply.sh` passes `bash -n`.

You should still run the real repository commands after applying:

```bash
npm test
npm run validate
npm run build
npm run preview -- --port 4173 --strictPort
npm run test:e2e
```

