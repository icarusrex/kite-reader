// Emoji pictures for picturable words. Distractor pictures do not need to be decodable.
export const PICTURES: Record<string, string> = {
  dad: '👨', mad: '😠', sad: '😢', dig: '⛏️', sit: '🪑', fit: '💪', fan: '🪭', fin: '🦈', tin: '🥫',
  man: '🧍', map: '🗺️', pig: '🐷', hat: '👒', bat: '🦇', bag: '👜', pin: '📌', lip: '👄', hill: '⛰️',
  cat: '🐱', cap: '🧢', cab: '🚕', van: '🚐', rat: '🐀', kid: '🧒', dog: '🐶', fish: '🐟', sun: '☀️',
  bed: '🛏️', cup: '☕', bus: '🚌', mat: '🟫', gas: '⛽', nap: '😴', sip: '🥤',
};

export function pictureFor(word: string): string | undefined {
  return PICTURES[word.toLowerCase()];
}
