import { LEVELS, Level, knownGraphemes, levelByN } from '../content/levels';
import { GRAPHEMES, GRAPHEME_BY_ID } from '../content/phonemes';
import { PICTURES } from '../content/pictures';
import { segment } from './decodable';
import { Progress, dueItems } from './progress';

export type StepKind =
  | 'ear' | 'reveal' | 'hearTap' | 'seeSay' | 'hold' | 'glide' | 'alien'
  | 'readMatch' | 'build' | 'whichWord' | 'sentence' | 'banner';

export interface Step {
  uid: string;
  kind: StepKind;
  g?: string;               // grapheme
  word?: string;
  text?: string;
  options?: string[];
  ear?: { mode: 'blend' | 'onset' | 'rhyme' | 'first'; target: string; options: string[] };
  banner?: 'checkout' | 'cold' | 'story_time' | 'new_sound';
  itemId?: string;          // for spaced repetition
  itemKind?: 'grapheme' | 'word';
  phase: 'main' | 'checkout' | 'cold';
  reinjected?: boolean;
}

let uidN = 0;
const uid = () => `s${++uidN}`;

// Deterministic-enough shuffling with Math.random; fine for a home app.
export function shuffle<T>(a: T[]): T[] {
  const b = [...a];
  for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; }
  return b;
}
const pick = <T,>(a: T[], n: number) => shuffle(a).slice(0, n);
const cycle = <T,>(a: T[], n: number) => (a.length ? Array.from({ length: n }, (_, i) => a[i % a.length]) : []);

const RHYMES: string[][] = [
  ['cat', 'hat', 'bat', 'rat', 'mat'], ['fan', 'man', 'van'], ['pig', 'dig'], ['fin', 'pin', 'tin'],
  ['dad', 'mad', 'sad'], ['map', 'cap', 'nap'], ['lip', 'sip'],
];
const PICTURE_WORDS = Object.keys(PICTURES);
const BLEND_WORDS = ['fan', 'fin', 'dig', 'sad', 'map', 'pig', 'hat', 'bat', 'pin', 'sit', 'man', 'cat', 'tin', 'nap', 'lip', 'rat'];

/** Grapheme distractors: known first, then upcoming ones to fill. */
function graphemeOptions(target: string, level: number, n: number): string[] {
  const known = knownGraphemes(level).filter((g) => g !== target);
  const extra = GRAPHEMES.map((g) => g.id).filter((g) => g !== target && !known.includes(g));
  const distract = [...pick(known, n - 1), ...extra].slice(0, n - 1);
  return shuffle([target, ...distract]);
}

function wordsUpTo(level: number): string[] {
  const set = new Set<string>();
  for (const l of LEVELS) if (l.n <= level) l.words.forEach((w) => set.add(w));
  return [...set];
}

function picturableUpTo(level: number) {
  return wordsUpTo(level).filter((w) => PICTURES[w.toLowerCase()]);
}

function earStep(level: Level): Step {
  switch (level.pa) {
    case 'rhyme': {
      const fam = pick(RHYMES, 1)[0];
      const [target, answer] = pick(fam, 2);
      const others = pick(PICTURE_WORDS.filter((w) => !fam.includes(w)), 2);
      return { uid: uid(), kind: 'ear', phase: 'main', ear: { mode: 'rhyme', target, options: shuffle([answer, ...others]) }, word: answer };
    }
    case 'onset_rime':
    case 'blend2':
    case 'blend3': {
      const [answer, ...others] = pick(BLEND_WORDS, 3);
      return { uid: uid(), kind: 'ear', phase: 'main', ear: { mode: level.pa === 'onset_rime' ? 'onset' : 'blend', target: answer, options: shuffle([answer, ...others]) }, word: answer };
    }
    case 'first_sound': {
      const answer = pick(BLEND_WORDS, 1)[0];
      const first = segment(answer)![0];
      const others = pick(BLEND_WORDS.filter((w) => segment(w)![0] !== first), 2);
      return { uid: uid(), kind: 'ear', phase: 'main', ear: { mode: 'first', target: first, options: shuffle([answer, ...others]) }, word: answer };
    }
  }
}

function reviewStep(itemId: string, level: number): Step | null {
  const [type, value] = itemId.split(':');
  if (type === 'g' && GRAPHEME_BY_ID[value]) {
    return Math.random() < 0.5
      ? { uid: uid(), kind: 'hearTap', g: value, options: graphemeOptions(value, level, 3), itemId, itemKind: 'grapheme', phase: 'main' }
      : { uid: uid(), kind: 'seeSay', g: value, itemId, itemKind: 'grapheme', phase: 'main' };
  }
  if (type === 'w') return { uid: uid(), kind: 'glide', word: value, itemId, itemKind: 'word', phase: 'main' };
  return null;
}

const gStep = (kind: StepKind, g: string, level: number, phase: Step['phase'] = 'main'): Step => ({
  uid: uid(), kind, g, phase, itemId: `g:${g}`, itemKind: 'grapheme',
  options: kind === 'hearTap' ? graphemeOptions(g, level, level < 4 ? 2 : level < 8 ? 3 : 4) : undefined,
});
const wStep = (kind: StepKind, word: string, phase: Step['phase'] = 'main'): Step => ({
  uid: uid(), kind, word, phase, itemId: kind === 'alien' ? undefined : `w:${word.toLowerCase()}`, itemKind: 'word',
});

