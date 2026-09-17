import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { BASICS, BASICS_PICTURE_WORDS, COMPOUND, STRETCH, SYLLABLE } from '../content/basics';
import { PICTURES } from '../content/pictures';
import { PROMPTS } from '../content/prompts';
import { buildBasics } from './basics';
import { segment } from './decodable';
import { currentBasics, freshProgress, passBasics, setTrack } from './progress';

describe('basics', () => {
  it('lessons have enough practice for 8-10 minutes (at least 12 scored answers)', () => {
    for (const b of BASICS) expect(buildBasics(freshProgress(), b.n).filter((s) => !s.demo && ['sayFast', 'hearTap', 'seeSay', 'rhyme'].includes(s.kind)).length, `B${b.n}`).toBeGreaterThanOrEqual(12);
  });

  it('a new child starts on Basics lesson 1 with 10-minute sessions', () => {
    const p = freshProgress();
    expect(p.track).toBe('basics');
    expect(currentBasics(p)).toBe(1);
    expect(p.settings.capMinutes).toBe(10);
  });

  it('every lesson opens with a say-it-fast demo, uses 2 choices, and only asks rhyme after showing it', () => {
    for (const b of BASICS) {
      const steps = buildBasics(freshProgress(), b.n);
      expect(steps[0]).toMatchObject({ kind: 'sayFast', demo: true });
      for (const s of steps.filter((x) => x.kind === 'sayFast' || x.kind === 'hearTap')) expect(s.options).toHaveLength(2);
      const rhymes = steps.filter((s) => s.kind === 'rhyme');
      if (b.rhyme) { expect(rhymes[0].demo).toBe(true); expect(rhymes.length).toBe(5); } else expect(rhymes).toHaveLength(0);
      if (b.newSound) {
        const tap = steps.filter((s) => s.kind === 'hearTap' && s.g === b.newSound);
        expect(steps.findIndex((s) => s.kind === 'meet')).toBeLessThan(steps.indexOf(tap[0]));
        expect(tap[0].demo).toBe(true);
      }
    }
  });

  it('passing lesson 10 moves him on to level 1; a grown-up can go back', () => {
    let p = freshProgress();
    for (const b of BASICS) p = passBasics(p, b.n, '2026-09-17');
    expect(p.track).toBe('levels');
    p = setTrack(p, 'basics', 3);
    expect(p.track).toBe('basics');
    expect(currentBasics(p)).toBe(3);
  });

  it('all Basics words have pictures, audio and (for stretched words) letter sounds', () => {
    const manifest = JSON.parse(readFileSync('public/audio/manifest.json', 'utf8'));
    for (const w of BASICS_PICTURE_WORDS) {
      expect(PICTURES, w).toHaveProperty(w);
      expect(manifest, w).toHaveProperty(`word:${w}`);
    }
    for (const c of [...COMPOUND, ...SYLLABLE]) expect(existsSync(`public/audio/${manifest[`split:${c.word}`]}`), c.word).toBe(true);
    for (const w of STRETCH) expect(segment(w), w).not.toBeNull();
    for (const k of Object.keys(PROMPTS)) expect(manifest, k).toHaveProperty(`prompt:${k}`);
  });
});
