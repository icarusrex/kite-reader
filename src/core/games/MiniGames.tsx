/**
 * Reward games: one short game after each finished lesson, built from what the child already knows, so the reward
 * is more practice in disguise. Two classics, alternating:
 *   - Bubble pop: hear a sound (or a number), pop the bubbles that show it.
 *   - Memory match: turn cards over to find pairs; every card says its sound (or number) when turned.
 * Modules supply the cards (reading: letter sounds; math: numbers as numerals or dots); this file is the play.
 */
import { ReactNode, useEffect, useMemo, useRef, useState } from 'react';

export interface GameCard {
  id: string;
  /** What the bubble or card shows. */
  face: ReactNode;
  /** The other half of a memory pair (e.g. dots for a numeral); defaults to the same face. */
  pairFace?: ReactNode;
  /** Say it: the sound, or the number word. */
  speak: () => Promise<unknown>;
}
export interface GameTheme {
  cards: GameCard[];
  /** "Pop this sound… sss!" */
  ask: (card: GameCard) => Promise<unknown>;
  cheer: () => Promise<unknown>;
}

const shuffle = <T,>(a: T[]) => { const o = [...a]; for (let i = o.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [o[i], o[j]] = [o[j], o[i]]; } return o; };
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function MiniGame({ kind, theme, onDone }: { kind: 'pop' | 'memory'; theme: GameTheme; onDone: () => void }) {
  const [stars, setStars] = useState<number | null>(null);
  return <div className="screen game">
    <div className="topbar"><button className="icon-btn" onClick={onDone} aria-label="Close">✕</button><div className="topbar-title">{kind === 'pop' ? '🫧 Bubble pop' : '🃏 Memory match'}</div></div>
    {stars === null
      ? kind === 'pop' ? <BubblePop theme={theme} onWin={setStars} /> : <MemoryMatch theme={theme} onWin={setStars} />
      : <Win stars={stars} onDone={onDone} cheer={theme.cheer} />}
  </div>;
}

function Win({ stars, onDone, cheer }: { stars: number; onDone: () => void; cheer: () => Promise<unknown> }) {
  useEffect(() => { void cheer(); }, []);
  return <div className="stage">
    <div className="confetti" aria-hidden>{Array.from({ length: 18 }, (_, i) => <span key={i} style={{ left: `${(i * 53) % 100}%`, animationDelay: `${(i % 6) * 0.15}s` }}>{['🎉', '⭐', '🎈', '✨'][i % 4]}</span>)}</div>
    <h1 className="title">You did it!</h1>
    <div className="game-stars">{'⭐'.repeat(Math.min(stars, 10))}</div>
    <button className="primary" onClick={onDone} aria-label="Done">✓</button>
  </div>;
}

/* ---------- Bubble pop ---------- */

const ROUNDS = 5;
interface Bubble { key: number; card: GameCard; x: number; delay: number; dur: number; popped: boolean; wrong: boolean }

function BubblePop({ theme, onWin }: { theme: GameTheme; onWin: (stars: number) => void }) {
  const [round, setRound] = useState(0);
  const [stars, setStars] = useState(0);
  const targets = useMemo(() => Array.from({ length: ROUNDS }, (_, i) => shuffle(theme.cards)[0] ?? theme.cards[i % theme.cards.length]), [theme]);
  const target = targets[round];
  const nextKey = useRef(0);
  const makeBubbles = (t: GameCard): Bubble[] => {
    const others = shuffle(theme.cards.filter((c) => c.id !== t.id));
    const cards = shuffle([t, t, ...Array.from({ length: 4 }, (_, i) => others[i % Math.max(1, others.length)] ?? t)]);
    const lanes = shuffle([8, 24, 40, 56, 72, 88]);
    return cards.map((card, i) => ({ key: nextKey.current++, card, x: lanes[i], delay: i * 0.7, dur: 7 + Math.random() * 2, popped: false, wrong: false }));
  };
  const [bubbles, setBubbles] = useState<Bubble[]>(() => makeBubbles(target));
  useEffect(() => { void theme.ask(target); }, [round]);

  const tap = async (b: Bubble) => {
    if (b.popped) return;
    if (b.card.id !== target.id) {
      setBubbles((bs) => bs.map((x) => x.key === b.key ? { ...x, wrong: true } : x));
      void b.card.speak(); // hear what that one was
      await wait(500);
      setBubbles((bs) => bs.map((x) => x.key === b.key ? { ...x, wrong: false } : x));
      return;
    }
    const next = bubbles.map((x) => x.key === b.key ? { ...x, popped: true } : x);
    setBubbles(next);
    setStars((s) => s + 1);
    if (next.some((x) => x.card.id === target.id && !x.popped)) { void target.speak(); return; }
    await theme.cheer();
    if (round + 1 >= ROUNDS) return onWin(stars + 1);
    const t = targets[round + 1];
    setBubbles(makeBubbles(t));
    setRound(round + 1);
  };

  return <div className="pop-field">
    <button className="pop-ask" onClick={() => void theme.ask(target)} aria-label="Hear it again">🔊</button>
    <div className="game-stars small">{'⭐'.repeat(stars)}</div>
    {bubbles.map((b) => <button key={b.key} className={`bubble${b.popped ? ' popped' : ''}${b.wrong ? ' wrong' : ''}`}
      style={{ left: `${b.x}%`, animationDelay: `${b.delay}s`, animationDuration: `${b.dur}s` }}
      onPointerDown={() => void tap(b)} aria-label="bubble"><span className="bubble-in">{b.card.face}</span></button>)}
  </div>;
}

