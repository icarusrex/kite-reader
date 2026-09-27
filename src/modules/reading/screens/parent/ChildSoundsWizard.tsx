import { useEffect, useRef, useState } from 'react';
import { useStore } from '../../../../core/app/store';
import { SOUNDS as GRAPHEMES } from '../../content/phonemes';
import { meter } from '../../audio/mic';
import { say } from '../../audio/speaker';
import { STOPS } from '../../audio/soundCheck';
import { MIN_EXAMPLES, addExample, loadVoice, mfcc } from '../../audio/ownVoice';
import { SHORT_VOICED_MS, useUtterance } from '../../activities/useSpeech';
import { Tile } from '../../../../core/ui/components';

/** How long a try shows before it is kept; ↺ in that time throws it away. */
const KEEP_MS = 900;

/**
 * The child copies each letter sound MIN_EXAMPLES times, so the app knows their voice from day one instead of after
 * a week of play. Each try is kept automatically unless the grown-up taps ↺. About five minutes for all sounds.
 */
export function ChildSoundsWizard({ onClose }: { onClose: () => void }) {
  const { activeProfileId, progress } = useStore();
  const [counts, setCounts] = useState<Record<string, number> | null>(null);
  const [i, setI] = useState(0);
  const [phase, setPhase] = useState<'model' | 'listen' | 'heard' | 'done'>('model');
  const [micError, setMicError] = useState<string | null>(null);
  const timer = useRef<number | undefined>();
  const pending = useRef<{ feats: number[][]; clip: { samples: Float32Array; rate: number } } | null>(null);
  const g = GRAPHEMES[i];
  const have = counts?.[g.id] ?? 0;

  useEffect(() => {
    (async () => {
      if (!(await meter.start())) { setMicError(meter.error ?? 'Microphone not available'); return; }
      const v = await loadVoice(activeProfileId);
      const c = Object.fromEntries(GRAPHEMES.map((x) => [x.id, v.ex[x.id]?.length ?? 0]));
      setCounts(c);
      const first = GRAPHEMES.findIndex((x) => c[x.id] < MIN_EXAMPLES);
      setI(first < 0 ? 0 : first);
    })();
    return () => clearTimeout(timer.current);
  }, [activeProfileId]);

  // The app says the sound, then listens for the child's copy.
  useEffect(() => {
    if (!counts || phase !== 'model') return;
    let live = true;
    (async () => {
      if (have === 0) await say({ p: 'my_turn' }, { pause: 150 }, { g: g.id }, { pause: 300 }, { p: 'your_turn' });
      else await say({ g: g.id });
      if (live) setPhase('listen');
    })();
    return () => { live = false; };
  }, [counts, phase, i, have, g.id]);

  const next = (c: Record<string, number>) => {
    const after = GRAPHEMES.findIndex((x, k) => k > i && c[x.id] < MIN_EXAMPLES);
    const any = GRAPHEMES.findIndex((x) => c[x.id] < MIN_EXAMPLES);
    if (c[g.id] < MIN_EXAMPLES) { setPhase('model'); return; }
    if (after >= 0 || any >= 0) { setI(after >= 0 ? after : any); setPhase('model'); return; }
    setPhase('done');
  };

  const keep = async () => {
    const t = pending.current; pending.current = null;
    if (!t || !counts) return;
    await addExample(activeProfileId, g.id, t.feats, false, t.clip);
    const c = { ...counts, [g.id]: counts[g.id] + 1 };
    setCounts(c);
    next(c);
  };

  useUtterance(phase === 'listen', (start, end) => {
    const clip = meter.clip(start - 150, end + 150);
    const feats = clip && mfcc(clip.samples, clip.rate);
    if (!clip || !feats) { setPhase('model'); return; }
    pending.current = { feats, clip };
    setPhase('heard');
    timer.current = window.setTimeout(keep, KEEP_MS);
  }, 600, STOPS.has(g.id) ? SHORT_VOICED_MS : undefined);

  const redo = () => { clearTimeout(timer.current); pending.current = null; setPhase('model'); };
  const go = (k: number) => { clearTimeout(timer.current); pending.current = null; setI(k); setPhase('model'); };

  const name = progress.settings.childName || 'the child';
  const learnt = counts ? GRAPHEMES.filter((x) => counts[x.id] >= MIN_EXAMPLES).length : 0;
  return (
    <div className="screen" style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'var(--bg)' }}>
      <div className="topbar" style={{ justifyContent: 'space-between', padding: '12px 16px' }}>
        <span className="subtitle">{name}'s sounds · {learnt}/{GRAPHEMES.length}</span>
        <button className="btn" onClick={() => { clearTimeout(timer.current); onClose(); }}>Done</button>
      </div>
      {micError ? <div className="stage"><p className="subtitle">{micError}</p></div>
        : phase === 'done' ? <div className="stage"><div style={{ fontSize: '22vmin' }}>🪁</div><h1 className="title">All sounds recorded!</h1><button className="btn" onClick={onClose}>Done</button></div>
        : <div className="stage">
          <Tile big label={g.id} onTap={() => phase === 'listen' && say({ g: g.id })} />
          <div className="row" style={{ gap: 10 }}>{Array.from({ length: MIN_EXAMPLES }, (_, k) => <span key={k} style={{ fontSize: '6vmin', opacity: k < have || (k === have && phase === 'heard') ? 1 : 0.25 }}>⭐</span>)}</div>
          <p className="subtitle">{phase === 'listen' ? '🎤 Your turn!' : phase === 'heard' ? 'Got it!' : 'Listen…'}</p>
          <div className="row" style={{ gap: 10 }}>
            <button className="btn light" disabled={i === 0} onClick={() => go(i - 1)}>← Back</button>
            <button className="btn light" disabled={phase !== 'heard'} onClick={redo} aria-label="Redo">↺ Not right</button>
            <button className="btn light" onClick={() => go((i + 1) % GRAPHEMES.length)}>Skip →</button>
          </div>
          <p className="muted" style={{ fontSize: 13 }}>Each try is kept unless you tap ↺. Tap the letter to hear it again.</p>
        </div>}
    </div>
  );
}
