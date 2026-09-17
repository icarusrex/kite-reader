/**
 * Homographs: words spelled the same but said differently (rainbow's "bow" vs "take a bow"). A word said on its own
 * has no context, so the voice guesses. These are respelled for the voice, in the sense the app's books use.
 * Respelling (not IPA) because the IPA-capable models make whole words sound wrong ("does" tested 2026-09-17).
 * Used by scripts/gen-audio.ts and the /api/say worker.
 */
export const PRONOUNCE: Record<string, string> = {
  bow: 'boh', bows: 'bohz',            // rain-bow, a bow and arrow
  row: 'roe', rows: 'roez',            // ro-bot, a row of trees
  read: 'reed', reads: 'reeds',        // "My brothers read"
  does: 'duz',                         // "What does this say?"
  live: 'liv', lives: 'livz',          // "I live in Kansas"
  wind: 'winnd', winds: 'winndz',      // the wind blows
  wound: 'woond',
  close: 'kloze',                      // close the door
  use: 'yooz', used: 'yoozd',
  tear: 'teer', tears: 'teers',        // the Tin Man's tears
  lead: 'leed', leads: 'leeds',        // lead the way
  minute: 'minnit',
  desert: 'dezzert',
  present: 'prezzent',
  content: 'kuntent',
  excuse: 'ekskyooz',                  // "excuse me"
  permit: 'permitt',
  converse: 'kunverse',
  learned: 'lernd',
  wicked: 'wikkid',
  dove: 'duv',
};

/** Respell homographs in a text so the voice says them in the intended sense. */
export function withPronunciation(text: string): string {
  return text.replace(/[A-Za-z]+/g, (w) => PRONOUNCE[w.toLowerCase()] ?? w);
}
