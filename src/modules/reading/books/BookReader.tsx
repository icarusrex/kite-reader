import { useEffect, useMemo, useRef, useState } from 'react';
import { Book, getBook, imageUrl, markPageRead } from './library';
import { tokenize } from '../engine/wordLevel';
import { say } from '../audio/speaker';
import { useTap } from '../../../core/ui/components';
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
  // Swipe left/right anywhere on the page to turn it, like a picture-book app.
  const swipeStart = useRef<{ x: number; y: number } | null>(null);
  const onSwipeStart = (e: React.PointerEvent) => { swipeStart.current = { x: e.clientX, y: e.clientY }; };
  const onSwipeEnd = (e: React.PointerEvent) => {
    const s = swipeStart.current; swipeStart.current = null;
    if (!s) return;
    const dx = e.clientX - s.x, dy = e.clientY - s.y;
    if (Math.abs(dx) < 60 || Math.abs(dx) < Math.abs(dy) * 1.5) return;
    if (dx < 0) { markPageRead(id, i); setI(Math.min(pages.length - 1, i + 1)); } else setI(Math.max(0, i - 1));
  };
  if (!book) return null;
  const page = pages[i];
  const pictureOnly = !!(book.textInPicture && page?.image);
  return <div className="screen"><div className="topbar"><button className="icon-btn" onPointerDown={back} aria-label="Back">←</button><div className="topbar-title">{book.title}</div></div>
    {/* A scanned page already shows its words: show the page alone, big, rather than printing the words a second time. */}
    <div className={`local-page${pictureOnly ? ' picture-only' : ''}`} onPointerDown={onSwipeStart} onPointerUp={onSwipeEnd} onPointerCancel={() => { swipeStart.current = null; }}>{page?.image && <img src={imageUrl(id, page.image)} alt={pictureOnly ? page.text.replace(/\n/g, ' ') : ''} width={page.w} height={page.h} />}{!pictureOnly && <div className="reader-text local-text">{page?.text.split('\n').map((line, li) => <p key={li}>{line.split(/(\s+|-)/).map((chunk, ci) => { const t = tokenize(chunk)[0]; if (!t) return chunk; const lw = t.toLowerCase(); const ok = canDecodeWord(progress, t, level); return <span key={ci} className={ok ? 'cr' : ''} onClick={() => say({ w: lw })}>{chunk}</span>; })}</p>)}</div>}</div>
    <div className="reader-nav"><button className="icon-btn" onPointerDown={prev} aria-label="Previous page">◀</button><span className="muted">{i + 1} / {pages.length}</span><button className="icon-btn" onPointerDown={next} aria-label="Next page">▶</button></div></div>;
}
