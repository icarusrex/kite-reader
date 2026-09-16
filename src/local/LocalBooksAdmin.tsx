import { useEffect, useRef, useState } from 'react';
import { deleteBook, getBook, getImage, listBooks, LibraryEntry, LocalBook, saveBook } from './library';
import { importFile } from './importer';
import { useStore } from '../app/store';
import { currentLevel } from '../engine/progress';

/** Grown-ups: import owned books from this computer, review OCR text, see when each becomes readable. */
export function LocalBooksAdmin() {
  const { progress } = useStore();
  const level = currentLevel(progress);
  const [books, setBooks] = useState<LibraryEntry[]>([]);
  const [status, setStatus] = useState('');
  const [editing, setEditing] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const refresh = () => listBooks().then(setBooks);
  useEffect(() => { refresh(); }, []);

  const onFiles = async (files: FileList | null) => {
    if (!files) return;
    for (const f of [...files]) {
      try {
        setStatus(`${f.name}: starting…`);
        const book = await importFile(f, (msg, done, total) => setStatus(`${f.name}: ${msg} ${done}/${total}`));
        setStatus(`${f.name}: analysing…`);
        await saveBook(book);
        await refresh();
      } catch (e) {
        setStatus(`${f.name}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
    setStatus('Done.');
  };

  if (editing) return <ReviewBook id={editing} onClose={() => { setEditing(null); refresh(); }} />;

  return (
    <div className="card">
      <h2>My books (stored only in this browser on this computer)</h2>
      <p style={{ fontSize: 14 }}>Import EPUB or PDF files you own. Text is read on this computer (OCR for scanned picture books), saved in this browser, and never uploaded or added to the code. Review each book once: OCR on picture books makes mistakes.</p>
      <div className="row" style={{ justifyContent: 'flex-start', gap: 8 }}>
        <button className="btn" onClick={() => input.current?.click()}>Import books…</button>
        <span style={{ fontSize: 14 }}>{status}</span>
      </div>
      <input ref={input} type="file" accept=".epub,.pdf,application/epub+zip,application/pdf" multiple hidden onChange={(e) => onFiles(e.target.files)} />
      {books.length > 0 && (
        <table style={{ marginTop: 12 }}><thead><tr><th>Book</th><th>Pages</th><th>Readable at</th><th>With pre-teaching</th><th>Pre-teach words</th><th /></tr></thead><tbody>
          {books.map((b) => {
            const a = b.analysis;
            const badge = !a ? '' : a.ready95 <= level ? 'good' : a.readyPreteach <= level ? 'warn' : '';
            return (
              <tr key={b.id}>
                <td><b>{b.title}</b></td>
                <td>{b.pages}</td>
                <td><span className={`pill ${badge}`}>{a ? (a.ready95 > 120 ? 'beyond L120' : `L${a.ready95}`) : '…'}</span></td>
                <td>{a ? (a.readyPreteach > 120 ? 'beyond L120' : `L${a.readyPreteach}`) : ''}</td>
                <td style={{ fontSize: 13 }}>{a?.preteach.join(', ')}</td>
                <td style={{ whiteSpace: 'nowrap' }}>
                  <button className="btn light" onClick={() => setEditing(b.id)}>Review text</button>{' '}
                  <button className="btn light" onClick={async () => { if (window.prompt(`Type DELETE to remove “${b.title}” from this browser`) === 'DELETE') { await deleteBook(b.id); refresh(); } }}>✕</button>
                </td>
              </tr>
            );
          })}
        </tbody></table>
      )}
    </div>
  );
}

function ReviewBook({ id, onClose }: { id: string; onClose: () => void }) {
  const [book, setBook] = useState<LocalBook | null>(null);
  const [urls, setUrls] = useState<Record<number, string>>({});
  const [title, setTitle] = useState('');
  useEffect(() => {
    getBook(id).then(async (b) => {
      if (!b) return;
      setBook(b); setTitle(b.title);
      const u: Record<number, string> = {};
      for (let i = 0; i < b.pages.length; i++) { const k = b.pages[i].image; if (k) { const blob = await getImage(k); if (blob) u[i] = URL.createObjectURL(blob); } }
      setUrls(u);
    });
  }, [id]);
  if (!book) return <div className="card">Loading…</div>;
  const setText = (i: number, text: string) => setBook({ ...book, pages: book.pages.map((p, j) => (j === i ? { ...p, text } : p)) });
  return (
    <div className="card">
      <div className="row" style={{ justifyContent: 'space-between', gap: 8 }}>
        <label style={{ flex: 1 }}>Title <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} style={{ flex: 1 }} /></label>
        <button className="btn" onClick={async () => { await saveBook({ ...book, title }); onClose(); }}>Save & re-analyse</button>
        <button className="btn light" onClick={onClose}>Cancel</button>
      </div>
      <p style={{ fontSize: 14 }}>Fix OCR mistakes and delete non-story text (covers, notes for parents). Empty a page’s text to hide it from reading.</p>
      {book.pages.map((p, i) => (
        <div key={i} style={{ display: 'grid', gridTemplateColumns: urls[i] ? 'minmax(160px, 38%) 1fr' : '1fr', gap: 12, padding: '10px 0', borderTop: '1px solid var(--line)' }}>
          {urls[i] && <img src={urls[i]} alt={`page ${i + 1}`} style={{ width: '100%', borderRadius: 8 }} />}
          <div><small>Page {i + 1}</small><textarea value={p.text} onChange={(e) => setText(i, e.target.value)} /></div>
        </div>
      ))}
    </div>
  );
}
