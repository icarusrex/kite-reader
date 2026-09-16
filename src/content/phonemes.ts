// Grapheme inventory. `level` = the level where the grapheme is introduced.
// `continuous` sounds can be held (mmm, sss); stop sounds cannot.
// `tts` is a fallback hint only; pure sounds should be recorded in Parent > Record sounds.

export interface Grapheme {
  id: string;
  level: number;
  continuous: boolean;
  ipa: string;
  tts: string;
  example: string; // key word, used by parents while recording
  recordTip: string;
}

export const GRAPHEMES: Grapheme[] = [
  { id: 'a', level: 1, continuous: true, ipa: 'æ', tts: 'a', example: 'apple', recordTip: 'The "a" in apple. Hold it: aaa.' },
  { id: 'm', level: 2, continuous: true, ipa: 'm', tts: 'mmm', example: 'map', recordTip: 'Lips closed, hum: mmm. No "muh".' },
  { id: 's', level: 3, continuous: true, ipa: 's', tts: 'sss', example: 'sun', recordTip: 'Snake hiss: sss. No voice.' },
  { id: 't', level: 4, continuous: false, ipa: 't', tts: 't', example: 'top', recordTip: 'Short whispered tap: t. No "tuh".' },
  { id: 'f', level: 6, continuous: true, ipa: 'f', tts: 'fff', example: 'fish', recordTip: 'Teeth on lip, blow: fff.' },
  { id: 'd', level: 7, continuous: false, ipa: 'd', tts: 'd', example: 'dog', recordTip: 'Very short: d. Barely any "uh".' },
  { id: 'g', level: 8, continuous: false, ipa: 'g', tts: 'g', example: 'goat', recordTip: 'Short throat sound: g. No "guh".' },
  { id: 'i', level: 9, continuous: true, ipa: 'ɪ', tts: 'i', example: 'insect', recordTip: 'The "i" in insect: iii.' },
  { id: 'n', level: 10, continuous: true, ipa: 'n', tts: 'nnn', example: 'nest', recordTip: 'Tongue up, hum: nnn.' },
  { id: 'p', level: 11, continuous: false, ipa: 'p', tts: 'p', example: 'pig', recordTip: 'Puff of air, no voice: p.' },
  { id: 'h', level: 12, continuous: false, ipa: 'h', tts: 'h', example: 'hat', recordTip: 'Breathy: h. Like fogging a mirror.' },
  { id: 'b', level: 13, continuous: false, ipa: 'b', tts: 'b', example: 'bat', recordTip: 'Short: b. No "buh".' },
  { id: 'l', level: 14, continuous: true, ipa: 'l', tts: 'lll', example: 'leg', recordTip: 'Tongue up, sing: lll.' },
  { id: 'j', level: 15, continuous: false, ipa: 'dʒ', tts: 'j', example: 'jam', recordTip: 'Short: j (not the Portuguese "j").' },
  { id: 'c', level: 16, continuous: false, ipa: 'k', tts: 'k', example: 'cat', recordTip: 'Same as k: short, whispered.' },
  { id: 'v', level: 17, continuous: true, ipa: 'v', tts: 'vvv', example: 'van', recordTip: 'Teeth on lip, buzz: vvv.' },
  { id: 'w', level: 18, continuous: true, ipa: 'w', tts: 'www', example: 'web', recordTip: 'Round lips: www (short).' },
  { id: 'r', level: 19, continuous: true, ipa: 'ɹ', tts: 'rrr', example: 'rat', recordTip: 'English r, growl: rrr. No trill.' },
  { id: 'k', level: 20, continuous: false, ipa: 'k', tts: 'k', example: 'kite', recordTip: 'Short, whispered: k.' },
  // Taught later, but needed now for the oral listening games (dog, sun, bed).
  { id: 'o', level: 26, continuous: true, ipa: 'ɑ', tts: 'o', example: 'octopus', recordTip: 'The "o" in on/dog: ooo (short, not "oh").' },
  { id: 'u', level: 39, continuous: true, ipa: 'ʌ', tts: 'uh', example: 'up', recordTip: 'The "u" in up/sun: uuu (short).' },
  { id: 'e', level: 44, continuous: true, ipa: 'ɛ', tts: 'eh', example: 'egg', recordTip: 'The "e" in egg/bed: eee (short, not "ee").' },
];

export const GRAPHEME_BY_ID: Record<string, Grapheme> = Object.fromEntries(GRAPHEMES.map((g) => [g.id, g]));

/** Graphemes available at a level (inclusive). */
export function graphemesUpTo(level: number): Grapheme[] {
  return GRAPHEMES.filter((g) => g.level <= level);
}
