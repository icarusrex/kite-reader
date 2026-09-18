import { BASICS, COMPOUND, RHYMES, STRETCH, SYLLABLE, basicsByN } from '../content/basics';
import { GRAPHEME_BY_ID } from '../content/phonemes';
import { Progress } from './progress';
import { AssessmentTally, Step, shuffle } from './session';

let uidN = 0;
const uid = () => `b${++uidN}`;
const pick = <T,>(a: T[], n: number) => shuffle(a).slice(0, n);

export function buildBasics(p: Progress, n: number): Step[] {
  const lesson = basicsByN(n);
  const steps: Step[] = [];
  const firstTime = (p.basics[n]?.sessions ?? 0) === 0;
  const pool = lesson.sayFast === 'compound' ? COMPOUND.map((c) => c.word) : lesson.sayFast === 'syllable' ? SYLLABLE.map((c) => c.word) : STRETCH;
  const words = pick(pool, 7);
  const sayFast = (word: string, demo = false): Step => {
    const other = pick(pool.filter((w) => w !== word), 1)[0];
    return { uid: uid(), kind: 'sayFast', word, options: shuffle([word, other]), fast: { mode: lesson.sayFast }, demo, phase: 'main' };
  };
  words.slice(0, 4).forEach((w, i) => steps.push(sayFast(w, i === 0)));
  if (lesson.track) steps.push({ uid: uid(), kind: 'trackGame', phase: 'main' });

  const g = lesson.newSound;
  if (g) {
    if (firstTime) steps.push({ uid: uid(), kind: 'banner', banner: 'new_sound', phase: 'main' });
    steps.push({ uid: uid(), kind: 'meet', g, phase: 'main' });
    if (GRAPHEME_BY_ID[g].continuous) steps.push({ uid: uid(), kind: 'hold', g, phase: 'main' });
    const other = lesson.review.length ? pick(lesson.review, 1)[0] : g === 'a' ? 's' : 'a';
    for (let i = 0; i < 4; i++) {
      steps.push({
        uid: uid(), kind: 'hearTap', g,
        options: shuffle([g, i % 2 ? other : pick(['s', 'a', 't'].filter((x) => x !== g), 1)[0]]),
        itemId: i ? `g:${g}` : undefined, itemKind: 'grapheme', demo: i === 0,
        required: i === 1, phase: 'main',
      });
    }
    steps.push({ uid: uid(), kind: 'seeSay', g, itemId: `g:${g}`, itemKind: 'grapheme', required: true, phase: 'main' });
  }

  if (g && !lesson.review.length) steps.push({ uid: uid(), kind: 'hearTap', g, options: shuffle([g, g === 'a' ? 't' : 'a']), itemId: `g:${g}`, itemKind: 'grapheme', phase: 'main' });
  const review = g ? pick(lesson.review, 3) : shuffle(lesson.review).slice(0, 4).flatMap((r) => [r, r]);
  review.forEach((r, i) => {
    if (i % 2 === 0) steps.push({ uid: uid(), kind: 'hearTap', g: r, options: shuffle([r, pick(lesson.review.filter((x) => x !== r).concat(g ? [g] : []), 1)[0] ?? 't']), itemId: `g:${r}`, itemKind: 'grapheme', phase: 'main' });
    else steps.push({ uid: uid(), kind: 'seeSay', g: r, itemId: `g:${r}`, itemKind: 'grapheme', phase: 'main' });
  });

  words.slice(4).forEach((w) => steps.push(sayFast(w)));
  if (g) steps.push({ uid: uid(), kind: 'seeSay', g, itemId: `g:${g}`, itemKind: 'grapheme', phase: 'main' });

  if (lesson.rhyme) {
    const fams = pick(RHYMES, 4);
    steps.push({ uid: uid(), kind: 'rhyme', pair: pick(fams[0], 2) as [string, string], rhymes: true, demo: true, phase: 'main' });
    steps.push(...shuffle([
      { uid: uid(), kind: 'rhyme', pair: pick(fams[1], 2) as [string, string], rhymes: true, phase: 'main' },
      { uid: uid(), kind: 'rhyme', pair: pick(fams[2], 2) as [string, string], rhymes: true, phase: 'main' },
      { uid: uid(), kind: 'rhyme', pair: [pick(fams[0], 1)[0], pick(fams[1], 1)[0]] as [string, string], rhymes: false, phase: 'main' },
      { uid: uid(), kind: 'rhyme', pair: [pick(fams[2], 1)[0], pick(fams[3], 1)[0]] as [string, string], rhymes: false, phase: 'main' },
    ] as Step[]));
  }
  return steps;
}

export const BASICS_PASS_RATIO = 0.8;
export const LAST_BASICS = BASICS[BASICS.length - 1].n;

export function passesBasicsAssessment(tally: AssessmentTally, required: AssessmentTally) {
  const ratio = tally.answered ? tally.correct / tally.answered : 1;
  return ratio >= BASICS_PASS_RATIO && required.answered >= 2 && required.correct === required.answered;
}
