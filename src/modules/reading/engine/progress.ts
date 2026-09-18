import { LEVELS, MAX_LEVEL } from '../content/levels';
import { BASICS } from '../content/basics';

export const SCHEMA_VERSION = 2 as const;
export const CURRICULUM_VERSION = 'reading-2026-09-18-v2';

// Leitner intervals in days per box (box index 0..5)
export const BOX_DAYS = [0, 1, 2, 4, 7, 14];

export type ItemKind = 'grapheme' | 'word';

export interface ItemState {
  id: string;
  kind: ItemKind;
  box: number;
  due: string;
  seen: number;
  correct: number;
  wrong: number;
}

export type LevelStatus = 'locked' | 'active' | 'cold' | 'passed';

export interface LevelState {
  status: LevelStatus;
  sessions: number;
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
  basics?: number;
  practice?: boolean;
}

export interface ReadinessResult {
  date: string;
  blending: number;
  tracking: number;
}

export interface Settings {
  childName: string;
  capMinutes: number;
  parentScoring: boolean;
  readinessPassed: boolean | null;
  micSensitivity: number;
  rev?: number;
}

export interface BasicsState { status: 'locked' | 'active' | 'passed'; sessions: number; passedOn?: string }

export interface Progress {
  version: typeof SCHEMA_VERSION;
  curriculumVersion: string;
  track: 'basics' | 'levels';
  basics: Record<number, BasicsState>;
  settings: Settings;
  levels: Record<number, LevelState>;
  items: Record<string, ItemState>;
  sessions: SessionLog[];
  errors: Record<string, number>;
  readAloud: Record<string, { chapter: number; date: string }[]>;
  readiness?: ReadinessResult;
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

export function freshProgress(childName = ''): Progress {
  const levels: Record<number, LevelState> = {};
  for (let n = 1; n <= MAX_LEVEL; n++) levels[n] = { status: n === 1 ? 'active' : 'locked', sessions: 0 };
  return {
    version: SCHEMA_VERSION,
    curriculumVersion: CURRICULUM_VERSION,
    track: 'basics',
    basics: freshBasics(),
    settings: { childName, capMinutes: 10, parentScoring: false, readinessPassed: null, micSensitivity: 3, rev: 2 },
    levels,
    items: {},
    sessions: [],
    errors: {},
    readAloud: {},
  };
}

/** Upgrade a legacy single-child progress object without throwing away learning history. */
export function migrateProgress(raw: unknown): Progress {
  const p = (raw && typeof raw === 'object' ? raw : {}) as Partial<Progress> & { settings?: Partial<Settings> };
  const base = freshProgress(p.settings?.childName ?? '');
  const levels: Record<number, LevelState> = { ...(p.levels ?? {}) } as Record<number, LevelState>;
  for (let n = 1; n <= MAX_LEVEL; n++) {
    if (!levels[n]) levels[n] = { status: levels[n - 1]?.status === 'passed' ? 'active' : 'locked', sessions: 0 };
  }
  const passedAny = Object.values(levels).some((l) => l.status === 'passed');
  const track = p.track ?? (passedAny ? 'levels' : 'basics');
  const basics = { ...freshBasics(), ...(p.basics ?? {}) };
  const settings: Settings = { ...base.settings, ...(p.settings ?? {}) };
  if (!p.track && settings.capMinutes === 15) settings.capMinutes = 10;
  settings.rev = Math.max(settings.rev ?? 0, 2);
  return {
    ...base,
    ...p,
    version: SCHEMA_VERSION,
    curriculumVersion: CURRICULUM_VERSION,
    track,
    basics,
    settings,
    levels,
    items: p.items ?? {},
    sessions: p.sessions ?? [],
    errors: p.errors ?? {},
    readAloud: p.readAloud ?? {},
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
  return Array.from({ length: MAX_LEVEL }, (_, i) => p.levels[i + 1]).every((l) => l?.status === 'passed');
}

export function recordAnswer(p: Progress, id: string, kind: ItemKind, correct: boolean, date = today()): Progress {
  const prev = p.items[id] ?? { id, kind, box: 0, due: date, seen: 0, correct: 0, wrong: 0 };
  const next: ItemState = { ...prev, seen: prev.seen + 1 };
  if (correct) {
    next.correct += 1;
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
  return { ...p, levels: { ...p.levels, [level]: { ...p.levels[level], status: 'cold', checkoutPassedOn: date } } };
}

export function passCold(p: Progress, level: number, date = today()): Progress {
  const levels = { ...p.levels, [level]: { ...p.levels[level], status: 'passed' as const, passedOn: date } };
  if (levels[level + 1] && levels[level + 1].status === 'locked') levels[level + 1] = { ...levels[level + 1], status: 'active' };
  return { ...p, levels };
}

export function failCold(p: Progress, level: number): Progress {
  return { ...p, levels: { ...p.levels, [level]: { ...p.levels[level], status: 'active', checkoutPassedOn: undefined } } };
}

export function jumpTo(p: Progress, n: number, date = today()): Progress {
  const levels: Record<number, LevelState> = {};
  for (let i = 1; i <= MAX_LEVEL; i++) {
    const old: LevelState = p.levels[i] ?? { status: 'locked', sessions: 0 };
    levels[i] = i < n ? { ...old, status: 'passed', passedOn: old.passedOn ?? date } : i === n ? { ...old, status: 'active' } : { ...old, status: 'locked' };
  }
  // Test-out means prerequisite heart words are known too; otherwise learner-aware text filtering would contradict the jump.
  const items = { ...p.items };
  for (const level of LEVELS.filter((l) => l.n < n)) for (const word of level.heartWords) {
    const id = `h:${word}`;
    if (!items[id]) items[id] = { id, kind: 'word', box: 3, due: addDays(date, 4), seen: 1, correct: 1, wrong: 0 };
  }
  return { ...p, track: 'levels', levels, items };
}

export function coldCheckDue(p: Progress, level: number, date = today()) {
  const l = p.levels[level];
  return l?.status === 'cold' && !!l.checkoutPassedOn && l.checkoutPassedOn < date;
}

export function freshBasics(): Record<number, BasicsState> {
  return Object.fromEntries(BASICS.map((b) => [b.n, { status: b.n === 1 ? 'active' : 'locked', sessions: 0 }])) as Record<number, BasicsState>;
}

export function currentBasics(p: Progress): number {
  return BASICS.find((b) => p.basics[b.n]?.status === 'active')?.n ?? BASICS[BASICS.length - 1].n;
}

export function passBasics(p: Progress, n: number, date = today()): Progress {
  const basics = { ...p.basics, [n]: { ...p.basics[n], status: 'passed' as const, passedOn: date } };
  const next = BASICS.find((b) => b.n > n);
  if (next) basics[next.n] = { ...basics[next.n], status: 'active' };
  return { ...p, basics, track: next ? p.track : 'levels' };
}

export function setTrack(p: Progress, track: Progress['track'], basicsLesson = 1): Progress {
  if (track === 'levels') return { ...p, track };
  const basics = Object.fromEntries(BASICS.map((b) => [b.n, { ...(p.basics[b.n] ?? { sessions: 0 }), status: b.n < basicsLesson ? 'passed' : b.n === basicsLesson ? 'active' : 'locked' }])) as Record<number, BasicsState>;
  return { ...p, track, basics };
}
