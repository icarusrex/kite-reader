import {
  MathErrorCode,
  MathRepresentation,
  MathResponseDirection,
  MathSkillId,
  MathTaskFamily,
  MATH_SKILL_BY_ID,
  MATH_SKILLS,
} from '../content/skills';
import { MathLessons, freshMathLessons, normalizeLessons } from './lessons';

export const MATH_SCHEMA_VERSION = 1 as const;
export const MATH_CURRICULUM_VERSION = 'math-2026-09-18-v1';

export type MathSkillPhase = 'unseen' | 'introduced' | 'practicing' | 'provisional' | 'secure' | 'maintenance';
export type MathEvidenceKind = 'guided' | 'independent' | 'cold' | 'transfer' | 'physical';
export type MathHelpLevel = 'none' | 'neutral_repeat' | 'scaffold' | 'modeled';
export type MathSessionMode = 'guided' | 'practice' | 'explore';
export type MathStrategyCode = 'count_all' | 'count_on' | 'subitize' | 'decompose' | 'finger_representation' | 'one_to_one_match' | 'guess';

export interface MathAttempt {
  id: string;
  sessionId: string;
  skillId: MathSkillId;
  taskFamily: MathTaskFamily;
  representation: MathRepresentation;
  responseDirection: MathResponseDirection;
  evidenceKind: MathEvidenceKind;
  correct: boolean;
  helpLevel: MathHelpLevel;
  errorCode?: MathErrorCode;
  strategyCode?: MathStrategyCode;
  occurredAt: string;
  /** Actual assessed quantity; absent in older evidence. */
  target?: number;
}

export interface MathSkillState {
  skillId: MathSkillId;
  phase: MathSkillPhase;
  representationCoverage: MathRepresentation[];
  directionCoverage: MathResponseDirection[];
  independentEvidence: number;
  delayedEvidence: number;
  transferEvidence: number;
  physicalEvidence: number;
  unresolvedErrors: MathErrorCode[];
  lastEvidenceAt?: string;
  nextReviewAt?: string;
  provisionalAt?: string;
  /** Session in which the concept went provisional; the cold check must come from a later one. */
  provisionalSessionId?: string;
  securedAt?: string;
  needsCoverageCheck?: boolean;
  reviewFailures?: Pick<MathAttempt, 'target' | 'taskFamily' | 'responseDirection' | 'sessionId' | 'occurredAt'>[];
}

export interface MathSessionLog {
  id: string;
  date: string;
  mode: MathSessionMode;
  skillIds: MathSkillId[];
  /** The concept the session was actually built around. Optional because
   *  sessions logged before this field existed do not carry it. */
  primarySkillId?: MathSkillId;
  activeSeconds: number;
  attempts: number;
}

export interface MathSettings {
  capMinutes: number;
  physicalPrompts: boolean;
}

export interface MathProgress {
  version: typeof MATH_SCHEMA_VERSION;
  curriculumVersion: string;
  /** The child's path: numbered lessons, as in Reading. Skills/attempts below are the evidence record. */
  lessons: MathLessons;
  skills: Record<MathSkillId, MathSkillState>;
  attempts: MathAttempt[];
  sessions: MathSessionLog[];
  settings: MathSettings;
}

const dateOnly = (iso = new Date().toISOString()) => iso.slice(0, 10);
export const mathToday = () => dateOnly();

