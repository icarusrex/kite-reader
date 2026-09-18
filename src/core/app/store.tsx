import { createContext, useContext, useEffect, useState } from 'react';
import { migrateProgress, Progress } from '../../modules/reading/engine/progress';
import { MathProgress, migrateMathProgress } from '../../modules/math/engine/state';
import { load, save } from '../storage';
import { addProfile as addHouseholdProfile, Household, migrateHousehold, removeProfile as removeHouseholdProfile, renameProfile as renameHouseholdProfile } from './household';

const HOUSEHOLD_KEY = 'kite:household';

interface Store {
  reading: Progress;
  math: MathProgress;
  household: Household;
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
  useEffect(() => { (async () => {
    const [saved, legacy] = await Promise.all([load<unknown>(HOUSEHOLD_KEY, null), load<unknown>('progress', null)]);
    const next = migrateHousehold(saved, legacy);
    setHousehold(next);
    await save(HOUSEHOLD_KEY, next);
  })(); }, []);
  if (!household) return null;

  const commit = (fn: (h: Household) => Household) => setHousehold((prev) => {
    const next = fn(prev!);
    void save(HOUSEHOLD_KEY, next);
    return next;
  });

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

  const replaceReading = (p: Progress) => updateReading(() => migrateProgress(p));
  const replaceMath = (p: MathProgress) => updateMath(() => migrateMathProgress(p));
  const replaceHousehold = (h: Household) => commit(() => migrateHousehold(h));
  const switchProfile = (id: string) => commit((h) => h.profiles[id] ? { ...h, activeProfileId: id } : h);
  const addProfile = (name: string) => commit((h) => addHouseholdProfile(h, name));
  const renameProfile = (id: string, name: string) => commit((h) => renameHouseholdProfile(h, id, name));
  const deleteProfile = (id: string) => commit((h) => removeHouseholdProfile(h, id));

  const active = household.profiles[household.activeProfileId] ?? Object.values(household.profiles)[0];
  const reading = active.modules.reading;
  const math = active.modules.math;
  return <Ctx.Provider value={{
    reading, math, household, activeProfileId: household.activeProfileId,
    updateReading, updateMath, replaceReading, replaceMath, replaceHousehold,
    switchProfile, addProfile, renameProfile, deleteProfile,
    progress: reading, update: updateReading, replace: replaceReading,
  }}>{children}</Ctx.Provider>;
}

export function useStore() {
  const store = useContext(Ctx);
  if (!store) throw new Error('Kite store is not available');
  return store;
}
