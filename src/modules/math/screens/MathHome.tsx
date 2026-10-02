import { useStore } from '../../../core/app/store';
import { ParentCorner, useTap } from '../../../core/ui/components';
import { MATH_LESSONS, MATH_LESSON_COUNT } from '../content/lessons';
import { currentMathLesson, mathAllPassed, mathLessonTitle } from '../engine/lessons';
import { mathToday } from '../engine/state';

/** Same shape as Reading's home: the path of lessons, where you are, and ▶. */
export function MathHome({ onStart, onBack, onParent }: { onStart: () => void; onBack: () => void; onParent: () => void }) {
  const { math } = useStore();
  const cur = currentMathLesson(math);
  const complete = mathAllPassed(math);
  const usedToday = math.sessions.filter((s) => s.date === mathToday() && s.mode === 'guided').reduce((a, s) => a + s.activeSeconds, 0);
  const recommendationMet = usedToday >= math.settings.capMinutes * 60;
  const start = useTap(() => !complete && onStart());
  return <div className="screen">
    <ParentCorner onOpen={onParent} />
    <div className="stage">
      <div style={{ fontSize: '18vmin', lineHeight: 1 }}>🔢</div>
      <h1 className="title">Math</h1>
      <div className="path" aria-label="Lessons">{MATH_LESSONS.map((id, i) => {
        const st = math.lessons[id].status;
        const cls = st === 'passed' ? 'passed' : i + 1 === cur ? (st === 'cold' ? 'cold' : 'current') : '';
        return <div key={id} className={`stone ${cls}`}>{st === 'passed' ? '★' : i + 1}</div>;
      })}</div>
      {!complete && <p className="subtitle">Lesson {cur} of {MATH_LESSON_COUNT} · {mathLessonTitle(cur)} · tap ▶</p>}
      <div className="row" style={{ gap: 14 }}>
        {!complete && <button className={`primary ${recommendationMet ? 'soft' : ''}`} onPointerDown={start} aria-label="Start math">▶</button>}
        <button className="btn light" onClick={onBack}>Kite</button>
      </div>
      {recommendationMet && !complete && <p className="subtitle">Today's recommended practice is done. Keep going as long as you like!</p>}
      {complete && <p className="subtitle">All math lessons done! Practice and Explore are in the grown-up area.</p>}
    </div>
  </div>;
}
