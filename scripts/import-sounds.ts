/**
 * Bake recorded pure sounds into the app.
 *   npm run sounds -- ~/Downloads/kite-sounds.json
 * The file comes from Grown-ups → Sounds → "Export for the app". Writes public/audio/phonemes/<g>.wav
 * and adds phoneme:<g> to public/audio/manifest.json. Then build and deploy.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

/** Even out loudness: quiet hissing sounds (s, f, v) and loud vowels end up at the same peak level. */
function normalize(wav: Buffer, target = 0.7) {
  const n = (wav.length - 44) / 2;
  let peak = 1;
  for (let i = 0; i < n; i++) peak = Math.max(peak, Math.abs(wav.readInt16LE(44 + i * 2)));
  const gain = Math.min(4, (target * 32767) / peak);
  for (let i = 0; i < n; i++) wav.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(wav.readInt16LE(44 + i * 2) * gain))), 44 + i * 2);
  return wav;
}

const file = process.argv[2];
if (!file || !existsSync(file)) { console.error('Usage: npm run sounds -- <kite-sounds.json>'); process.exit(1); }
const sounds: Record<string, string> = JSON.parse(readFileSync(file, 'utf8'));
const OUT = 'public/audio';
const manifestPath = join(OUT, 'manifest.json');
const manifest: Record<string, string> = existsSync(manifestPath) ? JSON.parse(readFileSync(manifestPath, 'utf8')) : {};
mkdirSync(join(OUT, 'phonemes'), { recursive: true });
for (const [g, b64] of Object.entries(sounds)) {
  const rel = `phonemes/${g}.wav`;
  writeFileSync(join(OUT, rel), normalize(Buffer.from(b64, 'base64')));
  manifest[`phoneme:${g}`] = rel;
}
writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
console.log(`Baked ${Object.keys(sounds).length} sounds: ${Object.keys(sounds).join(' ')}`);
