import { describe, expect, it } from 'vitest';
import { checkText, checkWord, displayChunks, segment } from './decodable';
import { LEVELS } from '../content/levels';

describe('decodable', () => {
  it('segments words', () => {
    expect(segment('mat')).toEqual(['m', 'a', 't']);
    expect(segment('Matt')).toEqual(['m', 'a', 't']);
    expect(displayChunks('Matt')).toEqual(['M', 'a', 'tt']);
  });
  it('gates by level', () => {
    expect(checkWord('sat', 4).ok).toBe(true);
    expect(checkWord('sit', 4).ok).toBe(false);
    expect(checkWord('sit', 9).ok).toBe(true);
    expect(checkText('Sam sat.', 4).ratio).toBe(1);
  });
  it('all level content is decodable at its level', () => {
    const heart: string[] = [];
    for (const l of LEVELS) {
      heart.push(...l.heartWords);
      const all = [...l.words, ...l.nonsense, ...l.sentences, ...(l.pairs?.flat() ?? [])].join(' ');
      const res = checkText(all, l.n, heart);
      expect(res.failures, `level ${l.n}`).toEqual([]);
    }
  });
});
