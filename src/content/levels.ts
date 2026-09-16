import { GRAPHEMES } from './phonemes';

export type PaSkill = 'rhyme' | 'onset_rime' | 'blend2' | 'blend3' | 'first_sound';

export interface Level {
  n: number;
  title: string;
  newGraphemes: string[]; // empty = review level
  heartWords: string[];
  words: string[];       // real words for blending/reading
  nonsense: string[];    // alien names
  sentences: string[];
  pa: PaSkill;
  /** Minimal-pair sets for "Which word?" */
  pairs?: string[][];
}

export const LEVELS: Level[] = [
  { n: 1, title: 'a', newGraphemes: ['a'], heartWords: [], words: [], nonsense: [], sentences: [], pa: 'rhyme' },
  { n: 2, title: 'm', newGraphemes: ['m'], heartWords: [], words: ['am'], nonsense: ['ma', 'mam'], sentences: [], pa: 'rhyme' },
  { n: 3, title: 's', newGraphemes: ['s'], heartWords: [], words: ['am', 'Sam'], nonsense: ['mas', 'sa', 'mam'], sentences: [], pa: 'onset_rime' },
  { n: 4, title: 't', newGraphemes: ['t'], heartWords: [], words: ['at', 'mat', 'sat', 'Sam', 'am'], nonsense: ['tam', 'tas', 'tat'], sentences: ['Sam sat.'], pa: 'onset_rime' },
  { n: 5, title: 'Review', newGraphemes: [], heartWords: [], words: ['am', 'at', 'mat', 'sat', 'Sam', 'Matt'], nonsense: ['tas', 'mas', 'tat', 'sa'], sentences: ['Sam sat.', 'Matt sat.'], pa: 'blend2' },
  { n: 6, title: 'f', newGraphemes: ['f'], heartWords: [], words: ['fat', 'at', 'sat', 'mat'], nonsense: ['faf', 'maf', 'taf', 'fam'], sentences: ['Sam sat.', 'Matt sat.'], pa: 'blend2' },
  { n: 7, title: 'd', newGraphemes: ['d'], heartWords: [], words: ['dad', 'mad', 'sad', 'add', 'Tad', 'fad'], nonsense: ['dat', 'daf', 'das'], sentences: ['Dad sat.', 'Sad Sam sat.', 'Tad sat.'], pa: 'blend3' },
  { n: 8, title: 'g', newGraphemes: ['g'], heartWords: [], words: ['gas', 'tag', 'sag', 'dad', 'mad', 'sad'], nonsense: ['gam', 'dag', 'gat', 'mag'], sentences: ['Dad sat.', 'Sad Tad sat.'], pa: 'blend3' },
  {
    n: 9, title: 'i', newGraphemes: ['i'], heartWords: [], words: ['it', 'sit', 'if', 'fit', 'dig', 'did', 'fig', 'Sid', 'mitt'],
    nonsense: ['mif', 'tig', 'sim', 'dif'], sentences: ['Sid sat.', 'Dad did it.', 'Sam did it.'], pa: 'first_sound',
    pairs: [['sat', 'sit'], ['fat', 'fit'], ['dad', 'did'], ['mad', 'mid']],
  },
  {
    n: 10, title: 'n', newGraphemes: ['n'], heartWords: [], words: ['in', 'tin', 'fin', 'man', 'fan', 'tan', 'nag', 'Nan', 'din', 'Dan'],
    nonsense: ['nim', 'naf', 'nid', 'gan'], sentences: ['Dan sat.', 'Nan did it.', 'Dad sat in it.'],
    pa: 'first_sound', pairs: [['tan', 'tin'], ['fan', 'fin'], ['man', 'min'], ['sat', 'sit']],
  },
];

export const MAX_LEVEL = LEVELS.length;
export const levelByN = (n: number) => LEVELS.find((l) => l.n === n)!;

/** Level where a grapheme becomes available. */
export const graphemeLevel = (g: string) => GRAPHEMES.find((x) => x.id === g)?.level ?? Infinity;

/** Graphemes available (taught) at level n. */
export function knownGraphemes(n: number): string[] {
  return GRAPHEMES.filter((g) => g.level <= n).map((g) => g.id);
}
