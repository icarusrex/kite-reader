/**
 * Local book library. Books the family owns are imported on this machine and stored only in
 * this browser's IndexedDB (text + page images). Nothing here is bundled, committed or uploaded.
 */
import { get, set, del } from 'idb-keyval';
import { tokenize, wordLevel, BEYOND, setDictionary } from '../engine/wordLevel';

export interface LocalPage { text: string; image?: string } // image = idb key of a JPEG blob
export interface LocalBook {
  id: string; title: string; source: string; importedOn: string; pages: LocalPage[];
  analysis?: BookAnalysis;
}
export interface BookAnalysis {
  tokens: number; unique: number;
  ready95: number;            // lowest level with ≥95% of words decodable
  readyPreteach: number;      // lowest level with ≥85% decodable and ≤8 unique words to pre-teach
  preteach: string[];         // words to pre-teach at readyPreteach
  names: string[];            // capitalised story names treated as known once pre-taught
  sentences: { text: string; level: number; page: number }[];
}
export interface LibraryEntry { id: string; title: string; pages: number; cover?: string; analysis?: BookAnalysis; readPages?: number[] }

const INDEX = 'lib:index';
const TWO = new Set('am an as at be by do go he hi if in is it me my no of oh ok on or ox so to up us we'.split(' '));

export async function listBooks(): Promise<LibraryEntry[]> { return (await get<LibraryEntry[]>(INDEX)) ?? []; }
export async function getBook(id: string) { return get<LocalBook>(`lib:book:${id}`); }
export async function getImage(key: string) { return get<Blob>(key); }

export async function saveBook(book: LocalBook) {
  book.analysis = await analyzeBook(book);
  await set(`lib:book:${book.id}`, book);
  const idx = (await listBooks()).filter((b) => b.id !== book.id);
  const prev = (await listBooks()).find((b) => b.id === book.id);
  idx.push({ id: book.id, title: book.title, pages: book.pages.length, cover: book.pages.find((p) => p.image)?.image, analysis: book.analysis, readPages: prev?.readPages ?? [] });
  idx.sort((a, b) => (a.analysis?.readyPreteach ?? 999) - (b.analysis?.readyPreteach ?? 999));
  await set(INDEX, idx);
}

export async function markPageRead(id: string, page: number) {
  const idx = await listBooks();
  const e = idx.find((b) => b.id === id); if (!e) return;
  e.readPages = [...new Set([...(e.readPages ?? []), page])];
  await set(INDEX, idx);
}

export async function deleteBook(id: string) {
  const b = await getBook(id);
  for (const p of b?.pages ?? []) if (p.image) await del(p.image);
  await del(`lib:book:${id}`);
  await set(INDEX, (await listBooks()).filter((x) => x.id !== id));
}

let dictLoaded: Promise<Set<string>> | null = null;
export function dictionary() {
  dictLoaded ??= import('../content/common-words.txt?raw').then((m) => {
    const words = m.default.split('\n');
    setDictionary(words);
    return new Set(words);
  });
  return dictLoaded;
}

/** Words worth analysing: real words or names that recur in the book (drops OCR noise). */
export async function usableTokens(book: LocalBook): Promise<{ word: string; page: number }[]> {
  const dict = await dictionary();
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

export async function analyzeBook(book: LocalBook): Promise<BookAnalysis> {
  const dict = await dictionary();
  const toks = await usableTokens(book);
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

export const slug = (s: string) => s.toLowerCase().replace(/\.[a-z0-9]+$/, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);
