import { describe, expect, it } from 'vitest';
import { Progress, coldCheckDue, currentLevel, dueItems, freshProgress, passCheckout, passCold, recordAnswer } from './progress';

describe('progress', () => {
  it('starts at level 1', () => expect(currentLevel(freshProgress())).toBe(1));

  it('leitner promotes once per day, demotes on error', () => {
    let p = freshProgress();
    p = recordAnswer(p, 'g:a', 'grapheme', true, '2026-09-01');
    expect(p.items['g:a'].box).toBe(1);
    expect(p.items['g:a'].due).toBe('2026-09-02');
    p = recordAnswer(p, 'g:a', 'grapheme', true, '2026-09-01');
    expect(p.items['g:a'].box).toBe(1);
    p = recordAnswer(p, 'g:a', 'grapheme', true, '2026-09-02');
    expect(p.items['g:a'].box).toBe(2);
    p = recordAnswer(p, 'g:a', 'grapheme', false, '2026-09-02');
    expect(p.items['g:a'].box).toBe(1);
    expect(dueItems(p, '2026-09-03').map((i) => i.id)).toEqual(['g:a']);
  });

  it('checkout -> cold next day -> unlock', () => {
    let p = passCheckout(freshProgress(), 1, '2026-09-01');
    expect(coldCheckDue(p, 1, '2026-09-01')).toBe(false);
    expect(coldCheckDue(p, 1, '2026-09-02')).toBe(true);
    p = passCold(p, 1, '2026-09-02');
    expect(currentLevel(p)).toBe(2);
  });
  it('existing progress with no level passed moves to Basics; a child already past level 1 stays on levels', async () => {
    const { migrate } = await import('../../../core/app/store');
    const old = { ...freshProgress(), track: undefined, basics: undefined, settings: { ...freshProgress().settings, capMinutes: 15 } } as unknown as Progress;
    expect(migrate(old).track).toBe('basics');
    expect(migrate(old).settings.capMinutes).toBe(10);
    const along = { ...old, levels: { ...old.levels, 1: { status: 'passed', sessions: 2 }, 2: { status: 'active', sessions: 0 } } } as unknown as Progress;
    expect(migrate(along).track).toBe('levels');
  });
});
