import { describe, expect, it } from 'vitest';
import { MATH_SKILLS } from '../content/skills';
import { MATH_LESSONS, mathLessonNumber } from '../content/lessons';
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

describe('math content audit', () => {
  const all = (id: Parameters<typeof buildSkillTasks>[0]) => buildSkillTasks(id, 'independent', 12);

  it('the words match the picture', () => {
    for (const t of all('num.count.one_to_one.1_3')) expect(t.prompt.includes('dot')).toBe(t.representation === 'random_dots');
    for (const t of all('op.add.combine.to5')) expect(t.prompt.includes('frog')).toBe(t.representation === 'objects');
    for (const t of all('op.subtract.separate.to5')) expect(t.prompt.includes('apple')).toBe(t.representation === 'objects');
    for (const t of all('num.order.1_5')) expect(t.prompt.includes('dots')).toBe(t.representation !== 'numeral');
  });

  it('answers are not always the same', () => {
    const hidden = all('num.compose.2_4').filter((t) => t.partitionMode === 'hidden_part').map((t) => t.hiddenPart);
    expect(new Set(hidden).size).toBeGreaterThan(1);
    for (const id of ['num.count.cardinal.1_5', 'num.subitize.structured.4_5'] as const) expect(new Set(all(id).map((t) => t.quantity)).size).toBeGreaterThan(2);
    for (const t of [...all('num.compose.2_4'), ...all('num.compose.5')].filter((t) => t.partitionMode === 'make_split')) expect(t.splitLeft).toBeLessThan(t.target!);
  });

  it('numerals are only tapped once a lesson has taught them; before that the child says the answer', () => {
    MATH_LESSONS.forEach((id, i) => {
      const n = i + 1;
      const taught = n >= mathLessonNumber('num.map.numeral.1_5') ? 5 : n >= mathLessonNumber('num.map.numeral.1_3') ? 3 : 0;
      for (const t of all(id)) for (const o of t.options ?? []) expect(o, `${id}: option ${o}`).toBeLessThanOrEqual(taught);
    });
  });
});
