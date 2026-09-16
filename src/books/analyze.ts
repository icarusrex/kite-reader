/**
 * Readability analysis for a bundled picture book. Pure: runs at build time (scripts/books/build.ts)
 * with the common-words dictionary passed in, so the app only reads the result.
 */
import { tokenize, wordLevel, BEYOND, setDictionary } from '../engine/wordLevel';

export interface BookPage { text: string; image?: string; w?: number; h?: number } // image = path under /books/<id>/
export interface Book { id: string; title: string; author: string; pages: BookPage[] }
export interface BookAnalysis {
  tokens: number; unique: number;
  ready95: number;            // lowest level with ≥95% of words decodable
  readyPreteach: number;      // lowest level with ≥90% decodable and ≤10 unique words to pre-teach
  preteach: string[];         // words to pre-teach at readyPreteach
  names: string[];            // capitalised story names treated as known once pre-taught
  sentences: { text: string; level: number; page: number }[];
}
export interface LibraryEntry { id: string; title: string; author: string; pages: number; cover?: string; analysis: BookAnalysis }

const TWO = new Set('am an as at be by do go he hi if in is it me my no of oh ok on or ox so to up us we'.split(' '));

/** Words worth analysing: real words or names that recur in the book (drops OCR noise). */
function usableTokens(book: Book, dict: Set<string>): { word: string; page: number }[] {
  const all = book.pages.flatMap((p, page) => tokenize(p.text).map((w) => ({ w, page })));
  const capsCount = new Map<string, number>();
  for (const { w } of all) if (/^[A-Z][a-z]+$/.test(w)) capsCount.set(w.toLowerCase(), (capsCount.get(w.toLowerCase()) ?? 0) + 1);
  return all
    .filter(({ w }) => {
      const lw = w.toLowerCase().replace(/'.*/, '');
      if (lw.length === 1) return lw === 'a' || lw === 'i';
      if (lw.length === 2) return TWO.has(lw);
      return dict.has(lw) || (capsCount.get(lw) ?? 0) >= 2;
    })
    .map(({ w, page }) => ({ word: w, page }));
}

export function analyzeBook(book: Book, dict: Set<string>): BookAnalysis {
  setDictionary(dict);
  const toks = usableTokens(book, dict);
  const names = [...new Set(toks.map((t) => t.word).filter((w) => /^[A-Z][a-z]+$/.test(w) && !dict.has(w.toLowerCase())))].map((w) => w.toLowerCase());
  const levels = toks.map((t) => (names.includes(t.word.toLowerCase()) ? 0 : wordLevel(t.word).level));
  const lvByWord = new Map(toks.map((t, i) => [t.word.toLowerCase(), levels[i]]));
  const share = (L: number) => levels.filter((l) => l <= L).length / Math.max(1, levels.length);
  const missing = (L: number) => [...new Set([...lvByWord].filter(([, l]) => l > L).map(([w]) => w))];
  let ready95 = BEYOND, readyPreteach = BEYOND;
  for (let L = 1; L <= 120; L++) {
    if (ready95 === BEYOND && share(L) >= 0.95) ready95 = L;
    if (readyPreteach === BEYOND && share(L) >= 0.9 && missing(L).length <= 10) readyPreteach = L;
  }
  readyPreteach = Math.min(readyPreteach, ready95);
  const preteach = readyPreteach < BEYOND ? missing(readyPreteach) : missing(120).slice(0, 12);

  const sentences: BookAnalysis['sentences'] = [];
  book.pages.forEach((p, page) => {
    for (const raw of p.text.replace(/[“”"]/g, '').replace(/\s*\n\s*/g, ' ').split(/(?<=[.!?])\s+/)) {
      const text = raw.trim();
      const words = tokenize(text);
      if (words.length < 2 || words.length > 10 || !/^[A-Z]/.test(text) || !/[.!?]$/.test(text)) continue;
      if (!words.every((w) => dict.has(w.toLowerCase().replace(/'.*/, '')) || names.includes(w.toLowerCase()) || w === 'I')) continue;
      const level = Math.max(...words.map((w) => (names.includes(w.toLowerCase()) ? BEYOND : wordLevel(w).level)));
      if (level < BEYOND) sentences.push({ text, level, page });
    }
  });
  return { tokens: levels.length, unique: lvByWord.size, ready95, readyPreteach, preteach, names, sentences };
}
