import { describe, expect, it } from 'vitest';
import { checkText, checkWord, displayChunks, segment, trickyParts } from './decodable';
import { LEVELS } from '../content/levels';

describe('decodable', () => {
  it('segments words', () => {
    expect(segment('mat')).toEqual(['m', 'a', 't']);
    expect(segment('Matt')).toEqual(['m', 'a', 't']);
    expect(displayChunks('Matt')).toEqual(['M', 'a', 'tt']);
  });
  it('gates by level', () => {
    expect(checkWord('sat', 3).ok).toBe(true);
    expect(checkWord('sit', 3).ok).toBe(false);
    expect(checkWord('sit', 4).ok).toBe(true);
    expect(checkWord('pick', 8).ok).toBe(true);
    expect(checkText('Pat sat.', 5).ratio).toBe(1);
  });
  it('all level content is decodable at its level', () => {
    const heart: string[] = [];
    for (const l of LEVELS) {
      heart.push(...l.heartWords);
      const all = [...l.words, ...l.nonsense, ...l.sentences, ...(l.story ?? []), ...(l.pairs?.flat() ?? [])].join(' ');
      const res = checkText(all, l.n, heart);
      expect(res.failures, `level ${l.n}`).toEqual([]);
    }
  });
  it('marks the tricky part of a heart word', () => {
    expect(trickyParts('Pooh', 7)).toEqual([{ text: 'P', tricky: false }, { text: 'ooh', tricky: true }]);
    expect(trickyParts('said', 35)).toEqual([{ text: 's', tricky: false }, { text: 'ai', tricky: true }, { text: 'd', tricky: false }]);
  });
});
