import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { wordLevel, BEYOND, setDictionary } from './wordLevel';

setDictionary(readFileSync('src/content/common-words.txt', 'utf8').split('\n'));

// Levels 1–20 in the Jolly Phonics order (s a t i p n → c k ck e h r m d → g o u l f b), later patterns as before
const expectations: [string, number][] = [
  ['sat', 3], ['sit', 4], ['cats', 8], ['the', 7], ['is', 7], ['am', 12], ['sand', 14], ['snap', 14], ['mask', 14], ['me', 14], ['go', 16], ['laptop', 20],
  ['dog', 16], ['stop', 16], ['cup', 17], ['truck', 17], ['drum', 17], ['lamp', 18], ['clap', 18], ['plum', 18],
  ['fan', 19], ['gift', 19], ['flag', 19], ['frog', 19], ['back', 20], ['bed', 20], ['black', 20], ['my', 20],
  ['fish', 22], ['chin', 23], ['bath', 24], ['king', 37], ['pink', 38], ['pie', 51], ['bike', 52], ['home', 54], ['cake', 56],
  ['blue', 57], ['cute', 58], ['tree', 59], ['car', 62], ['share', 63], ['fork', 64], ['her', 65], ['bird', 66],
  ['turn', 67], ['day', 72], ['rain', 73], ['eat', 75], ['boat', 76], ['cow', 77], ['out', 78], ['coin', 80],
  ['boy', 81], ['yes', 84], ['quick', 88], ['box', 89], ['zip', 90], ['saw', 91], ['ball', 92],
  ['when', 95], ['this', 97], ['moon', 101], ['book', 102], ['house', 104], ['jumped', 105], ['snow', 106],
  ['night', 107], ['little', 108], ['new', 111], ['knee', 114], ['happy', 116], ['page', 120],
];

describe('wordLevel', () => {
  for (const [w, lv] of expectations) {
    it(`${w} ≈ L${lv}`, () => expect(wordLevel(w).level).toBe(lv));
  }
  it('beyond', () => {
    expect(wordLevel('phone').level).toBe(BEYOND);
    expect(wordLevel("don't").level).toBe(BEYOND);
    expect(wordLevel('hullabaloo').level).toBe(BEYOND);
    expect(wordLevel('sometimes').level).toBe(113);
    expect(wordLevel('himself').level).toBe(20);
  });
  it('final s is only an ending when the rest is a word', () => {
    expect(wordLevel('gas').level).toBe(15);
    expect(wordLevel('cats').level).toBe(8);
    expect(wordLevel('thing').level).toBe(37);
  });
  it('held-sound words count as that letter', () => {
    expect(wordLevel('Mmm').level).toBe(12);
    expect(wordLevel('sss').level).toBe(3);
  });
});
