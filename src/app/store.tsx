import { createContext, useContext, useEffect, useState } from 'react';
import { freshProgress, Progress } from '../engine/progress';
import { MAX_LEVEL } from '../content/levels';
import { load, save } from '../engine/storage';

interface Store { progress: Progress; update: (fn: (p: Progress) => Progress) => void; replace: (p: Progress) => void }
const Ctx = createContext<Store | null>(null);

/** Upgrade saved data when new levels are added. */
function migrate(p: Progress): Progress {
  const levels = { ...p.levels };
  for (let n = 1; n <= MAX_LEVEL; n++) {
    if (!levels[n]) levels[n] = { status: levels[n - 1]?.status === 'passed' ? 'active' : 'locked', sessions: 0 };
  }
  return { ...freshProgress(), ...p, settings: { ...freshProgress().settings, ...p.settings }, levels };
}

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [progress, setProgress] = useState<Progress | null>(null);
  useEffect(() => { load<Progress | null>('progress', null).then((p) => setProgress(p ? migrate(p) : freshProgress())); }, []);
  if (!progress) return null;
  const update = (fn: (p: Progress) => Progress) => setProgress((prev) => { const next = fn(prev!); save('progress', next); return next; });
  const replace = (p: Progress) => { const m = migrate(p); save('progress', m); setProgress(m); };
  return <Ctx.Provider value={{ progress, update, replace }}>{children}</Ctx.Provider>;
}

export function useStore() {
  const s = useContext(Ctx);
  if (!s) throw new Error('no store');
  return s;
}
