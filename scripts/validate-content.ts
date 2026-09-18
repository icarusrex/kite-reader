import { LEVELS } from '../src/modules/reading/content/levels';
import { checkText } from '../src/modules/reading/engine/decodable';
import { tokenize, wordLevel } from '../src/modules/reading/engine/wordLevel';

// Two checks: letters taught so far (decodable.ts), and the full scope & sequence (wordLevel.ts), which also
// catches patterns taught later even when every letter is known (clusters like "and" = nd at L27, "is" = L35).
let bad = 0;
const heart: string[] = [];
for (const l of LEVELS) {
  heart.push(...l.heartWords);
  const all = [...l.words, ...l.nonsense, ...l.sentences, ...(l.story ?? []), ...(l.pairs?.flat() ?? [])].join(' ');
  const r = checkText(all, l.n, heart);
  const real = [...l.words, ...l.sentences, ...(l.story ?? []), ...(l.pairs?.flat() ?? [])].join(' ');
  const late = [...new Set(tokenize(real).filter((w) => !heart.some((h) => h.toLowerCase() === w.toLowerCase()) && wordLevel(w).level > l.n))];
  if (r.failures.length || late.length) {
    bad++;
    if (r.failures.length) console.log(`L${l.n}: not decodable →`, r.failures.map((f) => `${f.word} (${f.missing.join(',')})`).join(', '));
    if (late.length) console.log(`L${l.n}: taught later →`, late.map((w) => `${w} (L${wordLevel(w).level})`).join(', '));
  }
}
console.log(bad ? `${bad} level(s) with problems` : `All ${LEVELS.length} levels decodable ✓`);
process.exit(bad ? 1 : 0);
