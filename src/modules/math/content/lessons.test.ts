import { describe, expect, it } from 'vitest';
import { MATH_LESSONS } from './lessons';
import { MATH_SKILLS, MATH_SKILL_BY_ID } from './skills';

describe('math lesson order', () => {
  it('has every concept exactly once', () => {
    expect(new Set(MATH_LESSONS).size).toBe(MATH_SKILLS.length);
  });
  it('never teaches a concept before what it builds on', () => {
    MATH_LESSONS.forEach((id, i) => {
      for (const pre of [...MATH_SKILL_BY_ID[id].hardPrerequisites, ...MATH_SKILL_BY_ID[id].softPrerequisites]) expect(MATH_LESSONS.indexOf(pre)).toBeLessThan(i);
    });
  });
});
