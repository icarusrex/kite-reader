import { useEffect, useState } from 'react';
import { StoreProvider, useStore } from './app/store';
import { Home } from './screens/Home';
import { Session } from './screens/Session';
import { Parent } from './screens/Parent';
import { Readiness } from './screens/Readiness';
import { meter } from './audio/mic';
import { initAudio, say } from './audio/speaker';
import { ParentCorner } from './ui/components';
import { requestPersistence } from './engine/storage';

type View = 'home' | 'session' | 'parent' | 'readiness' | 'done';

function Shell() {
  const { progress } = useStore();
  const [view, setView] = useState<View>('home');
  const [extra, setExtra] = useState(false);
  useEffect(() => { initAudio(); requestPersistence(); meter.sensitivity = progress.settings.micSensitivity; /* eslint-disable-next-line */ }, []);

  const start = async () => {
    await meter.start(); // must be inside the tap for iOS
    if (progress.settings.readinessPassed === null) return setView('readiness');
    setView('session');
  };

  if (view === 'parent') return <Parent onClose={() => setView('home')} onReadiness={async () => { await meter.start(); setView('readiness'); }} onExtraSession={() => { setExtra(true); setView('home'); }} />;
  if (view === 'readiness') return <Readiness onDone={() => setView('home')} />;
  if (view === 'session') return <Session onParent={() => setView('parent')} onExit={() => { setExtra(false); setView('done'); }} />;
  if (view === 'done') return <Done onHome={() => setView('home')} onParent={() => setView('parent')} />;
  return <Home onStart={start} onParent={() => setView('parent')} extraAllowed={extra} />;
}

function Done({ onHome, onParent }: { onHome: () => void; onParent: () => void }) {
  useEffect(() => { say({ p: 'all_done' }); const t = setTimeout(onHome, 9000); return () => clearTimeout(t); /* eslint-disable-next-line */ }, []);
  return (
    <div className="screen">
      <ParentCorner onOpen={onParent} />
      <div className="stage">
        <div style={{ fontSize: '28vmin' }}>🌙</div>
        <h1 className="title">All done for today!</h1>
      </div>
    </div>
  );
}

export default function App() {
  return <StoreProvider><Shell /></StoreProvider>;
}
