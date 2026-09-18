import { useEffect, useMemo, useState } from 'react';
import { LIBRARY, ReadAloudBook, VocabItem, loadBook, loadVocab } from '../content/readaloud';
import { useStore } from '../app/store';
import { currentLevel, Progress, today } from '../engine/progress';
import { tokenize } from '../engine/wordLevel';
import { canDecodeWord } from '../engine/knowledge';
import { say, stop } from '../audio/speaker';
import { useTap } from '../ui/components';
import { LibraryEntry, imageUrl, listBooks } from '../books/library';
import { BookReader } from '../books/BookReader';

const PARAS_PER_PAGE = 3;
const PROMPTS = ['What happened in this part of the story?', 'Who was in this chapter? What did they want?', 'What do you think will happen next?', 'How do you think they felt? Have you ever felt like that?', 'What was your favourite part?'];

export function StoryChair({ onClose }: { onClose: () => void }) {
  const { progress, update } = useStore();
  const [bookId, setBookId] = useState<string | null>(null);
  const [book, setBook] = useState<ReadAloudBook | null>(null);
  const [vocab, setVocab] = useState<Record<string, Record<string, VocabItem[]>>>({});
  const [chapter, setChapter] = useState<number | null>(null);
  const [page, setPage] = useState(-1);
  const [showDecodable, setShowDecodable] = useState(true);
  const [local, setLocal] = useState<LibraryEntry[]>([]);
  const [localId, setLocalId] = useState<string | null>(null);
  const level = currentLevel(progress);

  useEffect(() => { loadVocab().then(setVocab); return () => stop(); }, []);
  useEffect(() => { listBooks().then(setLocal); }, []);
  useEffect(() => { if (bookId) loadBook(bookId).then(setBook); else setBook(null); }, [bookId]);
  const read = (bookId && progress.readAloud?.[bookId]) || [];
  const close = useTap(() => (chapter !== null ? setChapter(null) : bookId ? setBookId(null) : onClose()));
  if (localId) return <BookReader id={localId} progress={progress} level={level} onBack={() => setLocalId(null)} />;

  if (!bookId) return <div className="screen"><Top onBack={close} title="Story chair" /><div className="stage" style={{ justifyContent: 'flex-start', overflow: 'auto' }}>
    {local.length > 0 && <p className="shelf-label">My books</p>}{local.length > 0 && <div className="row">{local.map((b) => { const a = b.analysis; const ready = a && a.ready95 <= level; return <BookCard key={b.id} cover={b.cover ? '' : '📘'} image={b.cover && imageUrl(b.id, b.cover)} color="#FFFFFF" title={b.title} sub={ready ? 'Likely readable; highlighting uses actual learner knowledge' : a && a.readyPreteach <= level ? 'Almost! A grown-up helps with a few words' : 'Read it together'} badge={ready} onTap={() => setLocalId(b.id)} />; })}</div>}
    <p className="shelf-label">Read-aloud classics</p><div className="row">{LIBRARY.map((b) => <BookCard key={b.id} cover={b.cover} color={b.color} title={b.title} sub={`${progress.readAloud?.[b.id]?.length ?? 0} chapters read`} onTap={() => setBookId(b.id)} />)}</div><p className="subtitle">A grown-up reads. Highlighted words are ones this learner can actually decode now.</p>
  </div></div>;
  if (!book) return <div className="screen"><Top onBack={close} title="…" /></div>;

  if (chapter === null) return <div className="screen"><Top onBack={close} title={book.title} /><div className="chapters">{book.chapters.map((c) => <ChapterRow key={c.n} label={c.label} title={c.title} done={read.some((r) => r.chapter === c.n)} onTap={() => { setChapter(c.n); setPage(-1); }} />)}</div></div>;

  const ch = book.chapters.find((c) => c.n === chapter)!;
  const words = vocab[book.id]?.[String(chapter)] ?? [];
  const pages = Math.ceil(ch.paragraphs.length / PARAS_PER_PAGE);
  const finished = page >= pages;
  return <div className="screen"><Top onBack={close} title={`${ch.label}${ch.title && ch.title !== ch.label ? ' · ' + ch.title : ''}`} />
    {page === -1 && <div className="stage"><h1 className="title">Listen for these words</h1><div className="row">{words.map((v) => <WordCard key={v.word} v={v} />)}</div><button className="primary" onPointerDown={() => setPage(0)}>Start ▶</button></div>}
    {page >= 0 && !finished && <ReaderPage paragraphs={ch.paragraphs.slice(page * PARAS_PER_PAGE, (page + 1) * PARAS_PER_PAGE)} progress={progress} level={level} highlight={showDecodable} vocab={words.map((w) => w.word)} footer={<div className="reader-nav"><button className="icon-btn" onPointerDown={() => setPage(Math.max(-1, page - 1))} aria-label="Previous page">◀</button><label className="toggle"><input type="checkbox" checked={showDecodable} onChange={(e) => setShowDecodable(e.target.checked)} /> words he can read</label><span className="muted">{page + 1} / {pages}</span><button className="icon-btn" onPointerDown={() => { stop(); setPage(page + 1); }} aria-label="Next page">▶</button></div>} />}
    {finished && <div className="stage"><div style={{ fontSize: '16vmin' }}>🪁</div><h1 className="title">The end of this chapter!</h1><div className="prompts">{pickPrompts(chapter).map((q) => <p key={q}>💬 {q}</p>)}{words.map((v) => <p key={v.word}>🔤 Can you use <b>{v.word}</b> in a sentence?</p>)}</div><button className="primary soft" onPointerDown={() => { update((p) => ({ ...p, readAloud: { ...p.readAloud, [book.id]: [...(p.readAloud?.[book.id] ?? []).filter((r) => r.chapter !== chapter), { chapter, date: today() }] } })); setChapter(null); }}>We read it ✓</button></div>}
  </div>;
}

