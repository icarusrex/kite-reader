import { createContext, useContext, useEffect, useState } from 'react';
import { freshBasics, freshProgress, Progress } from '../engine/progress';
import { MAX_LEVEL } from '../content/levels';
import { load, save } from '../engine/storage';

interface Store { progress: Progress; update: (fn: (p: Progress) => Progress) => void; replace: (p: Progress) => void }
const Ctx = createContext<Store | null>(null);

/** Upgrade saved data when new levels are added. */
export function migrate(p: Progress): Progress {
  const levels = { ...p.levels };
  for (let n = 1; n <= MAX_LEVEL; n++) {
    if (!levels[n]) levels[n] = { status: levels[n - 1]?.status === 'passed' ? 'active' : 'locked', sessions: 0 };
  }
  // Added 2026-09-17: Basics track. A child who hasn't passed any level starts there; sessions default to 10 minutes.
  const passedAny = Object.values(levels).some((l) => l.status === 'passed');
  const track = p.track ?? (passedAny ? 'levels' : 'basics');
  const basics = { ...freshBasics(), ...(p.basics ?? {}) };
  const settings = { ...freshProgress().settings, ...p.settings };
  if (!p.track && settings.capMinutes === 15) settings.capMinutes = 10;
  // 2026-09-17: spoken answers count automatically (grown-up can still tap ✗); the old "grown-up checks" is a setting
  if ((p.settings?.rev ?? 0) < 1) { settings.parentScoring = false; settings.rev = 1; }
  return { ...freshProgress(), ...p, track, basics, settings, levels };
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
