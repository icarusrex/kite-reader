import { useEffect, useRef, useState } from 'react';
import { meter } from '../audio/mic';
import { say, stop } from '../audio/speaker';
import { Banner, Build, Ear, Glide, HearTap, HeartWord, Hold, Meet, ReadMatch, Reveal, Rhyme, SayFast, SeeSay, Sentence, Story, TrackGame, WhichWord } from '../activities/Activities';
import { Meaning, Medial, Segment } from '../activities/PedagogyActivities';
import { ActivityProps } from '../activities/types';
import { AssessmentTally, SessionExtras, Step, StepKind, buildCheckout, buildMain, passesAssessment, storyFor, storyLevel } from '../engine/session';
import { storyPictureUrl } from '../content/pictures';
import { SessionLog, coldCheckDue, currentBasics, currentLevel, failCold, passBasics, passCheckout, passCold, recordAnswer, today } from '../engine/progress';
import { BASICS_PASS_RATIO, buildBasics } from '../engine/basics';
import { useStore } from '../app/store';
import { ParentCorner } from '../ui/components';

const VIEWS: Record<StepKind, (p: ActivityProps) => JSX.Element> = {
  ear: Ear, medial: Medial, segment: Segment, meaning: Meaning,
  reveal: Reveal, hearTap: HearTap, seeSay: SeeSay, hold: Hold, glide: Glide, alien: Glide,
  readMatch: ReadMatch, build: Build, whichWord: WhichWord, sentence: Sentence, story: Story, banner: Banner, heart: HeartWord,
  meet: Meet, sayFast: SayFast, rhyme: Rhyme, trackGame: TrackGame,
};

interface Tally { answered: number; correct: number }
const emptyTally = (): Tally => ({ answered: 0, correct: 0 });

export function Session({ onExit, onParent, extras, practiceLevel, practiceBasics }: { onExit: (log: SessionLog) => void; onParent: () => void; extras?: SessionExtras; practiceLevel?: number; practiceBasics?: number }) {
  const { progress, update } = useStore();
  const progressRef = useRef(progress);
  progressRef.current = progress;

  const basicsLesson = useRef(practiceBasics ?? (!practiceLevel && progress.track === 'basics' ? currentBasics(progress) : undefined)).current;
  const practice = !!(practiceLevel || practiceBasics);
  const startLevel = useRef(practiceLevel ?? currentLevel(progress)).current;
  const [level, setLevel] = useState(startLevel);
  const [queue, setQueue] = useState<Step[]>(() =>
    basicsLesson ? buildBasics(progress, basicsLesson)
      : !practiceLevel && coldCheckDue(progress, startLevel) ? buildCheckout(startLevel, 'cold') : buildMain(progress, startLevel, extras));
  const [index, setIndex] = useState(0);
  const [neutral, setNeutral] = useState(false);
  const tallies = useRef<Record<Step['phase'], Tally>>({ main: emptyTally(), checkout: emptyTally(), cold: emptyTally() });
  const requiredTallies = useRef<Record<Step['phase'], AssessmentTally>>({ main: emptyTally(), checkout: emptyTally(), cold: emptyTally() });
  const streakWrong = useRef(0);
  const missesByItem = useRef<Record<string, number>>({});
  const active = useRef(0);
  const lastInteraction = useRef(Date.now());
  const ended = useRef(false);
  const ranMain = useRef(false);
  const levelRef = useRef(level);
  levelRef.current = level;

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
    if (basicsLesson && ranMain.current && !practice) {
      update((p) => ({ ...p, basics: { ...p.basics, [basicsLesson]: { ...p.basics[basicsLesson], sessions: (p.basics[basicsLesson]?.sessions ?? 0) + 1 } } }));
    } else if (!basicsLesson && ranMain.current && !practiceLevel) {
      update((p) => ({ ...p, levels: { ...p.levels, [n]: { ...p.levels[n], sessions: (p.levels[n]?.sessions ?? 0) + 1 } } }));
    }
    const log: SessionLog = {
      date: today(), level: basicsLesson ? 0 : n, activeSeconds: active.current, endedBy, ...(practice ? { practice: true } : {}), ...(basicsLesson ? { basics: basicsLesson } : {}),
      answered: t.main.answered + t.checkout.answered + t.cold.answered,
      correct: t.main.correct + t.checkout.correct + t.cold.correct,
    };
    update((p) => ({ ...p, sessions: [...p.sessions, log] }));
    if (endedBy === 'fatigue') await say({ p: 'rest' });
    if (storyTime) {
      setQueue((q) => [...q.slice(0, index + 1), { uid: 'story', kind: 'banner', banner: 'story_time', lines: storyFor(n), image: storyLevel(n) && storyPictureUrl(storyLevel(n)!.n), phase: 'main' }]);
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
    return !practice && !basicsLesson && !!storyFor(n) && sessionsSoFar % 3 === 0;
  };

  const phaseComplete = (phase: Step['phase']) => {
    const n = levelRef.current;
    const t = tallies.current[phase];
    const ratio = t.answered ? t.correct / t.answered : 1;
    if (phase === 'cold') {
      if (passesAssessment('cold', t, requiredTallies.current.cold)) {
        update((p) => passCold(p, n));
        const nextP = passCold(progressRef.current, n);
        const next = currentLevel(nextP);
        setLevel(next);
        return appendSteps([{ uid: `done${n}`, kind: 'banner', banner: 'level_done', phase: 'main' }, ...buildMain(nextP, next, extras)]);
      }
      update((p) => failCold(p, n));
      return appendSteps(buildMain(progressRef.current, n, extras));
    }
    if (phase === 'main') {
      ranMain.current = true;
      if (basicsLesson) {
        if (!practice && ratio >= BASICS_PASS_RATIO) {
          update((p) => passBasics(p, basicsLesson));
          say({ p: 'basics_done' });
        }
        return finish('complete');
      }
      if (practiceLevel) return finish('complete');
      const sessions = progressRef.current.levels[n]?.sessions ?? 0;
      const status = progressRef.current.levels[n]?.status;
      const confident = t.answered >= 8 && ratio >= 0.9;
      if (status === 'active' && (sessions >= 1 || confident) && !capReached()) return appendSteps(buildCheckout(n));
      return finish('complete', wantsStoryTime());
    }
    if (phase === 'checkout') {
      if (passesAssessment('checkout', t, requiredTallies.current.checkout)) update((p) => passCheckout(p, n));
      return finish('complete', wantsStoryTime());
    }
  };

  const appendSteps = (steps: Step[]) => {
    tallies.current.checkout = emptyTally();
    requiredTallies.current.checkout = emptyTally();
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
      if (step.required) {
        const r = requiredTallies.current[step.phase];
        r.answered += 1; if (correct) r.correct += 1;
      }
      if (step.itemId && step.itemKind) update((p) => recordAnswer(p, step.itemId!, step.itemKind!, correct));
      if (step.kind !== 'ear') streakWrong.current = correct ? 0 : streakWrong.current + 1;
      const key = step.itemId ?? step.word ?? step.g ?? '';
      if (!correct && key) missesByItem.current[key] = (missesByItem.current[key] ?? 0) + 1;
    }
    let q = queue;
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
