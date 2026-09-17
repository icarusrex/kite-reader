import { MAX_LEVEL } from '../content/levels';
import { HEART_WORDS, wordLevel } from '../engine/wordLevel';
import type { SessionExtras } from '../engine/session';
import type { LibraryEntry } from './analyze';

/**
 * Sentences and pre-teach words from the bundled books for a session at level n.
 * Pre-teach only words he won't be able to sound out by the last built level (or that are irregular sight words):
 * teaching "ant" or "spot" by heart before he can decode them would train guessing, the habit phonics avoids.
 */
export function bookExtras(books: LibraryEntry[], n: number): SessionExtras {
  const sentences = books.flatMap((b) => (b.analysis?.sentences ?? []).filter((x) => x.level <= n).map((x) => ({ text: x.text, source: b.title })));
  const heart = n < 5 ? [] : books
    .filter((b) => b.analysis && b.analysis.readyPreteach <= n + 10)
    .flatMap((b) => b.analysis.preteach
      .filter((w) => wordLevel(w).level > n && (wordLevel(w).level > MAX_LEVEL || w in HEART_WORDS))
      .map((word) => ({ word, source: b.title })));
  const seen = new Set<string>();
  return { sentences, heart: heart.filter((h) => !seen.has(h.word) && seen.add(h.word)) };
}
