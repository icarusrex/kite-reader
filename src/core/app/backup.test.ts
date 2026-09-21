import { describe, expect, it } from 'vitest';
import { parseBackup } from './backup';
import { freshProgress, jumpTo } from '../../modules/reading/engine/progress';
import { householdFromLegacy } from './household';

describe('backup validation', () => {
  it.each([null, [], {}, 1, 'backup', { version: 2 }, { settings: {} }, { profiles: {} }, { profiles: [] }])('rejects unrecognized or empty backup %j', (raw) => {
    expect(() => parseBackup(raw)).toThrow();
  });
  it('restores reading history and accepts harmless metadata without mutating input', () => {
    const raw = { ...jumpTo(freshProgress('Sam'), 4), note: 'exported locally' };
    const before = JSON.stringify(raw);
    const result = parseBackup(raw);
    expect(result.kind).toBe('reading');
    if (result.kind !== 'reading') throw new Error('wrong kind');
    expect(result.reading.levels[3].status).toBe('passed');
    expect(result.reading.settings.childName).toBe('Sam');
    expect(JSON.stringify(raw)).toBe(before);
  });
  it.each([1, 2])('supports legacy reading v%i with missing modern fields', (version) => {
    const result = parseBackup({ version, settings: { childName: 'Legacy', capMinutes: 15 }, levels: { 1: { status: 'passed', sessions: 2 } }, sessions: [] });
    expect(result.kind).toBe('reading');
    if (result.kind !== 'reading') throw new Error('wrong kind');
    expect(result.reading.track).toBe('levels');
    expect(result.reading.settings.capMinutes).toBe(10);
    expect(result.reading.levels[1].sessions).toBe(2);
  });
  it.each([1, 2, 3])('supports household v%i and preserves progress', (version) => {
    const reading = jumpTo(freshProgress('Legacy'), 4);
    const profile = version === 3 ? { modules: { reading } } : { progress: reading };
    const result = parseBackup({ version, activeProfileId: 'missing', profiles: { child: { name: 'Legacy', ...profile } } });
    expect(result.kind).toBe('household');
    if (result.kind !== 'household') throw new Error('wrong kind');
    expect(result.household.activeProfileId).toBe('child');
    expect(result.household.profiles.child.modules.reading.levels[3].status).toBe('passed');
    expect(result.household.profiles.child.modules.math.attempts).toEqual([]);
  });
  it.each([
    { version: 99 }, { curriculumVersion: 'reading-2099-01-01-v9' },
    { settings: null }, { settings: { childName: 10 } }, { settings: { capMinutes: -1 } },
    { levels: [] }, { levels: { 1: null } }, { levels: { 1: { status: 'banana', sessions: 0 } } },
    { basics: { 1: { status: 'passed', sessions: -1 } } }, { items: { word: {} } },
    { sessions: {} }, { sessions: [null] }, { sessions: [{ date: '2026-09-18' }] },
    { errors: { word: -1 } }, { readAloud: { book: {} } }, { readAloud: { book: [null] } },
    { readiness: { date: '2026-09-18', blending: 'yes', tracking: 2 } }, { track: 'other' },
  ])('rejects malformed reading field %j', (override) => {
    expect(() => parseBackup({ ...freshProgress(), ...override })).toThrow();
  });
  it.each([
    { version: 4 }, { profiles: { child: null } }, { profiles: { child: {} } },
    { profiles: { child: { name: 42, progress: freshProgress() } } },
    { profiles: { child: { modules: [] } } },
  ])('rejects malformed households %j', (override) => {
    expect(() => parseBackup({ ...householdFromLegacy(), ...override })).toThrow();
  });
  it.each([
    { version: 2 }, { curriculumVersion: 'math-2099-01-01-v9' }, { settings: { physicalPrompts: 1 } },
    { skills: [] }, { skills: { 'num.count.verbal.1_5': { phase: 'broken' } } },
    { skills: { 'num.count.verbal.1_5': { representationCoverage: null } } },
    { attempts: [null] }, { attempts: [{}] }, { sessions: [{ skillIds: 'one' }] },
  ])('rejects malformed math before migration can discard it %j', (override) => {
    const raw = householdFromLegacy();
    const profile = raw.profiles[raw.activeProfileId];
    Object.assign(profile.modules.math, override);
    expect(() => parseBackup(raw)).toThrow();
  });
});
