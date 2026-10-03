/**
 * Cloud copy of learner progress (worker/progress.ts → D1). The device copy in IndexedDB stays the working copy,
 * so the app is instant and works offline; this mirrors each learner profile to the server and back.
 *  - Clearing the browser, reinstalling, or a new tablet: the profiles come back from the server on next load.
 *  - Each profile carries the server `rev` it was last synced at. A save names that rev; if another device saved
 *    in between, the server refuses (409) and the copy with more learning in it wins. The other copy is kept on the
 *    server as a conflict snapshot, so nothing is thrown away.
 *  - Which learner is active stays per device.
 */
import { useEffect, useState } from 'react';
import { get, set } from 'idb-keyval';
import type { Household, LearnerProfile } from './household';
import { parseBackup } from './backup';

const META_KEY = 'kite:sync';

export interface SyncMeta {
  /** Server rev each profile was last synced at; `dirty` = changed on this device since. */
  profiles: Record<string, { rev: number; dirty: boolean }>;
  /** Profiles deleted on this device whose deletion hasn't reached the server yet (id → rev). */
  deleted: Record<string, number>;
}
export interface ServerProfile { id: string; rev: number; deleted: boolean; updatedAt: string; data: unknown }

export const emptyMeta = (): SyncMeta => ({ profiles: {}, deleted: {} });

/** How much learning a profile holds: decides which copy wins a conflict. */
export function learningIn(p: LearnerProfile): number {
  const r = p.modules.reading, m = p.modules.math;
  return r.sessions.length + m.sessions.length + m.attempts.length + Object.values(r.items).reduce((n, i) => n + i.seen, 0)
    + Object.values(r.basics ?? {}).reduce((n, b) => n + (b?.sessions ?? 0), 0);
}

/** A server copy as a valid, migrated profile, or null when this app version can't read it. */
export function readServerProfile(s: ServerProfile): LearnerProfile | null {
  try {
    const parsed = parseBackup({ version: 3, activeProfileId: s.id, profiles: { [s.id]: s.data } });
    return parsed.kind === 'household' ? parsed.household.profiles[s.id] ?? null : null;
  } catch { return null; }
}

export interface MergeResult {
  household: Household;
  meta: SyncMeta;
  /** Profiles to upload, with the rev the server must still be at. */
  push: { id: string; baseRev: number }[];
  /** Copies that lost a conflict: kept on the server, not on the device. */
  losers: LearnerProfile[];
}

/** Combine the device household with the server's profiles. Pure, so the rules are unit-tested. */
export function merge(local: Household, metaIn: SyncMeta, server: ServerProfile[], firstSync: boolean): MergeResult {
  const meta: SyncMeta = { profiles: { ...metaIn.profiles }, deleted: { ...metaIn.deleted } };
  const profiles = { ...local.profiles };
  const push: MergeResult['push'] = [];
  const losers: LearnerProfile[] = [];
  const onServer = new Map(server.map((s) => [s.id, s]));

  for (const s of server) {
    const mine = profiles[s.id];
    const m = meta.profiles[s.id];
    if (s.deleted) {
      if (!mine) { delete meta.profiles[s.id]; continue; }
      // Deleted elsewhere: follow, unless this device has unsynced learning for that child (then bring it back).
      if ((m && !m.dirty) || (!m && learningIn(mine) === 0)) { delete profiles[s.id]; delete meta.profiles[s.id]; }
      else push.push({ id: s.id, baseRev: s.rev });
      continue;
    }
    const theirs = readServerProfile(s);
    if (!theirs) continue; // written by a newer app version: leave both copies alone until this device updates
    if (!mine) {
      if (s.id in meta.deleted) continue; // deleted here; the deletion is on its way up
      profiles[s.id] = theirs; meta.profiles[s.id] = { rev: s.rev, dirty: false };
      continue;
    }
    if (m && !m.dirty) {
      if (s.rev > m.rev) { profiles[s.id] = theirs; meta.profiles[s.id] = { rev: s.rev, dirty: false }; }
      continue;
    }
    if (m && m.dirty && s.rev === m.rev) { push.push({ id: s.id, baseRev: s.rev }); continue; }
    // Both changed (or this device never synced this profile): keep the copy with more learning in it.
    if (learningIn(mine) > learningIn(theirs)) { losers.push(theirs); push.push({ id: s.id, baseRev: s.rev }); meta.profiles[s.id] = { rev: s.rev, dirty: true }; }
    else { if (learningIn(mine) > 0) losers.push(mine); profiles[s.id] = theirs; meta.profiles[s.id] = { rev: s.rev, dirty: false }; }
  }

  const serverHasLearners = server.some((s) => !s.deleted);
  for (const [id, p] of Object.entries(local.profiles)) {
    if (onServer.has(id)) continue;
    // A fresh device starts with an empty "Child"; once the real learners arrive from the server, it goes.
    if (firstSync && serverHasLearners && learningIn(p) === 0) { delete profiles[id]; delete meta.profiles[id]; continue; }
    meta.profiles[id] = { rev: 0, dirty: true };
    push.push({ id, baseRev: 0 });
  }
  for (const id of Object.keys(meta.deleted)) if (!onServer.has(id) || onServer.get(id)!.deleted) delete meta.deleted[id];

  if (!Object.keys(profiles).length) return { household: local, meta: metaIn, push: [], losers: [] };
  const activeProfileId = profiles[local.activeProfileId] ? local.activeProfileId : Object.keys(profiles)[0];
  return { household: { ...local, activeProfileId, profiles }, meta, push, losers };
}

/* ---------- running it ---------- */

