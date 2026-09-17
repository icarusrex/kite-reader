import { GRAPHEMES } from '../content/phonemes';

const IDS = GRAPHEMES.map((g) => g.id).sort((a, b) => b.length - a.length);

/**
 * Split a word into graphemes using longest-match against the inventory.
 * Doubled consonants (tt, ss, ff, dd, ll) collapse to a single grapheme.
 * Returns null if any part is unknown.
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

/** Display chunks: like segment() but keeps doubled letters together ("Matt" -> M,a,tt). */
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

export interface DecodeCheck {
  word: string;
  ok: boolean;
  missing: string[];
}

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

/** Split a heart word into parts the child can already sound out and the tricky part to learn by heart
 *  ("Pooh" at L11 → P | ooh). */
export function trickyParts(word: string, level: number): { text: string; tricky: boolean }[] {
  const marked = markTricky(word);
  if (marked) return marked;
  const parts: { text: string; tricky: boolean }[] = [];
  const letters = word.replace(/[^A-Za-z]/g, '');
  let i = 0;
  while (i < letters.length) {
    const rest = letters.slice(i).toLowerCase();
    const known = IDS.find((id) => rest.startsWith(id) && (GRAPHEMES.find((g) => g.id === id)!.level <= level));
    // a letter only counts as regular if the next letters aren't the start of a vowel team (oo, ee…)
    const team = /^[aeiou]{2}/.test(rest);
    const len = known && !team ? known.length : team ? 2 : 1;
    const tricky = !known || team;
    const last = parts[parts.length - 1];
    if (last && last.tricky === tricky) last.text += letters.slice(i, i + len);
    else parts.push({ text: letters.slice(i, i + len), tricky });
    i += len;
  }
  return parts;
}

/**
 * The part of each sight word that doesn't sound the way its letters say (learned by heart). Letter-availability
 * can't find these: in "is" every letter is taught, but the s says /z/.
 */
export const TRICKY: Record<string, string[]> = {
  the: ['e'], is: ['s'], i: ['i'], pooh: ['ooh'],
  he: ['e'], she: ['e'], we: ['e'], me: ['e'], be: ['e'], to: ['o'], has: ['s'], his: ['s'], as: ['s'],
  no: ['o'], go: ['o'], so: ['o'],
  you: ['ou'], are: ['a', 'e'], was: ['a', 's'], of: ['o', 'f'], said: ['ai'], my: ['y'],
};

function markTricky(word: string): { text: string; tricky: boolean }[] | null {
  const spots = TRICKY[word.toLowerCase()];
  if (!spots) return null;
  const lower = word.toLowerCase();
  const flags = [...word].map(() => false);
  let from = 0;
  for (const s of spots) {
    const at = lower.indexOf(s, from);
    if (at < 0) continue;
    for (let k = at; k < at + s.length; k++) flags[k] = true;
    from = at + s.length;
  }
  const parts: { text: string; tricky: boolean }[] = [];
  [...word].forEach((ch, k) => {
    const last = parts[parts.length - 1];
    if (last && last.tricky === flags[k]) last.text += ch;
    else parts.push({ text: ch, tricky: flags[k] });
  });
  return parts;
}
