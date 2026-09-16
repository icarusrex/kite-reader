import { describe, expect, it } from 'vitest';
import { buildMain, bookSentencesFor } from './session';
import { freshProgress, jumpTo } from './progress';

describe('session builder', () => {
  it('adds up to 2 new heart words from owned books and uses local sentences when decodable', () => {
    const p = jumpTo(freshProgress(), 9);
    const steps = buildMain(p, 9, {
      heart: [{ word: 'said', source: 'Book A' }, { word: 'you', source: 'Book A' }, { word: 'was', source: 'Book B' }],
      sentences: [{ text: 'Sid sat.', source: 'Book A' }, { text: 'The fox hid.', source: 'Book B' }],
    });
    expect(steps.filter((s) => s.kind === 'heart').map((s) => s.word)).toEqual(['said', 'you']);
    const sentence = steps.find((s) => s.kind === 'sentence')!;
    expect(['Sid sat.', 'Dad did it.', 'Sam did it.']).toContain(sentence.text);
  });
  it('skips heart words already being learned', () => {
    let p = jumpTo(freshProgress(), 9);
    p = { ...p, items: { 'h:said': { id: 'h:said', kind: 'word', box: 1, due: '2099-01-01', seen: 1, correct: 1, wrong: 0 } } };
    const steps = buildMain(p, 9, { heart: [{ word: 'said', source: 'A' }], sentences: [] });
    expect(steps.some((s) => s.kind === 'heart')).toBe(false);
  });
  it('public-domain book sentences are strictly decodable', () => {
    for (const n of [10, 12, 20]) for (const s of bookSentencesFor(n)) expect(s.level).toBeLessThanOrEqual(n);
  });
});
