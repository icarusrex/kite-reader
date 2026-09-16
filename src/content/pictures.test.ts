import { existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { LEVELS } from './levels';
import { CLEAR_WORDS, PICTURES, pictureUrl, storyPictureUrl } from './pictures';

describe('pictures', () => {
  it('every picture word has an illustration file', () => {
    const missing = Object.keys(PICTURES).filter((w) => !existsSync(`public${pictureUrl(w)}`));
    expect(missing).toEqual([]);
  });
  it('listening-game words are all picture words', () => {
    for (const w of CLEAR_WORDS) expect(PICTURES).toHaveProperty(w);
  });
  it('every story has an illustration', () => {
    const missing = LEVELS.filter((l) => l.story && !existsSync(`public${storyPictureUrl(l.n)}`)).map((l) => l.n);
    expect(missing).toEqual([]);
  });
});
