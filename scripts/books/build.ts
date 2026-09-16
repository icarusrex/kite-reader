/**
 * Bundle the family's own picture books into public/books (page pictures + text + readability).
 *   npm run books                 # all books
 *   npm run books -- fat-cat      # just one
 * macOS only: page rendering and OCR use PDFKit + Apple Vision via scripts/books/extract.swift.
 * Source files: ~/Documents/eBooks (override with BOOKS_DIR). Text fixes go in scripts/books/overrides.json.
 * Output is private: the repo is private and the site sits behind Cloudflare Access.
 */
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, rmSync, writeFileSync, existsSync, mkdtempSync, statSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { join } from 'node:path';
import JSZip from 'jszip';
import { analyzeBook, Book, BookPage, LibraryEntry } from '../../src/books/analyze';

const SRC = process.env.BOOKS_DIR ?? join(homedir(), 'Documents/eBooks');
const OUT = 'public/books';
const tmp = mkdtempSync(join(tmpdir(), 'kite-books-'));

type Kind =
  | { kind: 'pdf'; file: string; skipPages?: number[]; jacket?: boolean } // jacket: page 0 is back + front cover
  | { kind: 'epub-text'; file: string }      // real text + one picture per page (split on pagebreak)
  | { kind: 'epub-layers'; file: string }    // index-N_1.jpg = picture, index-N_2+.png = text images
  | { kind: 'epub-images'; file: string };   // scanned pages with text baked in; images sharing a <p> form one spread
type Source = { id: string; title: string; author: string } & Kind;

const BOOKS: Source[] = [
  { id: 'fat-cat-on-a-mat', title: 'Fat Cat on a Mat', author: 'Phil Roxbee Cox', kind: 'pdf', file: 'Fat Cat on a Mat.pdf', jacket: true },
  { id: 'fox-on-a-box', title: 'Fox on a Box', author: 'Phil Roxbee Cox', kind: 'pdf', file: 'Fox on a Box (Book).pdf', jacket: true },
  { id: 'frog-on-a-log', title: 'Frog on a Log', author: 'Phil Roxbee Cox', kind: 'pdf', file: 'Frog on a Log (Book).pdf', jacket: true },
  { id: 'goose-on-the-loose', title: 'Goose on the Loose', author: 'Phil Roxbee Cox', kind: 'pdf', file: 'Goose on the Loose (Book).pdf', jacket: true },
  { id: 'sam-sheep-cant-sleep', title: 'Sam Sheep Can’t Sleep', author: 'Phil Roxbee Cox', kind: 'pdf', file: "Sam Sheep Can't Sleep (book).pdf", jacket: true },
  { id: 'the-eye-book', title: 'The Eye Book', author: 'Theo. LeSieg', kind: 'pdf', file: 'The Eye Book.pdf' },
  { id: 'hop-on-pop', title: 'Hop on Pop', author: 'Dr. Seuss', kind: 'epub-images', file: 'Hop on Pop.epub' },
  { id: 'green-eggs-and-ham', title: 'Green Eggs and Ham', author: 'Dr. Seuss', kind: 'epub-layers', file: '[Dr. Seuss 1 ] Seuss, Dr - Green eggs and ham (Random House Books for Young Readers) - libgen.li.epub' },
  { id: 'are-you-my-mother', title: 'Are You My Mother?', author: 'P. D. Eastman', kind: 'epub-text', file: 'Are You My Mother_.epub' },
];

type Img = { file: string } | { pdf: string; page: number; rightHalf?: boolean };
type Job = { out?: string; picture?: Img[]; ocr: Img[]; text?: string };
type Extracted = { out?: string; width: number; height: number; lines: string[] };

const BOILERPLATE = /usborne|phonics readers|language (expert|consultant)|illustrat|edited by|copyright|all rights|isbn|random house|harpercollins|beginner books|library of congress|printed in|www\.|\.com|published by|trademark|\bphd\b/i;

function extractor() {
  const bin = join(tmp, 'extract');
  execFileSync('swiftc', ['-O', 'scripts/books/extract.swift', '-o', bin], { stdio: 'inherit' });
  const pages = (pdf: string) => Number(execFileSync(bin, ['pages', pdf], { encoding: 'utf8' }));
  const run = (jobs: Job[]): Extracted[] => {
    if (!jobs.length) return [];
    const r = spawnSync(bin, { input: JSON.stringify(jobs), maxBuffer: 64 * 1024 * 1024, encoding: 'utf8' });
    if (r.status !== 0) throw new Error(r.stderr);
    return r.stdout.trim().split('\n').map((l) => JSON.parse(l));
  };
  return { run, pages };
}

const htmlText = (html: string) => html.replace(/<br\s*\/?>/g, '\n').replace(/<[^>]+>/g, '')
  .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&#8217;|&rsquo;/g, '’').replace(/&#8220;|&ldquo;/g, '“').replace(/&#8221;|&rdquo;/g, '”')
  .split('\n').map((l) => l.replace(/\s+/g, ' ').trim()).filter(Boolean).join(' ');

