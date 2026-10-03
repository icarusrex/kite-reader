import { MATH_LESSONS, MATH_LESSON_COUNT, mathLessonSkill } from '../content/lessons';
import { MathSkillId, MATH_SKILL_BY_ID } from '../content/skills';
import type { MathProgress, MathSkillState } from './state';
import { MathTask, buildPhysicalTask, modelTask } from './tasks';
import { savedTasks } from './planner';

/** Math progresses exactly like Reading's levels: one current lesson; practise it, pass a checkout, then a
 *  cold check in the next session (same day allowed) passes it and the next lesson opens straight away. */
export type MathLessonStatus = 'locked' | 'active' | 'cold' | 'passed';

export interface MathLessonState {
  status: MathLessonStatus;
  sessions: number;
  checkoutPassedOn?: string;
  passedOn?: string;
  /** Spaced review of a passed lesson, Leitner boxes as in Reading. */
  box?: number;
  due?: string;
}

export type MathLessons = Record<MathSkillId, MathLessonState>;
export type MathPhase = 'main' | 'checkout' | 'cold';

/** Same intervals as Reading's BOX_DAYS. */
export const MATH_BOX_DAYS = [0, 1, 2, 4, 7, 14];
/** Six-task checkout allows one miss; five-task cold check allows one miss (Reading: 0.9 of 10, 0.8 of 5). */
export const MATH_PASS = { checkout: 5 / 6, cold: 0.8 } as const;
export const MATH_TASKS = { main: 6, checkout: 6, cold: 5, reviews: 2 } as const;

