# Kite modular refactor + Math MVP

This download supersedes the earlier `kite-math-mvp` bundle. Apply this bundle directly to the current Kite Reader repository; you do not need to apply the earlier Math bundle first.

## What changed structurally

- `src/app` → `src/core/app`
- `src/engine/storage.ts` → `src/core/storage.ts`
- `src/ui/components.tsx` → `src/core/ui/components.tsx`
- Reading-specific UI/audio/content/engine/screens/books/activities now live under `src/modules/reading/`.
- Math lives under `src/modules/math/`.
- `src/App.tsx` → `src/core/App.tsx` and acts as the composition root.
- `src/main.tsx` remains the tiny Vite entrypoint and points to Core App.
- A simple child-facing module launcher now offers Reading or Math.
- Persisted learner state is grouped under `profile.modules.reading` and `profile.modules.math` with backward migration.

## Important non-refactor

There is intentionally **no** generic learning engine. Reading and Math still have different progress/mastery/session models.

A second deliberate correction: the existing Reading `speaker.ts` was not actually generic because it knows phonemes, prompts and Reading recordings. It remains in the Reading module. Core only gets a small generic text-speech primitive used by Math and available to future modules.

## Safety of the migration

The included migration tool rewrites relative TypeScript/JavaScript imports based on the old and new filesystem locations rather than doing blind string substitutions. After applying, a second tool audits every relative import and fails if a target cannot be resolved.

The script also removes the stale cross-module Math progress tab created by the earlier bundle if that bundle was already applied.

## Verification in this bundle

- Math graph/content remains the same 20-unit MVP from the research-backed implementation.
- Math engine files retain their existing strict-TypeScript-tested state/planner/task logic.
- The module migration algorithm is tested in this environment against representative Reading/Core import relationships.
- A relative-import audit is included and runs automatically after applying to the real repository.

Because this environment cannot clone the public repository over DNS and the connected GitHub App is read-only for writes, the final repository-level commands must still be run on your machine after applying:

```bash
npm test
npm run validate
npm run build
npm run test:e2e
```
