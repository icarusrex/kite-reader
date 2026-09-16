/**
 * Estimates the curriculum level (1–120, 121 = beyond / Stage 6) at which a word
 * becomes decodable, using the full scope & sequence from "Curriculum v1".
 * Heuristic by design: English spelling is ambiguous, so explicit word lists
 * resolve the common exceptions. Used for the book library audit and content checks.
 */

export const BEYOND = 121;

export const HEART_WORDS: Record<string, number> = {
  a: 1, the: 25, is: 35, as: 35, has: 35, his: 35, they: 45, i: 70, want: 70, to: 71, do: 71, into: 71, onto: 71,
  you: 85, said: 86, what: 96, where: 96, there: 96, here: 96, of: 96, could: 98, would: 98, should: 98,
  any: 100, many: 100, tomorrow: 109, today: 109, father: 109, bye: 110, your: 110, friend: 110,
  again: 112, were: 112, some: 113, horse: 113, hooray: 113, our: 115, eyes: 115, eye: 115, air: 115,
  oh: 117, have: 117, put: 117, away: 117, one: 118, whole: 118, worth: 118, able: 118,
};

/** Irregular or ambiguous words not covered by the rules. */
const EXCEPTIONS: Record<string, number> = {
  was: BEYOND, who: BEYOND, two: BEYOND, come: BEYOND, done: BEYOND, love: BEYOND, give: BEYOND, live: BEYOND,
  other: 97, mother: 97, brother: 97, does: BEYOND, goes: 83, gone: BEYOND, son: BEYOND, won: BEYOND,
  once: BEYOND, only: BEYOND, very: 116, every: 116, pretty: BEYOND, busy: BEYOND, both: BEYOND, most: BEYOND,
  almost: BEYOND, post: BEYOND, find: BEYOND, kind: BEYOND, mind: BEYOND, behind: BEYOND, child: BEYOND, wild: BEYOND,
  old: BEYOND, cold: BEYOND, told: BEYOND, gold: BEYOND, hold: BEYOND, push: BEYOND, pull: BEYOND, full: BEYOND,
  pushes: BEYOND, watch: BEYOND, wash: BEYOND, water: BEYOND, walk: BEYOND, talk: BEYOND, heavy: BEYOND,
  head: BEYOND, bread: BEYOND, ready: BEYOND, dead: BEYOND, great: BEYOND, break: BEYOND, sure: BEYOND,
  honey: BEYOND, money: BEYOND, people: BEYOND, laugh: BEYOND, cries: 119, tries: 119, pies: 51,
  nothing: BEYOND, something: BEYOND, everything: BEYOND, usual: BEYOND, making: BEYOND, taking: BEYOND, having: BEYOND, coming: BEYOND,
  woke: 54, gave: 56, came: 56, snort: 64, girl: 66, bird: 66, first: 66, sorry: BEYOND, good: 102, mr: BEYOND, mrs: BEYOND,
};

const LONG_OW = new Set(['snow', 'grow', 'show', 'slow', 'blow', 'low', 'own', 'bowl', 'yellow', 'window', 'follow', 'below', 'glow', 'throw', 'flow', 'grown', 'shown', 'know']);
const SHORT_OO = new Set(['look', 'book', 'books', 'good', 'foot', 'wood', 'cook', 'stood', 'took', 'hook', 'wool', 'looked', 'looking', 'shook', 'hood']);
const VOICED_TH = new Set(['this', 'that', 'then', 'them', 'than', 'these', 'those', 'though', 'together', 'weather', 'feather', 'either', 'whether', 'thus']);
const HARD_G = new Set(['get', 'gets', 'give', 'gift', 'girl', 'gig', 'giggle', 'begin', 'together', 'forget', 'target', 'tiger', 'geese', 'gear', 'jiggle', 'wiggle', 'wriggle', 'buggy', 'foggy', 'doggy', 'piggy', 'soggy']);

const ONSETS: Record<string, number> = {
  sn: 32, sw: 33, fl: 34, fr: 36, sk: 40, sc: 43, sp: 42, st: 31, bl: 46, gl: 46, sl: 46, sm: 46, cl: 47, gr: 47, pr: 47,
  pl: 48, tw: 48, str: 48, br: 49, tr: 49, cr: 50, dr: 50, spl: 50, spr: 50, scr: 50, squ: 88, thr: 50, shr: 50,
};
const CODAS: Record<string, number> = { nd: 27, mp: 29, ft: 30, st: 31, sk: 40, sp: 42 };

const SINGLE: Record<string, number> = {
  a: 1, m: 2, s: 3, t: 4, f: 6, d: 7, g: 8, i: 9, n: 10, p: 11, h: 12, b: 13, l: 14, j: 15, c: 16, v: 17, w: 18,
  r: 19, k: 20, o: 26, u: 39, e: 44, y: 84, x: 89, z: 90, q: 88,
};

