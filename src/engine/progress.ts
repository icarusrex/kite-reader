import { MAX_LEVEL } from '../content/levels';

// Leitner intervals in days per box (box index 0..5)
export const BOX_DAYS = [0, 1, 2, 4, 7, 14];

export type ItemKind = 'grapheme' | 'word';

export interface ItemState {
  id: string;          // e.g. "g:m" or "w:sat"
  kind: ItemKind;
  box: number;
  due: string;         // YYYY-MM-DD
  seen: number;
  correct: number;
  wrong: number;
}

export type LevelStatus = 'locked' | 'active' | 'cold' | 'passed';

export interface LevelState {
  status: LevelStatus;
  sessions: number;      // sessions spent practicing this level
  checkoutPassedOn?: string;
  passedOn?: string;
}

export interface SessionLog {
  date: string;
  level: number;
  activeSeconds: number;
  answered: number;
  correct: number;
  endedBy: 'cap' | 'complete' | 'fatigue' | 'parent';
}

export interface Settings {
  childName: string;
  capMinutes: number;
  parentScoring: boolean;
  readinessPassed: boolean | null;
  micSensitivity: number; // 1..5
}

export interface Progress {
  version: 1;
  settings: Settings;
  levels: Record<number, LevelState>;
  items: Record<string, ItemState>;
  sessions: SessionLog[];
  errors: Record<string, number>; // trouble spots, e.g. "g:d" -> count
}

export const today = (d = new Date()) => {
  const z = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return z.toISOString().slice(0, 10);
};

export const addDays = (date: string, n: number) => {
  const d = new Date(date + 'T12:00:00');
  d.setDate(d.getDate() + n);
  return today(d);
};

export function freshProgress(): Progress {
  const levels: Record<number, LevelState> = {};
  for (let n = 1; n <= MAX_LEVEL; n++) levels[n] = { status: n === 1 ? 'active' : 'locked', sessions: 0 };
  return {
    version: 1,
    settings: { childName: '', capMinutes: 15, parentScoring: true, readinessPassed: null, micSensitivity: 3 },
    levels,
    items: {},
    sessions: [],
    errors: {},
  };
}

export function currentLevel(p: Progress): number {
  for (let n = 1; n <= MAX_LEVEL; n++) {
    const s = p.levels[n]?.status;
    if (s === 'active' || s === 'cold') return n;
  }
  return MAX_LEVEL;
}

export function allPassed(p: Progress) {
  return Object.values(p.levels).every((l) => l.status === 'passed');
}

/** Record an answer for an item. Returns new progress (mutates copy). */
export function recordAnswer(p: Progress, id: string, kind: ItemKind, correct: boolean, date = today()): Progress {
  const prev = p.items[id] ?? { id, kind, box: 0, due: date, seen: 0, correct: 0, wrong: 0 };
  const next: ItemState = { ...prev, seen: prev.seen + 1 };
  if (correct) {
    next.correct += 1;
    // Only promote once per day: if already promoted today (due in future), keep box.
    if (prev.due <= date) {
      next.box = Math.min(prev.box + 1, BOX_DAYS.length - 1);
      next.due = addDays(date, BOX_DAYS[next.box]);
    }
  } else {
    next.wrong += 1;
    next.box = 1;
    next.due = addDays(date, 1);
  }
  const errors = { ...p.errors };
  if (!correct) errors[id] = (errors[id] ?? 0) + 1;
  return { ...p, items: { ...p.items, [id]: next }, errors };
}

export function dueItems(p: Progress, date = today(), limit = 6): ItemState[] {
  return Object.values(p.items)
    .filter((i) => i.due <= date && i.seen > 0)
    .sort((a, b) => a.box - b.box || a.due.localeCompare(b.due))
    .slice(0, limit);
}

export function passCheckout(p: Progress, level: number, date = today()): Progress {
  const levels = { ...p.levels, [level]: { ...p.levels[level], status: 'cold' as const, checkoutPassedOn: date } };
  return { ...p, levels };
}

/** Cold check (next day) passed: level done, unlock next. */
export function passCold(p: Progress, level: number, date = today()): Progress {
  const levels = { ...p.levels, [level]: { ...p.levels[level], status: 'passed' as const, passedOn: date } };
  if (levels[level + 1] && levels[level + 1].status === 'locked') levels[level + 1] = { ...levels[level + 1], status: 'active' };
  return { ...p, levels };
}

export function failCold(p: Progress, level: number): Progress {
  const levels = { ...p.levels, [level]: { ...p.levels[level], status: 'active' as const, checkoutPassedOn: undefined } };
  return { ...p, levels };
}

/** Parent test-out / jump: mark all levels below n passed, n active. */
export function jumpTo(p: Progress, n: number, date = today()): Progress {
  const levels: Record<number, LevelState> = {};
  for (let i = 1; i <= MAX_LEVEL; i++) {
    const old = p.levels[i] ?? { sessions: 0 };
    levels[i] = i < n ? { ...old, status: 'passed', passedOn: old.passedOn ?? date } : i === n ? { ...old, status: 'active' } : { ...old, status: 'locked' };
  }
  return { ...p, levels };
}

export function coldCheckDue(p: Progress, level: number, date = today()) {
  const l = p.levels[level];
  return l?.status === 'cold' && !!l.checkoutPassedOn && l.checkoutPassedOn < date;
}
