import { GRAPHEMES } from './phonemes';

export type PaSkill = 'rhyme' | 'onset_rime' | 'blend2' | 'blend3' | 'first_sound' | 'final_sound' | 'medial_sound' | 'segment3';

export interface Level {
  n: number;
  title: string;
  newGraphemes: string[];
  heartWords: string[];
  words: string[];
  nonsense: string[];
  sentences: string[];
  pa: PaSkill;
  pairs?: string[][];
  story?: string[];
  contrast?: string[];
}

/*
 * Levels 1–20 follow the Jolly Phonics order used by most beginner decodable books (e.g. SPELD SA):
 *   s a t i p n → c k ck e h r m d → g o u l f b
 * with -s endings and first sight words at the level 7 review (the, is, I), adjacent consonants and more sight words
 * at the level 14 review (he, she, we, me, be, to, has, his, as), and you, are, was, of, said, my at level 20.
 * Re-sequenced 2026-09-17 from the Mentava order, which left e/u/-s/the/is/and until levels 25–44 and made almost
 * no real beginner book readable (2 of 60 SPELD SA books by level 20, now 41).
 * Characters: Pip the piglet, Pooh (sight word from level 7), Tin Man (from level 12).
 */
export const LEVELS: Level[] = [
  { n: 1, title: 'a', newGraphemes: ['a'], heartWords: [], words: [], nonsense: [], sentences: [], pa: 'onset_rime' },
  { n: 2, title: 't', newGraphemes: ['t'], heartWords: [], words: ['at'], nonsense: ['ta'], sentences: [], pa: 'onset_rime' },
  { n: 3, title: 's', newGraphemes: ['s'], heartWords: [], words: ['sat', 'at'], nonsense: ['tas', 'sas'], sentences: [], pa: 'onset_rime' },
  {
    n: 4, title: 'i', newGraphemes: ['i'], heartWords: [], words: ['it', 'sit', 'sat', 'at'], nonsense: ['tis', 'sis'],
    sentences: ['Sit.', 'Sit at it.'], pa: 'blend2', pairs: [['sat', 'sit']],
  },
  {
    n: 5, title: 'p', newGraphemes: ['p'], heartWords: [], words: ['pat', 'pit', 'tip', 'sip', 'tap', 'sap', 'pip', 'Pip', 'Pat'],
    nonsense: ['pas', 'tas', 'pis'], sentences: ['Pip sat.', 'Pat sat.', 'Tap it.'], pa: 'blend2',
    pairs: [['pat', 'pit'], ['tap', 'tip'], ['sap', 'sip']],
    story: ['Pip sat.', 'Pat sat.', 'Pip sat at a tap.'],
  },
  {
    n: 6, title: 'n', newGraphemes: ['n'], heartWords: [], words: ['in', 'an', 'tin', 'pin', 'nap', 'pan', 'nip', 'tan', 'Nan', 'Nat'],
    nonsense: ['nas', 'nis', 'tas'], sentences: ['Nan sat in a pan.', 'Pip sat in a tin.', 'Nat sat in a pan.'], pa: 'blend3',
    pairs: [['tan', 'tin'], ['pan', 'pin'], ['nap', 'nip']],
    story: ['Pip sat in a tin.', 'Nan sat in a pan.', 'Nat sat in a tin pan!'],
  },
  {
    n: 7, title: 'review', newGraphemes: [], heartWords: ['the', 'is', 'I', 'Pooh'],
    words: ['sits', 'taps', 'pins', 'naps', 'tins', 'pans', 'tips', 'pats'], nonsense: ['nas', 'pas', 'tis'],
    sentences: ['Pip sits in the pan.', 'Nat is in the tin.', 'I sit in the tin.'], pa: 'first_sound',
    story: ['Pooh sits in a tin.', 'Pip sits in the pan.', 'Is it a pan?', 'It is!'],
  },
  {
    n: 8, title: 'c k', newGraphemes: ['c', 'k', 'ck'], heartWords: [],
    words: ['cat', 'can', 'cap', 'kit', 'Kip', 'pick', 'tick', 'sick', 'pack', 'sack', 'kick', 'tack'],
    nonsense: ['nack', 'kas', 'cip'], sentences: ['Kip sits in a sack.', 'A cat naps in the cap.'], pa: 'first_sound',
    pairs: [['pack', 'pick'], ['tack', 'tick'], ['cat', 'cap']],
    story: ['Pip is in a sack.', 'Pooh taps the sack.', 'Tick, tack!', 'It is Pip!'],
  },
  {
    n: 9, title: 'e', newGraphemes: ['e'], heartWords: [],
    words: ['pet', 'net', 'ten', 'pen', 'set', 'peck', 'neck', 'Ken', 'nets', 'pens'],
    nonsense: ['tek', 'sep', 'nep'], sentences: ['Ken sets a net.', 'Ten pens sit in a tin.'], pa: 'first_sound',
    pairs: [['pen', 'pin'], ['pet', 'pit'], ['ten', 'tin'], ['set', 'sit']],
    contrast: ['e', 'i'],
    story: ['Ken sets a net.', 'Pip is in the net!', 'Pooh pats Pip.'],
  },
  {
    n: 10, title: 'h', newGraphemes: ['h'], heartWords: [],
    words: ['hat', 'hit', 'hen', 'hip', 'hiss', 'hats', 'hens'],
    nonsense: ['hep', 'hak', 'hin'], sentences: ['A hen sits in a hat.', 'Pip hits the hat.'], pa: 'first_sound',
    pairs: [['hat', 'hit'], ['hen', 'pen'], ['hip', 'tip']],
    story: ['A hen sits in a hat.', 'Pip sits in the hat.', 'The hen pecks Pip!', 'Ha, ha!'],
  },
  {
    n: 11, title: 'r', newGraphemes: ['r'], heartWords: [],
    words: ['rat', 'rip', 'ran', 'rap', 'rack', 'Rick', 'rats', 'rips'],
    nonsense: ['rin', 'rep', 'rak'], sentences: ['A rat ran in.', 'Rick ran.'], pa: 'first_sound',
    pairs: [['rat', 'hat'], ['rip', 'tip'], ['ran', 'pan']],
    story: ['A rat ran in.', 'Pip ran.', 'Pooh ran.', 'The rat sat in a pan.'],
  },
  {
    n: 12, title: 'm', newGraphemes: ['m'], heartWords: [],
    words: ['man', 'mat', 'map', 'men', 'met', 'him', 'ham', 'Sam', 'Tim', 'mess'],
    nonsense: ['mip', 'mek', 'sem'], sentences: ['Tin Man met Pip.', 'Tim sat in the mess.'], pa: 'first_sound',
    pairs: [['man', 'men'], ['map', 'mat'], ['ham', 'hem']],
    story: ['Tin Man met Pip.', 'Pip sat in a tin pan.', 'Tin Man sat in a pen.', 'Pip ran. Tin Man ran!'],
  },
  {
    n: 13, title: 'd', newGraphemes: ['d'], heartWords: [],
    words: ['dad', 'den', 'did', 'dip', 'dim', 'red', 'had', 'hid', 'mad', 'sad', 'Dan', 'Ted'],
    nonsense: ['dek', 'dap', 'nid'], sentences: ['Dad had a red hat.', 'Ted hid in the den.'], pa: 'first_sound',
    pairs: [['dad', 'did'], ['red', 'rid'], ['den', 'din']],
    story: ['Dad had a red hat.', 'Pip hid in it.', 'Dad sat.', 'Pip is in the hat!'],
  },
  {
    n: 14, title: 'review', newGraphemes: [], heartWords: ['he', 'she', 'we', 'me', 'be', 'to', 'has', 'his', 'as'],
    words: ['and', 'ant', 'sand', 'hand', 'stand', 'nest', 'tent', 'spin', 'snap', 'trip', 'step', 'stick', 'crack', 'drip'],
    nonsense: ['stap', 'drin', 'snek'], sentences: ['He has a tent.', 'She and Pip stand in the sand.', 'We stick it in the nest.'],
    pa: 'first_sound', pairs: [['trip', 'drip'], ['hand', 'sand'], ['snap', 'snip']],
    story: ['Pooh has a sack.', 'He can stand in it.', 'Pip hid in the sack.', 'He trips!', 'Pip and Pooh sit in the sand.'],
  },
  {
    n: 15, title: 'g', newGraphemes: ['g'], heartWords: [],
    words: ['get', 'dig', 'pig', 'peg', 'gap', 'tag', 'rag', 'Meg', 'grin', 'grip', 'digs'],
    nonsense: ['gip', 'deg', 'gan'], sentences: ['Pip digs in the sand.', 'Meg gets a peg.'], pa: 'medial_sound',
    pairs: [['pig', 'peg'], ['tag', 'rag'], ['dig', 'dip']],
    story: ['Pip is a pig.', 'Pip digs in the sand.', 'He digs and digs.', 'Pooh gets a pan.', '"Dig, Pip, dig!"'],
  },
  {
    n: 16, title: 'o', newGraphemes: ['o'], heartWords: [],
    words: ['on', 'not', 'pot', 'top', 'hot', 'dog', 'cot', 'mop', 'rock', 'sock', 'Tom', 'stop', 'spot', 'hop', 'got', 'drop'],
    nonsense: ['tog', 'pok', 'nop'], sentences: ['The pot is hot.', 'Stop, Pip!'], pa: 'final_sound',
    pairs: [['hat', 'hot'], ['pat', 'pot'], ['sack', 'sock']],
    contrast: ['a', 'o'],
    story: ['Pooh has a pot.', 'It is hot!', 'Pip hops on the pot.', '"Stop, Pip! Not on the hot pot!"'],
  },
  {
    n: 17, title: 'u', newGraphemes: ['u'], heartWords: [],
    words: ['up', 'cup', 'sun', 'run', 'mud', 'hug', 'rug', 'nut', 'duck', 'cut', 'hum', 'must', 'drum', 'truck', 'stuck'],
    nonsense: ['tup', 'mun', 'sug'], sentences: ['The sun is hot.', 'Pip runs in the mud.'], pa: 'medial_sound',
    pairs: [['cat', 'cut'], ['hat', 'hut'], ['rag', 'rug']],
    story: ['The sun is hot.', 'Pip runs in the mud.', 'Pooh has a cup.', 'Pip gets stuck!', 'Pooh gets Pip up. Hug!'],
  },
  {
    n: 18, title: 'l', newGraphemes: ['l'], heartWords: [],
    words: ['leg', 'lid', 'log', 'let', 'lot', 'lip', 'lap', 'lick', 'lost', 'hill', 'doll', 'lamp', 'slip', 'clap', 'plan'],
    nonsense: ['lom', 'lep', 'lut'], sentences: ['Tin Man lost his hat.', 'Pip sits on a log.'], pa: 'final_sound',
    pairs: [['lip', 'lap'], ['log', 'leg'], ['let', 'lot']],
    story: ['Tin Man lost his hat.', 'Is it on the hill?', 'It is not.', 'Pip spots it in a log!'],
  },
  {
    n: 19, title: 'f', newGraphemes: ['f'], heartWords: [],
    words: ['fan', 'fit', 'fog', 'fun', 'fed', 'fin', 'off', 'puff', 'flag', 'frog', 'fell', 'fast', 'soft', 'lift', 'gift'],
    nonsense: ['fip', 'fot', 'fum'], sentences: ['A frog sits on a log.', 'It is fun!'], pa: 'medial_sound',
    pairs: [['fan', 'fun'], ['fit', 'fat'], ['fog', 'frog']],
    story: ['Pooh sits on a log in the fog.', 'A frog hops up.', '"Pip, it is fun!"', 'Pip and Pooh hop and hop.'],
  },
  {
    n: 20, title: 'b', newGraphemes: ['b'], heartWords: ['you', 'are', 'was', 'of', 'said', 'my'],
    words: ['bat', 'bed', 'big', 'bug', 'bun', 'bag', 'bib', 'cab', 'crab', 'rub', 'bus', 'bell', 'best', 'bump'],
    nonsense: ['bip', 'bol', 'deb'], sentences: ['Pooh said, "My pot is in the bag."', 'You are a big bug!'], pa: 'segment3',
    pairs: [['bad', 'dad'], ['big', 'dig'], ['bed', 'bad']],
    contrast: ['b', 'd'],
    story: ['Pooh said, "My pot is not in the bag."', '"Was it Pip?"', '"It was a bug!" said Pip.', '"You are a big bug!"'],
  },
];

export const MAX_LEVEL = LEVELS.length;
export const levelByN = (n: number) => LEVELS.find((l) => l.n === n)!;
export const graphemeLevel = (g: string) => GRAPHEMES.find((x) => x.id === g)?.level ?? Infinity;
export function knownGraphemes(n: number): string[] {
  return GRAPHEMES.filter((g) => g.level <= n).map((g) => g.id);
}
