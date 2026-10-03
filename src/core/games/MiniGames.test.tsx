// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, expect, it, vi } from 'vitest';
import { MiniGame, GameTheme, stickerFor, STICKERS } from './MiniGames';
import { readingGameTheme, taughtGraphemes } from '../../modules/reading/games';
import { mathGameTheme } from '../../modules/math/games';
import { freshProgress, jumpTo } from '../../modules/reading/engine/progress';
import { freshMathProgress } from '../../modules/math/engine/state';
import { mathJumpTo } from '../../modules/math/engine/lessons';
import { mathLessonNumber } from '../../modules/math/content/lessons';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
vi.useFakeTimers();

const theme = (): GameTheme => ({
  cards: ['a', 'b', 'c'].map((id) => ({ id, face: <b data-id={id}>{id}</b>, speak: async () => {} })),
  ask: async () => {}, cheer: async () => {},
});
async function mount(kind: 'pop' | 'memory', onDone = () => {}) {
  const el = document.createElement('div'); document.body.append(el);
  await act(async () => { createRoot(el).render(<MiniGame kind={kind} theme={theme()} onDone={onDone} />); });
  return el;
}
const settle = async (ms = 1000) => { await act(async () => { await vi.advanceTimersByTimeAsync(ms); }); };

describe('mini games', () => {
  it('memory match: matching every pair wins', async () => {
    const el = await mount('memory');
    const ids = () => [...el.querySelectorAll('.memory-card')];
    expect(ids()).toHaveLength(6);
    // Turn cards over one at a time, remembering what each was, then pair them up.
    const seen: string[] = [];
    for (let i = 0; i < 6; i += 2) {
      for (const j of [i, i + 1]) { await act(async () => { (ids()[j] as HTMLElement).click(); }); seen[j] = ids()[j].querySelector('b')!.dataset.id!; }
      await settle();
    }
    for (const id of ['a', 'b', 'c']) {
      const [x, y] = seen.flatMap((s, k) => (s === id ? [k] : []));
      if (ids()[x].classList.contains('matched')) continue;
      await act(async () => { (ids()[x] as HTMLElement).click(); }); await act(async () => { (ids()[y] as HTMLElement).click(); }); await settle();
    }
    expect(el.textContent).toContain('You did it!');
  });

  it('bubble pop: popping the asked-for bubbles for five rounds wins; wrong bubbles only wobble', async () => {
    let asked = '';
    const t = theme(); t.ask = async (c) => { asked = c.id; };
    const el = document.createElement('div'); document.body.append(el);
    await act(async () => { createRoot(el).render(<MiniGame kind="pop" theme={t} onDone={() => {}} />); });
    for (let round = 0; round < 5; round++) {
      const wrong = [...el.querySelectorAll('.bubble')].find((b) => b.querySelector('b')!.dataset.id !== asked && !b.classList.contains('popped'));
      if (wrong) { await act(async () => { wrong.dispatchEvent(new Event('pointerdown', { bubbles: true })); }); expect(wrong.classList.contains('wrong')).toBe(true); await settle(600); }
      for (const b of [...el.querySelectorAll('.bubble')].filter((b) => b.querySelector('b')!.dataset.id === asked)) {
        await act(async () => { b.dispatchEvent(new Event('pointerdown', { bubbles: true })); }); await settle(50);
      }
      await settle(300);
    }
    expect(el.textContent).toContain('You did it!');
    expect(el.querySelector('.game-stars')!.textContent).toBe('⭐'.repeat(10));
  });

  it('stickers cycle through the set', () => {
    expect(stickerFor(1)).toBe(STICKERS[0]);
    expect(stickerFor(STICKERS.length + 1)).toBe(STICKERS[0]);
  });
});

describe('game cards come from what the child has learned', () => {
  it('reading: taught letter sounds, at least three', () => {
    expect(readingGameTheme(freshProgress()).cards.length).toBeGreaterThanOrEqual(3);
    const p = jumpTo({ ...freshProgress(), track: 'levels' }, 6);
    const taught = taughtGraphemes(p);
    for (const c of readingGameTheme(p).cards) expect(taught).toContain(c.id);
  });
  it('math: dots until numerals are taught, then numerals; up to five once counting to five is passed', () => {
    const fresh = mathGameTheme(freshMathProgress());
    expect(fresh.cards.map((c) => c.id)).toEqual(['1', '2', '3']);
    const later = mathGameTheme(mathJumpTo(freshMathProgress(), mathLessonNumber('num.order.1_5')));
    expect(later.cards.map((c) => c.id)).toEqual(['1', '2', '3', '4', '5']);
  });
});
