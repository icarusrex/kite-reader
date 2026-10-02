import { describe, expect, it } from 'vitest';
import { buildMathSessionPlan } from './planner';
import { freshMathProgress } from './state';

describe('math practice and explore plans', () => {
  it('explains an unseen concept first, then gives its tasks', () => {
    const plan = buildMathSessionPlan(freshMathProgress(), 'explore', 'num.count.verbal.1_5');
    expect(plan.tasks[0].model).toBe(true);
    expect(plan.tasks.every((t) => t.skillId === 'num.count.verbal.1_5')).toBe(true);
  });

  it('a grown-up can practise or explore any lesson, including one not yet reached', () => {
    const plan = buildMathSessionPlan(freshMathProgress(), 'practice', 'op.add.combine.to5');
    expect(plan.primarySkillId).toBe('op.add.combine.to5');
    expect(plan.tasks.filter((t) => !t.model).length).toBeGreaterThan(1);
  });
});
