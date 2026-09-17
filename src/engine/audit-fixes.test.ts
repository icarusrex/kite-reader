import { describe, expect, it } from 'vitest';
import { buildCheckout, buildMain, MAX_NEW_HEART, passesAssessment } from './session';
import { freshProgress, jumpTo, recordAnswer } from './progress';
import { trickyParts } from './decodable';
import { soundOf } from '../content/phonemes';
import { bookExtras } from '../books/extras';
import type { LibraryEntry } from '../books/analyze';

const same = (a: string, b: string) => a !== b && soundOf(a) === soundOf(b);

describe('same-sound spellings (c / k / ck)', () => {
  it('Hear & Tap never offers two spellings of the same sound, in practice or checks', () => {
    for (let i = 0; i < 200; i++) {
      for (const n of [8, 10, 14, 20]) {
        const steps = [...buildMain(jumpTo(freshProgress(), n), n), ...buildCheckout(n), ...buildCheckout(n, 'cold')];
        for (const s of steps.filter((x) => x.kind === 'hearTap')) {
          for (const o of s.options!) expect(same(o, s.g!), `L${n} ${s.g} with ${o}`).toBe(false);
        }
      }
    }
  });
  it('Build It never offers a decoy that spells a sound of the word another way', () => {
    for (let i = 0; i < 200; i++) for (const s of buildMain(jumpTo(freshProgress(), 12), 12).filter((x) => x.kind === 'build')) {
      const decoys = s.options!.filter((o) => !s.word!.includes(o));
      for (const d of decoys) for (const ch of ['c', 'k', 'ck']) if (s.word!.includes(ch)) expect(same(d, ch), `${s.word} decoy ${d}`).toBe(false);
    }
  });
  it('level 8 can be passed: every required probe is answerable, and all-correct passes', () => {
    for (const phase of ['checkout', 'cold'] as const) {
      const steps = buildCheckout(8, phase).filter((s) => s.kind !== 'banner');
      const required = steps.filter((s) => s.required);
      expect(required.map((s) => s.g).sort()).toEqual(['c', 'c', 'ck', 'ck', 'k', 'k']);
      for (const s of required.filter((x) => x.kind === 'hearTap')) expect(s.options!.filter((o) => soundOf(o) === 'k')).toEqual([s.g]);
      expect(passesAssessment(phase, { answered: steps.length, correct: steps.length }, { answered: required.length, correct: required.length })).toBe(true);
    }
  });
});

describe('sight words', () => {
  const tricky = (w: string, n: number) => trickyParts(w, n).map((p) => (p.tricky ? `[${p.text}]` : p.text)).join('');
  it('mark the part that does not sound like its letters', () => {
    expect(tricky('is', 7)).toBe('i[s]');
    expect(tricky('I', 7)).toBe('[I]');
    expect(tricky('we', 14)).toBe('w[e]');
    expect(tricky('has', 14)).toBe('ha[s]');
    expect(tricky('of', 20)).toBe('[of]');
    expect(tricky('said', 20)).toBe('s[ai]d');
    expect(tricky('Pooh', 7)).toBe('P[ooh]');
  });
  it(`at most ${MAX_NEW_HEART} new per session; the rest come once earlier ones are started`, () => {
    let p = jumpTo(freshProgress(), 14);
    const first = buildMain(p, 14).filter((s) => s.kind === 'heart' && !s.model).map((s) => s.word);
    expect(first).toEqual(['he', 'has', 'she']);
    for (const w of first) p = recordAnswer(p, `h:${w}`, 'word', true, '2026-09-17');
    const second = buildMain(p, 14).filter((s) => s.kind === 'heart' && s.model).map((s) => s.word);
    expect(second).toEqual(['he', 'has', 'she', 'we', 'to', 'me']);
  });
});

describe('book pre-teaching', () => {
  const book = (preteach: string[]): LibraryEntry => ({ id: 'b', title: 'B', author: '', pages: 3, analysis: { tokens: 10, unique: 5, ready95: 14, readyPreteach: 7, preteach, names: [], sentences: [] } });
  it('pre-teaches irregular words and words beyond the built levels, not words he will soon sound out', () => {
    const words = bookExtras([book(['ant', 'on', 'spot', 'was', 'of', 'elephant', 'rain'])], 7).heart.map((h) => h.word);
    expect(words).toEqual(['was', 'of', 'elephant', 'rain']);
  });
});
