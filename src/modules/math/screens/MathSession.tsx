import { useEffect, useRef, useState } from 'react';
import { useStore } from '../../../core/app/store';
import { ParentCorner } from '../../../core/ui/components';
import { MathTaskView, MathTaskResult } from '../activities/MathActivities';
import { mathLessonSkill } from '../content/lessons';
import { buildMathSessionPlan } from '../engine/planner';
import {
  MathPhase, buildLessonCheck, buildLessonMain, currentMathLesson, lessonDoneBanner, mathAllPassed, mathColdCheckDue,
  mathCountSession, mathFailCold, mathPassCheckout, mathPassCold, mathRecordReview, passesMath,
} from '../engine/lessons';
import { MathAttempt, MathSessionMode, mathToday, recordMathAttempt, recordMathSession } from '../engine/state';
import { MathTask } from '../engine/tasks';

const makeSessionId = () => `math-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
const tally = () => ({ answered: 0, correct: 0 });

/** One Math session, run the way Reading's Session runs a level: the current lesson's practice, then a
 *  checkout when ready; next time a cold check, and passing it rolls straight into the next lesson.
 *  Practice and Explore play a chosen lesson and never move the child's place. */
export function MathSession({ mode = 'guided', lesson: requested, onExit, onParent }: {
  mode?: MathSessionMode;
  lesson?: number;
  onExit: () => void;
  onParent: () => void;
}) {
  const { math, updateMath } = useStore();
  const mathRef = useRef(math); mathRef.current = math;
  const sessionId = useRef(makeSessionId()).current;
  const startLesson = useRef(mode === 'guided' ? currentMathLesson(math) : requested ?? currentMathLesson(math)).current;
  const lessonRef = useRef(startLesson);
  const [queue, setQueue] = useState<MathTask[]>(() => {
    if (mode !== 'guided') return buildMathSessionPlan(math, mode, mathLessonSkill(startLesson)).tasks.map((t) => ({ ...t, phase: 'main' as const }));
    return mathColdCheckDue(math, startLesson) ? buildLessonCheck(math, startLesson, 'cold') : buildLessonMain(math, startLesson);
  });
  const [index, setIndex] = useState(0);
  const tallies = useRef<Record<MathPhase, { answered: number; correct: number }>>({ main: tally(), checkout: tally(), cold: tally() });
  const ranMain = useRef(false);
  const streakWrong = useRef(0);
  const active = useRef(0);
  const attempts = useRef(0);
  const skillIds = useRef(new Set<MathTask['skillId']>());
  const finished = useRef(false);

  useEffect(() => {
    const t = window.setInterval(() => { if (document.visibilityState === 'visible') active.current += 1; }, 1000);
    return () => clearInterval(t);
  }, []);

  const finish = () => {
    if (finished.current) return;
    finished.current = true;
    const n = lessonRef.current;
    if (mode === 'guided' && ranMain.current) updateMath((p) => mathCountSession(p, n));
    if (mode !== 'explore') {
      updateMath((p) => recordMathSession(p, {
        id: sessionId, date: mathToday(), mode, skillIds: [...skillIds.current],
        primarySkillId: mathLessonSkill(n), activeSeconds: active.current, attempts: attempts.current,
      }));
    }
    onExit();
  };

  // Like Reading's appendSteps: the session carries on with what comes next.
  const append = (tasks: MathTask[]) => {
    setQueue((q) => [...q.slice(0, index + 1), ...tasks]);
    setIndex((i) => i + 1);
  };

  const phaseComplete = (phase: MathPhase) => {
    const n = lessonRef.current;
    const t = tallies.current[phase];
    if (phase === 'cold') {
      if (passesMath('cold', t.answered, t.correct)) {
        const next = mathPassCold(mathRef.current, n);
        updateMath((p) => mathPassCold(p, n));
        if (mathAllPassed(next)) return finish();
        const following = currentMathLesson(next);
        lessonRef.current = following;
        tallies.current.main = tally();
        return append([lessonDoneBanner(following), ...buildLessonMain(next, following)]);
      }
      updateMath((p) => mathFailCold(p, n));
      tallies.current.main = tally();
      return append(buildLessonMain(mathRef.current, n));
    }
    if (phase === 'main') {
      ranMain.current = true;
      if (mode !== 'guided') return finish();
      const lesson = mathRef.current.lessons[mathLessonSkill(n)];
      const confident = t.answered >= 6 && t.correct / t.answered >= 0.9;
      if (lesson.status === 'active' && (lesson.sessions >= 1 || confident)) {
        tallies.current.checkout = tally();
        return append(buildLessonCheck(mathRef.current, n, 'checkout'));
      }
      return finish();
    }
    if (passesMath('checkout', t.answered, t.correct)) updateMath((p) => mathPassCheckout(p, n));
    return finish();
  };

  const onDone = (result: MathTaskResult | null) => {
    if (finished.current) return;
    const task = queue[index];
    const phase = task.phase ?? 'main';
    let q = queue;
    if (result) {
      skillIds.current.add(task.skillId);
      if (mode !== 'explore') {
        attempts.current += 1;
        const attempt: MathAttempt = {
          id: `${sessionId}-${task.uid}`, sessionId, skillId: task.skillId, taskFamily: task.taskFamily,
          representation: task.representation, responseDirection: task.responseDirection, evidenceKind: task.evidenceKind,
          target: task.target ?? task.quantity, correct: result.correct, helpLevel: result.helpLevel,
          errorCode: result.errorCode, occurredAt: new Date().toISOString(),
        };
        updateMath((p) => recordMathAttempt(p, attempt));
        if (task.review) updateMath((p) => mathRecordReview(p, task.skillId, result.correct));
      }
      // Reviews of earlier lessons do not count towards this lesson's score.
      if (!task.review) {
        const t = tallies.current[phase];
        t.answered += 1;
        if (result.correct && result.helpLevel === 'none') t.correct += 1;
      }
      streakWrong.current = result.correct ? 0 : streakWrong.current + 1;
      // As Reading: a miss in practice comes back once, a few tasks later.
      if (!result.correct && phase === 'main' && !task.review && !task.uid.endsWith('r')) {
        const at = Math.min(q.length, index + 4);
        q = [...q.slice(0, at), { ...task, uid: `${task.uid}r` }, ...q.slice(at)];
        setQueue(q);
      }
      // Five misses in a row: stop for now, as Reading's fatigue rule does.
      if (mode === 'guided' && phase === 'main' && streakWrong.current >= 5) return finish();
    }
    const next = q[index + 1];
    if (!next || (next.phase ?? 'main') !== phase) {
      if (!next) return phaseComplete(phase);
    }
    setIndex(index + 1);
  };

  const task = queue[index];
  const pct = Math.round((index / Math.max(1, queue.length)) * 100);
  return <div className="screen">
    <ParentCorner onOpen={onParent} />
    {mode !== 'guided' && <div className="mode-badge">Math · {mode === 'explore' ? 'Explore · no progress saved' : 'Practice'}</div>}
    <div className="topbar" style={{ paddingLeft: 88 }}><div className="dots"><div style={{ width: `${pct}%` }} /></div></div>
    <MathTaskView key={task.uid} task={task} onDone={onDone} />
  </div>;
}
