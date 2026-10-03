import { useEffect } from 'react';
import { useStore } from '../../../core/app/store';
import { speakText, stopSpeech } from '../../../core/audio/speech';
import { ParentCorner, useTap } from '../../../core/ui/components';
import { currentMathLesson, mathAllPassed, mathLessonTitle } from '../engine/lessons';

/** Between lessons, as in Reading: progress is already saved, so the child can go straight on or stop here. */
export function MathDone({ onNext, onHome, onParent, reward }: { onNext: () => void; onHome: () => void; onParent: () => void; reward?: React.ReactNode }) {
  const { math } = useStore();
  const complete = mathAllPassed(math);
  const cur = currentMathLesson(math);
  const next = useTap(onNext);
  useEffect(() => { void speakText(complete ? 'You finished all the math lessons!' : 'Great job! Tap the arrow to play the next one.'); return stopSpeech; }, [complete]);
  return <div className="screen"><ParentCorner onOpen={onParent} /><div className="stage">
    <div style={{ fontSize: '22vmin' }}>🔢</div>
    <h1 className="title">Great job!</h1>
    {!complete && <p className="subtitle">Next: lesson {cur} · {mathLessonTitle(cur)}</p>}
    {reward}
    <div className="row" style={{ gap: 14 }}>
      {!complete && <button className="primary" onPointerDown={next} aria-label="Next lesson">▶</button>}
      <button className="btn light" onClick={onHome}>Home</button>
    </div>
  </div></div>;
}
