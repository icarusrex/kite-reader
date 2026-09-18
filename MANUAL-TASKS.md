# Kite Reader — grown-up checklist

## Before using real progress

1. **Record/check pure phoneme sounds.** In Grown-ups → Sounds, verify each sound is the phoneme, not the letter name. In particular, `i` is short /ɪ/ as in *insect/sit*, never “aye”. Your recordings override baked audio on that device.
2. **Bake recordings for other devices.** Export `kite-sounds.json`, then run `npm run sounds -- <file>` in the repo and rebuild/deploy.
3. **Dry-run with Explore.** Grown-ups → Lessons → **Explore** can open any Basics lesson or Level without writing progress, SRS, errors or session history. Use this for product testing.
4. **Use Practice only for reached material.** Practice may feed spaced review, but it never unlocks a level.

## Starting a learner

Each child has a separate profile. When more than one exists, Kite asks who is learning on launch. Manage profiles under **Grown-ups → Profiles**.

A fresh learner starts on **Basics**. Basics B1–B10 teaches early phoneme awareness and first sound-symbol correspondences. A new-sound lesson only passes when its overall score is adequate **and** its required receptive/productive sound probes are correct.

After Basics, the readiness check runs before Level 1. If oral blending is below the placement threshold, **Save → Basics** really returns that profile to Basics. **Start Level 1 anyway** remains an explicit parent override.

## Spoken answers

For scored spoken activities the microphone detects that an attempt happened; it does not independently decide reading correctness. The grown-up confirms ✓/✗.

Loose acoustic matching is used only for unscored coaching. It never awards mastery and no longer gives an automatic “Yes!” merely because a sound had the right broad acoustic shape.

## Session length

The active-minute setting is a recommended guided-session length. A guided session may end at that point, but the Home screen always permits another session. Explore is unlimited.

## Heart words and connected text

Heart words are introduced in small batches. Kite will not move a level to checkout until all heart words assigned to that level have been introduced and read correctly at least once. Sentences/stories are filtered against the active learner's actual known heart words plus words introduced earlier in that session.

## Books

My Books and Story Chair use learner-aware readability. Proper names are not automatically highlighted as decodable; recurring names can be pre-taught like other assistable words.

## Weekly

- Grown-ups → Progress counts **guided** sessions in the weekly total. Practice remains visible in recent history but does not inflate the guided-week summary. Explore leaves no log.
- Review Trouble spots if one item keeps accumulating errors.
- Grown-ups → Backup → **Export household**. This exports all learner profiles together.

## Developer commands

| Command | Purpose |
|---|---|
| `npm test` | Unit/invariant tests |
| `npm run validate` | Curriculum content validation |
| `npm run build` | TypeScript + production build |
| `npm run preview -- --port 4173 --strictPort` | Serve production build locally |
| `npm run test:e2e` | Browser smoke test (preview must be running) |
| `npm run audio` | Generate missing instruction/word fallback audio |
| `npm run sounds -- <file>` | Bake grown-up phoneme recordings |
| `npm run books` | Rebuild private bundled books |
| `npm run pictures` | Generate missing illustrations |
