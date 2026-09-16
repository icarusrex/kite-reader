import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { wordLevel, BEYOND, setDictionary } from './wordLevel';

setDictionary(readFileSync('src/content/common-words.txt', 'utf8').split('\n'));

const expectations: [string, number][] = [
  ['am', 2], ['sat', 4], ['sit', 9], ['fan', 10], ['back', 21], ['fish', 22], ['chin', 23], ['bath', 24], ['the', 25],
  ['dog', 26], ['sand', 27], ['cats', 28], ['lamp', 29], ['gift', 30], ['stop', 31], ['snap', 32], ['flag', 34],
  ['is', 35], ['frog', 36], ['king', 37], ['pink', 38], ['cup', 39], ['mask', 40], ['bed', 44], ['black', 46],
  ['clap', 47], ['plum', 48], ['truck', 49], ['drum', 50], ['pie', 51], ['bike', 52], ['home', 54], ['cake', 56],
  ['blue', 57], ['cute', 58], ['tree', 59], ['car', 62], ['share', 63], ['fork', 64], ['her', 65], ['bird', 66],
  ['turn', 67], ['day', 72], ['rain', 73], ['eat', 75], ['boat', 76], ['cow', 77], ['out', 78], ['coin', 80],
  ['boy', 81], ['me', 82], ['go', 83], ['yes', 84], ['quick', 88], ['box', 89], ['zip', 90], ['saw', 91], ['ball', 92],
  ['my', 93], ['when', 95], ['this', 97], ['moon', 101], ['book', 102], ['house', 104], ['jumped', 105], ['snow', 106],
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
    expect(wordLevel('himself').level).toBe(65);
  });
});
