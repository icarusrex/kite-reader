/**
 * Mine the public-domain read-aloud books:
 *  - sentences decodable at each level (used as "real book" sentences in sessions)
 *  - per-chapter readability at curriculum checkpoints
 * Writes src/content/bookSentences.json and src/content/readaloud/stats.json
 *   npm run mine
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { tokenize, wordLevel, BEYOND, setDictionary } from '../src/engine/wordLevel';
setDictionary(readFileSync('src/content/common-words.txt', 'utf8').split('\n'));

interface Book { id: string; title: string; chapters: { n: number; title: string; paragraphs: string[] }[] }
const BOOKS = ['wizard-of-oz', 'winnie-the-pooh'].map((id) => JSON.parse(readFileSync(`src/content/readaloud/${id}.json`, 'utf8')) as Book);
const CHECKPOINTS = [20, 50, 71, 103, 120];
// Proper nouns a child learns as whole words from the story; treated as pre-taught names.
const NAMES = new Set(['dorothy', 'toto', 'oz', 'pooh', 'piglet', 'eeyore', 'kanga', 'roo', 'owl', 'rabbit', 'christopher', 'robin', 'em', 'henry']);

export interface BookSentence { book: string; chapter: number; text: string; level: number; words: number }
const sentences: BookSentence[] = [];
const seen = new Set<string>();
const stats: Record<string, { chapter: number; title: string; words: number; pctDecodable: Record<number, number> }[]> = {};

for (const b of BOOKS) {
  stats[b.id] = [];
  for (const ch of b.chapters) {
    const tokens: number[] = [];
    for (const para of ch.paragraphs) {
      for (const w of tokenize(para)) tokens.push(NAMES.has(w.toLowerCase()) ? 1 : wordLevel(w).level);
      const parts = para.replace(/[“”"]/g, '').split(/(?<=[.!?])\s+/);
      for (const raw of parts) {
        const text = raw.trim().replace(/^[—–\-\s]+/, '');
        const toks = tokenize(text);
        if (toks.length < 2 || toks.length > 10) continue;
        if (!/^[A-Z]/.test(text) || !/[.!?]$/.test(text) || /[;:()—]|\w-\w/.test(text)) continue;
        if (toks.slice(1).some((t) => /^[A-Z]/.test(t) && !NAMES.has(t.toLowerCase()) && t !== 'I')) continue;
        const level = Math.max(...toks.map((t) => (NAMES.has(t.toLowerCase()) ? BEYOND : wordLevel(t).level)));
        if (level >= BEYOND) continue;
        const key = text.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        sentences.push({ book: b.id, chapter: ch.n, text, level, words: toks.length });
      }
    }
    const pct: Record<number, number> = {};
    for (const cp of CHECKPOINTS) pct[cp] = Math.round((100 * tokens.filter((l) => l <= cp).length) / Math.max(1, tokens.length));
    stats[b.id].push({ chapter: ch.n, title: ch.title, words: tokens.length, pctDecodable: pct });
  }
}

sentences.sort((a, b) => a.level - b.level || a.words - b.words);
writeFileSync('src/content/bookSentences.json', JSON.stringify(sentences, null, 0));
writeFileSync('src/content/readaloud/stats.json', JSON.stringify(stats, null, 1));

const byBand = (lo: number, hi: number) => sentences.filter((s) => s.level >= lo && s.level <= hi).length;
console.log(`sentences: ${sentences.length}`);
for (const [lo, hi] of [[1, 10], [11, 20], [21, 50], [51, 71], [72, 103], [104, 120]]) console.log(`  L${lo}-${hi}: ${byBand(lo, hi)}`);
console.log('first 25:', sentences.slice(0, 25).map((s) => `L${s.level} ${s.text}`).join(' | '));
for (const b of BOOKS) {
  const all = stats[b.id];
  const avg = (cp: number) => Math.round(all.reduce((a, c) => a + c.pctDecodable[cp] * c.words, 0) / all.reduce((a, c) => a + c.words, 0));
  console.log(b.id, CHECKPOINTS.map((cp) => `L${cp}:${avg(cp)}%`).join(' '));
}
