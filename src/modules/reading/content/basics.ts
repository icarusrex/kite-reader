/**
 * Basics track (curriculum Stage 0): for children who don't know letters yet. Short, fully guided lessons modelled on
 * the first lessons of "Teach Your Child to Read in 100 Easy Lessons" and Mentava Basics:
 *   - one new sound per lesson (sounds, not letter names) in the Jolly Phonics order (s a t i p n m), with a picture anchor
 *   - "say it fast" oral blending that gets gradually harder: compound words → syllables → stretched sounds
 *   - rhyme taught (shown with pictures) before it's asked, from lesson 5
 *   - a left-to-right tracking game early on
 * Every game starts with a "watch me" demo. After lesson 10 the child moves on to level 1.
 */

export type SayFastMode = 'compound' | 'syllable' | 'stretch';

export interface BasicsLesson {
  n: number;
  title: string;
  newSound?: string;      // grapheme id
  review: string[];       // earlier sounds to practise
  sayFast: SayFastMode;
  rhyme: boolean;
  track: boolean;         // left-to-right game
}

// Same order as levels 1–20 (Jolly Phonics: s a t i p n …), so level 1 starts with sounds he already knows.
export const BASICS: BasicsLesson[] = [
  { n: 1, title: 's', newSound: 's', review: [], sayFast: 'compound', rhyme: false, track: true },
  { n: 2, title: 'a', newSound: 'a', review: ['s'], sayFast: 'compound', rhyme: false, track: true },
  { n: 3, title: 't', newSound: 't', review: ['s', 'a'], sayFast: 'compound', rhyme: false, track: true },
  { n: 4, title: 'review', review: ['s', 'a', 't'], sayFast: 'syllable', rhyme: false, track: false },
  { n: 5, title: 'i', newSound: 'i', review: ['s', 'a', 't'], sayFast: 'syllable', rhyme: true, track: false },
  { n: 6, title: 'p', newSound: 'p', review: ['s', 'a', 't', 'i'], sayFast: 'syllable', rhyme: true, track: false },
  { n: 7, title: 'n', newSound: 'n', review: ['a', 't', 'i', 'p'], sayFast: 'stretch', rhyme: true, track: false },
  { n: 8, title: 'review', review: ['s', 'a', 't', 'i', 'p', 'n'], sayFast: 'stretch', rhyme: true, track: false },
  { n: 9, title: 'm', newSound: 'm', review: ['s', 'a', 't', 'i', 'p', 'n'], sayFast: 'stretch', rhyme: true, track: false },
  { n: 10, title: 'review', review: ['s', 'a', 't', 'i', 'p', 'n', 'm'], sayFast: 'stretch', rhyme: true, track: false },
];

/** Picture word for each sound ("sss, like in sun"). */
export const ANCHORS: Record<string, string> = { s: 'sun', a: 'apple', t: 'tap', i: 'insect', p: 'pig', n: 'nest', m: 'map' };

/** Say it fast. `split` is what's said slowly (spelled so the voice says the parts naturally). */
export const COMPOUND: { word: string; split: string }[] = [
  { word: 'sunflower', split: 'sun... flower' }, { word: 'cupcake', split: 'cup... cake' }, { word: 'rainbow', split: 'rain... bow' },
  { word: 'football', split: 'foot... ball' }, { word: 'snowman', split: 'snow... man' }, { word: 'starfish', split: 'star... fish' },
  { word: 'ladybug', split: 'lady... bug' }, { word: 'popcorn', split: 'pop... corn' }, { word: 'pancake', split: 'pan... cake' },
  { word: 'teapot', split: 'tea... pot' }, { word: 'raincoat', split: 'rain... coat' }, { word: 'toothbrush', split: 'tooth... brush' },
];
export const SYLLABLE: { word: string; split: string }[] = [
  { word: 'table', split: 'tay... bull' }, { word: 'monkey', split: 'mun... key' }, { word: 'rabbit', split: 'rab... bit' },
  { word: 'pencil', split: 'pen... sill' }, { word: 'basket', split: 'bas... ket' }, { word: 'tiger', split: 'tie... gur' },
  { word: 'carrot', split: 'care... rut' }, { word: 'lemon', split: 'lem... un' }, { word: 'button', split: 'but... tun' },
  { word: 'zebra', split: 'zee... bruh' }, { word: 'spider', split: 'spy... der' }, { word: 'robot', split: 'row... bot' },
];
/** Stretched: words that start with a held sound, said slowly from the letter sounds with no gaps (mmmaaap). */
export const STRETCH = ['sun', 'map', 'van', 'fan', 'leg', 'man', 'mat', 'nest'];

/** Rhyme families (all pictured); non-rhyme foils come from other families. */
export const RHYMES: string[][] = [['cat', 'hat', 'bat'], ['moon', 'spoon'], ['cake', 'snake'], ['bee', 'tree'], ['goat', 'boat'], ['fox', 'box'], ['mouse', 'house'], ['dog', 'log', 'frog']];

export const BASICS_PICTURE_WORDS = [...new Set([
  ...Object.values(ANCHORS), ...COMPOUND.map((c) => c.word), ...SYLLABLE.map((c) => c.word), ...STRETCH, ...RHYMES.flat(),
])];

export const basicsByN = (n: number) => BASICS.find((b) => b.n === n)!;
