import { useEffect, useState } from 'react';
import { say, saySegmented, sayYes } from '../audio/speaker';
import { segment } from '../engine/decodable';
import { shuffle } from '../engine/session';
import { PictureTile, ReplayButton, useTap } from '../ui/components';
import { useStore } from '../app/store';
import { CLEAR_WORDS } from '../content/pictures';
import { setTrack, today } from '../engine/progress';

type Trial = { kind: 'dir'; answer: 'dogfish' | 'fishdog'; left: 'dogfish' | 'fishdog' } | { kind: 'blend'; answer: string; options: string[] };
const BLEND = CLEAR_WORDS;
function makeTrials(): Trial[] {
  const dir: Trial[] = Array.from({ length: 8 }, (_, i) => ({ kind: 'dir', answer: i % 2 ? 'dogfish' : 'fishdog', left: Math.random() < 0.5 ? 'dogfish' : 'fishdog' }));
  const blend: Trial[] = shuffle(BLEND).slice(0, 5).map((w) => ({ kind: 'blend', answer: w, options: shuffle([w, ...shuffle(BLEND.filter((x) => x !== w)).slice(0, 2)]) }));
  return [...shuffle(dir), ...blend];
}

export function Readiness({ onDone }: { onDone: () => void }) {
  const { update } = useStore();
  const [trials] = useState(makeTrials);
  const [i, setI] = useState(0);
  const [score, setScore] = useState({ dir: 0, blend: 0 });
  const [locked, setLocked] = useState(true);
  const t = trials[i];
  const prompt = async () => {
    if (!t) return; setLocked(true);
    if (t.kind === 'dir') await say({ p: t.answer === 'dogfish' ? 'tap_dogfish' : 'tap_fishdog' });
    else { await say({ p: 'ear_listen' }, { pause: 300 }); await saySegmented(segment(t.answer)!, 180); }
    setLocked(false);
  };
  useEffect(() => { if (i === 0) say({ p: 'ready_intro' }).then(prompt); else prompt(); /* eslint-disable-next-line */ }, [i]);
  const answer = async (choice: string) => {
    if (locked || !t) return; setLocked(true);
    const ok = choice === t.answer; if (ok) await sayYes();
    setScore((s) => ({ dir: s.dir + (ok && t.kind === 'dir' ? 1 : 0), blend: s.blend + (ok && t.kind === 'blend' ? 1 : 0) })); setI(i + 1);
  };
  if (!t) {
    const passed = score.blend >= 4;
    const save = (startAnyway: boolean) => {
      update((p) => {
        const readiness = { date: today(), blending: score.blend, tracking: score.dir };
        if (passed || startAnyway) return { ...p, readiness, settings: { ...p.settings, readinessPassed: true } };
        const basics = setTrack(p, 'basics', 1);
        return { ...basics, readiness, settings: { ...basics.settings, readinessPassed: false } };
      });
      onDone();
    };
    return (
      <div className="parent" style={{ display: 'grid', placeItems: 'center' }}><div className="card" style={{ maxWidth: 560 }}>
        <h2>Readiness check (for grown-ups)</h2>
        <p>Oral blending: <b>{score.blend}/5</b> (ready ≥ 4) · Left-to-right tracking: <b>{score.dir}/8</b> (diagnostic)</p>
        <p>{passed ? 'Ready to start Level 1.' : 'Oral blending is not ready yet. Save sends this profile to Basics; you can explicitly override and start Level 1.'}</p>
        <div className="row" style={{ justifyContent: 'flex-start', gap: 8 }}>
          <button className="btn" onClick={() => save(false)}>{passed ? 'Start' : 'Save → Basics'}</button>
          {!passed && <button className="btn light" onClick={() => save(true)}>Start Level 1 anyway</button>}
        </div>
      </div></div>
    );
  }
  return <div className="screen"><div className="stage"><ReplayButton onTap={prompt} />{t.kind === 'dir'
    ? <div className={`row ${locked ? 'waiting' : ''}`}>{(t.left === 'dogfish' ? ['dogfish', 'fishdog'] : ['fishdog', 'dogfish']).map((c) => <DirCard key={c} which={c} correct={c === t.answer} onTap={() => answer(c)} />)}</div>
    : <div className={`row ${locked ? 'waiting' : ''}`}>{t.options.map((o) => <PictureTile key={o} word={o} correct={o === t.answer} onTap={() => answer(o)} />)}</div>}</div></div>;
}
function DirCard({ which, onTap, correct }: { which: string; onTap: () => void; correct: boolean }) {
  const tap = useTap(onTap);
  return <button className="tile" style={{ padding: '0 5vmin', gap: '1vmin', display: 'flex' }} onPointerDown={tap} aria-label={which} data-c={correct ? '1' : undefined}><span className="picture">{which === 'dogfish' ? '🐶🐟' : '🐟🐶'}</span></button>;
}
