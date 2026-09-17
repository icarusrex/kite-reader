import { describe, expect, it } from 'vitest';
import { withPronunciation } from './pronounce';

describe('pronunciation of homographs', () => {
  it('tags homographs with IPA and leaves other words alone', () => {
    expect(withPronunciation('rain... bow.')).toEqual({ text: 'rain... <phoneme alphabet="ipa" ph="boʊ">bow</phoneme>.', ipa: true });
    expect(withPronunciation('Read.').text).toBe('<phoneme alphabet="ipa" ph="riːd">Read</phoneme>.');
    expect(withPronunciation('sun... flower.')).toEqual({ text: 'sun... flower.', ipa: false });
  });
});
