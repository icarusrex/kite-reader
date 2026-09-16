# Kite Reader: things only a grown-up can do

What's left for you, in order. Items marked **(tell Claude)** are quicker if you hand them over.

## Before the first real session

### 1. Record the pure sounds (≈15 min)
The app models every sound for blending. Until you record them, single sounds use the device voice, which adds "uh" ("muh" instead of "mmm") and teaches the wrong thing.

- On the Mac, in Chrome: open the app → hold 🔒 (top-left) for 1.5 s → **Sounds**.
- Record all **22** sounds (a m s t f d g i n p h b l j c v w r k, plus o u e for the listening games).
- Quiet room, about 20 cm from the mic. Hold the button, say the sound, release. Press ▶ to check it.
- Continuous sounds (a m s f i n l v w r o u e): hold them for about a second: "mmm", "sss".
- Stop sounds (t d g p h b j c k): short and almost whispered, with **no vowel after them**: "t", not "tuh".
- The short vowels are the sounds in **a**pple, **i**nsect, **o**ctopus, **u**p and **e**gg, not the letter names.

### 2. Put the recordings into the app (≈2 min)
Recordings are saved in one browser only. Build them in so the tablet gets them too, and a browser wipe can't delete them.

1. Sounds tab → **Export 22 sounds for the app**. This downloads `kite-sounds.json`.
2. In Terminal:
   ```bash
   cd ~/projects/reading-tutor
   npm run sounds -- ~/Downloads/kite-sounds.json
   npm run build && npx wrangler deploy
   git add public/audio && git commit -m "Pure sounds" && git push
   ```
   **(tell Claude)**: just say "sounds exported".

### 3. Dry run: be the child (≈10 min)
Play one session yourself on the device your child will use, before they do.
- **Blending (kite and letters):** the kite should rise while you hold the sounds and fall if you stop between them. If it falls while you're still talking, raise **Mic sensitivity** in Settings. If it flies during silence, lower it.
- **Listen for bad audio:** any word or instruction that sounds wrong (see Listen-checks).
- **Time it:** a session should end on its own in about 8–15 minutes.

### 4. Readiness check (≈3 min, with your child)
Settings → **Readiness check**. It uses pictures a child names exactly (cat, dog, sun…), and it now also plays the o/u/e sounds, so do it **after** step 2.
**(tell Claude)** the result: "left-to-right x/8, blending y/5". If they don't pass, the Basics track (letter sounds only, no blending) gets built next.

## Listen-checks (ElevenLabs audio, one-time)
The listening games play **word endings without their first sound**: "at", "og", "un", "eb", "eg", "en", "us", "ed". ElevenLabs can say these oddly. Also check the alien words (pim, dap, jas…) and "Pooh".
- The files are in `public/audio/words/`. In Finder, press space on a file to hear it.
- To redo one: delete its `.mp3`, then run `npm run audio` (uses `.env`). Or **(tell Claude)** which ones sound wrong.

## Content you may want to edit
- **Stories and sentences for levels 5–20** are in `src/content/levels.ts` (`sentences:` and `story:`). Characters: **Pig** (Piglet), **Pooh** (heart word from level 11: the "ooh" is learned by sight), **Tin Man** (Oz). Rewrite freely, then run `npm run validate`. It rejects any word that uses letters or patterns not taught yet (e.g. "the" before level 25, "and" before level 27).
- **Themes your child likes** (dinosaurs, a pet's name, family names): **(tell Claude)**. Names made only of taught letters (Sam, Dan, Kim, Jill) can be used right away; others become heart words.
- **Pictures** for Read & Match are emoji in `src/content/pictures.ts`. The listening games only use the `CLEAR_WORDS` list; keep it to things a child names exactly that way.

## Weekly (≈2 min)
- **Grown-ups → Progress:** look at the session log. If several sessions ended with **fatigue**, the app stopped because your child missed the same item three times. **(tell Claude)**: the plan is to drop back to easy review instead of ending the session.
- **Trouble spots** (e.g. b ×4): nothing to do unless one keeps growing. Mention it.
- **Backup → Export progress.** Keep the file somewhere safe. Import restores it, e.g. when moving to the tablet.

## Upcoming (tell Claude when your child gets there)
- **At level ~17:** ask for **levels 21–30** (ck, sh, ch, th, *the*, o, nd, -s, mp, ft). They need engine work (two-letter sounds on one tile, the heart word *the*), so give it about a week of lead time.
- **Books:** anything new in `~/Documents/eBooks` → "add this book". It gets text-extracted, checked for readability and put on the shelf.
- **Android tablet:** open https://reader.viableplanet.eu in Chrome → log in → ⋮ → **Add to Home screen**. Built-in sounds come along automatically. For progress, export on the Mac and import on the tablet.

## Reference
| Command | What it does |
|---|---|
| `npm run validate` | Checks every level's words, sentences and stories are decodable at that level |
| `npm test` | Unit tests |
| `npm run audio` | ElevenLabs audio for new words/prompts (skips existing) |
| `npm run sounds -- <file>` | Builds exported pure-sound recordings into the app |
| `npm run books` | Rebuilds bundled books from `~/Documents/eBooks` |
| `npm run build && npx wrangler deploy` | Publishes to reader.viableplanet.eu |
| `CHANNEL=chrome node tests/smoke.mjs` | Plays a full simulated session (needs `npx vite preview --port 4173`) |
