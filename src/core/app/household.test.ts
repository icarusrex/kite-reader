import { describe, expect, it } from 'vitest';
import { addProfile, householdFromLegacy, migrateHousehold, removeProfile, renameProfile } from './household';
import { freshProgress, jumpTo } from '../../modules/reading/engine/progress';

function readingOf(h: ReturnType<typeof householdFromLegacy>, id = h.activeProfileId) {
  return h.profiles[id].modules.reading;
}

describe('household profiles', () => {
  it('migrates legacy single-user Reading progress without losing state', () => {
    const legacy = jumpTo(freshProgress('Liam'), 8, '2026-09-18');
    const h = householdFromLegacy(legacy);
    const p = h.profiles[h.activeProfileId];
    expect(Object.keys(h.profiles)).toHaveLength(1);
    expect(p.name).toBe('Liam');
    expect(p.modules.reading.levels[7].status).toBe('passed');
    expect(p.modules.reading.items['h:a']?.correct).toBe(1);
    expect(p.modules.math.skills['num.count.verbal.1_5'].phase).toBe('unseen');
  });

  it('isolates module state between learners', () => {
    let h = householdFromLegacy(freshProgress('One'));
    const first = h.activeProfileId;
    h = addProfile(h, 'Two', 'p-two');
    h.profiles['p-two'].modules.reading = jumpTo(h.profiles['p-two'].modules.reading, 12, '2026-09-18');
    h.profiles['p-two'].modules.math.skills['num.count.verbal.1_5'].phase = 'secure';
    expect(readingOf(h, first).levels[1].status).toBe('active');
    expect(h.profiles[first].modules.math.skills['num.count.verbal.1_5'].phase).toBe('unseen');
    expect(h.profiles['p-two'].modules.reading.levels[11].status).toBe('passed');
  });

  it('migrates the previous progress/math profile shape into modules', () => {
    const reading = jumpTo(freshProgress('Legacy'), 4, '2026-09-18');
    const raw = {
      version: 2,
      activeProfileId: 'p-old',
      profiles: {
        'p-old': { id: 'p-old', name: 'Legacy', createdAt: '2026-09-18T00:00:00.000Z', progress: reading },
      },
    };
    const h = migrateHousehold(raw);
    expect(h.version).toBe(3);
    expect(h.profiles['p-old'].modules.reading.levels[3].status).toBe('passed');
    expect(h.profiles['p-old'].modules.math.skills['num.count.verbal.1_5'].phase).toBe('unseen');
  });

  it('renames profile metadata and Reading child settings, and never deletes the final profile', () => {
    let h = householdFromLegacy(freshProgress('One'));
    const id = h.activeProfileId;
    h = renameProfile(h, id, 'Renamed');
    expect(h.profiles[id].name).toBe('Renamed');
    expect(h.profiles[id].modules.reading.settings.childName).toBe('Renamed');
    expect(removeProfile(h, id)).toEqual(h);
  });

  it('repairs an invalid active profile during migration', () => {
    const base = householdFromLegacy(freshProgress('One'));
    const raw = { ...base, activeProfileId: 'missing' };
    const migrated = migrateHousehold(raw);
    expect(Object.keys(migrated.profiles)).toContain(migrated.activeProfileId);
  });
});
