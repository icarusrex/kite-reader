import { useEffect, useRef, useState } from 'react';
import { useStore } from '../../../core/app/store';
import { ParentCorner } from '../../../core/ui/components';
import { MathTaskView, MathTaskResult } from '../activities/MathActivities';
import { MathSkillId } from '../content/skills';
import { buildMathSessionPlan } from '../engine/planner';
import { MathAttempt, MathSessionMode, mathToday, recordMathAttempt, recordMathSession } from '../engine/state';

const makeSessionId = () => `math-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

export function MathSession({ mode = 'guided', skillId, onExit, onParent }: {
  mode?: MathSessionMode;
  skillId?: MathSkillId;
  onExit: () => void;
  onParent: () => void;
}) {
  const { math, updateMath } = useStore();
  const snapshot = useRef(math).current;
  const plan = useRef(buildMathSessionPlan(snapshot, mode, skillId)).current;
  const sessionId = useRef(makeSessionId()).current;
  const [index, setIndex] = useState(0);
  const active = useRef(0);
  const attempts = useRef(0);
  const finished = useRef(false);

  useEffect(() => {
    const t = window.setInterval(() => { if (document.visibilityState === 'visible') active.current += 1; }, 1000);
    return () => clearInterval(t);
  }, []);

  const finish = () => {
    if (finished.current) return;
    finished.current = true;
    if (mode !== 'explore') {
      updateMath((p) => recordMathSession(p, {
        id: sessionId,
        date: mathToday(),
        mode,
        skillIds: [...new Set(plan.tasks.map((t) => t.skillId))],
        primarySkillId: plan.primarySkillId,
        activeSeconds: active.current,
        attempts: attempts.current,
      }));
    }
    onExit();
  };

  const onDone = (result: MathTaskResult | null) => {
    const task = plan.tasks[index];
    if (result && mode !== 'explore') {
      attempts.current += 1;
      const attempt: MathAttempt = {
        id: `${sessionId}-${index}`,
        sessionId,
        skillId: task.skillId,
        taskFamily: task.taskFamily,
        representation: task.representation,
        responseDirection: task.responseDirection,
        evidenceKind: task.evidenceKind,
        target: task.target ?? task.quantity,
        correct: result.correct,
        helpLevel: result.helpLevel,
        errorCode: result.errorCode,
        occurredAt: new Date().toISOString(),
      };
      updateMath((p) => recordMathAttempt(p, attempt));
    }

    const next = index + 1;
    const cap = mode === 'guided' && active.current >= snapshot.settings.capMinutes * 60;
    if (next >= plan.tasks.length || cap) return finish();
    setIndex(next);
  };

  const task = plan.tasks[index];
  const pct = Math.round((index / Math.max(1, plan.tasks.length)) * 100);
  return <div className="screen">
    <ParentCorner onOpen={onParent} />
    {mode !== 'guided' && <div className="mode-badge">Math · {mode === 'explore' ? 'Explore · no progress saved' : 'Practice'}</div>}
    <div className="topbar" style={{ paddingLeft: 88 }}><div className="dots"><div style={{ width: `${pct}%` }} /></div></div>
    <MathTaskView key={task.uid} task={task} onDone={onDone} />
  </div>;
}
