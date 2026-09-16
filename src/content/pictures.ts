// Emoji pictures. PICTURES serves Read & Match (the child reads the word first, so a loose picture is OK).
// CLEAR_WORDS are the only pictures used when the child must name the picture from sound alone
// (readiness check, listening games): a 4-year-old would call them exactly this word.
export const PICTURES: Record<string, string> = {
  // clear
  cat: '🐱', pig: '🐷', bat: '🦇', hat: '🎩', map: '🗺️', sun: '☀️', bed: '🛏️', bus: '🚌', dog: '🐶', van: '🚐',
  ten: '🔟', leg: '🦵', web: '🕸️', log: '🪵', pen: '🖊️',
  // read & match only
  dad: '👨', sad: '😢', dig: '⛏️', fan: '🪭', fin: '🦈', tin: '🥫', man: '🧍', pin: '📌', lip: '👄', hill: '⛰️',
  cap: '🧢', cab: '🚕', rat: '🐀', kid: '🧒', bag: '👜', gas: '⛽', nap: '😴', ham: '🍖', bib: '👶', pan: '🍳',
  wig: '💇', lid: '🫙', kit: '🧰', jam: '🍓', rag: '🧽', cup: '☕', fish: '🐟',
};

export const CLEAR_WORDS = ['cat', 'pig', 'bat', 'hat', 'map', 'sun', 'bed', 'bus', 'dog', 'van', 'ten', 'leg', 'web', 'log', 'pen'];

export function pictureFor(word: string): string | undefined {
  return PICTURES[word.toLowerCase()];
}
