import { LEVELS } from '../content/levels';
import { BASICS } from '../content/basics';
import { allPassed, currentLevel, today } from '../engine/progress';
import { useStore } from '../../../core/app/store';
import { Kite, ParentCorner, useTap } from '../../../core/ui/components';

export function ReadingHome({ onStart, onParent, onStories, onBack, extraAllowed }: {
  onStart: () => void;
  onParent: () => void;
  onStories: () => void;
  onBack: () => void;
  extraAllowed: boolean;
}) {
  const { reading: progress } = useStore();
  const cur = currentLevel(progress);
  const usedToday = progress.sessions.filter((s) => s.date === today() && !s.practice).reduce((a, s) => a + s.activeSeconds, 0);
  const recommendationMet = usedToday >= progress.settings.capMinutes * 60 && !extraAllowed;
  const complete = progress.track === 'levels' && allPassed(progress);
  const start = useTap(() => !complete && onStart());
  const stories = useTap(onStories);
  return <div className="screen">
    <ParentCorner onOpen={onParent} />
    <div className="stage">
      <div style={{ position: 'relative', width: '22vmin', height: '24vmin' }}><Kite style={{ left: 0, width: '22vmin', height: '24vmin' }} /></div>
      <h1 className="title">Reading</h1>
      {progress.track === 'basics' ? (
        <div className="path" aria-label="Basics">{BASICS.map((b) => { const st = progress.basics[b.n]?.status; return <div key={b.n} className={`stone ${st === 'passed' ? 'passed' : st === 'active' ? 'current' : ''}`}>{st === 'passed' ? '★' : b.newSound ?? '↺'}</div>; })}</div>
      ) : (
        <div className="path" aria-label="Levels">{LEVELS.map((l) => { const st = progress.levels[l.n]?.status; const cls = st === 'passed' ? 'passed' : l.n === cur ? (st === 'cold' ? 'cold' : 'current') : ''; return <div key={l.n} className={`stone ${cls}`}>{st === 'passed' ? '★' : l.newGraphemes[0] ?? '↺'}</div>; })}</div>
      )}
      <div className="row" style={{ gap: 14 }}>
        {!complete && <button className={`primary ${recommendationMet ? 'soft' : ''}`} onPointerDown={start} aria-label="Start reading">▶</button>}
        <button className="btn light" onClick={onBack}>Kite</button>
      </div>
      {recommendationMet && !complete && <p className="subtitle">Recommended reading practice is complete. Keep going if you want.</p>}
      {complete && <p className="subtitle">Books and Explore are still available. New reading levels can be added later.</p>}
    </div>
    <button className="home-books" onPointerDown={stories} aria-label="Story chair">📚</button>
  </div>;
}