function pickPrompts(n: number) { return [PROMPTS[n % PROMPTS.length], PROMPTS[(n + 2) % PROMPTS.length]]; }
function ReaderPage({ paragraphs, progress, level, highlight, vocab, footer }: { paragraphs: string[]; progress: Progress; level: number; highlight: boolean; vocab: string[]; footer: React.ReactNode }) {
  const rendered = useMemo(() => paragraphs.map((p) => p.split(/(\s+)/).map((chunk, i) => { const toks = tokenize(chunk); const w = toks[0]?.toLowerCase(); if (!w) return chunk; const isVocab = vocab.includes(w); const canRead = toks.length === 1 && canDecodeWord(progress, w, level) && w.length > 1; const cls = isVocab ? 'vw' : highlight && canRead ? 'cr' : ''; return cls ? <span key={i} className={cls} onPointerDown={() => say({ w })}>{chunk}</span> : chunk; })), [paragraphs, progress, level, highlight, vocab]);
  return <div className="reader"><div className="reader-text">{rendered.map((r, i) => <p key={i}>{r}</p>)}</div>{footer}</div>;
}
function WordCard({ v }: { v: VocabItem }) { const tap = useTap(() => say({ w: v.word }, { pause: 300 }, { w: v.meaning })); return <button className="tile wordcard" onPointerDown={tap}><b>{v.word}</b><small>{v.meaning}</small></button>; }
function BookCard({ cover, color, title, sub, onTap, image, badge }: { cover: string; color: string; title: string; sub: string; onTap: () => void; image?: string; badge?: boolean }) { const tap = useTap(onTap); return <button className="bookcard" style={{ background: color }} onPointerDown={tap}>{image ? <img src={image} alt="" style={{ maxWidth: '100%', maxHeight: '24vmin', borderRadius: 12 }} /> : <span style={{ fontSize: '14vmin' }}>{cover}</span>}{badge && <span className="badge">★ Ready</span>}<b>{title}</b><small>{sub}</small></button>; }
function ChapterRow({ label, title, done, onTap }: { label: string; title: string; done: boolean; onTap: () => void }) { return <button className={`chapter ${done ? 'done' : ''}`} onClick={onTap}><span>{done ? '★' : '○'}</span><span><b>{label}</b>{title && title !== label ? ` — ${title}` : ''}</span></button>; }
function Top({ onBack, title }: { onBack: (e: React.PointerEvent) => void; title: string }) { return <div className="topbar"><button className="icon-btn" onPointerDown={onBack} aria-label="Back">←</button><div className="topbar-title">{title}</div></div>; }
