import { get, set, del, keys } from 'idb-keyval';

export async function load<T>(key: string, fallback: T): Promise<T> {
  try {
    const v = await get(key);
    return (v as T) ?? fallback;
  } catch {
    return fallback;
  }
}

export async function save<T>(key: string, value: T): Promise<void> {
  try {
    await set(key, value);
  } catch (e) {
    console.warn('save failed', key, e);
  }
}

export async function remove(key: string) {
  try { await del(key); } catch { /* ignore */ }
}

export async function allKeys(): Promise<string[]> {
  try { return (await keys()).map(String); } catch { return []; }
}

export async function requestPersistence() {
  try { await navigator.storage?.persist?.(); } catch { /* ignore */ }
}
