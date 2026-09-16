import { LEVELS } from '../src/content/levels';
import { checkText } from '../src/engine/decodable';

let bad = 0;
const heart: string[] = [];
for (const l of LEVELS) {
  heart.push(...l.heartWords);
  const all = [...l.words, ...l.nonsense, ...l.sentences, ...(l.pairs?.flat() ?? [])].join(' ');
  const r = checkText(all, l.n, heart);
  if (r.failures.length) { bad++; console.log(`L${l.n}: not decodable →`, r.failures.map((f) => `${f.word} (${f.missing.join(',')})`).join(', ')); }
}
console.log(bad ? `${bad} level(s) with problems` : `All ${LEVELS.length} levels decodable ✓`);
process.exit(bad ? 1 : 0);
