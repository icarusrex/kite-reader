import { LEVELS, Level, knownGraphemes, levelByN } from '../content/levels';
import { GRAPHEMES, GRAPHEME_BY_ID } from '../content/phonemes';
import { CLEAR_WORDS, PICTURES, storyPictureUrl } from '../content/pictures';
import { checkText, segment } from './decodable';
import BOOK_SENTENCES from '../content/bookSentences.json';
import { wordLevel } from './wordLevel';
import { Progress, dueItems } from './progress';

export type StepKind =
  | 'ear' | 'medial' | 'segment' | 'meaning'
  | 'reveal' | 'hearTap' | 'seeSay' | 'hold' | 'glide' | 'alien'
  | 'readMatch' | 'build' | 'whichWord' | 'sentence' | 'story' | 'banner' | 'heart'
  | 'meet' | 'sayFast' | 'rhyme' | 'trackGame';

export interface Step {
  uid: string;
  kind: StepKind;
  g?: string;               // grapheme or target phoneme for PA
  word?: string;
  text?: string;
  lines?: string[];         // story sentences
  image?: string;           // story illustration
  options?: string[];
  ear?: { mode: 'blend' | 'onset' | 'rhyme' | 'first' | 'last'; target: string; options: string[] };
  banner?: 'checkout' | 'cold' | 'story_time' | 'new_sound' | 'level_done';
  itemId?: string;          // for spaced repetition
  itemKind?: 'grapheme' | 'word';
  phase: 'main' | 'checkout' | 'cold';
  reinjected?: boolean;
  required?: boolean;       // newly taught item that must be correct for assessment to pass
  model?: boolean;          // heart word: first exposure is shown and modelled, not scored
  demo?: boolean;           // "watch me": the activity is shown with the answer, not scored
  fast?: { mode: 'compound' | 'syllable' | 'stretch' };
  pair?: [string, string];
  rhymes?: boolean;
  source?: string;
}

let uidN = 0;
const uid = () => `s${++uidN}`;

export function shuffle<T>(a: T[]): T[] {
  const b = [...a];
  for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; }
  return b;
}
const pick = <T,>(a: T[], n: number) => shuffle(a).slice(0, n);
const cycle = <T,>(a: T[], n: number) => (a.length ? Array.from({ length: n }, (_, i) => a[i % a.length]) : []);

