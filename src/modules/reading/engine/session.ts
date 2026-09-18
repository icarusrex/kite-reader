import { LEVELS, Level, knownGraphemes, levelByN } from '../content/levels';
import { GRAPHEMES, GRAPHEME_BY_ID, soundOf } from '../content/phonemes';
import { CLEAR_WORDS, PICTURES, storyPictureUrl } from '../content/pictures';
import { checkText, encodingChunks, hasVoicedFinalS, segment } from './decodable';
import BOOK_SENTENCES from '../content/bookSentences.json';
import { wordLevel } from './wordLevel';
import { Progress, dueItems } from './progress';
import { canDecodeText, learnedHeartWords, levelHeartWordsReady } from './knowledge';

export type StepKind =
  | 'ear' | 'medial' | 'segment' | 'meaning'
  | 'reveal' | 'hearTap' | 'seeSay' | 'hold' | 'glide' | 'alien'
  | 'readMatch' | 'build' | 'whichWord' | 'sentence' | 'story' | 'banner' | 'heart'
  | 'meet' | 'sayFast' | 'rhyme' | 'trackGame';

export interface Step {
  uid: string;
  kind: StepKind;
  g?: string;
  word?: string;
  text?: string;
  lines?: string[];
  image?: string;
  options?: string[];
  ear?: { mode: 'blend' | 'onset' | 'rhyme' | 'first' | 'last'; target: string; options: string[] };
  banner?: 'checkout' | 'cold' | 'story_time' | 'new_sound' | 'level_done';
  itemId?: string;
  itemKind?: 'grapheme' | 'word';
  phase: 'main' | 'checkout' | 'cold';
  reinjected?: boolean;
  required?: boolean;
  model?: boolean;
  demo?: boolean;
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
  const other = (g: string) => g !== target && soundOf(g) !== soundOf(target);
  const known = knownGraphemes(level).filter(other);
  const extra = GRAPHEMES.map((g) => g.id).filter((g) => other(g) && !known.includes(g));
  return shuffle([target, ...[...pick(known, n - 1), ...extra].slice(0, n - 1)]);
}

function wordsUpTo(level: number): string[] {
  const set = new Set<string>();
  for (const l of LEVELS) if (l.n <= level) l.words.forEach((w) => set.add(w));
  return [...set];
}
const picturableUpTo = (level: number) => wordsUpTo(level).filter((w) => PICTURES[w.toLowerCase()]);

function earStep(level: Level): Step {
  switch (level.pa) {
    case 'rhyme': {
      const fam = pick(RHYMES, 1)[0];
      const [target, answer] = pick(fam, 2);
      return { uid: uid(), kind: 'ear', phase: 'main', ear: { mode: 'rhyme', target, options: shuffle([answer, ...pick(CLEAR_WORDS.filter((w) => !fam.includes(w)), 2)]) }, word: answer };
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
      const sound = (w: string) => { const parts = segment(w)!; return at === 0 ? parts[0] : parts[parts.length - 1]; };
      const answer = pick(BLEND_WORDS, 1)[0];
      const others = pick(BLEND_WORDS.filter((w) => sound(w) !== sound(answer)), 2);
      return { uid: uid(), kind: 'ear', phase: 'main', ear: { mode: at === 0 ? 'first' : 'last', target: sound(answer), options: shuffle([answer, ...others]) }, word: answer };
    }
    case 'medial_sound': {
      const answer = pick(CVC_PICTURE_WORDS, 1)[0];
      const middle = segment(answer)![1];
      return { uid: uid(), kind: 'medial', phase: 'main', word: answer, g: middle, options: shuffle([answer, ...pick(CVC_PICTURE_WORDS.filter((w) => segment(w)![1] !== middle), 2)]) };
    }
    case 'segment3': {
      const answer = pick(CVC_PICTURE_WORDS, 1)[0];
      return { uid: uid(), kind: 'segment', phase: 'main', word: answer };
    }
  }
}

