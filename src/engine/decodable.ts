import { GRAPHEMES } from '../content/phonemes';

const IDS = GRAPHEMES.map((g) => g.id).sort((a, b) => b.length - a.length);

/**
 * Reading/phoneme-oriented split. Doubled consonants collapse because "hiss" has one final /s/ phoneme.
 * Use encodingChunks() when spelling/tiles must preserve the written form.
 */
export function segment(word: string): string[] | null {
  const w = word.toLowerCase().replace(/[^a-z]/g, '');
  const out: string[] = [];
  let i = 0;
  while (i < w.length) {
    const match = IDS.find((id) => w.startsWith(id, i));
    if (!match) return null;
    const prev = out[out.length - 1];
    const isDouble = match.length === 1 && prev === match && !'aeiou'.includes(match);
    if (!isDouble) out.push(match);
    i += match.length;
  }
  return out;
}

/** Display chunks preserve orthography: Matt -> M,a,tt; duck -> d,u,ck. */
export function displayChunks(word: string): string[] {
  const chunks: string[] = [];
  const letters = word.replace(/[^A-Za-z]/g, '');
  let i = 0;
  while (i < letters.length) {
    const rest = letters.slice(i).toLowerCase();
    const match = IDS.find((id) => rest.startsWith(id)) ?? rest[0];
    let len = match.length;
    if (len === 1 && rest[1] === rest[0] && !'aeiou'.includes(rest[0])) len = 2;
    chunks.push(letters.slice(i, i + len));
    i += len;
  }
  return chunks;
}

/** Orthographic chunks for encoding/spelling activities. Never collapse doubled consonants. */
export function encodingChunks(word: string): string[] {
  return displayChunks(word).map((x) => x.toLowerCase());
}


/** English inflectional final -s is /z/ after a voiced non-sibilant sound (pins, pans, digs). */
export function hasVoicedFinalS(word: string): boolean {
  const w = word.toLowerCase().replace(/[^a-z]/g, '');
  if (!w.endsWith('s') || w.endsWith('ss') || w.length < 2) return false;
  const base = w.slice(0, -1);
  // Vowels and these consonants are voiced; sibilants taking /ɪz/ are outside the early curriculum.
  return /[aeioubdglmnrvwy]$/.test(base.replace(/ /g, ''));
}

export interface DecodeCheck { word: string; ok: boolean; missing: string[] }

export function checkWord(word: string, level: number, heartWords: string[] = []): DecodeCheck {
  const clean = word.toLowerCase().replace(/[^a-z]/g, '');
  if (heartWords.map((h) => h.toLowerCase()).includes(clean)) return { word, ok: true, missing: [] };
  const seg = segment(clean);
  if (!seg) return { word, ok: false, missing: [clean] };
  const missing = seg.filter((g) => (GRAPHEMES.find((x) => x.id === g)?.level ?? Infinity) > level);
  return { word, ok: missing.length === 0, missing };
}

export function checkText(text: string, level: number, heartWords: string[] = []) {
  const tokens = text.split(/\s+/).map((t) => t.replace(/[^A-Za-z]/g, '')).filter(Boolean);
  const results = tokens.map((t) => checkWord(t, level, heartWords));
  const okCount = results.filter((r) => r.ok).length;
  return { total: tokens.length, decodable: okCount, ratio: tokens.length ? okCount / tokens.length : 1, failures: results.filter((r) => !r.ok) };
}

/**
 * Pattern levels used only to decide what part of a heart word is not yet independently decodable.
 * They mirror the word-level sequence for common multi-letter spellings.
 */
const PATTERN_LEVEL: Record<string, number> = {
  ck: 8, sh: 22, ch: 23, th: 24, ng: 37, nk: 38, wh: 95,
  ee: 59, ea: 75, oa: 76, ai: 73, ay: 72, oi: 80, oy: 81, ou: 78, ow: 77,
  oo: 101, ie: 51, ar: 62, or: 64, er: 65, ir: 66, ur: 67,
};
const ORTHO_IDS = [...new Set([...Object.keys(PATTERN_LEVEL), ...IDS])].sort((a, b) => b.length - a.length);

/**
 * Split a heart word into currently-decodable and "heart" parts. A part is marked if it is permanently irregular
 * OR if its spelling correspondence has not been taught yet (temporarily irregular for this learner level).
 */
export function trickyParts(word: string, level: number): { text: string; tricky: boolean }[] {
  const letters = word.replace(/[^A-Za-z]/g, '');
  const lower = letters.toLowerCase();
  const flags = [...letters].map(() => false);

  for (const spot of TRICKY[lower] ?? []) {
    let from = 0;
    while (from < lower.length) {
      const at = lower.indexOf(spot, from);
      if (at < 0) break;
      for (let k = at; k < at + spot.length; k++) flags[k] = true;
      from = at + spot.length;
      break;
    }
  }

  let i = 0;
  while (i < lower.length) {
    const rest = lower.slice(i);
    const unit = ORTHO_IDS.find((x) => rest.startsWith(x)) ?? rest[0];
    const graphemeLevel = GRAPHEMES.find((g) => g.id === unit)?.level;
    const unitLevel = PATTERN_LEVEL[unit] ?? graphemeLevel ?? Infinity;
    if (unitLevel > level) for (let k = i; k < i + unit.length; k++) flags[k] = true;
    i += unit.length;
  }

  const parts: { text: string; tricky: boolean }[] = [];
  [...letters].forEach((ch, k) => {
    const last = parts[parts.length - 1];
    if (last && last.tricky === flags[k]) last.text += ch;
    else parts.push({ text: ch, tricky: flags[k] });
  });
  return parts;
}

/** Permanently unexpected spellings; unknown-yet spellings are added dynamically by trickyParts(). */
export const TRICKY: Record<string, string[]> = {
  a: ['a'], the: ['e'], is: ['s'], i: ['i'], pooh: ['ooh'],
  he: ['e'], she: ['e'], we: ['e'], me: ['e'], be: ['e'], to: ['o'], has: ['s'], his: ['s'], as: ['s'],
  no: ['o'], go: ['o'], so: ['o'],
  you: ['ou'], are: ['a', 'e'], was: ['a', 's'], of: ['o', 'f'], said: ['ai'], my: ['y'],
};
