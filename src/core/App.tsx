import { useEffect, useState } from 'react';
import { StoreProvider, useStore } from './app/store';
import { ModuleLauncher } from './screens/ModuleLauncher';
import { ReadingHome } from '../modules/reading/screens/ReadingHome';
import { Session, SessionMode } from '../modules/reading/screens/Session';
import { Parent } from '../modules/reading/screens/Parent';
import { Readiness } from '../modules/reading/screens/Readiness';
import { StoryChair } from '../modules/reading/screens/StoryChair';
import { listBooks } from '../modules/reading/books/library';
import { bookExtras } from '../modules/reading/books/extras';
import { SessionExtras } from '../modules/reading/engine/session';
import { allPassed, currentBasics, currentLevel } from '../modules/reading/engine/progress';
import { MathHome } from '../modules/math/screens/MathHome';
import { MathSession } from '../modules/math/screens/MathSession';
import { MathProgressScreen } from '../modules/math/screens/MathProgressScreen';
import { MathDone } from '../modules/math/screens/MathDone';
import { MathSessionMode } from '../modules/math/engine/state';
import { KiteModuleId } from './module';
import { meter } from '../modules/reading/audio/mic';
import { initAudio, say } from '../modules/reading/audio/speaker';
import { ParentCorner, useTap } from './ui/components';
import { requestPersistence } from './storage';
import { MiniGame, StickerReward } from './games/MiniGames';
import { readingGameTheme } from '../modules/reading/games';
import { mathGameTheme } from '../modules/math/games';
import { applyUpdate, useUpdate } from './update';

type View =
  | 'launcher'
  | 'reading-home'
  | 'reading-session'
  | 'parent'
  | 'readiness'
  | 'done'
  | 'stories'
  | 'math-home'
  | 'math-session'
  | 'math-done'
  | 'math-progress'
  | 'game';

