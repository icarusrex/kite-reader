import { useEffect, useMemo, useState } from 'react';
import { getBook, getImage, LocalBook, markPageRead } from './library';
import { tokenize, wordLevel } from '../engine/wordLevel';
import { say } from '../audio/speaker';
import { useTap } from '../ui/components';

/** Read one of the family's own books: page picture + text, decodable words highlighted, tap a word to hear it. */
export function LocalReader({ id, level, onBack }: { id: string; level: number; onBack: () => void }) {
  const [book, setBook] = useState<LocalBook | null>(null);
  const [i, setI] = useState(0);
  const [img, setImg] = useState<string | null>(null);
  const pages = useMemo(() => book?.pages.filter((p) => p.text.trim()) ?? [], [book]);
  useEffect(() => { getBook(id).then((b) => b && setBook(b)); }, [id]);
  useEffect(() => {
    let url: string | null = null;
    const k = pages[i]?.image;
    if (k) getImage(k).then((b) => { if (b) { url = URL.createObjectURL(b); setImg(url); } });
    else setImg(null);
    return () => { if (url) URL.revokeObjectURL(url); };
  }, [pages, i]);
  const back = useTap(onBack);
  const prev = useTap(() => setI(Math.max(0, i - 1)));
  const next = useTap(() => { markPageRead(id, i); setI(Math.min(pages.length - 1, i + 1)); });
  if (!book) return null;
  const names = book.analysis?.names ?? [];
  const page = pages[i];
  return (
    <div className="screen">
      <div className="topbar">
        <button className="icon-btn" onPointerDown={back} aria-label="Back">←</button>
        <div className="topbar-title">{book.title}</div>
      </div>
      <div className="local-page">
        {img && <img src={img} alt="" />}
        <div className="reader-text local-text">
          {page?.text.split('\n').map((line, li) => (
            <p key={li}>{line.split(/(\s+|-)/).map((chunk, ci) => {
              const t = tokenize(chunk)[0];
              if (!t) return chunk;
              const lw = t.toLowerCase();
              const ok = names.includes(lw) || wordLevel(t).level <= level;
              return <span key={ci} className={ok ? 'cr' : ''} onPointerDown={() => say({ w: lw })}>{chunk}</span>;
            })}</p>
          ))}
        </div>
      </div>
      <div className="reader-nav">
        <button className="icon-btn" onPointerDown={prev} aria-label="Previous page">◀</button>
        <span className="muted">{i + 1} / {pages.length}</span>
        <button className="icon-btn" onPointerDown={next} aria-label="Next page">▶</button>
      </div>
    </div>
  );
}
