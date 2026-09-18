import { describe, expect, it } from 'vitest';
import { buildMathSessionPlan } from './planner';
import { MathAttempt, freshMathProgress, recordMathAttempt } from './state';

const answer = (id: string, sessionId: string): MathAttempt => ({
  id, sessionId, skillId: 'num.count.verbal.1_5', taskFamily: 'verbal_count', representation: 'spoken', responseDirection: 'produce',
  evidenceKind: 'independent', correct: true, helpLevel: 'none', occurredAt: `2026-09-${sessionId === 's1' ? '18' : '19'}T10:00:00Z`,
});

describe('math session planner', () => {
  it('introduces one primary novelty and includes a model for an unseen concept', () => {
    const plan = buildMathSessionPlan(freshMathProgress(), 'guided');
    expect(plan.tasks.filter((t) => t.model)).toHaveLength(1);
    expect(new Set(plan.tasks.filter((t) => !plan.reviewSkillIds.includes(t.skillId)).map((t) => t.skillId))).toEqual(new Set([plan.primarySkillId]));
  });

  it('practice never needs to invent a future skill once material has been reached', () => {
    let p = freshMathProgress();
    p = recordMathAttempt(p, answer('1', 's1'));
    const plan = buildMathSessionPlan(p, 'practice');
    expect(p.skills[plan.primarySkillId].phase).not.toBe('unseen');
  });
});
