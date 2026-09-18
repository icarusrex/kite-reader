import { createContext, useContext, useEffect, useState } from 'react';
import { migrateProgress, Progress } from '../engine/progress';
import { load, save } from '../engine/storage';
import { addProfile as addHouseholdProfile, Household, migrateHousehold, removeProfile as removeHouseholdProfile, renameProfile as renameHouseholdProfile } from './household';

const HOUSEHOLD_KEY = 'kite:household';
interface Store {
  progress: Progress; household: Household; activeProfileId: string;
  update: (fn: (p: Progress) => Progress) => void; replace: (p: Progress) => void; replaceHousehold: (h: Household) => void;
  switchProfile: (id: string) => void; addProfile: (name: string) => void; renameProfile: (id: string, name: string) => void; deleteProfile: (id: string) => void;
}
const Ctx = createContext<Store | null>(null);
export const migrate = migrateProgress;

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [household, setHousehold] = useState<Household | null>(null);
  useEffect(() => { (async () => { const [saved, legacy] = await Promise.all([load<unknown>(HOUSEHOLD_KEY, null), load<unknown>('progress', null)]); const next = migrateHousehold(saved, legacy); setHousehold(next); await save(HOUSEHOLD_KEY, next); })(); }, []);
  if (!household) return null;

  const commit = (fn: (h: Household) => Household) => setHousehold((prev) => {
    const next = fn(prev!); void save(HOUSEHOLD_KEY, next); return next;
  });
  const update = (fn: (p: Progress) => Progress) => commit((h) => {
    const before = h.profiles[h.activeProfileId];
    const nextProgress = migrateProgress(fn(before.progress));
    const name = nextProgress.settings.childName.trim() || before.name;
    nextProgress.settings.childName = name;
    return { ...h, profiles: { ...h.profiles, [before.id]: { ...before, name, progress: nextProgress } } };
  });
  const replace = (p: Progress) => update(() => migrateProgress(p));
  const replaceHousehold = (h: Household) => commit(() => migrateHousehold(h));
  const switchProfile = (id: string) => commit((h) => h.profiles[id] ? { ...h, activeProfileId: id } : h);
  const addProfile = (name: string) => commit((h) => addHouseholdProfile(h, name));
  const renameProfile = (id: string, name: string) => commit((h) => renameHouseholdProfile(h, id, name));
  const deleteProfile = (id: string) => commit((h) => removeHouseholdProfile(h, id));

  const active = household.profiles[household.activeProfileId] ?? Object.values(household.profiles)[0];
  return <Ctx.Provider value={{ progress: active.progress, household, activeProfileId: household.activeProfileId, update, replace, replaceHousehold, switchProfile, addProfile, renameProfile, deleteProfile }}>{children}</Ctx.Provider>;
}

export function useStore() { const s = useContext(Ctx); if (!s) throw new Error('no store'); return s; }
