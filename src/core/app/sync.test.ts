import { describe, expect, it } from 'vitest';
import { emptyMeta, learningIn, merge, ServerProfile, SyncMeta } from './sync';
import { Household, LearnerProfile, makeProfile } from './household';

const withSessions = (p: LearnerProfile, n: number): LearnerProfile => ({
  ...p, modules: { ...p.modules, reading: { ...p.modules.reading, sessions: Array.from({ length: n }, () => ({ date: '2026-10-01', level: 1, activeSeconds: 60, answered: 5, correct: 5, endedBy: 'complete' as const })) } },
});
const home = (...ps: LearnerProfile[]): Household => ({ version: 3, activeProfileId: ps[0].id, profiles: Object.fromEntries(ps.map((p) => [p.id, p])) });
const srv = (p: LearnerProfile, rev: number, deleted = false): ServerProfile => ({ id: p.id, rev, deleted, updatedAt: '2026-10-03T00:00:00Z', data: JSON.parse(JSON.stringify(p)) });
const meta = (m: SyncMeta['profiles'], deleted: SyncMeta['deleted'] = {}): SyncMeta => ({ profiles: m, deleted });

const ana = withSessions(makeProfile('Ana', 'p-ana'), 3);
const ben = withSessions(makeProfile('Ben', 'p-ben'), 1);

describe('progress sync merge', () => {
  it('first sync uploads every learner on this device', () => {
    const r = merge(home(ana, ben), emptyMeta(), [], true);
    expect(r.push).toEqual([{ id: 'p-ana', baseRev: 0 }, { id: 'p-ben', baseRev: 0 }]);
    expect(Object.keys(r.household.profiles)).toEqual(['p-ana', 'p-ben']);
  });

  it('cleared browser / new tablet: the empty starter learner is replaced by the saved learners', () => {
    const fresh = makeProfile('Child', 'p-new');
    const r = merge(home(fresh), emptyMeta(), [srv(ana, 4), srv(ben, 2)], true);
    expect(Object.keys(r.household.profiles).sort()).toEqual(['p-ana', 'p-ben']);
    expect(r.household.profiles['p-ana'].modules.reading.sessions).toHaveLength(3);
    expect(r.household.activeProfileId).toBe('p-ana');
    expect(r.push).toEqual([]);
  });

  it('takes a newer server copy when this device has no unsynced changes', () => {
    const newer = withSessions(ana, 5);
    const r = merge(home(ana), meta({ 'p-ana': { rev: 2, dirty: false } }), [srv(newer, 3)], false);
    expect(r.household.profiles['p-ana'].modules.reading.sessions).toHaveLength(5);
    expect(r.meta.profiles['p-ana']).toEqual({ rev: 3, dirty: false });
  });

  it('uploads local changes when the server is still at the synced rev', () => {
    const r = merge(home(ana), meta({ 'p-ana': { rev: 2, dirty: true } }), [srv(withSessions(ana, 1), 2)], false);
    expect(r.push).toEqual([{ id: 'p-ana', baseRev: 2 }]);
    expect(r.household.profiles['p-ana']).toBe(ana);
  });

  it('conflict: the copy with more learning wins and the other is kept as a conflict copy', () => {
    const elsewhere = withSessions(ana, 1);
    const r = merge(home(ana), meta({ 'p-ana': { rev: 2, dirty: true } }), [srv(elsewhere, 3)], false);
    expect(r.household.profiles['p-ana']).toBe(ana);
    expect(r.push).toEqual([{ id: 'p-ana', baseRev: 3 }]);
    expect(r.losers.map((l) => learningIn(l))).toEqual([learningIn(elsewhere)]);

    const r2 = merge(home(ben), meta({ 'p-ben': { rev: 2, dirty: true } }), [srv(withSessions(ben, 6), 3)], false);
    expect(r2.household.profiles['p-ben'].modules.reading.sessions).toHaveLength(6);
    expect(r2.losers).toHaveLength(1);
    expect(r2.push).toEqual([]);
  });

  it('follows a deletion made on another device, unless this device has unsynced learning for that child', () => {
    const r = merge(home(ana, ben), meta({ 'p-ana': { rev: 1, dirty: false }, 'p-ben': { rev: 1, dirty: false } }), [srv(ana, 1), srv(ben, 2, true)], false);
    expect(Object.keys(r.household.profiles)).toEqual(['p-ana']);
    const r2 = merge(home(ana, ben), meta({ 'p-ana': { rev: 1, dirty: false }, 'p-ben': { rev: 1, dirty: true } }), [srv(ana, 1), srv(ben, 2, true)], false);
    expect(Object.keys(r2.household.profiles)).toEqual(['p-ana', 'p-ben']);
    expect(r2.push).toEqual([{ id: 'p-ben', baseRev: 2 }]);
  });

  it('does not bring back a learner deleted on this device', () => {
    const r = merge(home(ana), meta({ 'p-ana': { rev: 1, dirty: false } }, { 'p-ben': 1 }), [srv(ana, 1), srv(ben, 1)], false);
    expect(Object.keys(r.household.profiles)).toEqual(['p-ana']);
  });

  it('leaves a server copy it cannot read (newer app version) untouched', () => {
    const future = { ...srv(ana, 9), data: { ...JSON.parse(JSON.stringify(ana)), modules: { ...ana.modules, reading: { ...ana.modules.reading, curriculumVersion: 'reading-2099-01-01-v1' } } } };
    const r = merge(home(ana), meta({ 'p-ana': { rev: 2, dirty: false } }), [future], false);
    expect(r.household.profiles['p-ana']).toBe(ana);
    expect(r.push).toEqual([]);
  });

  it('never ends with zero learners', () => {
    const r = merge(home(ana), meta({ 'p-ana': { rev: 1, dirty: false } }), [srv(ana, 2, true)], false);
    expect(Object.keys(r.household.profiles)).toEqual(['p-ana']);
  });
});