export type SyncStatus = { state: 'off' | 'syncing' | 'synced' | 'offline' | 'signed-out' | 'error'; at?: number };
let status: SyncStatus = { state: 'off' };
const listeners = new Set<(s: SyncStatus) => void>();
const setStatus = (s: SyncStatus) => { status = s; listeners.forEach((l) => l(s)); };
export function useSyncStatus() {
  const [s, setS] = useState(status);
  useEffect(() => { listeners.add(setS); return () => { listeners.delete(setS); }; }, []);
  return s;
}

class HttpError extends Error { constructor(public status: number) { super(`HTTP ${status}`); } }
async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const r = await fetch(path, { credentials: 'include', redirect: 'manual', cache: 'no-store', ...init, headers: { 'Content-Type': 'application/json', ...init?.headers } });
  // An expired Cloudflare Access login answers with a redirect to its login page (opaque under redirect: 'manual').
  if (r.type === 'opaqueredirect' || r.status === 401 || r.status === 403) throw new HttpError(401);
  if (r.status === 409) throw Object.assign(new HttpError(409), { body: await r.json() });
  if (!r.ok) throw new HttpError(r.status);
  return r.json();
}

interface Hooks { get: () => Household; apply: (h: Household) => void }
let hooks: Hooks | null = null;
let meta: SyncMeta | null = null;
let firstSync = true;
let metaLoaded = false;
let running: Promise<void> | null = null;
let again = false;
let timer: number | undefined;

const saveMeta = () => meta && set(META_KEY, meta).catch(() => {});

async function syncOnce() {
  if (!hooks) return;
  if (!navigator.onLine) { setStatus({ state: 'offline', at: status.at }); return; }
  setStatus({ state: 'syncing', at: status.at });
  meta ??= emptyMeta();
  try {
    for (const [id, rev] of Object.entries(meta.deleted)) {
      try { await api(`/api/profiles/${id}`, { method: 'DELETE', body: JSON.stringify({ baseRev: rev }) }); } catch (e) { if ((e as HttpError).status !== 409) throw e; }
    }
    const { profiles } = await api<{ profiles: ServerProfile[] }>('/api/profiles');
    const before = hooks.get();
    const r = merge(before, meta, profiles, firstSync);
    meta = r.meta;
    if (r.household !== before) hooks.apply(r.household);
    await saveMeta();
    for (const loser of r.losers) await api(`/api/profiles/${loser.id}/conflict`, { method: 'POST', body: JSON.stringify({ data: loser }) }).catch(() => {});
    for (const { id, baseRev } of r.push) {
      const p = hooks.get().profiles[id];
      if (!p) continue;
      const sent = p;
      try {
        const { rev } = await api<{ rev: number }>(`/api/profiles/${id}`, { method: 'PUT', body: JSON.stringify({ baseRev, data: p }) });
        // Still dirty if the child carried on while this was uploading.
        meta.profiles[id] = { rev, dirty: hooks.get().profiles[id] !== sent };
      } catch (e) { if ((e as HttpError).status === 409) again = true; else throw e; }
    }
    firstSync = false;
    await saveMeta();
    setStatus({ state: 'synced', at: Date.now() });
  } catch (e) {
    setStatus({ state: (e as HttpError).status === 401 ? 'signed-out' : navigator.onLine ? 'error' : 'offline', at: status.at });
  }
}

/** Sync now (coalesces: a request while one is running runs once more afterwards). */
export function syncNow(): Promise<void> {
  if (running) { again = true; return running; }
  running = (async () => {
    do { again = false; await syncOnce(); } while (again && status.state === 'synced');
  })().finally(() => { running = null; });
  return running;
}

/** Called by the store after every change: marks changed/deleted profiles and uploads shortly after. */
export function noteChange(before: Household, next: Household) {
  if (!metaLoaded) return;
  meta ??= emptyMeta();
  for (const [id, p] of Object.entries(next.profiles)) {
    if (before.profiles[id] !== p) meta.profiles[id] = { rev: meta.profiles[id]?.rev ?? 0, dirty: true };
  }
  for (const id of Object.keys(before.profiles)) {
    if (!next.profiles[id]) { const rev = meta.profiles[id]?.rev; delete meta.profiles[id]; if (rev) meta.deleted[id] = rev; }
  }
  void saveMeta();
  window.clearTimeout(timer);
  timer = window.setTimeout(() => void syncNow(), 2000);
}

/** Restore when this device's copy can't be read at all: the server's profiles, or null. */
export async function fetchServerHousehold(): Promise<Household | null> {
  try {
    const { profiles } = await api<{ profiles: ServerProfile[] }>('/api/profiles');
    const live = profiles.filter((p) => !p.deleted).map(readServerProfile).filter((p): p is LearnerProfile => !!p);
    if (!live.length) return null;
    meta = { profiles: Object.fromEntries(profiles.filter((p) => !p.deleted).map((p) => [p.id, { rev: p.rev, dirty: false }])), deleted: {} };
    firstSync = false;
    await saveMeta();
    return { version: 3, activeProfileId: live[0].id, profiles: Object.fromEntries(live.map((p) => [p.id, p])) };
  } catch { return null; }
}

/** Read this device's sync record. The store awaits it before showing anything, so no change goes unmarked. */
export async function loadSyncMeta() {
  if (metaLoaded) return;
  const stored = await get<SyncMeta>(META_KEY).catch(() => undefined);
  if (stored) { meta = stored; firstSync = false; }
  metaLoaded = true;
}

export function startSync(h: Hooks) {
  if (hooks) { hooks = h; return; }
  hooks = h;
  void syncNow();
  document.addEventListener('visibilitychange', () => { void syncNow(); }); // pull on return, push on leaving
  window.addEventListener('online', () => void syncNow());
  window.setInterval(() => void syncNow(), 5 * 60 * 1000);
}