function Shell() {
  const { reading, household, switchProfile, addProfile } = useStore();
  const [profileChosen, setProfileChosen] = useState(Object.keys(household.profiles).length <= 1);
  const [view, setView] = useState<View>('launcher');
  const [extra, setExtra] = useState(false);
  const [extras, setExtras] = useState<SessionExtras | undefined>();
  const [requestedLevel, setRequestedLevel] = useState<number | undefined>();
  const [requestedBasics, setRequestedBasics] = useState<number | undefined>();
  const [mode, setMode] = useState<SessionMode>('guided');
  const [mathMode, setMathMode] = useState<MathSessionMode>('guided');
  const [mathLesson, setMathLesson] = useState<number | undefined>();
  // Finishing a guided lesson earns a sticker and one short game (played from the Great job screen).
  const [reward, setReward] = useState<'reading' | 'math' | null>(null);
  const [game, setGame] = useState<'reading' | 'math'>('reading');
  const { math } = useStore();
  const stickers = reading.sessions.filter((s) => !s.practice).length + math.sessions.filter((s) => s.mode === 'guided').length;
  const rewardFor = (m: 'reading' | 'math') => reward === m ? <>
    <StickerReward count={stickers} />
    <button className="btn game-btn" onClick={() => { setGame(m); setReward(null); setView('game'); }}>🎮 Play a game!</button>
  </> : null;

  useEffect(() => {
    initAudio();
    requestPersistence();
    meter.sensitivity = reading.settings.micSensitivity;
    // Initial device setup only; learner changes do not require reinitializing audio.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // A downloaded update goes in on a home screen only, never in the middle of a lesson (progress is saved as it happens).
  const update = useUpdate();
  const restingView = ['launcher', 'reading-home', 'math-home', 'done', 'math-done'].includes(view);
  useEffect(() => { if (update.pending && restingView) void applyUpdate(); }, [update.pending, restingView]);

  if (!profileChosen && Object.keys(household.profiles).length > 1) {
    return <ProfileChooser
      onChoose={(id) => { switchProfile(id); setProfileChosen(true); setView('launcher'); }}
      onAdd={() => { const name = window.prompt('Name for this learner'); if (name?.trim()) { addProfile(name); setProfileChosen(true); setView('launcher'); } }}
    />;
  }

  const startReading = async () => {
    if (reading.track === 'levels' && allPassed(reading)) return;
    await meter.start();
    if (reading.track === 'levels' && reading.settings.readinessPassed !== true) return setView('readiness');
    setExtras(await localExtras(currentLevel(reading)));
    setRequestedLevel(undefined);
    setRequestedBasics(undefined);
    setMode('guided');
    setView('reading-session');
  };

  const openLevel = async (n: number, nextMode: 'practice' | 'explore') => {
    await meter.start();
    setExtras(await localExtras(n));
    setRequestedBasics(undefined);
    setRequestedLevel(n);
    setMode(nextMode);
    setView('reading-session');
  };

  const openBasics = async (n: number, nextMode: 'practice' | 'explore') => {
    await meter.start();
    setRequestedLevel(undefined);
    setRequestedBasics(n);
    setMode(nextMode);
    setView('reading-session');
  };

  const openMath = (nextMode: MathSessionMode, lesson?: number) => {
    setMathMode(nextMode);
    setMathLesson(lesson);
    setView('math-session');
  };

  const openModule = (id: KiteModuleId) => setView(id === 'reading' ? 'reading-home' : 'math-home');

  if (view === 'parent') return <Parent
    onClose={() => setView('launcher')}
    onReadiness={async () => { await meter.start(); setView('readiness'); }}
    onExtraSession={() => { setExtra(true); setView('reading-home'); }}
    onPractice={(n) => openLevel(n, 'practice')}
    onExplore={(n) => openLevel(n, 'explore')}
    onPracticeBasics={(n) => openBasics(n, 'practice')}
    onExploreBasics={(n) => openBasics(n, 'explore')}
    onSwitchProfile={() => setProfileChosen(false)}
  />;
  if (view === 'stories') return <StoryChair onClose={() => setView('reading-home')} />;
  if (view === 'readiness') return <Readiness onDone={() => setView('reading-home')} />;
  if (view === 'math-home') return <MathHome onStart={() => openMath('guided')} onBack={() => setView('launcher')} onParent={() => setView('math-progress')} />;
  if (view === 'math-progress') return <MathProgressScreen onClose={() => setView('math-home')} onPractice={(n) => openMath('practice', n)} onExplore={(n) => openMath('explore', n)} />;
  if (view === 'math-session') return <MathSession key={`${mathMode}:${mathLesson ?? 'auto'}`} mode={mathMode} lesson={mathLesson} onExit={() => { if (mathMode === 'guided') { setReward('math'); setView('math-done'); } else setView('math-progress'); }} onParent={() => setView('math-progress')} />;
  if (view === 'math-done') return <MathDone reward={rewardFor('math')} onNext={() => { setReward(null); openMath('guided'); }} onHome={() => { setReward(null); setView('math-home'); }} onParent={() => setView('math-progress')} />;
  if (view === 'game') return <MiniGame kind={stickers % 2 ? 'pop' : 'memory'} theme={game === 'math' ? mathGameTheme(math) : readingGameTheme(reading)} onDone={() => setView(game === 'math' ? 'math-done' : 'done')} />;
  if (view === 'reading-session') return <Session
    key={`${mode}:${requestedLevel ?? (requestedBasics ? `b${requestedBasics}` : 'main')}`}
    extras={extras}
    level={requestedLevel}
    basics={requestedBasics}
    mode={mode}
    onParent={() => setView('parent')}
    onExit={() => {
      setExtra(false);
      if (mode !== 'guided') {
        setRequestedLevel(undefined);
        setRequestedBasics(undefined);
        setView('parent');
      } else { setReward('reading'); setView('done'); }
    }}
  />;
  if (view === 'done') return <Done reward={rewardFor('reading')} onNext={() => { setReward(null); void startReading(); }} onHome={() => { setReward(null); setView('reading-home'); }} onParent={() => setView('parent')} />;
  if (view === 'reading-home') return <ReadingHome onStart={startReading} onParent={() => setView('parent')} onStories={() => setView('stories')} onBack={() => setView('launcher')} extraAllowed={extra} />;
  return <ModuleLauncher onOpen={openModule} onParent={() => setView('parent')} />;
}

function ProfileChooser({ onChoose, onAdd }: { onChoose: (id: string) => void; onAdd: () => void }) {
  const { household } = useStore();
  return <div className="parent" style={{ display: 'grid', placeItems: 'center' }}>
    <div className="card" style={{ width: 'min(620px, 90vw)' }}>
      <h1>Who is learning?</h1>
      <div className="row" style={{ justifyContent: 'flex-start', flexWrap: 'wrap' }}>
        {Object.values(household.profiles).map((p) => <button className="btn" key={p.id} onClick={() => onChoose(p.id)}>{p.name}</button>)}
        <button className="btn light" onClick={onAdd}>+ Add learner</button>
      </div>
    </div>
  </div>;
}

/** Between lessons: progress is already saved, so the child can go straight on to the next one or stop here. */
function Done({ onNext, onHome, onParent, reward }: { onNext: () => void; onHome: () => void; onParent: () => void; reward?: React.ReactNode }) {
  const { reading } = useStore();
  const complete = reading.track === 'levels' && allPassed(reading);
  const next = useTap(onNext);
  useEffect(() => { say({ p: complete ? 'all_done' : 'lesson_done' }); }, [complete]);
  return <div className="screen"><ParentCorner onOpen={onParent} /><div className="stage">
    <div style={{ fontSize: '22vmin' }}>🪁</div>
    <h1 className="title">Great job!</h1>
    {!complete && <p className="subtitle">Next: {reading.track === 'basics' ? `lesson ${currentBasics(reading)}` : `level ${currentLevel(reading)}`}</p>}
    {reward}
    <div className="row" style={{ gap: 14 }}>
      {!complete && <button className="primary" onPointerDown={next} aria-label="Next lesson">▶</button>}
      <button className="btn light" onClick={onHome}>Home</button>
    </div>
  </div></div>;
}

async function localExtras(n: number): Promise<SessionExtras> {
  try { return bookExtras(await listBooks(), n); }
  catch { return { sentences: [], heart: [] }; }
}

export default function App() {
  return <StoreProvider><Shell /></StoreProvider>;
}