const today = () => new Date().toISOString().slice(0, 10);
const addDays = (date: string, n: number) => { const d = new Date(`${date}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };

export function freshMathLessons(): MathLessons {
  return Object.fromEntries(MATH_LESSONS.map((id, i) => [id, { status: i === 0 ? 'active' : 'locked', sessions: 0 }])) as MathLessons;
}

/** Older Math progress had no lessons: secure concepts count as passed, the first other one is current
 *  (straight to its cold check if it was already provisional), the rest wait. */
export function lessonsFromSkills(skills: Partial<Record<MathSkillId, MathSkillState>>, date = today()): MathLessons {
  let current = false;
  return Object.fromEntries(MATH_LESSONS.map((id) => {
    const phase = skills[id]?.phase ?? 'unseen';
    if (phase === 'secure' || phase === 'maintenance') return [id, { status: 'passed', sessions: 1, passedOn: date, box: 1, due: date }];
    if (current) return [id, { status: 'locked', sessions: 0 }];
    current = true;
    return [id, phase === 'provisional' ? { status: 'cold', sessions: 1, checkoutPassedOn: date } : { status: 'active', sessions: phase === 'unseen' ? 0 : 1 }];
  })) as MathLessons;
}

export function normalizeLessons(raw: unknown, skills: Partial<Record<MathSkillId, MathSkillState>>): MathLessons {
  if (!raw || typeof raw !== 'object') return lessonsFromSkills(skills);
  const fresh = freshMathLessons();
  const r = raw as Partial<MathLessons>;
  const lessons = Object.fromEntries(MATH_LESSONS.map((id) => [id, { ...fresh[id], status: 'locked', ...(r[id] ?? {}) }])) as MathLessons;
  // Always exactly one place to continue from, unless everything is passed.
  if (!MATH_LESSONS.some((id) => lessons[id].status === 'active' || lessons[id].status === 'cold')) {
    const next = MATH_LESSONS.find((id) => lessons[id].status !== 'passed');
    if (next) lessons[next] = { ...lessons[next], status: 'active' };
  }
  return lessons;
}

export function currentMathLesson(p: Pick<MathProgress, 'lessons'>): number {
  const i = MATH_LESSONS.findIndex((id) => p.lessons[id].status === 'active' || p.lessons[id].status === 'cold');
  return i < 0 ? MATH_LESSON_COUNT : i + 1;
}

export const mathAllPassed = (p: Pick<MathProgress, 'lessons'>) => MATH_LESSONS.every((id) => p.lessons[id].status === 'passed');
export const mathColdCheckDue = (p: Pick<MathProgress, 'lessons'>, n: number) => p.lessons[mathLessonSkill(n)]?.status === 'cold';

const setLesson = (p: MathProgress, id: MathSkillId, patch: Partial<MathLessonState>): MathProgress =>
  ({ ...p, lessons: { ...p.lessons, [id]: { ...p.lessons[id], ...patch } } });

export function mathPassCheckout(p: MathProgress, n: number, date = today()): MathProgress {
  return setLesson(p, mathLessonSkill(n), { status: 'cold', checkoutPassedOn: date });
}

export function mathPassCold(p: MathProgress, n: number, date = today()): MathProgress {
  let next = setLesson(p, mathLessonSkill(n), { status: 'passed', passedOn: date, box: 1, due: addDays(date, MATH_BOX_DAYS[1]) });
  const following = MATH_LESSONS.slice(n).find((id) => next.lessons[id].status !== 'passed');
  if (following && next.lessons[following].status === 'locked') next = setLesson(next, following, { status: 'active' });
  return next;
}

export function mathFailCold(p: MathProgress, n: number): MathProgress {
  return setLesson(p, mathLessonSkill(n), { status: 'active', checkoutPassedOn: undefined });
}

/** Grown-up "Start here", as Reading's jumpTo: earlier lessons count as passed, later ones wait. */
export function mathJumpTo(p: MathProgress, n: number, date = today()): MathProgress {
  const lessons = Object.fromEntries(MATH_LESSONS.map((id, i) => {
    const old = p.lessons[id];
    if (i + 1 < n) return [id, old.status === 'passed' ? old : { ...old, status: 'passed', passedOn: old.passedOn ?? date, box: old.box ?? 1, due: old.due ?? addDays(date, 1) }];
    if (i + 1 === n) return [id, { ...old, status: 'active', checkoutPassedOn: undefined }];
    return [id, { ...old, status: 'locked', checkoutPassedOn: undefined }];
  })) as MathLessons;
  return { ...p, lessons };
}

export function mathCountSession(p: MathProgress, n: number): MathProgress {
  const id = mathLessonSkill(n);
  return setLesson(p, id, { sessions: (p.lessons[id].sessions ?? 0) + 1 });
}

/** Passed lessons whose review is due, weakest first — Reading's dueItems for lessons. */
export function mathDueReviews(p: MathProgress, date = today(), limit: number = MATH_TASKS.reviews): MathSkillId[] {
  return MATH_LESSONS
    .filter((id) => p.lessons[id].status === 'passed' && (p.lessons[id].due ?? date) <= date)
    .sort((a, b) => (p.lessons[a].box ?? 1) - (p.lessons[b].box ?? 1) || (p.lessons[a].due ?? '').localeCompare(p.lessons[b].due ?? ''))
    .slice(0, limit);
}

/** Reading's recordAnswer, per lesson: right when due moves up a box, wrong goes back to box 1 for tomorrow. */
export function mathRecordReview(p: MathProgress, id: MathSkillId, correct: boolean, date = today()): MathProgress {
  const l = p.lessons[id];
  if (l.status !== 'passed') return p;
  if (!correct) return setLesson(p, id, { box: 1, due: addDays(date, 1) });
  if ((l.due ?? date) > date) return p;
  const box = Math.min((l.box ?? 1) + 1, MATH_BOX_DAYS.length - 1);
  return setLesson(p, id, { box, due: addDays(date, MATH_BOX_DAYS[box]) });
}

// ---- What a session plays ----

const banner = (id: MathSkillId, text: string, emoji: string, phase: MathPhase): MathTask => ({
  ...modelTask(id), model: false, kind: 'banner', prompt: text, bannerEmoji: emoji, phase,
});

/** Practice on the current lesson: its explanation the first time only, spaced review of passed lessons
 *  mixed in, then the lesson's own tasks. */
export function buildLessonMain(p: MathProgress, n: number, date = today()): MathTask[] {
  const id = mathLessonSkill(n);
  const first = (p.lessons[id].sessions ?? 0) === 0 && !p.attempts.some((a) => a.skillId === id);
  const own = savedTasks(p, id, 'independent', MATH_TASKS.main, false).map((t) => ({ ...t, phase: 'main' as const }));
  const reviews = mathDueReviews(p, date).flatMap((rid) => savedTasks(p, rid, 'independent', 1, false)).map((t) => ({ ...t, phase: 'main' as const, review: true }));
  const mixed = [...own];
  reviews.forEach((r, i) => mixed.splice(Math.min(mixed.length, 1 + i * 3), 0, r));
  // "Physical-world prompts" (Grown-ups > Math): every third session of a lesson ends with real objects, when the concept has one.
  const physical = p.settings.physicalPrompts && (p.lessons[id].sessions ?? 0) % 3 === 2 ? buildPhysicalTask(id) : null;
  if (physical) mixed.push({ ...physical, phase: 'main' });
  return [...(first ? [{ ...modelTask(id), phase: 'main' as const }] : []), ...mixed];
}

export function buildLessonCheck(p: MathProgress, n: number, phase: 'checkout' | 'cold'): MathTask[] {
  const id = mathLessonSkill(n);
  const head = phase === 'checkout' ? banner(id, 'Now show me what you know!', '⭐', phase) : banner(id, 'Do you remember this one?', '🧠', phase);
  return [head, ...savedTasks(p, id, phase === 'cold' ? 'cold' : 'independent', MATH_TASKS[phase], false).map((t) => ({ ...t, phase }))];
}

export function lessonDoneBanner(n: number): MathTask {
  return banner(mathLessonSkill(n), 'You finished a lesson! Here comes a new one.', '🎉', 'main');
}

export function passesMath(phase: 'checkout' | 'cold', answered: number, correct: number) {
  return answered > 0 && correct / answered >= MATH_PASS[phase] - 1e-9;
}

export const mathLessonTitle = (n: number) => MATH_SKILL_BY_ID[mathLessonSkill(n)].title;