// Ordered longest-first; each entry: pattern, level
const MULTI: [string, number][] = [
  ['ough', BEYOND], ['eigh', BEYOND], ['tion', BEYOND], ['ture', BEYOND],
  ['ouse', 104], ['igh', 107], ['air', 115], ['ear', BEYOND], ['all', 92], ['are', 63], ['ore', 64], ['tch', BEYOND], ['dge', BEYOND],
  ['ck', 21], ['sh', 22], ['ch', 23], ['th', 24], ['ng', 37], ['nk', 38], ['wh', 95], ['qu', 88], ['kn', 114], ['wr', 114], ['ph', BEYOND],
  ['ee', 59], ['ea', 75], ['oa', 76], ['ai', 73], ['ay', 72], ['oi', 80], ['oy', 81], ['ou', 78], ['ow', 77], ['aw', 91], ['ew', 111],
  ['oo', 101], ['ie', 51], ['oe', 53], ['ue', 57], ['ey', BEYOND], ['au', BEYOND], ['ui', BEYOND], ['gh', BEYOND],
  ['ar', 62], ['or', 64], ['er', 65], ['ir', 66], ['ur', 67],
];

const VOWELS = 'aeiouy';

export interface WordLevel { word: string; level: number; reasons: string[] }

function syllables(w: string): number {
  let core = w.replace(/e$/, '').replace(/le$/, 'l');
  if (w.endsWith('le') && w.length > 3) core = w.slice(0, -2) + 'ul';
  const groups = core.match(/[aeiouy]+/g) ?? [];
  return Math.max(1, groups.length);
}

function core(w: string, reasons: string[]): number {
  let level = 1;
  const bump = (l: number, why: string) => { if (l > level) level = l; if (l > 1) reasons.push(`${why}→${l}`); };

  if (w in EXCEPTIONS) { bump(EXCEPTIONS[w], w); return level; }
  if (VOICED_TH.has(w)) bump(97, 'voiced th');
  if (w.includes('oo')) bump(SHORT_OO.has(w) ? 102 : 101, 'oo');
  if (w.includes('ow') && LONG_OW.has(w)) bump(106, 'ow(snow)');

  // open syllables: he/me/we/she/be, go/no/so, my/by/fly
  if (/^(sh|[bhmw])e$/.test(w)) bump(82, 'open e');
  if (/^(n|g|s)o$/.test(w)) bump(83, 'open o');
  if (/^[^aeiou]+y$/.test(w)) bump(93, '-y (my)');
  else if (/[^aeiouy]y$/.test(w) && w.length > 3) bump(116, '-y (happy)');
  if (/[^aeiou]le$/.test(w)) bump(108, '-le');

  // soft c / g
  if (/c[eiy]/.test(w)) bump(BEYOND, 'soft c');
  if (/g[eiy]/.test(w) && !HARD_G.has(w) && !/gg[eiy]/.test(w) && !/ng[eiy]/.test(w)) bump(120, 'soft g');

  // split digraphs (magic e)
  const split = w.match(/([aeiou])([bcdfgklmnpstvz])e$/);
  if (split && !/[aeiou]{2}[^aeiou]e$/.test(w)) {
    const lv = { a: 56, i: 52, o: 54, u: 58, e: 60 }[split[1] as 'a'];
    if (w.endsWith('ve') && !/[aio]ve$/.test(w)) bump(BEYOND, '-ve');
    bump(lv, `${split[1]}-e`);
    w = w.slice(0, -1);
  } else if (/ouse$/.test(w)) {
    bump(104, 'ouse'); w = w.slice(0, -1);
  } else if (/[aeiou]{2}[sv]e$/.test(w)) {
    w = w.slice(0, -1); // goose, loose, cheese: silent e after a team
  }

  // clusters
  const onset = w.match(/^[^aeiouy]+/)?.[0] ?? '';
  const on = onset.replace(/^(sh|ch|th|wh|ck|qu|kn|wr|ph)$/, '');
  if (on.length >= 2) {
    const key = on.startsWith('squ') ? 'squ' : on;
    if (ONSETS[key]) bump(ONSETS[key], `onset ${key}`);
    else if (!['sh', 'ch', 'th', 'wh', 'kn', 'wr', 'ph', 'qu'].includes(on) && !/^(sh|ch|th|wh)[r]$/.test(on)) bump(50, `onset ${on}`);
    if (/^(shr|thr)$/.test(on)) bump(50, `onset ${on}`);
  }
  const coda = w.match(/[^aeiouy]+$/)?.[0] ?? '';
  const cd = coda.replace(/^(r)/, '').replace(/(ck|sh|ch|th|ng|nk|ss|ll|ff|zz|tt|dd|gg)$/, '');
  if (cd.length >= 2) bump(CODAS[cd] ?? 50, `coda ${cd}`);

  // graphemes
  let i = 0;
  while (i < w.length) {
    const m = MULTI.find(([p]) => w.startsWith(p, i));
    if (m) {
      let lv = m[1];
      if (m[0] === 'th' && VOICED_TH.has(w)) lv = 97;
      if (m[0] === 'ow' && LONG_OW.has(w)) lv = 106;
      if (m[0] === 'oo') lv = SHORT_OO.has(w) ? 102 : 101;
      bump(lv, m[0]);
      i += m[0].length;
      continue;
    }
    const ch = w[i];
    if (ch === 'y' && i > 0) { i++; continue; } // handled by -y rules
    bump(SINGLE[ch] ?? BEYOND, ch);
    i++;
  }

  const syl = syllables(w);
  if (syl >= 3) bump(BEYOND, '3+ syllables');
  else if (syl === 2) bump(65, '2 syllables');
  return level;
}