function reviewStep(itemId: string, level: number): Step | null {
  const [type, value] = itemId.split(':');
  if (type === 'g' && GRAPHEME_BY_ID[value]) return Math.random() < 0.5
    ? { uid: uid(), kind: 'hearTap', g: value, options: graphemeOptions(value, level, 3), itemId, itemKind: 'grapheme', phase: 'main' }
    : { uid: uid(), kind: 'seeSay', g: value, itemId, itemKind: 'grapheme', phase: 'main' };
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

const spellingSound = (part: string) => soundOf(part.length === 2 && part[0] === part[1] ? part[0] : part);
function buildStep(word: string, level: number): Step {
  const parts = encodingChunks(word);
  const partSounds = parts.map(spellingSound);
  const pool = knownGraphemes(level).filter((g) => !parts.includes(g) && !partSounds.includes(soundOf(g)));
  return { ...wStep('build', word.toLowerCase()), options: shuffle([...parts, ...pick(pool, Math.min(2, pool.length))]) };
}

function meaningStep(text: string[]): Step | null {
  const tokens = text.join(' ').toLowerCase().match(/[a-z]+/g) ?? [];
  const present = [...new Set(tokens.filter((w) => !!PICTURES[w]))];
  if (!present.length) return null;
  const answer = pick(present, 1)[0];
  const others = pick(PICTURE_WORDS.filter((w) => !present.includes(w)), 2);
  return others.length < 2 ? null : { uid: uid(), kind: 'meaning', word: answer, options: shuffle([answer, ...others]), phase: 'main' };
}

export interface SessionExtras { sentences: { text: string; source: string }[]; heart: { word: string; source: string }[] }
export const MAX_NEW_HEART = 3;

export function buildMain(p: Progress, n: number, extras?: SessionExtras): Step[] {
  const level = levelByN(n);
  const steps: Step[] = [];
  const firstSession = (p.levels[n]?.sessions ?? 0) === 0;
  const recent = level.newGraphemes.length ? level.newGraphemes : knownGraphemes(n).slice(-3);

  for (let i = 0; i < 4; i++) steps.push({ ...earStep(level), ...(i === 0 && n <= 5 ? { demo: true } : {}) });
  for (const item of dueItems(p, undefined, 5)) { const s = reviewStep(item.id, n); if (s) steps.push(s); }

  const soundsIntroduced: string[] = [];
  for (const g of level.newGraphemes) {
    const again = soundsIntroduced.includes(soundOf(g));
    soundsIntroduced.push(soundOf(g));
    if (firstSession && !again) steps.push({ uid: uid(), kind: 'banner', banner: 'new_sound', phase: 'main' });
    steps.push({ ...gStep('reveal', g, n), itemId: undefined });
    for (let i = 0; i < (again ? 1 : 3); i++) steps.push(gStep('hearTap', g, n));
    if (again) { steps.push(gStep('seeSay', g, n)); continue; }
    if (GRAPHEME_BY_ID[g].continuous) steps.push({ ...gStep('hold', g, n), itemId: undefined });
    steps.push(gStep('seeSay', g, n));
  }

  for (let i = 0; i < 2 && level.contrast; i++) {
    const g = pick(level.contrast, 1)[0];
    steps.push({ ...gStep('hearTap', g, n), options: shuffle([...level.contrast]) });
  }

  const availableHeart = learnedHeartWords(p);
  let introduced = 0;
  for (const h of level.heartWords) {
    const id = `h:${h}`;
    const seen = p.items[id]?.seen ?? 0;
    if (!seen) { if (introduced >= MAX_NEW_HEART) continue; introduced++; }
    availableHeart.add(h.toLowerCase());
    if (seen < 3) steps.push({ uid: uid(), kind: 'heart', word: h, model: true, phase: 'main' });
    if (seen < 6 || (p.items[id]?.correct ?? 0) === 0) steps.push({ uid: uid(), kind: 'heart', word: h, itemId: id, itemKind: 'word', phase: 'main' });
  }

  const known = knownGraphemes(n);
  shuffle([...recent, ...recent, ...pick(known, Math.min(3, known.length))]).slice(0, 4).forEach((g, i) => steps.push(gStep(i % 2 ? 'hearTap' : 'seeSay', g, n)));
  if (n === 1) steps.push({ ...gStep('hold', 'a', n), itemId: undefined });

  if (level.words.length) {
    const withNew = level.words.filter((w) => level.newGraphemes.some((g) => segment(w)!.includes(g)));
    cycle(shuffle(withNew.length ? [...withNew, ...level.words] : level.words), n <= 3 ? 3 : 5).forEach((w) => steps.push(wStep('glide', w)));
  }
  pick(level.nonsense, n <= 3 ? 0 : n <= 10 ? 1 : 2).forEach((w) => steps.push(wStep('alien', w)));
  pick(picturableUpTo(n), 3).forEach((w) => steps.push(readMatchStep(w)));

  if (level.pairs) pick(level.pairs, 2).forEach((pair) => {
    const target = pick(pair, 1)[0];
    steps.push({ ...wStep('whichWord', target), options: shuffle(pair) });
  });
  if (n >= 4) pick(level.words.filter((w) => w.length <= 4 && !hasVoicedFinalS(w)), 3).forEach((w) => steps.push(buildStep(w, n)));

  const newHeart = (extras?.heart ?? [])
    .filter((h) => !p.items[`h:${h.word}`] && !level.heartWords.includes(h.word))
    .slice(0, Math.max(0, Math.min(2, MAX_NEW_HEART - introduced)));
  for (const h of newHeart) {
    availableHeart.add(h.word.toLowerCase());
    steps.push({ uid: uid(), kind: 'heart', word: h.word, source: h.source, model: true, phase: 'main' });
    steps.push({ uid: uid(), kind: 'heart', word: h.word, source: h.source, itemId: `h:${h.word}`, itemKind: 'word', phase: 'main' });
  }

  const readable = (text: string) => canDecodeText(p, text, n, availableHeart).ratio === 1;
  const local = (extras?.sentences ?? []).filter((x) => readable(x.text));
  const fromBooks = [...bookSentencesFor(n, p, availableHeart).map((b) => ({ text: b.text, source: BOOK_TITLES[b.book] ?? b.book })), ...local];
  const sentences = level.sentences.filter(readable);
  const story = level.story?.every(readable) ? level.story : undefined;
  const sessionsHere = p.levels[n]?.sessions ?? 0;
  let connected: Step | undefined;
  if (story && sessionsHere % 2 === 1) connected = { uid: uid(), kind: 'story', lines: story, image: storyPictureUrl(n), phase: 'main' };
  else if (fromBooks.length && Math.random() < 0.5) { const b = pick(fromBooks, 1)[0]; connected = { uid: uid(), kind: 'sentence', text: b.text, source: b.source, phase: 'main' }; }
  else if (sentences.length) connected = { uid: uid(), kind: 'sentence', text: pick(sentences, 1)[0], phase: 'main' };

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
  const required: Step[] = level.newGraphemes.flatMap((g) => [
    { ...gStep('hearTap', g, n, phase), required: true },
    { ...gStep('seeSay', g, n, phase), required: true },
  ]);
  const count = Math.max(baseCount, required.length);
  const pool: Step[] = [...required];
  if (!required.length && recent.length) pool.push(gStep('hearTap', recent[0], n, phase), gStep('seeSay', recent[recent.length - 1], n, phase));
  pool.push(gStep('seeSay', pick(known, 1)[0], n, phase));
  pool.push(gStep('hearTap', pick(known, 1)[0], n, phase));
  shuffle(wordsUpTo(n)).slice(0, 3).forEach((w) => pool.push(wStep('glide', w, phase)));
  pick(level.nonsense, n <= 3 ? 0 : n <= 10 ? 1 : 2).forEach((w) => pool.push(wStep('alien', w, phase)));
  const pics = picturableUpTo(n); if (pics.length) pool.push(readMatchStep(pick(pics, 1)[0], phase));
  while (pool.length < count) pool.push(gStep(pool.length % 2 ? 'hearTap' : 'seeSay', pick(known, 1)[0], n, phase));
  return [...steps, ...required, ...shuffle(pool.slice(required.length)).slice(0, Math.max(0, count - required.length))].slice(0, count + 1);
}

const BOOK_TITLES: Record<string, string> = { 'wizard-of-oz': 'The Wonderful Wizard of Oz', 'winnie-the-pooh': 'Winnie-the-Pooh' };
export const heartUpTo = (n: number) => LEVELS.filter((l) => l.n <= n).flatMap((l) => l.heartWords);

export function bookSentencesFor(n: number, p?: Progress, extraHeart: Iterable<string> = []) {
  return (BOOK_SENTENCES as { book: string; chapter: number; text: string; level: number }[]).filter((b) => {
    if (b.level > n) return false;
    if (p) return canDecodeText(p, b.text, n, extraHeart).ratio === 1;
    if (n <= LEVELS.length) return checkText(b.text, n, heartUpTo(n)).ratio === 1;
    return b.text.split(/\s+/).every((w) => wordLevel(w).level <= n);
  });
}

export const PASS_RATIO = { checkout: 0.9, cold: 0.8 } as const;
export interface AssessmentTally { answered: number; correct: number }
export function passesAssessment(phase: 'checkout' | 'cold', tally: AssessmentTally, required: AssessmentTally): boolean {
  const ratio = tally.answered ? tally.correct / tally.answered : 1;
  return ratio >= PASS_RATIO[phase] && (required.answered === 0 || required.correct === required.answered);
}

/** Main-phase gate: aggregate confidence is never enough while a level heart word remains unmastered. */
export function readyForCheckout(p: Progress, n: number, correctThisSession: ReadonlySet<string>) {
  return levelHeartWordsReady(p, n, correctThisSession);
}

export function storyFor(n: number): string[] | undefined { return storyLevel(n)?.story; }
export const storyLevel = (n: number) => [...LEVELS].reverse().find((l) => l.n <= n && l.story);
