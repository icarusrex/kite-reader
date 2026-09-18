import { useEffect, useMemo, useState } from 'react';
import { Book, getBook, imageUrl, markPageRead } from './library';
import { tokenize } from '../engine/wordLevel';
import { say } from '../audio/speaker';
import { useTap } from '../ui/components';
import { Progress } from '../engine/progress';
import { canDecodeWord } from '../engine/knowledge';

export function BookReader({ id, progress, level, onBack }: { id: string; progress: Progress; level: number; onBack: () => void }) {
  const [book, setBook] = useState<Book | null>(null);
  const [i, setI] = useState(0);
  const pages = useMemo(() => book?.pages.filter((p) => p.text.trim()) ?? [], [book]);
  useEffect(() => { getBook(id).then((b) => b && setBook(b)); }, [id]);
  const back = useTap(onBack);
  const prev = useTap(() => setI(Math.max(0, i - 1)));
  const next = useTap(() => { markPageRead(id, i); setI(Math.min(pages.length - 1, i + 1)); });
  if (!book) return null;
  const page = pages[i];
  return <div className="screen"><div className="topbar"><button className="icon-btn" onPointerDown={back} aria-label="Back">←</button><div className="topbar-title">{book.title}</div></div>
    <div className="local-page">{page?.image && <img src={imageUrl(id, page.image)} alt="" width={page.w} height={page.h} />}<div className="reader-text local-text">{page?.text.split('\n').map((line, li) => <p key={li}>{line.split(/(\s+|-)/).map((chunk, ci) => { const t = tokenize(chunk)[0]; if (!t) return chunk; const lw = t.toLowerCase(); const ok = canDecodeWord(progress, t, level); return <span key={ci} className={ok ? 'cr' : ''} onPointerDown={() => say({ w: lw })}>{chunk}</span>; })}</p>)}</div></div>
    <div className="reader-nav"><button className="icon-btn" onPointerDown={prev} aria-label="Previous page">◀</button><span className="muted">{i + 1} / {pages.length}</span><button className="icon-btn" onPointerDown={next} aria-label="Next page">▶</button></div></div>;
}
