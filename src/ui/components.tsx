import { useEffect, useRef, useState } from 'react';
import { meter, MeterFrame } from '../audio/mic';
import { pictureFor, pictureUrl } from '../content/pictures';

const lastTap = { x: -1, y: -1, t: 0 };

/** Tap handler with holdover filter: ignores repeat touches at the same spot within 500ms. */
export function useTap(fn: () => void) {
  return (e: React.PointerEvent) => {
    const now = performance.now();
    if (Math.abs(e.clientX - lastTap.x) < 12 && Math.abs(e.clientY - lastTap.y) < 12 && now - lastTap.t < 500) return;
    lastTap.x = e.clientX; lastTap.y = e.clientY; lastTap.t = now;
    fn();
  };
}

export function Tile(props: {
  label: string; onTap?: () => void; state?: 'good' | 'hint' | 'dim' | 'selected'; big?: boolean; word?: boolean; disabled?: boolean; correct?: boolean;
}) {
  const tap = useTap(() => !props.disabled && props.onTap?.());
  return (
    <button
      className={`tile ${props.big ? 'big' : ''} ${props.word ? 'word' : ''} ${props.state ?? ''} ${props.onTap ? '' : 'static'}`}
      onPointerDown={props.onTap ? tap : undefined}
      aria-label={props.label}
      data-c={props.correct ? '1' : undefined}
    >
      {props.label}
    </button>
  );
}

export function PictureTile(props: { word: string; onTap?: () => void; state?: 'good' | 'hint' | 'dim'; correct?: boolean }) {
  const tap = useTap(() => props.onTap?.());
  return (
    <button className={`tile ${props.state ?? ''}`} onPointerDown={tap} aria-label={props.word} data-c={props.correct ? '1' : undefined}>
      {pictureUrl(props.word)
        ? <img className="picture-img" src={pictureUrl(props.word)} alt="" draggable={false} />
        : <span className="picture">{pictureFor(props.word) ?? '❓'}</span>}
    </button>
  );
}

export function Kite({ style, fall, color = '#E8704A' }: { style?: React.CSSProperties; fall?: boolean; color?: string }) {
  return (
    <svg className={`kite ${fall ? 'fall' : ''}`} style={style} viewBox="0 0 100 120" aria-hidden>
      <path d="M50 4 88 46 50 92 12 46Z" fill={color} />
      <path d="M50 4v88M12 46h76" stroke="#FBF6EC" strokeWidth="4" />
      <circle cx="40" cy="38" r="4" fill="#2B2F3A" />
      <circle cx="60" cy="38" r="4" fill="#2B2F3A" />
      <path d="M42 54q8 7 16 0" stroke="#2B2F3A" strokeWidth="3.5" fill="none" strokeLinecap="round" />
      <path d="M50 92c-8 10 10 14 0 26" stroke="#3B4A6B" strokeWidth="3" fill="none" strokeLinecap="round" />
    </svg>
  );
}

export function useMeter(active = true) {
  const [frame, setFrame] = useState<MeterFrame>({ level: 0, voiced: false });
  useEffect(() => {
    if (!active) return;
    return meter.subscribe(setFrame);
  }, [active]);
  return frame;
}

/** Scrolling bar waveform of the child's voice. */
export function Waveform({ active = true }: { active?: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const hist = useRef<number[]>(Array(48).fill(0));
  const voicedHist = useRef<boolean[]>(Array(48).fill(false));
  useEffect(() => {
    if (!active) return;
    let n = 0;
    return meter.subscribe(({ level, voiced }) => {
      if (++n % 2) return;
      hist.current.push(level); hist.current.shift();
      voicedHist.current.push(voiced); voicedHist.current.shift();
      const c = ref.current; if (!c) return;
      const dpr = window.devicePixelRatio || 1;
      const w = c.clientWidth, h = c.clientHeight;
      if (c.width !== w * dpr) { c.width = w * dpr; c.height = h * dpr; }
      const g = c.getContext('2d')!;
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.clearRect(0, 0, w, h);
      const bw = w / hist.current.length;
      hist.current.forEach((v, i) => {
        const bh = Math.max(4, v * h);
        g.fillStyle = voicedHist.current[i] ? '#E8704A' : '#DCD9D2';
        g.beginPath();
        g.roundRect(i * bw + 2, (h - bh) / 2, bw - 4, bh, 3);
        g.fill();
      });
    });
  }, [active]);
  return <canvas ref={ref} className="wave" aria-hidden />;
}

export function Caption({ children }: { children?: React.ReactNode }) {
  return <div className="caption">{children}</div>;
}

export function ReplayButton({ onTap }: { onTap: () => void }) {
  const tap = useTap(onTap);
  return <button className="icon-btn" onPointerDown={tap} aria-label="Hear again">🔊</button>;
}

/** Hidden long-press area for grown-ups. */
export function ParentCorner({ onOpen }: { onOpen: () => void }) {
  const timer = useRef<number>();
  return (
    <div
      className="corner"
      onPointerDown={() => { timer.current = window.setTimeout(onOpen, 1500); }}
      onPointerUp={() => clearTimeout(timer.current)}
      onPointerLeave={() => clearTimeout(timer.current)}
      aria-label="Grown-ups: press and hold"
    >
      <span>🔒</span>
    </div>
  );
}
