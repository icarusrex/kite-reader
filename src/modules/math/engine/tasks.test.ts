import { describe, expect, it } from 'vitest';
import { MATH_SKILLS } from '../content/skills';
import { buildSkillTasks } from './tasks';

describe('math task generation', () => {
  it('can generate a model and four independent tasks for every first-20 skill', () => {
    for (const skill of MATH_SKILLS) {
      const tasks = buildSkillTasks(skill.id, 'independent', 4, true);
      expect(tasks, skill.id).toHaveLength(5);
      expect(tasks[0].model, skill.id).toBe(true);
      for (const task of tasks.slice(1)) {
        expect(task.skillId).toBe(skill.id);
        expect(skill.taskFamilies).toContain(task.taskFamily);
        expect(skill.representations).toContain(task.representation);
      }
    }
  });

  it('tests numeral mappings in both directions', () => {
    for (const id of ['num.map.numeral.1_3', 'num.map.numeral.1_5'] as const) {
      const tasks = buildSkillTasks(id, 'independent', 4);
      expect(tasks.map((t) => t.responseDirection)).toContain('symbol_to_quantity');
      expect(tasks.map((t) => t.responseDirection)).toContain('quantity_to_symbol');
    }
  });

  it('varies shape orientation so prototype matching is not enough', () => {
    const tasks = buildSkillTasks('geo.shape.properties.basic', 'independent', 4);
    const rotations = tasks.flatMap((t) => t.shapeOptions?.map((o) => o.rotation) ?? []);
    expect(rotations.some((r) => r !== 0)).toBe(true);
  });
});
