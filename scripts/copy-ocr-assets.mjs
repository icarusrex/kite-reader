// Copies OCR engine files into public/ocr so book import works fully offline on localhost.
import { cpSync, mkdirSync, readdirSync } from 'node:fs';
const out = 'public/ocr';
mkdirSync(out, { recursive: true });
cpSync('node_modules/tesseract.js/dist/worker.min.js', `${out}/worker.min.js`);
for (const f of readdirSync('node_modules/tesseract.js-core')) if (/^tesseract-core.*\.(wasm|wasm\.js|js)$/.test(f)) cpSync(`node_modules/tesseract.js-core/${f}`, `${out}/${f}`);
cpSync('node_modules/@tesseract.js-data/eng/4.0.0_best_int/eng.traineddata.gz', `${out}/eng.traineddata.gz`);
cpSync('node_modules/pdfjs-dist/build/pdf.worker.min.mjs', `${out}/pdf.worker.min.mjs`);
console.log('OCR assets ready in public/ocr');
