import { LEVELS } from '../content/levels';
import { Progress } from './progress';
import { HEART_WORDS, tokenize, wordLevel } from './wordLevel';

const clean = (word: string) => word.toLowerCase().replace(/[’]/g, "'").replace(/[^a-z']/g, '');

export function curriculumHeartWords(level: number): string[] {
  return LEVELS.filter((l) => l.n <= level).flatMap((l) => l.heartWords).map((w) => w.toLowerCase());
}

export function learnedHeartWords(p: Progress): Set<string> {
  const out = new Set<string>();
  for (const [id, item] of Object.entries(p.items)) if (id.startsWith('h:') && item.seen > 0) out.add(id.slice(2).toLowerCase());
  return out;
}

export function canDecodeWord(p: Progress, raw: string, level: number, extraHeart: Iterable<string> = []): boolean {
  const word = clean(raw);
  if (!word) return true;
  const hearts = learnedHeartWords(p);
  for (const h of extraHeart) hearts.add(clean(h));
  if (hearts.has(word)) return true;
  // A curriculum heart word is not considered readable merely because its nominal level has arrived.
  if (word in HEART_WORDS || curriculumHeartWords(level).includes(word)) return false;
  return wordLevel(word).level <= level;
}

export function canDecodeText(p: Progress, text: string, level: number, extraHeart: Iterable<string> = []) {
  const words = tokenize(text);
  const failures = words.filter((w) => !canDecodeWord(p, w, level, extraHeart));
  return { total: words.length, decodable: words.length - failures.length, ratio: words.length ? (words.length - failures.length) / words.length : 1, failures };
}

export function levelHeartWordsReady(p: Progress, level: number, correctThisSession: ReadonlySet<string> = new Set()): boolean {
  const heart = LEVELS.find((l) => l.n === level)?.heartWords ?? [];
  return heart.every((w) => {
    const id = `h:${w}`;
    return (p.items[id]?.correct ?? 0) > 0 || correctThisSession.has(id);
  });
}
