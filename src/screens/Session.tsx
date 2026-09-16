import { useEffect, useRef, useState } from 'react';
import { meter } from '../audio/mic';
import { say, stop } from '../audio/speaker';
import { levelByN } from '../content/levels';
import { Banner, Build, Ear, Glide, HearTap, Hold, ReadMatch, Reveal, SeeSay, Sentence, WhichWord } from '../activities/Activities';
import { ActivityProps } from '../activities/types';
import { PASS_RATIO, Step, StepKind, buildCheckout, buildMain } from '../engine/session';
import { SessionLog, coldCheckDue, currentLevel, failCold, passCheckout, passCold, recordAnswer, today } from '../engine/progress';
import { useStore } from '../app/store';
import { ParentCorner } from '../ui/components';

const VIEWS: Record<StepKind, (p: ActivityProps) => JSX.Element> = {
  ear: Ear, reveal: Reveal, hearTap: HearTap, seeSay: SeeSay, hold: Hold, glide: Glide, alien: Glide,
  readMatch: ReadMatch, build: Build, whichWord: WhichWord, sentence: Sentence, banner: Banner,
};

interface Tally { answered: number; correct: number }

export function Session({ onExit, onParent }: { onExit: (log: SessionLog) => void; onParent: () => void }) {
  const { progress, update } = useStore();
  const progressRef = useRef(progress);
  progressRef.current = progress;

  const startLevel = useRef(currentLevel(progress)).current;
  const [level, setLevel] = useState(startLevel);
  const [queue, setQueue] = useState<Step[]>(() =>
    coldCheckDue(progress, startLevel) ? buildCheckout(startLevel, 'cold') : buildMain(progress, startLevel));
  const [index, setIndex] = useState(0);
  const [neutral, setNeutral] = useState(false);
  const tallies = useRef<Record<Step['phase'], Tally>>({ main: { answered: 0, correct: 0 }, checkout: { answered: 0, correct: 0 }, cold: { answered: 0, correct: 0 } });
  const streakWrong = useRef(0);
  const missesByItem = useRef<Record<string, number>>({});
  const active = useRef(0);
  const lastInteraction = useRef(Date.now());
  const ended = useRef(false);
  const ranMain = useRef(false);
  const levelRef = useRef(level);
  levelRef.current = level;

  // Active-time clock: counts only while visible and recently interacted/voiced.
  useEffect(() => {
    const bump = () => { lastInteraction.current = Date.now(); };
    window.addEventListener('pointerdown', bump);
    const unsub = meter.subscribe(({ voiced }) => { if (voiced) bump(); });
    const t = setInterval(() => {
      if (document.visibilityState === 'visible' && Date.now() - lastInteraction.current < 25000) active.current += 1;
    }, 1000);
    return () => { window.removeEventListener('pointerdown', bump); unsub(); clearInterval(t); stop(); };
  }, []);

  const finish = async (endedBy: SessionLog['endedBy'], storyTime = false) => {
    if (ended.current) return;
    ended.current = true;
    const n = levelRef.current;
    const t = tallies.current;
    if (ranMain.current) {
      update((p) => ({ ...p, levels: { ...p.levels, [n]: { ...p.levels[n], sessions: (p.levels[n]?.sessions ?? 0) + 1 } } }));
    }
    const log: SessionLog = {
      date: today(), level: n, activeSeconds: active.current, endedBy,
      answered: t.main.answered + t.checkout.answered + t.cold.answered,
      correct: t.main.correct + t.checkout.correct + t.cold.correct,
    };
    update((p) => ({ ...p, sessions: [...p.sessions, log] }));
    if (endedBy === 'fatigue') await say({ p: 'rest' });
    if (storyTime) {
      setQueue((q) => [...q.slice(0, index + 1), { uid: 'story', kind: 'banner', banner: 'story_time', phase: 'main' }]);
      setIndex((i) => i + 1);
      pendingExit.current = log;
      return;
    }
    onExit(log);
  };
  const pendingExit = useRef<SessionLog | null>(null);

  const wantsStoryTime = () => {
    const n = levelRef.current;
    const sessionsSoFar = progressRef.current.sessions.length + 1;
    return levelByN(n).sentences.length > 0 && sessionsSoFar % 3 === 0;
  };

  /** Called when the queue runs out: decide what comes next. */
  const phaseComplete = (phase: Step['phase']) => {
    const n = levelRef.current;
    const t = tallies.current[phase];
    const ratio = t.answered ? t.correct / t.answered : 1;
    if (phase === 'cold') {
      if (ratio >= PASS_RATIO.cold) {
        update((p) => passCold(p, n));
        const nextP = passCold(progressRef.current, n);
        const next = currentLevel(nextP);
        say({ p: 'level_done' });
        setLevel(next);
        return appendSteps(buildMain(nextP, next));
      }
      update((p) => failCold(p, n));
      return appendSteps(buildMain(progressRef.current, n));
    }
    if (phase === 'main') {
      ranMain.current = true;
      const sessions = progressRef.current.levels[n]?.sessions ?? 0;
      const status = progressRef.current.levels[n]?.status;
      const confident = t.answered >= 8 && ratio >= 0.9;
      if (status === 'active' && (sessions >= 1 || confident) && !capReached()) return appendSteps(buildCheckout(n));
      return finish('complete', wantsStoryTime());
    }
    if (phase === 'checkout') {
      if (ratio >= PASS_RATIO.checkout) update((p) => passCheckout(p, n));
      return finish('complete', wantsStoryTime());
    }
  };

  const appendSteps = (steps: Step[]) => {
    tallies.current.checkout = { answered: 0, correct: 0 };
    setQueue((q) => [...q.slice(0, index + 1), ...steps]);
    setIndex((i) => i + 1);
  };

  const capReached = () => active.current >= progressRef.current.settings.capMinutes * 60;

  const onDone = (step: Step) => (correct: boolean | null) => {
    if (ended.current && pendingExit.current) { onExit(pendingExit.current); return; }
    if (ended.current) return;
    if (correct !== null) {
      const t = tallies.current[step.phase];
      t.answered += 1; if (correct) t.correct += 1;
      if (step.itemId && step.itemKind) update((p) => recordAnswer(p, step.itemId!, step.itemKind!, correct));
      if (step.kind !== 'ear') streakWrong.current = correct ? 0 : streakWrong.current + 1;
      const key = step.itemId ?? step.word ?? step.g ?? '';
      if (!correct && key) missesByItem.current[key] = (missesByItem.current[key] ?? 0) + 1;
    }
    let q = queue;
    // Re-inject a missed practice item ~30–60s later
    if (correct === false && step.phase === 'main' && !step.reinjected) {
      const copy: Step = { ...step, uid: step.uid + 'r', reinjected: true };
      const at = Math.min(q.length, index + 4);
      q = [...q.slice(0, at), copy, ...q.slice(at)];
      setQueue(q);
    }
    const key = step.itemId ?? step.word ?? step.g ?? '';
    const stuck = (key && missesByItem.current[key] >= 3) || streakWrong.current >= 5;
    if (stuck && step.phase === 'main') return finish('fatigue');
    const nextStep = q[index + 1];
    if (step.phase === 'main' && capReached() && (!nextStep || nextStep.phase === 'main')) return finish('cap', wantsStoryTime());
    if (!nextStep || nextStep.phase !== step.phase) {
      if (!nextStep) return phaseComplete(step.phase);
      // phase boundary already queued (shouldn't happen) – continue
    }
    setIndex(index + 1);
  };

  const step = queue[index];
  const View = VIEWS[step.kind];
  const pct = Math.round((index / queue.length) * 100);

  return (
    <div className="screen">
      <ParentCorner onOpen={onParent} />
      <div className="topbar" style={{ paddingLeft: 88 }}>
        <div className="dots"><div style={{ width: `${pct}%` }} /></div>
      </div>
      <View key={step.uid} step={step} ctx={{ settings: progress.settings, level }} onDone={onDone(step)} setNeutral={setNeutral} />
      <div className="neutral" style={{ opacity: neutral ? 1 : 0 }} />
    </div>
  );
}