async function unzip(file: string) {
  const zip = await JSZip.loadAsync(readFileSync(join(SRC, file)));
  const dir = mkdtempSync(join(tmp, 'epub-'));
  const names: string[] = [];
  for (const [name, entry] of Object.entries(zip.files)) {
    if (entry.dir || !/\.(x?html?|jpe?g|png)$/i.test(name)) continue;
    const path = join(dir, name);
    mkdirSync(path.slice(0, path.lastIndexOf('/')), { recursive: true });
    writeFileSync(path, await entry.async('nodebuffer'));
    names.push(name);
  }
  return { dir, names, size: (name: string) => statSync(join(dir, name)).size, read: (name: string) => readFileSync(join(dir, name), 'utf8') };
}

/** Pages as extraction jobs: `out` is the picture file name inside the book folder. */
async function jobsFor(b: Source, dir: string): Promise<Job[]> {
  const out = (n: number) => join(dir, `${String(n).padStart(2, '0')}.jpg`);
  if (b.kind === 'pdf') {
    const pdf = join(SRC, b.file);
    const count = extract.pages(pdf);
    return Array.from({ length: count }, (_, n) => n).filter((n) => !b.skipPages?.includes(n))
      // A landscape first page is the wraparound jacket (back + front): keep the front.
      .map((n) => ({ out: out(n), picture: [{ pdf, page: n, rightHalf: n === 0 && b.jacket }], ocr: n === 0 ? [] : [{ pdf, page: n }] }));
  }
  const e = await unzip(b.file);
  if (b.kind === 'epub-images') {
    const spreads = [...e.read('text.html').matchAll(/<p>([\s\S]*?)<\/p>/g)]
      .map((p) => [...p[1].matchAll(/src="([^"]+)"/g)].map((m) => ({ file: join(e.dir, m[1]) }))).filter((imgs) => imgs.length);
    return spreads.map((imgs, n) => ({ out: out(n), picture: imgs, ocr: imgs }));
  }
  if (b.kind === 'epub-layers') {
    const srcs = [...e.read('index.html').matchAll(/src="([^"]+)"/g)].map((m) => m[1]);
    const groups = new Map<string, string[]>();
    for (const s of srcs) { const k = s.replace(/_\d+\.\w+$/, ''); groups.set(k, [...(groups.get(k) ?? []), s]); }
    return [...groups.values()].map((g, n) => {
      const pic = g.find((s) => s.endsWith('.jpg'));
      return { out: pic ? out(n) : undefined, picture: pic ? [{ file: join(e.dir, pic) }] : undefined, ocr: g.filter((s) => s.endsWith('.png')).map((s) => ({ file: join(e.dir, s) })) };
    });
  }
  // epub-text: the story chapter (largest HTML file) split on page breaks
  const chapter = e.names.filter((f) => /\.x?html?$/i.test(f)).sort((a, z) => e.size(z) - e.size(a))[0];
  const base = chapter.slice(0, chapter.lastIndexOf('/') + 1);
  return e.read(chapter).split(/<p class="pagebreak">\s*<\/p>/).map((chunk, n) => {
    const img = chunk.match(/src="([^"]+)"/)?.[1];
    const text = [...chunk.matchAll(/<p class="(?:indent|nonindent|center)">([\s\S]*?)<\/p>/g)].map((m) => htmlText(m[1])).filter(Boolean).join('\n');
    return { out: img ? out(n) : undefined, picture: img ? [{ file: join(e.dir, base + img) }] : undefined, ocr: [], text };
  });
}

function cleanLines(lines: string[]) {
  if (lines.filter((l) => BOILERPLATE.test(l)).length >= 1) return '';
  return lines.map((l) => l.replace(/\s+/g, ' ').trim()).filter((l) => /[A-Za-z]/.test(l) && !/^\d+$/.test(l)).join('\n');
}

const dict = new Set(readFileSync('src/content/common-words.txt', 'utf8').split('\n'));
const overrides: Record<string, Record<string, string | null>> = existsSync('scripts/books/overrides.json') ? JSON.parse(readFileSync('scripts/books/overrides.json', 'utf8')) : {};
const only = process.argv.slice(2);
const extract = extractor();
const indexPath = join(OUT, 'index.json');
const index: LibraryEntry[] = existsSync(indexPath) ? JSON.parse(readFileSync(indexPath, 'utf8')) : [];

for (const b of BOOKS) {
  if (only.length && !only.includes(b.id)) continue;
  const dir = join(OUT, b.id);
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  process.stdout.write(`${b.title} … `);
  const jobs = await jobsFor(b, dir);
  const results = extract.run(jobs);
  const pages: BookPage[] = results.map((r, n) => {
    const override = overrides[b.id]?.[String(n)];
    const text = override !== undefined ? override ?? '' : jobs[n].text ?? cleanLines(r.lines);
    return { text, ...(r.out ? { image: r.out.split('/').pop(), w: r.width, h: r.height } : {}) };
  });
  const book: Book = { id: b.id, title: b.title, author: b.author, pages };
  writeFileSync(join(dir, 'book.json'), JSON.stringify(book, null, 1));
  const entry: LibraryEntry = { id: b.id, title: b.title, author: b.author, pages: pages.filter((p) => p.text).length, cover: pages.find((p) => p.image)?.image, analysis: analyzeBook(book, dict) };
  index.splice(0, index.length, ...index.filter((x) => x.id !== b.id), entry);
  console.log(`${pages.length} pages, readable at L${entry.analysis.ready95}`);
}
index.sort((a, b) => a.analysis.readyPreteach - b.analysis.readyPreteach || a.title.localeCompare(b.title));
writeFileSync(indexPath, JSON.stringify(index, null, 1));
rmSync(tmp, { recursive: true, force: true });
