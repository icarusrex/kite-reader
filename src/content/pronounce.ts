/**
 * Homographs: words spelled the same but said differently (rainbow's "bow" vs "take a bow"). A word said on its own
 * has no context, so the voice guesses. These are sent as exact IPA, in the sense the app's books use.
 * Used by scripts/gen-audio.ts and the /api/say worker.
 */
export const PRONOUNCE: Record<string, string> = {
  bow: 'boʊ', bows: 'boʊz',            // rain-bow, a bow and arrow
  row: 'roʊ', rows: 'roʊz',            // ro-bot, a row of trees
  read: 'riːd', reads: 'riːdz',        // "My brothers read"
  does: 'dʌz',                         // "What does this say?"
  live: 'lɪv', lives: 'lɪvz',          // "I live in Kansas"
  wind: 'wɪnd', winds: 'wɪndz',        // the wind blows
  wound: 'wuːnd',
  close: 'kloʊz',                      // close the door
  use: 'juːz', used: 'juːzd',
  tear: 'tɪr', tears: 'tɪrz',          // the Tin Man's tears
  lead: 'liːd', leads: 'liːdz',        // lead the way
  minute: 'ˈmɪnɪt',
  desert: 'ˈdɛzərt',
  present: 'ˈprɛzənt',
  content: 'kənˈtɛnt',
  excuse: 'ɪkˈskjuːz',                 // "excuse me"
  permit: 'pərˈmɪt',
  converse: 'kənˈvɜrs',
  learned: 'lɜrnd',
  wicked: 'ˈwɪkɪd',
  dove: 'dʌv',
};

/** Model that follows IPA phoneme tags (eleven_v3 doesn't). */
export const IPA_MODEL = 'eleven_turbo_v2';

/** Replace homographs in a text with IPA phoneme tags. `ipa` tells the caller to use IPA_MODEL. */
export function withPronunciation(text: string): { text: string; ipa: boolean } {
  let ipa = false;
  const out = text.replace(/[A-Za-z]+/g, (w) => {
    const ph = PRONOUNCE[w.toLowerCase()];
    if (!ph) return w;
    ipa = true;
    return `<phoneme alphabet="ipa" ph="${ph}">${w}</phoneme>`;
  });
  return { text: out, ipa };
}
