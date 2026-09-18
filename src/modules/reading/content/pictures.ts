// Word pictures: illustrations in public/pictures/<word>.jpg (npm run pictures), emoji only as a fallback.
// PICTURES serves Read & Match (the child reads the word first, so a loose picture is OK).
// CLEAR_WORDS are the only pictures used when the child must name the picture from sound alone
// (readiness check, listening games): a 4-year-old would call them exactly this word.
export const PICTURES: Record<string, string> = {
  // clear
  cat: '🐱', pig: '🐷', bat: '🦇', hat: '🎩', map: '🗺️', sun: '☀️', bed: '🛏️', bus: '🚌', dog: '🐶', van: '🚐',
  ten: '🔟', leg: '🦵', web: '🕸️', log: '🪵', pen: '🖊️',
  // read & match only
  dad: '👨', sad: '😢', dig: '⛏️', fan: '🪭', fin: '🦈', tin: '🥫', man: '🧍', pin: '📌', lip: '👄', hill: '⛰️',
  cap: '🧢', cab: '🚕', rat: '🐀', kid: '🧒', bag: '👜', gas: '⛽', nap: '😴', ham: '🍖', bib: '👶', pan: '🍳',
  wig: '💇', lid: '🫙', kit: '🧰', jam: '🍓', rag: '🧽', cup: '☕', fish: '🐟', mat: '🟫', tap: '🚰', fig: '🟣',
  // Basics track: sound anchors, say-it-fast words, rhymes
  apple: '🍎', nest: '🪺', sunflower: '🌻', cupcake: '🧁', rainbow: '🌈', football: '⚽', snowman: '⛄', starfish: '⭐',
  ladybug: '🐞', popcorn: '🍿', pancake: '🥞', teapot: '🫖', raincoat: '🧥', toothbrush: '🪥', table: '🪑', monkey: '🐒',
  rabbit: '🐇', pencil: '✏️', basket: '🧺', tiger: '🐯', carrot: '🥕', lemon: '🍋', button: '🔘', zebra: '🦓', spider: '🕷️',
  robot: '🤖', moon: '🌙', spoon: '🥄', cake: '🎂', snake: '🐍', bee: '🐝', tree: '🌳', goat: '🐐', boat: '⛵', fox: '🦊',
  box: '📦', mouse: '🐭', house: '🏠', frog: '🐸',
  // Levels 1–20 in the Jolly Phonics order (2026-09-17)
  insect: '🐜', net: '🥅', hen: '🐔', peg: '📎', pot: '🍲', sock: '🧦', rock: '🪨', bug: '🐛', duck: '🦆', rug: '🧶',
  nut: '🥜', doll: '🪆', flag: '🚩', bun: '🍞', crab: '🦀', hand: '✋', tent: '⛺', sand: '🏖️', drum: '🥁', truck: '🚚',
  lamp: '💡', bell: '🔔', gift: '🎁', mop: '🧹',
};

export const CLEAR_WORDS = ['cat', 'pig', 'bat', 'hat', 'map', 'sun', 'bed', 'bus', 'dog', 'van', 'ten', 'leg', 'web', 'log', 'pen'];

export function pictureFor(word: string): string | undefined {
  return PICTURES[word.toLowerCase()];
}

/** Illustration for a word (every PICTURES word has one; see pictures.test.ts). */
export function pictureUrl(word: string): string | undefined {
  const w = word.toLowerCase();
  return w in PICTURES ? `/pictures/${w}.jpg` : undefined;
}

/** Illustration for a level's story. */
export const storyPictureUrl = (level: number) => `/pictures/story-${level}.jpg`;