const cache = new Map<string, WordLevel>();

let DICT: Set<string> | null = null;
/** Optional dictionary of real English words; enables compound splitting (sometimes, himself). */
export function setDictionary(words: Iterable<string>) { DICT = new Set(words); cache.clear(); }

export function wordLevel(raw: string): WordLevel {
  const word = raw.toLowerCase().replace(/[’]/g, "'").replace(/[^a-z']/g, '');
  if (cache.has(word)) return cache.get(word)!;
  const reasons: string[] = [];
  const res = (level: number): WordLevel => { const r = { word, level: Math.min(level, BEYOND), reasons }; cache.set(word, r); return r; };

  if (!word) return res(1);
  if (word in HEART_WORDS) { reasons.push('heart word'); return res(HEART_WORDS[word]); }

  // contractions & possessives
  if (word.includes("'")) {
    const [base, tail] = word.split("'");
    const b = wordLevel(base).level;
    if (tail === 's' && !['it', 'he', 'she', 'let', 'that', 'what', 'there', 'here'].includes(base)) { reasons.push("possessive 's"); return res(Math.max(b, 28)); }
    reasons.push('contraction');
    const alias: Record<string, string> = { don: 'do', can: 'can', won: 'will' };
    return res(Math.max(wordLevel(alias[base] ?? base).level, BEYOND));
  }

  if (word in EXCEPTIONS) { reasons.push('exception'); return res(EXCEPTIONS[word]); }

  // compounds: sometimes, himself, anywhere, upside
  for (let k = 2; k <= word.length - 2; k++) {
    const a = word.slice(0, k), b = word.slice(k);
    if (!DICT) break;
    const part = (s: string) => s in HEART_WORDS || (DICT!.has(s) && (s.length >= 3 || ['up', 'in', 'on', 'at', 'it', 'us'].includes(s)));
    if (!part(a) || !part(b)) continue;
    const la = wordLevel(a).level, lb = wordLevel(b).level;
    if (la < BEYOND && lb < BEYOND) {
      reasons.push(`compound ${a}+${b}`);
      return res(Math.max(la, lb, 65));
    }
  }

  // inflections
  const tryBase = (base: string, lv: number, why: string): WordLevel | null => {
    if (base.length < 2) return null;
    const b = wordLevel(base);
    if (b.level >= BEYOND && !(base in HEART_WORDS)) return null;
    reasons.push(why, ...b.reasons);
    return res(Math.max(b.level, lv));
  };
  if (/[^s]s$/.test(word) && !/(ss|us|is)$/.test(word)) {
    if (/(sh|ch|x|z|ss)es$/.test(word)) { const r = tryBase(word.slice(0, -2), 44, '-es'); if (r) return r; }
    // "gas", "yes", "bus": what's left isn't a word, so the s belongs to the word rather than being an ending.
    const base = word.slice(0, -1);
    const isWord = base.length === 2 ? ['it', 'up', 'at', 'in', 'on', 'go', 'do', 'no', 'so', 'me', 'we', 'he'].includes(base) : !DICT || DICT.has(base) || base in HEART_WORDS;
    if (isWord) { const r = tryBase(base, 28, '-s'); if (r) return r; }
  }
  if (word.endsWith('ed') && word.length > 4) {
    const stem = word.slice(0, -2);
    const r = tryBase(stem, 105, '-ed') ?? tryBase(stem + 'e', 105, '-ed') ?? (/(.)\1$/.test(stem) ? tryBase(stem.slice(0, -1), 105, '-ed') : null);
    if (r) return r;
  }
  if (word.endsWith('ing') && word.length > 4) {
    const stem = word.slice(0, -3);
    const r = tryBase(stem, 37, '-ing') ?? (/(.)\1$/.test(stem) ? tryBase(stem.slice(0, -1), 65, '-ing') : null) ?? tryBase(stem + 'e', BEYOND, '-ing (drop e)');
    if (r) return r;
  }

  return res(core(word, reasons));
}

export function tokenize(text: string): string[] {
  return (text.replace(/[’‘]/g, "'").replace(/-/g, ' ').match(/[A-Za-z]+(?:'[A-Za-z]+)?/g) ?? []);
}
