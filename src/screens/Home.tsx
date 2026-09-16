import { LEVELS } from '../content/levels';
import { currentLevel, today } from '../engine/progress';
import { useStore } from '../app/store';
import { Kite, ParentCorner, useTap } from '../ui/components';

export function Home({ onStart, onParent, onStories, extraAllowed }: { onStart: () => void; onParent: () => void; onStories: () => void; extraAllowed: boolean }) {
  const { progress } = useStore();
  const cur = currentLevel(progress);
  const usedToday = progress.sessions.filter((s) => s.date === today()).reduce((a, s) => a + s.activeSeconds, 0);
  const resting = usedToday >= progress.settings.capMinutes * 60 && !extraAllowed;
  const start = useTap(() => !resting && onStart());
  const name = progress.settings.childName;
  const stories = useTap(onStories);

  return (
    <div className="screen">
      <ParentCorner onOpen={onParent} />
      <div className="stage">
        <div style={{ position: 'relative', width: '22vmin', height: '24vmin' }}>
          <Kite style={{ left: 0, width: '22vmin', height: '24vmin', transform: resting ? 'rotate(-12deg)' : undefined }} />
        </div>
        <h1 className="title">{resting ? 'See you tomorrow!' : name ? `Hi ${name}!` : 'Hi!'}</h1>
        <div className="path" aria-label="Levels">
          {LEVELS.map((l) => {
            const st = progress.levels[l.n]?.status;
            const cls = st === 'passed' ? 'passed' : l.n === cur ? (st === 'cold' ? 'cold' : 'current') : '';
            return <div key={l.n} className={`stone ${cls}`}>{st === 'passed' ? '★' : l.newGraphemes[0] ?? '↺'}</div>;
          })}
        </div>
        {!resting && <button className="primary" onPointerDown={start} aria-label="Start">▶</button>}
        {resting && <p className="subtitle">Your brain worked hard today.</p>}
      </div>
      <button className="home-books" onPointerDown={stories} aria-label="Story chair">📚</button>
    </div>
  );
}
