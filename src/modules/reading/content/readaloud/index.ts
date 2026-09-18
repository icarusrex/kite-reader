export interface ReadAloudChapter { n: number; label: string; title: string; paragraphs: string[] }
export interface ReadAloudBook {
  id: string; title: string; author: string; year: number; publicDomain: string; textNote?: string;
  chapters: ReadAloudChapter[];
}
export interface VocabItem { word: string; meaning: string; example: string }

export const LIBRARY = [
  { id: 'wizard-of-oz', title: 'The Wonderful Wizard of Oz', author: 'L. Frank Baum', cover: '🌪️', color: '#CFE3EF' },
  { id: 'winnie-the-pooh', title: 'Winnie-the-Pooh', author: 'A. A. Milne', cover: '🍯', color: '#F6E3B4' },
] as const;

// Lazy-loaded so the main app bundle stays small.
export async function loadBook(id: string): Promise<ReadAloudBook> {
  if (id === 'wizard-of-oz') return (await import('./wizard-of-oz.json')).default as ReadAloudBook;
  return (await import('./winnie-the-pooh.json')).default as ReadAloudBook;
}
export async function loadVocab(): Promise<Record<string, Record<string, VocabItem[]>>> {
  return (await import('./vocab.json')).default as Record<string, Record<string, VocabItem[]>>;
}
