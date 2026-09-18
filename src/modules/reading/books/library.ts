/**
 * The family's own picture books, bundled at build time by `npm run books` into /books
 * (page pictures + text + readability). Private: served only behind Cloudflare Access.
 */
import type { Book, LibraryEntry } from './analyze';
import { load, save } from '../../../core/storage';

export type { Book, BookAnalysis, BookPage, LibraryEntry } from './analyze';

let index: Promise<LibraryEntry[]> | null = null;
export function listBooks(): Promise<LibraryEntry[]> {
  index ??= fetch('/books/index.json').then((r) => (r.ok ? r.json() : [])).catch(() => []);
  return index;
}

export async function getBook(id: string): Promise<Book | null> {
  try {
    const r = await fetch(`/books/${id}/book.json`);
    return r.ok ? r.json() : null;
  } catch {
    return null;
  }
}

export const imageUrl = (id: string, file: string) => `/books/${id}/${file}`;

export async function markPageRead(id: string, page: number) {
  const read = await load<number[]>(`books:read:${id}`, []);
  if (!read.includes(page)) await save(`books:read:${id}`, [...read, page]);
}