const RHYMES: string[][] = [['cat', 'hat', 'bat'], ['dog', 'log'], ['ten', 'pen']];
const PICTURE_WORDS = Object.keys(PICTURES);
const BLEND_WORDS = CLEAR_WORDS;
const CVC_PICTURE_WORDS = CLEAR_WORDS.filter((w) => segment(w)?.length === 3);

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
      const others = pick(CLEAR_WORDS.filter((w) => !fam.includes(w)), 2);
      return { uid: uid(), kind: 'ear', phase: 'main', ear: { mode: 'rhyme', target, options: shuffle([answer, ...others]) }, word: answer };
    }
    case 'onset_rime':
    case 'blend2':
    case 'blend3': {
      const [answer, ...others] = pick(BLEND_WORDS, 3);
      return { uid: uid(), kind: 'ear', phase: 'main', ear: { mode: level.pa === 'onset_rime' ? 'onset' : 'blend', target: answer, options: shuffle([answer, ...others]) }, word: answer };
    }
    case 'first_sound':
    case 'final_sound': {
      const at = level.pa === 'first_sound' ? 0 : -1;
      const sound = (w: string) => segment(w)!.at(at)!;
      const answer = pick(BLEND_WORDS, 1)[0];
      const others = pick(BLEND_WORDS.filter((w) => sound(w) !== sound(answer)), 2);
      return { uid: uid(), kind: 'ear', phase: 'main', ear: { mode: at === 0 ? 'first' : 'last', target: sound(answer), options: shuffle([answer, ...others]) }, word: answer };
    }
    case 'medial_sound': {
      const answer = pick(CVC_PICTURE_WORDS, 1)[0];
      const middle = segment(answer)![1];
      const others = pick(CVC_PICTURE_WORDS.filter((w) => segment(w)![1] !== middle), 2);
      return { uid: uid(), kind: 'medial', phase: 'main', word: answer, g: middle, options: shuffle([answer, ...others]) };
    }
    case 'segment3': {
      const answer = pick(CVC_PICTURE_WORDS, 1)[0];
      return { uid: uid(), kind: 'segment', phase: 'main', word: answer };
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
  if (type === 'h') return { uid: uid(), kind: 'heart', word: value, itemId, itemKind: 'word', phase: 'main' };
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

/** Tiny meaning check. It deliberately checks comprehension without adding new print demands. */
function meaningStep(text: string[]): Step | null {
  const tokens = text.join(' ').toLowerCase().match(/[a-z]+/g) ?? [];
  const present = [...new Set(tokens.filter((w) => !!PICTURES[w]))];
  if (!present.length) return null;
  const answer = pick(present, 1)[0];
  const others = pick(PICTURE_WORDS.filter((w) => !present.includes(w)), 2);
  if (others.length < 2) return null;
  return { uid: uid(), kind: 'meaning', word: answer, options: shuffle([answer, ...others]), phase: 'main' };
}

export interface SessionExtras {
  sentences: { text: string; source: string }[];
  heart: { word: string; source: string }[];
}

export function buildMain(p: Progress, n: number, extras?: SessionExtras): Step[] {
  const level = levelByN(n);
  const steps: Step[] = [];
  const firstSession = (p.levels[n]?.sessions ?? 0) === 0;
  const recent = level.newGraphemes.length ? level.newGraphemes : knownGraphemes(n).slice(-3);

  // 1. Oral phonemic-awareness warm-up.
  for (let i = 0; i < 4; i++) steps.push({ ...earStep(level), ...(i === 0 && n <= 5 ? { demo: true } : {}) });

  // 2. Spaced review.
  for (const item of dueItems(p, undefined, 5)) {
    const s = reviewStep(item.id, n);
    if (s) steps.push(s);
  }

  // 3. New sound(s).
  for (const g of level.newGraphemes) {
    if (firstSession) steps.push({ uid: uid(), kind: 'banner', banner: 'new_sound', phase: 'main' });
    steps.push({ ...gStep('reveal', g, n), itemId: undefined });
    for (let i = 0; i < 3; i++) steps.push(gStep('hearTap', g, n));
    const g0 = GRAPHEME_BY_ID[g];
    if (g0.continuous) steps.push({ ...gStep('hold', g, n), itemId: undefined });
    steps.push(gStep('seeSay', g, n));
  }

  for (let i = 0; i < 2 && level.contrast; i++) {
    const g = pick(level.contrast, 1)[0];
    steps.push({ ...gStep('hearTap', g, n), options: shuffle([...level.contrast]) });
  }

  for (const h of level.heartWords) {
    const seen = p.items[`h:${h}`]?.seen ?? 0;
    if (seen < 3) steps.push({ uid: uid(), kind: 'heart', word: h, model: true, phase: 'main' });
    if (seen < 6) steps.push({ uid: uid(), kind: 'heart', word: h, itemId: `h:${h}`, itemKind: 'word', phase: 'main' });
  }

  const known = knownGraphemes(n);
  const mix = shuffle([...recent, ...recent, ...pick(known, Math.min(3, known.length))]);
  mix.slice(0, 4).forEach((g, i) => steps.push(gStep(i % 2 ? 'hearTap' : 'seeSay', g, n)));
  if (n === 1) steps.push({ ...gStep('hold', 'a', n), itemId: undefined });

  // 4. Blending. Alien words ramp in gradually: meaningful early wins first, diagnostic nonsense later.
  if (level.words.length) {
    const withNew = level.words.filter((w) => level.newGraphemes.some((g) => segment(w)!.includes(g)));
    cycle(shuffle(withNew.length ? [...withNew, ...level.words] : level.words), n <= 3 ? 3 : 5).forEach((w) => steps.push(wStep('glide', w)));
  }
  const alienCount = n <= 3 ? 0 : n <= 10 ? 1 : 2;
  pick(level.nonsense, alienCount).forEach((w) => steps.push(wStep('alien', w)));

  // 5. Read & match.
  pick(picturableUpTo(n), 3).forEach((w) => steps.push(readMatchStep(w)));

  // 6. Minimal pairs.
  if (level.pairs) pick(level.pairs, 2).forEach((pair) => {
    const target = pick(pair, 1)[0];
    steps.push({ ...wStep('whichWord', target), options: shuffle(pair) });
  });

  // 7. Encoding.
  if (n >= 4) pick(level.words.filter((w) => w.length <= 4), 3).forEach((w) => steps.push(buildStep(w, n)));

  // 8. Connected text, then one tiny meaning check when a clear picture target is available.
  const newHeart = (extras?.heart ?? []).filter((h) => !p.items[`h:${h.word}`]).slice(0, 2);
  for (const h of newHeart) {
    steps.push({ uid: uid(), kind: 'heart', word: h.word, source: h.source, model: true, phase: 'main' });
    steps.push({ uid: uid(), kind: 'heart', word: h.word, source: h.source, itemId: `h:${h.word}`, itemKind: 'word', phase: 'main' });
  }

  const local = (extras?.sentences ?? []).filter((x) => n > LEVELS.length || checkText(x.text, n, heartUpTo(n)).ratio === 1);
  const fromBooks = [...bookSentencesFor(n).map((b) => ({ text: b.text, source: BOOK_TITLES[b.book] ?? b.book })), ...local];
  const sessionsHere = p.levels[n]?.sessions ?? 0;
  let connected: Step | undefined;
  if (level.story && sessionsHere % 2 === 1) {
    connected = { uid: uid(), kind: 'story', lines: level.story, image: storyPictureUrl(n), phase: 'main' };
  } else if (fromBooks.length && Math.random() < 0.5) {
    const b = pick(fromBooks, 1)[0];
    connected = { uid: uid(), kind: 'sentence', text: b.text, source: b.source, phase: 'main' };
  } else if (level.sentences.length) {
    const t = pick(level.sentences, 1)[0];
    connected = { uid: uid(), kind: 'sentence', text: t, phase: 'main' };
  }
  if (connected) {
    steps.push(connected);
    const meaning = meaningStep(connected.lines ?? [connected.text!]);
    if (meaning) steps.push(meaning);
  }

  return steps;
}

export function buildCheckout(n: number, phase: 'checkout' | 'cold' = 'checkout'): Step[] {
  const level = levelByN(n);
  const baseCount = phase === 'cold' ? 5 : 10;
  const known = knownGraphemes(n);
  const recent = known.slice(-4);
  const steps: Step[] = [{ uid: uid(), kind: 'banner', banner: phase, phase }];

  // Every newly taught grapheme is guaranteed into checkout/cold check in both receptive and productive form.
  const required: Step[] = level.newGraphemes.flatMap((g) => [
    { ...gStep('hearTap', g, n, phase), required: true },
    { ...gStep('seeSay', g, n, phase), required: true },
  ]);

  const count = Math.max(baseCount, required.length);
  const pool: Step[] = [...required];
  if (!required.length && recent.length) {
    pool.push(gStep('hearTap', recent[0], n, phase), gStep('seeSay', recent[recent.length - 1], n, phase));
  }
  pool.push(gStep('seeSay', pick(known, 1)[0], n, phase));
  pool.push(gStep('hearTap', pick(known, 1)[0], n, phase));

  const words = shuffle(wordsUpTo(n));
  words.slice(0, 3).forEach((w) => pool.push(wStep('glide', w, phase)));
  const alienCount = n <= 3 ? 0 : n <= 10 ? 1 : 2;
  pick(level.nonsense, alienCount).forEach((w) => pool.push(wStep('alien', w, phase)));
  const pics = picturableUpTo(n);
  if (pics.length) pool.push(readMatchStep(pick(pics, 1)[0], phase));
  while (pool.length < count) pool.push(gStep(pool.length % 2 ? 'hearTap' : 'seeSay', pick(known, 1)[0], n, phase));

  const rest = pool.slice(required.length);
  const chosen = [...required, ...shuffle(rest).slice(0, Math.max(0, count - required.length))].slice(0, count);
  return [...steps, ...chosen];
}

const BOOK_TITLES: Record<string, string> = { 'wizard-of-oz': 'The Wonderful Wizard of Oz', 'winnie-the-pooh': 'Winnie-the-Pooh' };
export const heartUpTo = (n: number) => LEVELS.filter((l) => l.n <= n).flatMap((l) => l.heartWords);

export function bookSentencesFor(n: number) {
  return (BOOK_SENTENCES as { book: string; chapter: number; text: string; level: number }[]).filter((b) => {
    if (b.level > n) return false;
    if (n <= LEVELS.length) return checkText(b.text, n, heartUpTo(n)).ratio === 1;
    return b.text.split(/\s+/).every((w) => wordLevel(w).level <= n);
  });
}

export const PASS_RATIO = { checkout: 0.9, cold: 0.8 } as const;
export interface AssessmentTally { answered: number; correct: number }

/** Aggregate accuracy is necessary but not sufficient: all explicitly required new-concept probes must be correct. */
export function passesAssessment(phase: 'checkout' | 'cold', tally: AssessmentTally, required: AssessmentTally): boolean {
  const ratio = tally.answered ? tally.correct / tally.answered : 1;
  const requiredPass = required.answered === 0 || required.correct === required.answered;
  return ratio >= PASS_RATIO[phase] && requiredPass;
}

export function storyFor(n: number): string[] | undefined {
  return storyLevel(n)?.story;
}
export const storyLevel = (n: number) => [...LEVELS].reverse().find((l) => l.n <= n && l.story);
