import { GRAPHEMES } from './phonemes';

export type PaSkill = 'rhyme' | 'onset_rime' | 'blend2' | 'blend3' | 'first_sound' | 'final_sound';

export interface Level {
  n: number;
  title: string;
  newGraphemes: string[]; // empty = review level
  heartWords: string[];
  words: string[];       // real words for blending/reading
  nonsense: string[];    // alien names
  sentences: string[];
  pa: PaSkill;
  /** Minimal-pair sets for "Which word?" */
  pairs?: string[][];
  /** Short decodable story (one sentence per entry): read in sessions and at story time. */
  story?: string[];
  /** Graphemes easily confused with each other (b/d): extra Hear & Tap with only these options. */
  contrast?: string[];
}

export const LEVELS: Level[] = [
  { n: 1, title: 'a', newGraphemes: ['a'], heartWords: [], words: [], nonsense: [], sentences: [], pa: 'rhyme' },
  { n: 2, title: 'm', newGraphemes: ['m'], heartWords: [], words: ['am'], nonsense: ['ma', 'mam'], sentences: [], pa: 'rhyme' },
  { n: 3, title: 's', newGraphemes: ['s'], heartWords: [], words: ['am', 'Sam'], nonsense: ['mas', 'sa', 'mam'], sentences: [], pa: 'onset_rime' },
  { n: 4, title: 't', newGraphemes: ['t'], heartWords: [], words: ['at', 'mat', 'sat', 'Sam', 'am'], nonsense: ['tam', 'tas', 'tat'], sentences: ['Sam sat.'], pa: 'onset_rime' },
  { n: 5, title: 'Review', newGraphemes: [], heartWords: [], words: ['am', 'at', 'mat', 'sat', 'Sam', 'Matt'], nonsense: ['tas', 'mas', 'tat', 'sa'], sentences: ['Sam sat.', 'Matt sat.'], pa: 'blend2', story: ['Sam sat.', 'Matt sat.', 'Sam sat at a mat.'] },
  { n: 6, title: 'f', newGraphemes: ['f'], heartWords: [], words: ['fat', 'at', 'sat', 'mat'], nonsense: ['faf', 'maf', 'taf', 'fam'], sentences: ['Sam sat.', 'Matt sat.'], pa: 'blend2', story: ['Matt sat at a mat.', 'Sam sat at a mat.', 'Fat mat!'] },
  { n: 7, title: 'd', newGraphemes: ['d'], heartWords: [], words: ['dad', 'mad', 'sad', 'add', 'Tad', 'fad'], nonsense: ['dat', 'daf', 'das'], sentences: ['Dad sat.', 'Sad Sam sat.', 'Tad sat.'], pa: 'blend3', story: ['Dad sat.', 'Tad sat.', 'Sad Sam sat at a mat.', 'Dad sat at a mat.'] },
  { n: 8, title: 'g', newGraphemes: ['g'], heartWords: [], words: ['gas', 'tag', 'sag', 'dad', 'mad', 'sad'], nonsense: ['gam', 'dag', 'gat', 'mag'], sentences: ['Dad sat.', 'Sad Tad sat.'], pa: 'blend3', story: ['Tad sat at a mat.', 'Dad sat at a mat.', 'Sad Tad!', 'Mad Dad!'] },
  {
    n: 9, title: 'i', newGraphemes: ['i'], heartWords: [], words: ['it', 'sit', 'if', 'fit', 'dig', 'did', 'fig', 'Sid', 'mitt'],
    nonsense: ['mif', 'tig', 'sim', 'dif'], sentences: ['Sid sat.', 'Dad did it.', 'Sam did it.'], pa: 'first_sound',
    story: ['Sid did a dig.', 'Dad did a dig.', 'Tad sat.', 'Sad Tad!'],
    pairs: [['sat', 'sit'], ['fat', 'fit'], ['dad', 'did'], ['mad', 'mid']],
  },
  {
    n: 10, title: 'n', newGraphemes: ['n'], heartWords: [], words: ['in', 'tin', 'fin', 'man', 'fan', 'tan', 'nag', 'Nan', 'din', 'Dan'],
    nonsense: ['nim', 'naf', 'nid', 'gan'], sentences: ['Dan sat.', 'Nan did it.', 'Dad sat in it.'],
    pa: 'first_sound', pairs: [['tan', 'tin'], ['fan', 'fin'], ['man', 'min'], ['sat', 'sit']],
    story: ['Dan sat in a tin.', 'Nan sat in a tin.', 'Tin Man sat in a tin!'],
  },
  // Levels 11–20 (Stage 1). Characters remixed from public-domain stories: Pooh and Pig (Piglet) from
  // Winnie-the-Pooh, Tin Man from Oz. "Pooh" is a heart word (P is decodable, "ooh" is learned by heart).
  {
    n: 11, title: 'p', newGraphemes: ['p'], heartWords: ['Pooh'],
    words: ['pat', 'pin', 'tip', 'map', 'nap', 'pig', 'pit', 'sip', 'dip', 'tap', 'pan', 'pad', 'Pam'],
    nonsense: ['pim', 'pag', 'dap', 'pif'],
    sentences: ['Pig sat in a pit.', 'Pooh sat.', 'Pam sat in a pit.', 'Tin Man did a map.'],
    pa: 'first_sound', pairs: [['pat', 'pit'], ['pan', 'pin'], ['tap', 'tip'], ['sap', 'sip']],
    story: ['Pig sat in a pit.', 'Pooh sat in it.', 'Pig did a dip.', 'Pooh did a dip!'],
  },
  {
    n: 12, title: 'h', newGraphemes: ['h'], heartWords: [],
    words: ['hat', 'him', 'hid', 'hit', 'ham', 'had', 'hip'],
    nonsense: ['hap', 'hif', 'hin', 'hig'],
    sentences: ['Pig hid.', 'Pooh had a hat.', 'Dad had ham.', 'Sam hit it.'],
    pa: 'first_sound', pairs: [['hat', 'hit'], ['ham', 'him'], ['had', 'hid']],
    story: ['Pooh had a hat.', 'Pig hid in it!', 'Pooh had a pig in a hat.'],
  },
  {
    n: 13, title: 'b', newGraphemes: ['b'], heartWords: [],
    words: ['bat', 'big', 'bad', 'bag', 'bin', 'bib', 'bit', 'tab', 'dab', 'bid'],
    nonsense: ['bim', 'baf', 'bip', 'dib'],
    sentences: ['Pig had a big bag.', 'Bad bat!', 'Tin Man had a bib.'],
    pa: 'first_sound', pairs: [['bad', 'dad'], ['big', 'dig'], ['bid', 'did'], ['bag', 'big']],
    contrast: ['b', 'd'],
    story: ['Pooh had a big bag.', 'Pig hid in it.', 'Bad Pig!'],
  },
  {
    n: 14, title: 'l', newGraphemes: ['l'], heartWords: [],
    words: ['lap', 'lid', 'lip', 'fill', 'hill', 'lit', 'pill', 'mill', 'lab'],
    nonsense: ['lim', 'laf', 'lig', 'pil'],
    sentences: ['Pooh had a lid.', 'Pig hid in a hill.', 'Fill it!'],
    pa: 'first_sound', pairs: [['lap', 'lip'], ['lid', 'lad'], ['hill', 'fill']],
    story: ['Pig hid in a hill.', 'Pooh did a big dig.', 'Pooh had Pig!'],
  },
  {
    n: 15, title: 'j', newGraphemes: ['j'], heartWords: [],
    words: ['jam', 'jig', 'Jill', 'Jim', 'jab', 'jib'],
    nonsense: ['jaf', 'jid', 'jip', 'jas'],
    sentences: ['Pooh had jam.', 'Pig did a jig.', 'Jill had jam.'],
    pa: 'first_sound', pairs: [['jig', 'dig'], ['jam', 'ham']],
    story: ['Pooh had jam.', 'Pig had jam.', 'Pooh did a jig.', 'Jam! Jam! Jam!'],
  },
  {
    n: 16, title: 'c', newGraphemes: ['c'], heartWords: [],
    words: ['cat', 'can', 'cap', 'cab', 'Cam'],
    nonsense: ['cag', 'cim', 'cip', 'caf'],
    sentences: ['Pooh can dig.', 'Pig had a cap.', 'A cat sat in a cab.', 'Tin Man can nap.'],
    pa: 'final_sound', pairs: [['cap', 'cab'], ['cat', 'hat'], ['can', 'fan']],
    story: ['Tin Man had a cap.', 'A cat hid in it.', 'Tin Man can pat a cat.'],
  },
  {
    n: 17, title: 'v', newGraphemes: ['v'], heartWords: [],
    words: ['van', 'vat', 'Viv', 'vim', 'Val'],
    nonsense: ['vag', 'vip', 'vin', 'vam'],
    sentences: ['Pooh had a van.', 'A pig sat in a van.', 'Viv can nap.'],
    pa: 'final_sound', pairs: [['van', 'fan'], ['vat', 'fat']],
    contrast: ['f', 'v'],
    story: ['Pooh had a big van.', 'Pig sat in it.', 'Tin Man sat in it.', 'A cat hid in it!'],
  },
  {
    n: 18, title: 'w', newGraphemes: ['w'], heartWords: [],
    words: ['wig', 'win', 'wag', 'will', 'wit'],
    nonsense: ['waf', 'wim', 'wab', 'wid'],
    sentences: ['Pig had a wig.', 'Tin Man can win.', 'Pooh will nap.'],
    pa: 'final_sound', pairs: [['wig', 'big'], ['wag', 'bag'], ['win', 'pin']],
    story: ['Pig had a big wig.', 'It fit Pig!', 'Pooh will win a wig.'],
  },
  {
    n: 19, title: 'r', newGraphemes: ['r'], heartWords: [],
    words: ['rat', 'rip', 'rag', 'ran', 'rib', 'rim', 'rid', 'ram'],
    nonsense: ['raf', 'ril', 'rab', 'rin'],
    sentences: ['Pig ran.', 'A rat ran in a van.', 'Tin Man had a rag.'],
    pa: 'final_sound', pairs: [['rig', 'wig'], ['rag', 'wag'], ['ran', 'van']],
    contrast: ['r', 'w'],
    story: ['A rat ran in.', 'Pig ran!', 'Pooh ran!', 'Tin Man had a nap.'],
  },
  {
    n: 20, title: 'k', newGraphemes: ['k'], heartWords: [],
    words: ['kid', 'kit', 'Kim', 'kin', 'Kip'],
    nonsense: ['kif', 'kad', 'kag', 'kib'],
    sentences: ['Kim had a kit.', 'A kid ran.', 'Pooh can win a kit.'],
    pa: 'final_sound', pairs: [['kit', 'kid'], ['kin', 'kid']],
    story: ['Kim had a big kit.', 'A pin sat in it.', 'Kim hit it!', 'Pig ran. Pooh hid.', 'Tin Man had a nap.'],
  },
];

export const MAX_LEVEL = LEVELS.length;
export const levelByN = (n: number) => LEVELS.find((l) => l.n === n)!;

/** Level where a grapheme becomes available. */
export const graphemeLevel = (g: string) => GRAPHEMES.find((x) => x.id === g)?.level ?? Infinity;

/** Graphemes available (taught) at level n. */
export function knownGraphemes(n: number): string[] {
  return GRAPHEMES.filter((g) => g.level <= n).map((g) => g.id);
}