export function mathAddDays(date: string, days: number) {
  const d = new Date(`${date.slice(0, 10)}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function mathDaysBetween(a: string, b: string) {
  const aa = new Date(`${a.slice(0, 10)}T12:00:00Z`).getTime();
  const bb = new Date(`${b.slice(0, 10)}T12:00:00Z`).getTime();
  return Math.floor((bb - aa) / 864e5);
}

export function freshMathSkillState(skillId: MathSkillId): MathSkillState {
  return {
    skillId,
    phase: 'unseen',
    representationCoverage: [],
    directionCoverage: [],
    independentEvidence: 0,
    delayedEvidence: 0,
    transferEvidence: 0,
    physicalEvidence: 0,
    unresolvedErrors: [],
  };
}

export function freshMathProgress(): MathProgress {
  return {
    version: MATH_SCHEMA_VERSION,
    curriculumVersion: MATH_CURRICULUM_VERSION,
    lessons: freshMathLessons(),
    skills: Object.fromEntries(MATH_SKILLS.map((s) => [s.id, freshMathSkillState(s.id)])) as Record<MathSkillId, MathSkillState>,
    attempts: [],
    sessions: [],
    settings: { capMinutes: 8, physicalPrompts: true },
  };
}

export function migrateMathProgress(raw: unknown): MathProgress {
  const base = freshMathProgress();
  if (!raw || typeof raw !== 'object') return base;
  const p = raw as Partial<MathProgress>;
  const skills = { ...base.skills };
  for (const spec of MATH_SKILLS) {
    const old = p.skills?.[spec.id];
    if (old) {
      skills[spec.id] = { ...freshMathSkillState(spec.id), ...old, skillId: spec.id };
      // Cold checks used to wait three days; one already scheduled that way is due now instead.
      const s = skills[spec.id];
      if (s.phase === 'provisional' && s.provisionalAt && s.nextReviewAt && s.nextReviewAt > s.provisionalAt.slice(0, 10)) s.nextReviewAt = s.provisionalAt.slice(0, 10);
      if (spec.id === 'num.map.numeral.1_5' && ['secure', 'maintenance'].includes(old.phase)) {
        skills[spec.id].needsCoverageCheck = !hasNumeralCoverage((p.attempts ?? []).filter(a => a?.skillId === spec.id));
      }
    }
  }
  return {
    ...base,
    ...p,
    version: MATH_SCHEMA_VERSION,
    curriculumVersion: MATH_CURRICULUM_VERSION,
    skills,
    lessons: normalizeLessons(p.lessons, p.skills ? skills : {}),
    attempts: Array.isArray(p.attempts) ? p.attempts.filter((a): a is MathAttempt => !!a && typeof a === 'object' && 'skillId' in a) : [],
    sessions: Array.isArray(p.sessions) ? p.sessions : [],
    settings: { ...base.settings, ...(p.settings ?? {}) },
  };
}

const isIndependentQuality = (a: MathAttempt) =>
  a.helpLevel === 'none' && (a.evidenceKind === 'independent' || a.evidenceKind === 'cold' || a.evidenceKind === 'transfer' || a.evidenceKind === 'physical');

export function hasNumeralCoverage(attempts: MathAttempt[]) {
  const known = new Set(attempts.filter(a => a.correct && isIndependentQuality(a)).map(a => `${a.target}:${a.responseDirection}`));
  return [1, 2, 3, 4, 5].every(n => ['symbol_to_quantity', 'quantity_to_symbol'].every(direction => known.has(`${n}:${direction}`)));
}

function unresolvedErrors(attempts: MathAttempt[]): MathErrorCode[] {
  const latestWrong = new Map<MathErrorCode, number>();
  attempts.forEach((a, i) => { if (!a.correct && a.errorCode) latestWrong.set(a.errorCode, i); });
  return [...latestWrong.entries()]
    .filter(([, i]) => !attempts.slice(i + 1).some((a) => a.correct && a.helpLevel === 'none'))
    .map(([code]) => code);
}

const isDelayedKind = (a: MathAttempt) => a.evidenceKind === 'cold' || a.evidenceKind === 'transfer' || a.evidenceKind === 'physical';

/** Correct, unhelped cold answers needed in one later session to go secure. Two rather than one so a
 *  single lucky tap on a three-option question cannot certify a concept. */
export const MATH_COLD_CHECK_ANSWERS = 2;

function nextReviewFor(phase: MathSkillPhase, when: string) {
  if (phase === 'introduced' || phase === 'practicing') return mathAddDays(when, 1);
  // The cold check is due straight away: it runs in the next session, the same day if the child keeps going.
  if (phase === 'provisional') return mathAddDays(when, 0);
  if (phase === 'secure') return mathAddDays(when, 21);
  if (phase === 'maintenance') return mathAddDays(when, 60);
  return undefined;
}

function evaluateSkill(previous: MathSkillState, attempts: MathAttempt[], newest: MathAttempt): MathSkillState {
  const independent = attempts.filter(isIndependentQuality);
  const last5 = independent.slice(-5);
  const correctIndependent = independent.filter((a) => a.correct);
  const forms = new Set(correctIndependent.map((a) => `${a.taskFamily}:${a.representation}:${a.responseDirection}`));
  const sessions = new Set(correctIndependent.map((a) => a.sessionId));
  const formsRequired = MATH_SKILL_BY_ID[previous.skillId].minFormsForProvisional ?? 2;
  const qualifiesProvisional = last5.length >= 5 && last5.filter((a) => a.correct).length >= 4 && forms.size >= formsRequired && sessions.size >= 2;

  const coverageComplete = previous.skillId !== 'num.map.numeral.1_5' || hasNumeralCoverage(attempts);
  let phase: MathSkillPhase = attempts.length ? (independent.length ? 'practicing' : 'introduced') : 'unseen';
  let provisionalAt = previous.provisionalAt;
  let provisionalSessionId = previous.provisionalSessionId;
  let securedAt = previous.securedAt;

  if (previous.phase === 'secure' || previous.phase === 'maintenance') phase = previous.phase;
  else if (previous.phase === 'provisional' || qualifiesProvisional) {
    phase = 'provisional';
    if (!provisionalAt) { provisionalAt = newest.occurredAt; provisionalSessionId = newest.sessionId; }
    // Older evidence did not record the session; recover it from the attempt that crossed the line.
    if (!provisionalSessionId) {
      const before = attempts.slice(0, -1).filter((a) => a.occurredAt <= provisionalAt!);
      provisionalSessionId = before[before.length - 1]?.sessionId;
    }
    // Like Reading's cold check: a later session on any day, not a calendar wait. Every cold answer in
    // that session must be right and unhelped.
    const check = attempts.filter((a) => a.sessionId === newest.sessionId && isDelayedKind(a));
    const passedCheck = isDelayedKind(newest) && newest.sessionId !== provisionalSessionId
      && check.filter((a) => a.correct && a.helpLevel === 'none').length >= MATH_COLD_CHECK_ANSWERS
      && check.every((a) => a.correct && a.helpLevel === 'none');
    if (coverageComplete && passedCheck) {
      phase = 'secure';
      securedAt = newest.occurredAt;
    }
  }

  let reviewFailures = [...(previous.reviewFailures ?? [])];
  if (previous.phase === 'secure' || previous.phase === 'maintenance') {
    const sameConcept = (a: typeof reviewFailures[number]) => a.target === newest.target && a.taskFamily === newest.taskFamily && a.responseDirection === newest.responseDirection;
    if (!newest.correct || !isIndependentQuality(newest)) {
      reviewFailures = reviewFailures.filter(a => !sameConcept(a));
      reviewFailures.push({ target: newest.target, taskFamily: newest.taskFamily, responseDirection: newest.responseDirection, sessionId: newest.sessionId, occurredAt: newest.occurredAt });
    } else {
      reviewFailures = reviewFailures.filter(a => !(sameConcept(a) && a.sessionId !== newest.sessionId && mathDaysBetween(a.occurredAt, newest.occurredAt) >= 1));
    }
  }
  if (previous.phase === 'secure' && !reviewFailures.length && newest.correct && isIndependentQuality(newest) && previous.securedAt && mathDaysBetween(previous.securedAt, newest.occurredAt) >= 21) {
    phase = 'maintenance';
  }

  const reps = new Set(correctIndependent.map((a) => a.representation));
  const dirs = new Set(correctIndependent.map((a) => a.responseDirection));
  const lastEvidenceAt = newest.occurredAt;

  return {
    skillId: previous.skillId,
    phase,
    representationCoverage: [...reps],
    directionCoverage: [...dirs],
    independentEvidence: correctIndependent.length,
    delayedEvidence: correctIndependent.filter((a) => a.evidenceKind === 'cold').length,
    transferEvidence: correctIndependent.filter((a) => a.evidenceKind === 'transfer').length,
    physicalEvidence: correctIndependent.filter((a) => a.evidenceKind === 'physical').length,
    unresolvedErrors: unresolvedErrors(attempts),
    lastEvidenceAt,
    nextReviewAt: reviewFailures.length
      ? (previous.nextReviewAt && previous.reviewFailures?.length && previous.nextReviewAt < mathAddDays(newest.occurredAt, 1) && newest.correct && isIndependentQuality(newest)
        ? previous.nextReviewAt : mathAddDays(newest.occurredAt, 1))
      : nextReviewFor(phase, newest.occurredAt),
    needsCoverageCheck: !coverageComplete && (phase === 'secure' || phase === 'maintenance'),
    reviewFailures,
    provisionalAt,
    provisionalSessionId,
    securedAt,
  };
}

export function recordMathAttempt(progress: MathProgress, attempt: MathAttempt): MathProgress {
  const attempts = [...progress.attempts, attempt];
  const skillAttempts = attempts.filter((a) => a.skillId === attempt.skillId);
  const previous = progress.skills[attempt.skillId] ?? freshMathSkillState(attempt.skillId);
  const nextState = evaluateSkill(previous, skillAttempts, attempt);
  return { ...progress, attempts, skills: { ...progress.skills, [attempt.skillId]: nextState } };
}

export function recordMathSession(progress: MathProgress, log: MathSessionLog): MathProgress {
  return { ...progress, sessions: [...progress.sessions, log] };
}

export function mathDueSkills(progress: MathProgress, date = mathToday()): MathSkillId[] {
  return MATH_SKILLS
    .filter((skill) => {
      const state = progress.skills[skill.id];
      return state?.phase !== 'unseen' && !!state?.nextReviewAt && state.nextReviewAt <= date;
    })
    .sort((a, b) => (progress.skills[a.id].nextReviewAt ?? '').localeCompare(progress.skills[b.id].nextReviewAt ?? ''))
    .map((s) => s.id);
}
