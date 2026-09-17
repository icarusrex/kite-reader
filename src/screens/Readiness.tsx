import { useEffect, useState } from 'react';
import { say, saySegmented, sayYes } from '../audio/speaker';
import { segment } from '../engine/decodable';
import { shuffle } from '../engine/session';
import { PictureTile, ReplayButton, useTap } from '../ui/components';
import { useStore } from '../app/store';
import { CLEAR_WORDS } from '../content/pictures';

type Trial = { kind: 'dir'; answer: 'dogfish' | 'fishdog'; left: 'dogfish' | 'fishdog' } | { kind: 'blend'; answer: string; options: string[] };
const BLEND = CLEAR_WORDS;

function makeTrials(): Trial[] {
  const dir: Trial[] = Array.from({ length: 8 }, (_, i) => ({ kind: 'dir', answer: i % 2 ? 'dogfish' : 'fishdog', left: Math.random() < 0.5 ? 'dogfish' : 'fishdog' }));
  const words = shuffle(BLEND).slice(0, 5);
  const blend: Trial[] = words.map((w) => ({ kind: 'blend', answer: w, options: shuffle([w, ...shuffle(BLEND.filter((x) => x !== w)).slice(0, 2)]) }));
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
    if (!t) return;
    setLocked(true);
    if (t.kind === 'dir') await say({ p: t.answer === 'dogfish' ? 'tap_dogfish' : 'tap_fishdog' });
    else { await say({ p: 'ear_listen' }, { pause: 300 }); await saySegmented(segment(t.answer)!, 180); }
    setLocked(false);
  };
  useEffect(() => { if (i === 0) say({ p: 'ready_intro' }).then(prompt); else prompt(); /* eslint-disable-next-line */ }, [i]);

  const answer = async (choice: string) => {
    if (locked || !t) return;
    setLocked(true);
    const ok = choice === t.answer;
    if (ok) await sayYes();
    setScore((s) => ({ dir: s.dir + (ok && t.kind === 'dir' ? 1 : 0), blend: s.blend + (ok && t.kind === 'blend' ? 1 : 0) }));
    setI(i + 1);
  };

  if (!t) {
    // Oral blending is the placement gate. Directionality is useful diagnostic information, not a prerequisite to read.
    const passed = score.blend >= 4;
    const trackingStrong = score.dir >= 7;
    return (
      <div className="parent" style={{ display: 'grid', placeItems: 'center' }}>
        <div className="card" style={{ maxWidth: 560 }}>
          <h2>Readiness check (for grown-ups)</h2>
          <p>Oral blending: <b>{score.blend}/5</b> (ready ≥ 4) · Left-to-right tracking: <b>{score.dir}/8</b> (diagnostic)</p>
          <p>{passed
            ? trackingStrong
              ? 'Ready to start Level 1.'
              : 'Oral blending is ready. Start Level 1 and keep the left-to-right tracking games in the warm-up; tracking is not a reason to hold reading back.'
            : 'Oral blending is not ready yet. Use Basics and oral sound games (“what word is c…a…t?”), then retry later. You can still start Level 1 if a grown-up wants to.'}</p>
          <div className="row" style={{ justifyContent: 'flex-start', gap: 8 }}>
            <button className="btn" onClick={() => { update((p) => ({ ...p, settings: { ...p.settings, readinessPassed: passed } })); onDone(); }}>{passed ? 'Start' : 'Save result'}</button>
            {!passed && <button className="btn light" onClick={() => { update((p) => ({ ...p, settings: { ...p.settings, readinessPassed: true } })); onDone(); }}>Start anyway</button>}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="screen">
      <div className="stage">
        <ReplayButton onTap={prompt} />
        {t.kind === 'dir' ? (
          <div className={`row ${locked ? 'waiting' : ''}`}>
            {(t.left === 'dogfish' ? ['dogfish', 'fishdog'] : ['fishdog', 'dogfish']).map((c) => <DirCard key={c} which={c} correct={c === t.answer} onTap={() => answer(c)} />)}
          </div>
        ) : (
          <div className={`row ${locked ? 'waiting' : ''}`}>{t.options.map((o) => <PictureTile key={o} word={o} correct={o === t.answer} onTap={() => answer(o)} />)}</div>
        )}
      </div>
    </div>
  );
}

function DirCard({ which, onTap, correct }: { which: string; onTap: () => void; correct: boolean }) {
  const tap = useTap(onTap);
  return (
    <button className="tile" style={{ padding: '0 5vmin', gap: '1vmin', display: 'flex' }} onPointerDown={tap} aria-label={which} data-c={correct ? '1' : undefined}>
      <span className="picture">{which === 'dogfish' ? '🐶🐟' : '🐟🐶'}</span>
    </button>
  );
}
