import { freshProgress, migrateProgress, Progress } from '../engine/progress';

export const HOUSEHOLD_VERSION = 1 as const;

export interface LearnerProfile {
  id: string;
  name: string;
  createdAt: string;
  progress: Progress;
}

export interface Household {
  version: typeof HOUSEHOLD_VERSION;
  activeProfileId: string;
  profiles: Record<string, LearnerProfile>;
}

const cleanName = (name: string) => name.trim().slice(0, 40) || 'Child';

export function makeProfile(name: string, id = makeProfileId()): LearnerProfile {
  const n = cleanName(name);
  return { id, name: n, createdAt: new Date().toISOString(), progress: freshProgress(n) };
}

export function makeProfileId() {
  const rand = typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID().slice(0, 8) : Math.random().toString(36).slice(2, 10);
  return `p-${Date.now().toString(36)}-${rand}`;
}

export function householdFromLegacy(raw?: unknown): Household {
  const progress = migrateProgress(raw ?? freshProgress());
  const id = 'p-legacy';
  const name = cleanName(progress.settings.childName || 'Child');
  progress.settings.childName = name;
  return { version: HOUSEHOLD_VERSION, activeProfileId: id, profiles: { [id]: { id, name, createdAt: new Date().toISOString(), progress } } };
}

export function migrateHousehold(raw: unknown, legacy?: unknown): Household {
  if (!raw || typeof raw !== 'object' || !('profiles' in raw)) return householdFromLegacy(legacy);
  const h = raw as Partial<Household> & { profiles?: Record<string, Partial<LearnerProfile>> };
  const profiles: Record<string, LearnerProfile> = {};
  for (const [id, p] of Object.entries(h.profiles ?? {})) {
    const progress = migrateProgress(p.progress);
    const name = cleanName(p.name || progress.settings.childName || 'Child');
    progress.settings.childName = name;
    profiles[id] = { id, name, createdAt: p.createdAt ?? new Date().toISOString(), progress };
  }
  if (!Object.keys(profiles).length) return householdFromLegacy(legacy);
  const activeProfileId = h.activeProfileId && profiles[h.activeProfileId] ? h.activeProfileId : Object.keys(profiles)[0];
  return { version: HOUSEHOLD_VERSION, activeProfileId, profiles };
}

export function addProfile(h: Household, name: string, id = makeProfileId()): Household {
  const profile = makeProfile(name, id);
  return { ...h, activeProfileId: id, profiles: { ...h.profiles, [id]: profile } };
}

export function renameProfile(h: Household, id: string, name: string): Household {
  const old = h.profiles[id];
  if (!old) return h;
  const n = cleanName(name);
  const progress = { ...old.progress, settings: { ...old.progress.settings, childName: n } };
  return { ...h, profiles: { ...h.profiles, [id]: { ...old, name: n, progress } } };
}

export function removeProfile(h: Household, id: string): Household {
  if (!h.profiles[id] || Object.keys(h.profiles).length <= 1) return h;
  const profiles = { ...h.profiles };
  delete profiles[id];
  const activeProfileId = h.activeProfileId === id ? Object.keys(profiles)[0] : h.activeProfileId;
  return { ...h, profiles, activeProfileId };
}