function readMatchStep(word: string, phase: Step['phase'] = 'main'): Step {
  const others = pick(PICTURE_WORDS.filter((w) => w !== word.toLowerCase()), 2);
  return { ...wStep('readMatch', word, phase), options: shuffle([word.toLowerCase(), ...others]) };
}

function buildStep(word: string, level: number): Step {
  const parts = segment(word)!;
  const decoys = pick(knownGraphemes(level).filter((g) => !parts.includes(g)), Math.min(2, Math.max(0, knownGraphemes(level).length - parts.length)));
  return { ...wStep('build', word.toLowerCase()), options: shuffle([...parts, ...decoys]) };
}

export function buildMain(p: Progress, n: number): Step[] {
  const level = levelByN(n);
  const steps: Step[] = [];
  const firstSession = (p.levels[n]?.sessions ?? 0) === 0;
  const recent = level.newGraphemes.length ? level.newGraphemes : knownGraphemes(n).slice(-3);

  // 1. Ear warm-up (oral only)
  for (let i = 0; i < 3; i++) steps.push(earStep(level));

  // 2. Spaced review
  for (const item of dueItems(p, undefined, 5)) {
    const s = reviewStep(item.id, n);
    if (s) steps.push(s);
  }

  // 3. New sound(s)
  for (const g of level.newGraphemes) {
    if (firstSession) steps.push({ uid: uid(), kind: 'banner', banner: 'new_sound', phase: 'main' });
    steps.push({ ...gStep('reveal', g, n), itemId: undefined });
    for (let i = 0; i < 3; i++) steps.push(gStep('hearTap', g, n));
    const g0 = GRAPHEME_BY_ID[g];
    if (g0.continuous) steps.push({ ...gStep('hold', g, n), itemId: undefined });
    steps.push(gStep('seeSay', g, n));
  }

  // Mixed sound practice: new + known
  const known = knownGraphemes(n);
  const mix = shuffle([...recent, ...recent, ...pick(known, Math.min(3, known.length))]);
  mix.slice(0, 4).forEach((g, i) => steps.push(gStep(i % 2 ? 'hearTap' : 'seeSay', g, n)));

  // Hold practice for level 1 (no words yet)
  if (n === 1) steps.push({ ...gStep('hold', 'a', n), itemId: undefined });

  // 4. Blending
  if (level.words.length) {
    // prefer words with the new grapheme
    const withNew = level.words.filter((w) => level.newGraphemes.some((g) => segment(w)!.includes(g)));
    cycle(shuffle(withNew.length ? [...withNew, ...level.words] : level.words), n <= 3 ? 3 : 5).forEach((w) => steps.push(wStep('glide', w)));
  }
  pick(level.nonsense, 2).forEach((w) => steps.push(wStep('alien', w)));

  // 5. Read & match
  pick(picturableUpTo(n), 3).forEach((w) => steps.push(readMatchStep(w)));

  // 6. Which word (minimal pairs)
  if (level.pairs) pick(level.pairs, 2).forEach((pair) => {
    const target = pick(pair, 1)[0];
    steps.push({ ...wStep('whichWord', target), options: shuffle(pair) });
  });

  // 7. Build it
  if (n >= 4) pick(level.words.filter((w) => w.length <= 4), 3).forEach((w) => steps.push(buildStep(w, n)));

  // 8. Sentence
  if (level.sentences.length) {
    pick(level.sentences, 1).forEach((t) => steps.push({ uid: uid(), kind: 'sentence', text: t, phase: 'main' }));
  }

  return steps;
}

export function buildCheckout(n: number, phase: 'checkout' | 'cold' = 'checkout'): Step[] {
  const level = levelByN(n);
  const count = phase === 'cold' ? 5 : 10;
  const targets = level.newGraphemes.length ? level.newGraphemes : knownGraphemes(n).slice(-4);
  const known = knownGraphemes(n);
  const steps: Step[] = [{ uid: uid(), kind: 'banner', banner: phase, phase }];
  const pool: Step[] = [
    gStep('hearTap', targets[0], n, phase),
    gStep('seeSay', targets[targets.length - 1], n, phase),
    gStep('seeSay', pick(known, 1)[0], n, phase),
    gStep('hearTap', pick(known, 1)[0], n, phase),
  ];
  const words = shuffle(wordsUpTo(n));
  words.slice(0, 3).forEach((w) => pool.push(wStep('glide', w, phase)));
  pick(level.nonsense, 2).forEach((w) => pool.push(wStep('alien', w, phase)));
  const pics = picturableUpTo(n);
  if (pics.length) pool.push(readMatchStep(pick(pics, 1)[0], phase));
  // Pad for early levels with sound items
  while (pool.length < count) pool.push(gStep(pool.length % 2 ? 'hearTap' : 'seeSay', pick(known, 1)[0], n, phase));
  const chosen = phase === 'cold' ? [pool[0], pool[1], ...shuffle(pool.slice(2)).slice(0, 3)] : shuffle(pool).slice(0, count);
  return [...steps, ...chosen];
}

export const PASS_RATIO = { checkout: 0.9, cold: 0.8 } as const;
