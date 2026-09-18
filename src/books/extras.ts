import { MAX_LEVEL } from '../content/levels';
import { HEART_WORDS, wordLevel } from '../engine/wordLevel';
import type { SessionExtras } from '../engine/session';
import type { LibraryEntry } from './analyze';

export function bookExtras(books: LibraryEntry[], n: number): SessionExtras {
  const sentences = books.flatMap((b) => (b.analysis?.sentences ?? []).filter((x) => x.level <= n).map((x) => ({ text: x.text, source: b.title })));
  const heart = n < 5 ? [] : books
    .filter((b) => b.analysis && b.analysis.readyPreteach <= n + 10)
    .flatMap((b) => b.analysis.preteach
      .filter((w) => b.analysis.names.includes(w.toLowerCase()) || wordLevel(w).level > MAX_LEVEL || w in HEART_WORDS)
      .map((word) => ({ word, source: b.title })));
  const seen = new Set<string>();
  return { sentences, heart: heart.filter((h) => !seen.has(h.word.toLowerCase()) && seen.add(h.word.toLowerCase())) };
}
