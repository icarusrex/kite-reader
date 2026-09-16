/**
 * Import an owned EPUB or PDF into the local library, entirely in the browser.
 * EPUB: uses the text if present, otherwise OCRs the page images.
 * PDF: uses the text layer if present, otherwise renders each page and OCRs it.
 */
import JSZip from 'jszip';
import { set } from 'idb-keyval';
import type { LocalBook, LocalPage } from './library';
import { dictionary, slug } from './library';

export type Progress = (msg: string, done: number, total: number) => void;

const BOILERPLATE = /usborne|phonics readers|language (expert|consultant)|illustrat|edited by|copyright|all rights|isbn|random house|harpercollins|beginner books|library of congress|printed in|www\.|\.com|published by|psych|\bphd\b/i;

/** Drop OCR lines that are mostly non-words (picture noise) and whole pages of publisher matter. */
async function tidy(text: string) {
  const dict = await dictionary();
  const raw = text.split('\n');
  if (raw.filter((l) => BOILERPLATE.test(l)).length >= 2) return '';
  return raw.filter((l) => {
    const words = l.match(/[A-Za-z]+(?:'[a-z]+)?/g) ?? [];
    if (!words.length) return false;
    const real = words.filter((w) => dict.has(w.toLowerCase().replace(/'.*/, '')) || w === 'I' || w === 'a');
    return real.length / words.length >= 0.6 && real.some((w) => w.length >= 2);
  }).join('\n');
}

function cleanOcr(text: string) {
  return text
    .split('\n')
    .map((l) => l.replace(/[|©®™€£$@#%^*_=+<>~{}[\]\\]/g, ' ').replace(/\s{2,}/g, ' ').trim())
    .filter((l) => (l.match(/[A-Za-z]{2,}/g) ?? []).length > 0 && !BOILERPLATE.test(l))
    .filter((l) => { const letters = l.replace(/[^A-Za-z]/g, '').length; return letters >= Math.min(4, l.length * 0.5); })
    .join('\n');
}

let workerPromise: Promise<import('tesseract.js').Worker> | null = null;
async function ocrWorker() {
  workerPromise ??= import('tesseract.js').then(({ createWorker }) =>
    createWorker('eng', 1, { workerPath: '/ocr/worker.min.js', corePath: '/ocr/', langPath: '/ocr/', gzip: true }));
  return workerPromise;
}

async function ocr(image: Blob | HTMLCanvasElement): Promise<string> {
  const w = await ocrWorker();
  await w.setParameters({ tessedit_pageseg_mode: '11' as never }); // sparse text: picture books
  const { data } = await w.recognize(image);
  return tidy(data.text).then(cleanOcr);
}

async function toJpeg(src: Blob | HTMLCanvasElement, maxW = 1100): Promise<Blob> {
  const bmp = src instanceof Blob ? await createImageBitmap(src) : src;
  const scale = Math.min(1, maxW / bmp.width);
  const c = document.createElement('canvas');
  c.width = Math.round(bmp.width * scale); c.height = Math.round(bmp.height * scale);
  c.getContext('2d')!.drawImage(bmp, 0, 0, c.width, c.height);
  return new Promise((r) => c.toBlob((b) => r(b!), 'image/jpeg', 0.82));
}

async function storeImage(bookId: string, n: number, blob: Blob) {
  const key = `lib:img:${bookId}:${n}`;
  await set(key, await toJpeg(blob));
  return key;
}

export function cleanTitle(name: string) {
  let t = name.replace(/\.[^.]+$/, '').replace(/\s+-\s+libgen.*$/i, '').replace(/^\[.*?\]\s*/, '').replace(/\((?:book|[^)]*(?:books|press|publish|\d{4})[^)]*)\)/gi, '').replace(/_$/, '?');
  if (t.includes(' - ')) t = t.split(' - ').slice(1).join(' - '); // "Author - Title"
  t = t.replace(/-\d+$/, '').replace(/\s{2,}/g, ' ').trim();
  const small = new Set(['a', 'an', 'and', 'on', 'of', 'the', 'in', 'to', 'for']);
  return t.split(' ').map((w, i) => (i > 0 && small.has(w.toLowerCase()) ? w.toLowerCase() : w[0].toUpperCase() + w.slice(1))).join(' ');
}

export async function importFile(file: File, onProgress: Progress): Promise<LocalBook> {
  const title = cleanTitle(file.name);
  const id = slug(title);
  const book: LocalBook = { id, title, source: file.name, importedOn: new Date().toISOString().slice(0, 10), pages: [] };
  if (/\.epub$/i.test(file.name)) book.pages = await importEpub(file, id, onProgress);
  else if (/\.pdf$/i.test(file.name)) book.pages = await importPdf(file, id, onProgress);
  else throw new Error('Only .epub and .pdf are supported');
  book.pages = book.pages.filter((p) => p.text.trim() || p.image);
  return book;
}

async function importEpub(file: File, id: string, onProgress: Progress): Promise<LocalPage[]> {
  const zip = await JSZip.loadAsync(file);
  const container = await zip.file('META-INF/container.xml')?.async('string');
  const opfPath = container?.match(/full-path="([^"]+)"/)?.[1] ?? Object.keys(zip.files).find((f) => f.endsWith('.opf'))!;
  const base = opfPath.includes('/') ? opfPath.slice(0, opfPath.lastIndexOf('/') + 1) : '';
  const opf = await zip.file(opfPath)!.async('string');
  const doc = new DOMParser().parseFromString(opf, 'application/xml');
  const items = new Map([...doc.querySelectorAll('manifest > item')].map((i) => [i.getAttribute('id')!, i.getAttribute('href')!]));
  const spine = [...doc.querySelectorAll('spine > itemref')].map((r) => items.get(r.getAttribute('idref')!)).filter(Boolean) as string[];
  const resolve = (from: string, href: string) => {
    const parts = (from.slice(0, from.lastIndexOf('/') + 1) + href).split('/');
    const out: string[] = [];
    for (const p of parts) { if (p === '..') out.pop(); else if (p !== '.') out.push(p); }
    return decodeURIComponent(out.join('/'));
  };

  const pages: LocalPage[] = [];
  const seenImg = new Set<string>();
  let textChars = 0;
  const chapters: { text: string; images: string[] }[] = [];
  for (const href of spine) {
    const path = base + href;
    const html = await zip.file(decodeURIComponent(path))?.async('string');
    if (!html) continue;
    const d = new DOMParser().parseFromString(html, 'text/html');
    const paras = [...d.querySelectorAll('p, h1, h2, h3, li')].map((e) => e.textContent?.replace(/\s+/g, ' ').trim() ?? '').filter(Boolean);
    const text = paras.join('\n');
    textChars += text.replace(/\s/g, '').length;
    const images = [...d.querySelectorAll('img, image')].map((e) => e.getAttribute('src') ?? e.getAttribute('xlink:href') ?? e.getAttribute('href') ?? '').filter(Boolean).map((s) => resolve(path, s));
    chapters.push({ text, images });
  }
  let imgList = chapters.flatMap((c) => c.images).filter((s) => !seenImg.has(s) && seenImg.add(s));
  if (imgList.length < 3) imgList = Object.keys(zip.files).filter((f) => /\.(jpe?g|png)$/i.test(f)).sort();

  if (textChars > 400 && textChars > imgList.length * 20) {
    // Text epub: one page per spine document, split long ones
    let n = 0;
    for (const c of chapters) {
      if (!c.text) continue;
      const paras = c.text.split('\n');
      for (let i = 0; i < paras.length; i += 6) pages.push({ text: paras.slice(i, i + 6).join('\n') });
      onProgress('Reading text', ++n, chapters.length);
    }
    return pages;
  }
  // Image epub (picture book scans): group images that belong to one page (e.g. index-5_1.jpg art + index-5_2.png text),
  // OCR every image, keep the largest as the page picture.
  const groups: string[][] = [];
  for (const f of imgList) {
    const key = f.replace(/_\d+\.(jpe?g|png)$/i, '');
    const last = groups[groups.length - 1];
    if (last && last[0].replace(/_\d+\.(jpe?g|png)$/i, '') === key && key !== f) last.push(f); else groups.push([f]);
  }
  for (let i = 0; i < groups.length; i++) {
    onProgress('Reading page pictures (OCR)', i + 1, groups.length);
    const blobs = (await Promise.all(groups[i].map((f) => zip.file(f)?.async('blob')))).filter((b): b is Blob => !!b && b.size >= 3000);
    if (!blobs.length) continue;
    const texts: string[] = [];
    for (const b of blobs) { const t = await ocr(b); if (t) texts.push(t); }
    const picture = blobs.reduce((a, b) => (b.size > a.size ? b : a));
    pages.push({ text: texts.join('\n'), image: await storeImage(id, i, picture) });
  }
  return pages;
}

async function importPdf(file: File, id: string, onProgress: Progress): Promise<LocalPage[]> {
  const pdfjs = await import('pdfjs-dist');
  pdfjs.GlobalWorkerOptions.workerSrc = '/ocr/pdf.worker.min.mjs';
  const pdf = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
  const pages: LocalPage[] = [];
  for (let n = 1; n <= pdf.numPages; n++) {
    onProgress('Reading pages', n, pdf.numPages);
    const page = await pdf.getPage(n);
    const content = await page.getTextContent();
    let text = content.items.map((it) => ('str' in it ? it.str : '')).join(' ').replace(/\s+/g, ' ').trim();
    const viewport = page.getViewport({ scale: 2 });
    const canvas = document.createElement('canvas');
    canvas.width = viewport.width; canvas.height = viewport.height;
    await page.render({ canvasContext: canvas.getContext('2d')!, viewport }).promise;
    if (text.replace(/\W/g, '').length < 20) { onProgress('Reading page pictures (OCR)', n, pdf.numPages); text = await ocr(canvas); }
    else text = cleanOcr(await tidy(text));
    const blob = await new Promise<Blob>((r) => canvas.toBlob((b) => r(b!), 'image/jpeg', 0.9));
    pages.push({ text, image: await storeImage(id, n, blob) });
  }
  return pages;
}
