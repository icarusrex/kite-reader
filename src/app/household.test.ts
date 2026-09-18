import { describe, expect, it } from 'vitest';
import { addProfile, householdFromLegacy, migrateHousehold, removeProfile, renameProfile } from './household';
import { freshProgress, jumpTo } from '../engine/progress';

describe('household profiles', () => {
  it('migrates legacy single-user progress into one profile without losing state', () => {
    const legacy = jumpTo(freshProgress('Liam'), 8, '2026-09-18');
    const h = householdFromLegacy(legacy);
    const p = h.profiles[h.activeProfileId];
    expect(Object.keys(h.profiles)).toHaveLength(1);
    expect(p.name).toBe('Liam');
    expect(p.progress.levels[7].status).toBe('passed');
    expect(p.progress.items['h:a']?.correct).toBe(1);
  });

  it('isolates progress between learners', () => {
    let h = householdFromLegacy(freshProgress('One'));
    const first = h.activeProfileId;
    h = addProfile(h, 'Two', 'p-two');
    h.profiles['p-two'].progress = jumpTo(h.profiles['p-two'].progress, 12, '2026-09-18');
    expect(h.profiles[first].progress.levels[1].status).toBe('active');
    expect(h.profiles['p-two'].progress.levels[11].status).toBe('passed');
  });

  it('renames both profile metadata and child settings, and never deletes the final profile', () => {
    let h = householdFromLegacy(freshProgress('One'));
    const id = h.activeProfileId;
    h = renameProfile(h, id, 'Renamed');
    expect(h.profiles[id].name).toBe('Renamed');
    expect(h.profiles[id].progress.settings.childName).toBe('Renamed');
    expect(removeProfile(h, id)).toEqual(h);
  });

  it('repairs an invalid active profile during migration', () => {
    const base = householdFromLegacy(freshProgress('One'));
    const raw = { ...base, activeProfileId: 'missing' };
    expect(Object.keys(migrateHousehold(raw).profiles)).toContain(migrateHousehold(raw).activeProfileId);
  });
});
