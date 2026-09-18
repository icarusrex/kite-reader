import { describe, expect, it } from 'vitest';
import { withPronunciation } from './pronounce';

describe('pronunciation of homographs', () => {
  it('respells homographs and leaves other words alone', () => {
    expect(withPronunciation('does.')).toBe('duz.');
    expect(withPronunciation('Read.')).toBe('reed.');
    expect(withPronunciation('sun... flower.')).toBe('sun... flower.');
  });
});
