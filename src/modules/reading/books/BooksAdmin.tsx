import { useEffect, useState } from 'react';
import { LibraryEntry, listBooks } from './library';
import { useStore } from '../../../core/app/store';
import { currentLevel } from '../engine/progress';

/** Grown-ups: the bundled books and when each becomes readable. Add books with `npm run books` on the Mac. */
export function BooksAdmin() {
  const { progress } = useStore();
  const level = currentLevel(progress);
  const [books, setBooks] = useState<LibraryEntry[]>([]);
  useEffect(() => { listBooks().then(setBooks); }, []);
  const lv = (n: number) => (n > 120 ? 'beyond L120' : `L${n}`);
  return (
    <div className="card">
      <h2>My books</h2>
      <p style={{ fontSize: 14 }}>Built from the family’s own copies in <code>~/Documents/eBooks</code>. To add a book, list it in <code>scripts/books/build.ts</code>, run <code>npm run books</code>, then deploy.</p>
      {books.length === 0 ? <p>No books bundled.</p> : (
        <table style={{ marginTop: 12 }}><thead><tr><th>Book</th><th>Pages</th><th>Readable at</th><th>With pre-teaching</th><th>Pre-teach words</th></tr></thead><tbody>
          {books.map(({ id, title, pages, analysis: a }) => (
            <tr key={id}>
              <td><b>{title}</b></td>
              <td>{pages}</td>
              <td><span className={`pill ${a.ready95 <= level ? 'good' : a.readyPreteach <= level ? 'warn' : ''}`}>{lv(a.ready95)}</span></td>
              <td>{lv(a.readyPreteach)}</td>
              <td style={{ fontSize: 13 }}>{a.preteach.join(', ')}</td>
            </tr>
          ))}
        </tbody></table>
      )}
    </div>
  );
}
