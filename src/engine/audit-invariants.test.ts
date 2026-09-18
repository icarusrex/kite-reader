import { describe, expect, it } from 'vitest';
import { analyzeBook } from '../books/analyze';
import { buildBasics } from './basics';
import { canDecodeText, canDecodeWord } from './knowledge';
import { encodingChunks, hasVoicedFinalS, trickyParts } from './decodable';
import { freshProgress, jumpTo, recordAnswer } from './progress';
import { buildMain, readyForCheckout } from './session';
import { levelByN } from '../content/levels';

describe('audit invariants', () => {
  it('keeps orthography separate from phoneme segmentation for doubled consonants', () => {
    expect(encodingChunks('hiss')).toEqual(['h', 'i', 'ss']);
    expect(encodingChunks('mess')).toEqual(['m', 'e', 'ss']);
    expect(encodingChunks('hill')).toEqual(['h', 'i', 'll']);
    expect(encodingChunks('off')).toEqual(['o', 'ff']);
    expect(encodingChunks('bell')).toEqual(['b', 'e', 'll']);
  });

  it('marks both permanently irregular and not-yet-taught parts of heart words', () => {
    const marked = (w: string, n: number) => trickyParts(w, n).map((p) => p.tricky ? `[${p.text}]` : p.text).join('');
    expect(marked('the', 7)).toBe('[the]');
    expect(marked('the', 24)).toBe('th[e]');
    expect(marked('she', 14)).toBe('[she]');
    expect(marked('we', 14)).toBe('[we]');
    expect(marked('has', 14)).toBe('ha[s]');
    expect(marked('said', 20)).toBe('s[ai]d');
  });

  it('requires every level heart word to be answered correctly before checkout', () => {
    let p = jumpTo(freshProgress(), 14);
    expect(readyForCheckout(p, 14, new Set())).toBe(false);
    for (const w of levelByN(14).heartWords.slice(0, 3)) p = recordAnswer(p, `h:${w}`, 'word', true, '2026-09-18');
    expect(readyForCheckout(p, 14, new Set())).toBe(false);
    for (const w of levelByN(14).heartWords.slice(3)) p = recordAnswer(p, `h:${w}`, 'word', true, '2026-09-18');
    expect(readyForCheckout(p, 14, new Set())).toBe(true);
  });

  it('never uses a postponed heart word in connected text', () => {
    const p = jumpTo(freshProgress(), 14);
    for (let run = 0; run < 50; run++) {
      const connected = buildMain(p, 14).filter((s) => s.kind === 'sentence' || s.kind === 'story');
      for (const step of connected) {
        const text = step.text ?? step.lines!.join(' ');
        expect(canDecodeText(p, text, 14, ['he', 'has', 'she']).ratio, text).toBe(1);
        expect(text).not.toMatch(/\b(we|to|me|be|his|as)\b/i);
      }
    }
  });

  it('teaches the article a explicitly before treating it as readable', () => {
    let p = jumpTo(freshProgress(), 5);
    expect(canDecodeWord(p, 'a', 5)).toBe(false);
    expect(buildMain(p, 5).some((s) => s.kind === 'heart' && s.word === 'a')).toBe(true);
    p = recordAnswer(p, 'h:a', 'word', true, '2026-09-18');
    expect(canDecodeWord(p, 'a', 5)).toBe(true);
  });

  it('does not offer voiced final-s words in Build It until their sound is represented', () => {
    expect(hasVoicedFinalS('pins')).toBe(true);
    expect(hasVoicedFinalS('digs')).toBe(true);
    expect(hasVoicedFinalS('taps')).toBe(false);
    for (let run = 0; run < 100; run++) for (const step of buildMain(jumpTo(freshProgress(), 15), 15).filter((s) => s.kind === 'build')) {
      expect(hasVoicedFinalS(step.word!), step.word).toBe(false);
    }
  });

  it('Basics new-sound lessons contain required receptive and productive probes', () => {
    for (let n = 1; n <= 10; n++) {
      const steps = buildBasics(freshProgress(), n);
      const sound = steps.find((s) => s.kind === 'meet')?.g;
      if (!sound) continue;
      expect(steps.some((s) => s.required && s.kind === 'hearTap' && s.g === sound), `B${n}`).toBe(true);
      expect(steps.some((s) => s.required && s.kind === 'seeSay' && s.g === sound), `B${n}`).toBe(true);
    }
  });

  it('does not count recurring proper names as automatically decodable', () => {
    const pages = Array.from({ length: 10 }, (_, i) => ({ text: i < 2 ? 'Sant sat.' : 'Sam sat.' }));
    const result = analyzeBook({ id: 'x', title: 'X', author: '', pages }, new Set(['sam', 'sat']));
    expect(result.names).toContain('sant');
    expect(result.preteach).toContain('sant');
    expect(result.ready95).toBeGreaterThan(120);
  });
});
