import { useEffect, useRef } from 'react';

/**
 * Two sound shapes: the grown-up's recording (grey, above) and the child's try (below: green = close enough,
 * orange = not yet). Before he speaks only the grown-up's shape shows ("make this sound").
 */
export function SoundCompare({ reference, child, ok }: { reference?: number[]; child?: number[]; ok?: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current; if (!c || !reference?.length) return;
    const dpr = window.devicePixelRatio || 1;
    const w = c.clientWidth, h = c.clientHeight;
    c.width = w * dpr; c.height = h * dpr;
    const g = c.getContext('2d')!;
    g.scale(dpr, dpr);
    g.clearRect(0, 0, w, h);
    const draw = (env: number[], mid: number, amp: number, color: string) => {
      // same time scale for both, so a short "t" looks short and a held "mmm" looks long
      const len = Math.max(reference.length, child?.length ?? 0, 25);
      const step = (w - 16) / len;
      g.fillStyle = color;
      env.forEach((v, i) => { const bh = Math.max(3, v * amp); g.beginPath(); g.roundRect(8 + i * step, mid - bh / 2, Math.max(2, step - 1.5), bh, 2); g.fill(); });
    };
    draw(reference, h * 0.27, h * 0.46, '#C9BFB0');
    if (child?.length) draw(child, h * 0.75, h * 0.46, ok ? '#7FA876' : '#E8914A');
  }, [reference, child, ok]);
  if (!reference?.length) return null;
  return <canvas ref={ref} className="sound-compare" aria-hidden />;
}
