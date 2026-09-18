import { describe, expect, it } from 'vitest';
import { buildMain, bookSentencesFor, storyFor } from './session';
import { levelByN } from '../content/levels';
import { CLEAR_WORDS } from '../content/pictures';
import { freshProgress, jumpTo } from './progress';

describe('session builder', () => {
  it('adds up to 2 new heart words from owned books and uses local sentences when decodable', () => {
    const p = jumpTo(freshProgress(), 9);
    const steps = buildMain(p, 9, {
      heart: [{ word: 'said', source: 'Book A' }, { word: 'you', source: 'Book A' }, { word: 'was', source: 'Book B' }],
      sentences: [{ text: 'Pip sits in a pen.', source: 'Book A' }, { text: 'The fox hid.', source: 'Book B' }],
    });
    expect(steps.filter((s) => s.kind === 'heart' && !s.model).map((s) => s.word)).toEqual(['said', 'you']);
    expect(steps.filter((s) => s.kind === 'heart' && s.model).map((s) => s.word)).toEqual(['said', 'you']);
    const sentence = steps.find((s) => s.kind === 'sentence')!;
    expect(['Pip sits in a pen.', ...levelByN(9).sentences, ...bookSentencesFor(9).map((b) => b.text)]).toContain(sentence.text);
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
  it('level 7 teaches Pooh, the, is as heart words: modelled first, then read; I waits for the next session', () => {
    const steps = buildMain(jumpTo(freshProgress(), 7), 7);
    const pooh = steps.filter((s) => s.kind === 'heart' && s.word === 'Pooh');
    expect(pooh.map((s) => !!s.model)).toEqual([true, false]);
    expect(steps.filter((s) => s.kind === 'heart' && !s.model).map((s) => s.word)).toEqual(['Pooh', 'the', 'is']);
  });
  it('confusable letters get Hear & Tap with only those two options', () => {
    const steps = buildMain(jumpTo(freshProgress(), 20), 20);
    const bd = steps.filter((s) => s.kind === 'hearTap' && s.options?.length === 2 && s.options.includes('b') && s.options.includes('d'));
    expect(bd.length).toBe(2);
  });
  it('story alternates with the sentence and story time always has text', () => {
    let p = jumpTo(freshProgress(), 12);
    p = { ...p, levels: { ...p.levels, 12: { ...p.levels[12], sessions: 1 } } };
    expect(buildMain(p, 12).some((s) => s.kind === 'story')).toBe(true);
    for (let n = 5; n <= 20; n++) expect(storyFor(n)?.length).toBeGreaterThan(0);
  });
  it('final-sound listening game at level 16 uses clear pictures only', () => {
    const steps = buildMain(jumpTo(freshProgress(), 16), 16).filter((s) => s.kind === 'ear');
    expect(steps.length).toBe(4);
    for (const s of steps) { expect(s.ear!.mode).toBe('last'); for (const o of s.ear!.options) expect(CLEAR_WORDS).toContain(o); }
  });
});
