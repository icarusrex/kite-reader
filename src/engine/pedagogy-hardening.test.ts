import { describe, expect, it } from 'vitest';
import { buildCheckout, buildMain, passesAssessment } from './session';
import { freshProgress, jumpTo } from './progress';

describe('pedagogy hardening', () => {
  it('ramps alien words instead of front-loading them', () => {
    expect(buildMain(jumpTo(freshProgress(), 2), 2).filter((s) => s.kind === 'alien')).toHaveLength(0);
    expect(buildMain(jumpTo(freshProgress(), 3), 3).filter((s) => s.kind === 'alien')).toHaveLength(0);
    expect(buildMain(jumpTo(freshProgress(), 4), 4).filter((s) => s.kind === 'alien')).toHaveLength(1);
    expect(buildMain(jumpTo(freshProgress(), 8), 8).filter((s) => s.kind === 'alien')).toHaveLength(1);
    expect(buildMain(jumpTo(freshProgress(), 11), 11).filter((s) => s.kind === 'alien')).toHaveLength(2);
  });

  it('adds medial-vowel PA before CVC segmentation', () => {
    expect(buildMain(jumpTo(freshProgress(), 15), 15).filter((s) => s.kind === 'medial')).toHaveLength(4);
    expect(buildMain(jumpTo(freshProgress(), 20), 20).filter((s) => s.kind === 'segment')).toHaveLength(4);
  });

  it('puts a tiny meaning check immediately after connected story text when a clear picture target exists', () => {
    let p = jumpTo(freshProgress(), 13);
    p = { ...p, levels: { ...p.levels, 13: { ...p.levels[13], sessions: 1 } } };
    const steps = buildMain(p, 13);
    const story = steps.findIndex((s) => s.kind === 'story');
    expect(story).toBeGreaterThanOrEqual(0);
    expect(steps[story + 1]?.kind).toBe('meaning');
    expect(steps[story + 1]?.options).toContain(steps[story + 1]?.word);
  });

  it('guarantees both receptive and productive probes of the new grapheme in checkout and cold check', () => {
    for (const phase of ['checkout', 'cold'] as const) {
      const required = buildCheckout(13, phase).filter((s) => s.required);
      expect(required).toHaveLength(2);
      expect(required.map((s) => [s.kind, s.g])).toEqual(expect.arrayContaining([['hearTap', 'd'], ['seeSay', 'd']]));
    }
  });

  it('does not let aggregate accuracy hide a miss on the newly taught target', () => {
    expect(passesAssessment('checkout', { answered: 10, correct: 9 }, { answered: 2, correct: 1 })).toBe(false);
    expect(passesAssessment('checkout', { answered: 10, correct: 9 }, { answered: 2, correct: 2 })).toBe(true);
    expect(passesAssessment('cold', { answered: 5, correct: 4 }, { answered: 2, correct: 1 })).toBe(false);
    expect(passesAssessment('cold', { answered: 5, correct: 4 }, { answered: 2, correct: 2 })).toBe(true);
  });
});
