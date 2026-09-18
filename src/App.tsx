import { useEffect, useState } from 'react';
import { StoreProvider, useStore } from './app/store';
import { Home } from './screens/Home';
import { Session, SessionMode } from './screens/Session';
import { Parent } from './screens/Parent';
import { Readiness } from './screens/Readiness';
import { StoryChair } from './screens/StoryChair';
import { listBooks } from './books/library';
import { bookExtras } from './books/extras';
import { SessionExtras } from './engine/session';
import { allPassed, currentLevel } from './engine/progress';
import { meter } from './audio/mic';
import { initAudio, say } from './audio/speaker';
import { ParentCorner } from './ui/components';
import { requestPersistence } from './engine/storage';

type View = 'home' | 'session' | 'parent' | 'readiness' | 'done' | 'stories';

function Shell() {
  const { progress, household, switchProfile, addProfile } = useStore();
  const [profileChosen, setProfileChosen] = useState(Object.keys(household.profiles).length <= 1);
  const [view, setView] = useState<View>('home');
  const [extra, setExtra] = useState(false);
  const [extras, setExtras] = useState<SessionExtras | undefined>();
  const [requestedLevel, setRequestedLevel] = useState<number | undefined>();
  const [requestedBasics, setRequestedBasics] = useState<number | undefined>();
  const [mode, setMode] = useState<SessionMode>('guided');

  useEffect(() => { initAudio(); requestPersistence(); meter.sensitivity = progress.settings.micSensitivity; /* eslint-disable-next-line */ }, []);

  if (!profileChosen && Object.keys(household.profiles).length > 1) {
    return <ProfileChooser
      onChoose={(id) => { switchProfile(id); setProfileChosen(true); }}
      onAdd={() => { const name = window.prompt('Name for this learner'); if (name?.trim()) { addProfile(name); setProfileChosen(true); } }}
    />;
  }

  const start = async () => {
    if (progress.track === 'levels' && allPassed(progress)) return;
    await meter.start();
    if (progress.track === 'levels' && progress.settings.readinessPassed !== true) return setView('readiness');
    setExtras(await localExtras(currentLevel(progress)));
    setRequestedLevel(undefined); setRequestedBasics(undefined); setMode('guided'); setView('session');
  };
  const openLevel = async (n: number, nextMode: 'practice' | 'explore') => {
    await meter.start(); setExtras(await localExtras(n)); setRequestedBasics(undefined); setRequestedLevel(n); setMode(nextMode); setView('session');
  };
  const openBasics = async (n: number, nextMode: 'practice' | 'explore') => {
    await meter.start(); setRequestedLevel(undefined); setRequestedBasics(n); setMode(nextMode); setView('session');
  };

  if (view === 'parent') return <Parent
    onClose={() => setView('home')}
    onReadiness={async () => { await meter.start(); setView('readiness'); }}
    onExtraSession={() => { setExtra(true); setView('home'); }}
    onPractice={(n) => openLevel(n, 'practice')}
    onExplore={(n) => openLevel(n, 'explore')}
    onPracticeBasics={(n) => openBasics(n, 'practice')}
    onExploreBasics={(n) => openBasics(n, 'explore')}
    onSwitchProfile={() => setProfileChosen(false)}
  />;
  if (view === 'stories') return <StoryChair onClose={() => setView('home')} />;
  if (view === 'readiness') return <Readiness onDone={() => setView('home')} />;
  if (view === 'session') return <Session
    key={`${mode}:${requestedLevel ?? (requestedBasics ? `b${requestedBasics}` : 'main')}`}
    extras={extras} level={requestedLevel} basics={requestedBasics} mode={mode}
    onParent={() => setView('parent')}
    onExit={() => { setExtra(false); if (mode !== 'guided') { setRequestedLevel(undefined); setRequestedBasics(undefined); setView('parent'); } else setView('done'); }}
  />;
  if (view === 'done') return <Done onHome={() => setView('home')} onParent={() => setView('parent')} />;
  return <Home onStart={start} onParent={() => setView('parent')} onStories={() => setView('stories')} extraAllowed={extra} />;
}

function ProfileChooser({ onChoose, onAdd }: { onChoose: (id: string) => void; onAdd: () => void }) {
  const { household } = useStore();
  return (
    <div className="parent" style={{ display: 'grid', placeItems: 'center' }}>
      <div className="card" style={{ width: 'min(620px, 90vw)' }}>
        <h1>Who is learning?</h1>
        <div className="row" style={{ justifyContent: 'flex-start', flexWrap: 'wrap' }}>
          {Object.values(household.profiles).map((p) => <button className="btn" key={p.id} onClick={() => onChoose(p.id)}>{p.name}</button>)}
          <button className="btn light" onClick={onAdd}>+ Add learner</button>
        </div>
      </div>
    </div>
  );
}

function Done({ onHome, onParent }: { onHome: () => void; onParent: () => void }) {
  useEffect(() => { say({ p: 'all_done' }); const t = setTimeout(onHome, 7000); return () => clearTimeout(t); /* eslint-disable-next-line */ }, []);
  return <div className="screen"><ParentCorner onOpen={onParent} /><div className="stage"><div style={{ fontSize: '28vmin' }}>🌙</div><h1 className="title">Session complete!</h1><p className="subtitle">You can do another session whenever you want.</p></div></div>;
}

async function localExtras(n: number): Promise<SessionExtras> {
  try { return bookExtras(await listBooks(), n); } catch { return { sentences: [], heart: [] }; }
}

export default function App() { return <StoreProvider><Shell /></StoreProvider>; }
