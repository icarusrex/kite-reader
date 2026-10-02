import { useEffect, useState } from 'react';
import { registerSW } from 'virtual:pwa-register';

/** Keeps the installed app on the newest deploy without clearing anything (clearing site data would wipe
 *  progress). A new version is fetched in the background — checked every 30 minutes and whenever the app
 *  comes back to the front — and applied the next time the child is on a home screen, never mid-lesson.
 *
 *  The app sits behind Cloudflare Access. When that login expires, update checks are bounced to the login
 *  page and fail silently while the offline copy keeps running; `accessExpired` says so, and signIn() opens
 *  the login outside the offline copy. */
type State = { pending: boolean; accessExpired: boolean; checking: boolean; checkedAt?: number };
let state: State = { pending: false, accessExpired: false, checking: false };
const listeners = new Set<(s: State) => void>();
const setState = (patch: Partial<State>) => { state = { ...state, ...patch }; listeners.forEach((l) => l(state)); };

let apply: ((reload?: boolean) => Promise<void>) | null = null;
let registration: ServiceWorkerRegistration | undefined;

async function accessOk(): Promise<boolean> {
  try {
    const r = await fetch('/api/ping', { cache: 'no-store', credentials: 'include', redirect: 'manual' });
    return r.ok;
  } catch { return true; } // offline: not an Access problem
}

export async function checkForUpdate() {
  if (!navigator.onLine) return;
  setState({ checking: true });
  const ok = await accessOk();
  setState({ accessExpired: !ok });
  if (ok) { try { await registration?.update(); } catch { /* next check */ } }
  setState({ checking: false, checkedAt: Date.now() });
}

export function startUpdates() {
  if (!('serviceWorker' in navigator) || apply) return;
  apply = registerSW({
    immediate: true,
    onNeedRefresh: () => setState({ pending: true }),
    onRegisteredSW: (_url, reg) => {
      registration = reg;
      void checkForUpdate();
      window.setInterval(() => void checkForUpdate(), 30 * 60 * 1000);
      document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') void checkForUpdate(); });
      window.addEventListener('online', () => void checkForUpdate());
    },
  });
}

/** Swap to the new version now (the page reloads; progress is already saved). */
export const applyUpdate = () => apply?.(true);
/** The Access login, fetched past the offline copy; the Worker sends it back to the app afterwards. */
export const signIn = () => { window.location.href = '/api/signin'; };

export function useUpdate() {
  const [s, set] = useState(state);
  useEffect(() => { listeners.add(set); return () => { listeners.delete(set); }; }, []);
  return s;
}
