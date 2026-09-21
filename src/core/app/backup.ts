import { Household, HOUSEHOLD_VERSION, migrateHousehold } from './household';
import { Progress, SCHEMA_VERSION, CURRICULUM_VERSION, migrateProgress } from '../../modules/reading/engine/progress';
import { MATH_SCHEMA_VERSION, MATH_CURRICULUM_VERSION } from '../../modules/math/engine/state';
import { MATH_SKILL_BY_ID } from '../../modules/math/content/skills';

type Obj = Record<string, unknown>;
const bad = (): never => { throw new Error('That file is not a supported Kite backup. Your progress has not been changed.'); };
function obj(x: unknown): Obj { if (!x || typeof x !== 'object' || Array.isArray(x)) return bad(); return x as Obj; }
function str(x: unknown) { if (typeof x !== 'string') bad(); }
function num(x: unknown) { if (typeof x !== 'number' || !Number.isFinite(x) || x < 0) bad(); }
function bool(x: unknown) { if (typeof x !== 'boolean') bad(); }
function one(x: unknown, values: readonly unknown[]) { if (!values.includes(x)) bad(); }
function optional(o: Obj, key: string, check: (x: unknown) => void) { if (o[key] !== undefined) check(o[key]); }
function list(x: unknown, check: (x: unknown) => void) { if (!Array.isArray(x)) return bad(); x.forEach(check); }
function record(x: unknown, check: (x: unknown) => void) { const o = obj(x); for (const [key, value] of Object.entries(o)) { if (['__proto__', 'constructor', 'prototype'].includes(key)) bad(); check(value); } }
function date(x: unknown) { str(x); if (!/^\d{4}-\d{2}-\d{2}(T.*)?$/.test(x as string) || !Number.isFinite(Date.parse(x as string))) bad(); }
function version(o: Obj, max: number, curriculum?: string) {
  optional(o, 'version', x => { num(x); if (!Number.isInteger(x) || (x as number) < 1 || (x as number) > max) bad(); });
  if (curriculum) optional(o, 'curriculumVersion', x => {
    str(x); const m = /^(reading|math)-(\d{4}-\d{2}-\d{2})-v(\d+)$/.exec(x as string);
    const current = /^(reading|math)-(\d{4}-\d{2}-\d{2})-v(\d+)$/.exec(curriculum)!;
    if (!m || m[1] !== current[1] || m[2] > current[2] || (m[2] === current[2] && +m[3] > +current[3])) bad();
  });
}
function reading(raw: unknown) {
  const p = obj(raw); version(p, SCHEMA_VERSION, CURRICULUM_VERSION);
  const levels = obj(p.levels); if (!Object.keys(levels).length) bad(); const settings = obj(p.settings);
  optional(p, 'track', x => one(x, ['basics', 'levels']));
  const level = (x: unknown, basics = false) => { const l = obj(x); one(l.status, basics ? ['locked', 'active', 'passed'] : ['locked', 'active', 'cold', 'passed']); num(l.sessions); optional(l, 'passedOn', date); optional(l, 'checkoutPassedOn', date); };
  record(levels, level); optional(p, 'basics', x => record(x, y => level(y, true)));
  optional(settings, 'childName', str); optional(settings, 'capMinutes', x => { num(x); if (x === 0) bad(); });
  optional(settings, 'parentScoring', bool); optional(settings, 'readinessPassed', x => { if (x !== null) bool(x); });
  optional(settings, 'micSensitivity', x => { num(x); if ((x as number) < 1 || (x as number) > 5) bad(); }); optional(settings, 'rev', num);
  optional(p, 'items', x => record(x, value => { const i = obj(value); str(i.id); one(i.kind, ['grapheme', 'word']); num(i.box); if ((i.box as number) > 5) bad(); date(i.due); ['seen', 'correct', 'wrong'].forEach(k => num(i[k])); }));
  optional(p, 'sessions', x => list(x, value => { const s = obj(value); date(s.date); ['level', 'activeSeconds', 'answered', 'correct'].forEach(k => num(s[k])); one(s.endedBy, ['cap', 'complete', 'fatigue', 'parent']); optional(s, 'practice', bool); optional(s, 'basics', num); }));
  optional(p, 'errors', x => record(x, num));
  optional(p, 'readAloud', x => record(x, y => list(y, value => { const s = obj(value); num(s.chapter); date(s.date); })));
  optional(p, 'readiness', x => { const s = obj(x); date(s.date); num(s.blending); num(s.tracking); });
}
function math(raw: unknown) {
  const p = obj(raw); version(p, MATH_SCHEMA_VERSION, MATH_CURRICULUM_VERSION);
  optional(p, 'settings', x => { const s = obj(x); optional(s, 'capMinutes', num); optional(s, 'physicalPrompts', bool); });
  const skillId = (x: unknown) => { str(x); if (!Object.prototype.hasOwnProperty.call(MATH_SKILL_BY_ID, x as string)) bad(); };
  optional(p, 'skills', x => { const skills = obj(x); for (const [id, value] of Object.entries(skills)) { skillId(id); const s = obj(value); optional(s, 'needsCoverageCheck', bool);
    optional(s, 'reviewFailures', y => list(y, z => { const f = obj(z); optional(f, 'target', num); str(f.taskFamily); str(f.responseDirection); str(f.sessionId); date(f.occurredAt); }));
    optional(s, 'phase', y => one(y, ['unseen', 'introduced', 'practicing', 'provisional', 'secure', 'maintenance']));
    for (const k of ['representationCoverage', 'directionCoverage', 'unresolvedErrors']) optional(s, k, y => list(y, str));
    for (const k of ['independentEvidence', 'delayedEvidence', 'transferEvidence', 'physicalEvidence']) optional(s, k, num);
    for (const k of ['lastEvidenceAt', 'nextReviewAt', 'provisionalAt', 'securedAt']) optional(s, k, date);
  } });
  optional(p, 'attempts', x => list(x, value => { const a = obj(value); skillId(a.skillId); for (const k of ['id', 'sessionId', 'taskFamily', 'representation', 'responseDirection']) str(a[k]); one(a.evidenceKind, ['guided', 'independent', 'cold', 'transfer', 'physical']); one(a.helpLevel, ['none', 'neutral_repeat', 'scaffold', 'modeled']); bool(a.correct); date(a.occurredAt); optional(a, 'target', num); optional(a, 'errorCode', str); }));
  optional(p, 'sessions', x => list(x, value => { const s = obj(value); str(s.id); date(s.date); one(s.mode, ['guided', 'practice', 'explore']); list(s.skillIds, skillId); num(s.activeSeconds); num(s.attempts); optional(s, 'primarySkillId', skillId); }));
}

export function parseBackup(raw: unknown): { kind: 'household'; household: Household } | { kind: 'reading'; reading: Progress } {
  // Migration is intentionally permissive for old formats. Validate first, on a
  // detached copy, so an invalid file cannot reset progress or mutate live data.
  const p = obj(raw);
  if ('profiles' in p) {
    version(p, HOUSEHOLD_VERSION); const profiles = obj(p.profiles); if (!Object.keys(profiles).length) bad();
    optional(p, 'activeProfileId', str);
    record(profiles, value => { const profile = obj(value); optional(profile, 'name', str); optional(profile, 'createdAt', date); optional(profile, 'id', str);
      const modules = profile.modules === undefined ? undefined : obj(profile.modules);
      reading(modules?.reading ?? profile.progress);
      const m = modules?.math ?? profile.math; if (m !== undefined) math(m);
    });
    return { kind: 'household', household: migrateHousehold(structuredClone(p)) };
  }
  reading(p); return { kind: 'reading', reading: migrateProgress(structuredClone(p)) };
}