/* ---------- Memory match ---------- */

interface Tile { key: number; card: GameCard; face: ReactNode; open: boolean; matched: boolean }

function MemoryMatch({ theme, onWin }: { theme: GameTheme; onWin: (stars: number) => void }) {
  const [tiles, setTiles] = useState<Tile[]>(() => {
    const picked = shuffle(theme.cards).slice(0, 4);
    return shuffle(picked.flatMap((card, i) => [
      { key: i * 2, card, face: card.face, open: false, matched: false },
      { key: i * 2 + 1, card, face: card.pairFace ?? card.face, open: false, matched: false },
    ]));
  });
  const [turns, setTurns] = useState(0);
  const busy = useRef(false);

  const flip = async (t: Tile) => {
    if (busy.current || t.open || t.matched) return;
    const open = tiles.filter((x) => x.open && !x.matched);
    const next = tiles.map((x) => x.key === t.key ? { ...x, open: true } : x);
    setTiles(next);
    void t.card.speak();
    if (open.length === 0) return;
    busy.current = true;
    setTurns((n) => n + 1);
    const first = open[0];
    await wait(900);
    if (first.card.id === t.card.id) {
      const done = next.map((x) => x.card.id === t.card.id ? { ...x, matched: true } : x);
      setTiles(done);
      await theme.cheer();
      busy.current = false;
      // Fewer turns, more stars: 3 for a near-perfect game, never fewer than 1.
      if (done.every((x) => x.matched)) onWin(Math.max(1, 3 - Math.floor(Math.max(0, turns + 1 - 4) / 3)));
      return;
    }
    setTiles(next.map((x) => (x.key === t.key || x.key === first.key) ? { ...x, open: false } : x));
    busy.current = false;
  };

  return <div className="stage">
    <div className="memory">{tiles.map((t) => <button key={t.key} className={`memory-card${t.open || t.matched ? ' open' : ''}${t.matched ? ' matched' : ''}`} onClick={() => void flip(t)} aria-label="card">
      {t.open || t.matched ? t.face : <span className="memory-back">🪁</span>}
    </button>)}</div>
  </div>;
}

/* ---------- Stickers ---------- */

export const STICKERS = ['🦊', '🐢', '🦋', '🐳', '🦁', '🐸', '🦉', '🐙', '🦄', '🐝', '🐧', '🦕', '🐞', '🦒', '🐬', '🦔', '🐼', '🦜', '🐿️', '🦩', '🐨', '🦀', '🐯', '🐮', '🌻', '🌈', '🚀', '⛵', '🎈', '🍓', '🍉', '🌙'];
export const stickerFor = (n: number) => STICKERS[(n - 1 + STICKERS.length) % STICKERS.length];

/** The sticker this lesson earned, and the ones collected before it. */
export function StickerReward({ count }: { count: number }) {
  if (count < 1) return null;
  const recent = Array.from({ length: Math.min(count - 1, 11) }, (_, i) => stickerFor(count - 1 - i)).reverse();
  return <div className="sticker-reward">
    <div className="sticker-new" aria-label="New sticker">{stickerFor(count)}</div>
    {recent.length > 0 && <div className="sticker-row">{recent.map((s, i) => <span key={i}>{s}</span>)}{count > 12 && <small> +{count - 12}</small>}</div>}
  </div>;
}
