import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { migrateProgress, Progress } from '../../modules/reading/engine/progress';
import { MathProgress, migrateMathProgress } from '../../modules/math/engine/state';
import { get, set, setMany } from 'idb-keyval';
import { parseBackup } from './backup';
import { addProfile as addHouseholdProfile, Household, migrateHousehold, removeProfile as removeHouseholdProfile, renameProfile as renameHouseholdProfile } from './household';

const HOUSEHOLD_KEY = 'kite:household';
const RECOVERY_KEY = 'kite:household:before-import';

interface Store {
  reading: Progress;
  math: MathProgress;
  household: Household;
  recovery: Household | null;
  activeProfileId: string;
  updateReading: (fn: (p: Progress) => Progress) => void;
  updateMath: (fn: (p: MathProgress) => MathProgress) => void;
  replaceReading: (p: Progress) => void;
  replaceMath: (p: MathProgress) => void;
  replaceHousehold: (h: Household) => void;
  switchProfile: (id: string) => void;
  addProfile: (name: string) => void;
  renameProfile: (id: string, name: string) => void;
  deleteProfile: (id: string) => void;

  // Reading compatibility aliases. They let the existing, proven Reading module move without a risky rewrite.
  // New core/module code should prefer reading/updateReading/replaceReading.
  progress: Progress;
  update: (fn: (p: Progress) => Progress) => void;
  replace: (p: Progress) => void;
}

const Ctx = createContext<Store | null>(null);
export const migrate = migrateProgress;

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [household, setHousehold] = useState<Household | null>(null);
  const [recovery, setRecovery] = useState<Household | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'error'>('saved');
  const current = useRef<Household | null>(null);
  const queue = useRef<Promise<void>>(Promise.resolve());
  const revision = useRef(0);
  const pendingRecovery = useRef<Household | null>(null);

  // Serialize snapshots: a slower earlier save must never land after a newer one.
  const persist = (next: Household) => {
    const rev = ++revision.current;
    const previous = pendingRecovery.current;
    setSaveStatus('saving');
    queue.current = queue.current.then(async () => {
      try {
        if (previous) await setMany([[RECOVERY_KEY, previous], [HOUSEHOLD_KEY, next]]);
        else await set(HOUSEHOLD_KEY, next);
        if (pendingRecovery.current === previous) pendingRecovery.current = null;
        if (revision.current === rev) setSaveStatus('saved');
      } catch {
        if (revision.current === rev) setSaveStatus('error');
      }
    });
  };

  useEffect(() => {
    let cancelled = false;
    setLoadError(false);
    (async () => {
      try {
        const saved = await get<unknown>(HOUSEHOLD_KEY);
        let next: Household;
        if (saved !== undefined && saved !== null) {
          const parsed = parseBackup(saved);
          if (parsed.kind !== 'household') throw new Error('Invalid household');
          next = parsed.household;
        } else {
          const legacy = await get<unknown>('progress');
          if (legacy !== undefined && legacy !== null) {
            const parsed = parseBackup(legacy);
            if (parsed.kind !== 'reading') throw new Error('Invalid legacy progress');
            next = migrateHousehold(null, parsed.reading);
          } else next = migrateHousehold(null);
        }
        // Recovery is optional. A damaged recovery copy must not hide valid progress.
        let previous: Household | null = null;
        try { const raw = await get<unknown>(RECOVERY_KEY); if (raw) { const p = parseBackup(raw); if (p.kind === 'household') previous = p.household; } } catch { /* retain current household */ }
        if (cancelled) return;
        current.current = next;
        setHousehold(next);
        setRecovery(previous);
        persist(next);
      } catch { if (!cancelled) setLoadError(true); }
    })();
    return () => { cancelled = true; };
  }, [loadAttempt]);

  if (!household) return <div className="parent"><main><div className="card" role={loadError ? 'alert' : 'status'}>
    {loadError ? <><h1>We could not load your progress</h1><p>Your saved household has not been replaced. Retry when storage is available.</p><button className="btn" onClick={() => setLoadAttempt(n => n + 1)}>Retry</button></> : <p>Loading your progress...</p>}
  </div></main></div>;

  const commit = (fn: (h: Household) => Household, keepRecovery = false) => {
    const before = current.current!;
    const next = fn(before);
    if (keepRecovery) { pendingRecovery.current = before; setRecovery(before); }
    current.current = next;
    setHousehold(next);
    persist(next);
  };

  const updateReading = (fn: (p: Progress) => Progress) => commit((h) => {
    const before = h.profiles[h.activeProfileId];
    const reading = migrateProgress(fn(before.modules.reading));
    const name = reading.settings.childName.trim() || before.name;
    reading.settings.childName = name;
    return { ...h, profiles: { ...h.profiles, [before.id]: { ...before, name, modules: { ...before.modules, reading } } } };
  });

  const updateMath = (fn: (p: MathProgress) => MathProgress) => commit((h) => {
    const before = h.profiles[h.activeProfileId];
    const math = migrateMathProgress(fn(before.modules.math));
    return { ...h, profiles: { ...h.profiles, [before.id]: { ...before, modules: { ...before.modules, math } } } };
  });

  const replaceReading = (p: Progress) => {
    const parsed = parseBackup(p);
    if (parsed.kind !== 'reading') throw new Error('Expected Reading backup');
    commit(h => {
      const profile = h.profiles[h.activeProfileId];
      const reading = parsed.reading;
      const name = reading.settings.childName.trim() || profile.name;
      reading.settings.childName = name;
      return { ...h, profiles: { ...h.profiles, [profile.id]: { ...profile, name, modules: { ...profile.modules, reading } } } };
    }, true);
  };
  const replaceMath = (p: MathProgress) => updateMath(() => migrateMathProgress(p));
  const replaceHousehold = (h: Household) => {
    const parsed = parseBackup(h);
    if (parsed.kind !== 'household') throw new Error('Expected household backup');
    commit(() => parsed.household, true);
  };
  const switchProfile = (id: string) => commit((h) => h.profiles[id] ? { ...h, activeProfileId: id } : h);
  const addProfile = (name: string) => commit((h) => addHouseholdProfile(h, name));
  const renameProfile = (id: string, name: string) => commit((h) => renameHouseholdProfile(h, id, name));
  const deleteProfile = (id: string) => commit((h) => removeHouseholdProfile(h, id));

  const active = household.profiles[household.activeProfileId] ?? Object.values(household.profiles)[0];
  const reading = active.modules.reading;
  const math = active.modules.math;
  return <Ctx.Provider value={{
    reading, math, household, recovery, activeProfileId: household.activeProfileId,
    updateReading, updateMath, replaceReading, replaceMath, replaceHousehold,
    switchProfile, addProfile, renameProfile, deleteProfile,
    progress: reading, update: updateReading, replace: replaceReading,
  }}>
    {saveStatus === 'error' && <div className="save-warning" role="alert"><strong>Progress is not saved.</strong> Keep this window open. <button onClick={() => persist(current.current!)}>Retry saving</button> <button onClick={() => exportHousehold(current.current!)}>Export household</button></div>}
    {children}
  </Ctx.Provider>;
}

export function useStore() {
  const store = useContext(Ctx);
  if (!store) throw new Error('Kite store is not available');
  return store;
}

export function exportHousehold(household: Household) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(household, null, 2)], { type: 'application/json' }));
  const a = document.createElement('a');
  a.href = url; a.download = `kite-household-${new Date().toISOString().slice(0, 10)}.json`; a.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
