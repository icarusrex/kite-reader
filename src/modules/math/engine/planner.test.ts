import { describe, expect, it } from 'vitest';
import { buildMathSessionPlan } from './planner';
import { MathAttempt, freshMathProgress, mathActiveFrontier, mathMarkKnown, mathResetSkill, recordMathAttempt, recordMathSession } from './state';

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

describe('math progression is not a dead end', () => {
  const sessionOf = (p: ReturnType<typeof freshMathProgress>, sessionId: string, date: string) => {
    const plan = buildMathSessionPlan(p, 'guided');
    let next = p;
    for (const [i, t] of plan.tasks.entries()) {
      if (t.kind === 'model') continue;
      next = recordMathAttempt(next, {
        id: `${sessionId}-${i}`, sessionId, skillId: t.skillId, taskFamily: t.taskFamily,
        representation: t.representation, responseDirection: t.responseDirection,
        evidenceKind: t.evidenceKind, correct: true, helpLevel: 'none', occurredAt: `${date}T10:00:00Z`,
      });
    }
    next = recordMathSession(next, {
      id: sessionId, date, mode: 'guided', skillIds: [...new Set(plan.tasks.map((t) => t.skillId))],
      primarySkillId: plan.primarySkillId, activeSeconds: 300, attempts: plan.tasks.length,
    });
    return { plan, next };
  };

  it('does not serve the same lesson twice in a row while other material is open', () => {
    let p = freshMathProgress();
    const first = sessionOf(p, 's1', '2026-09-18');
    p = first.next;
    const second = sessionOf(p, 's2', '2026-09-18');
    expect(second.plan.primarySkillId).not.toBe(first.plan.primarySkillId);
  });

  it('a child who keeps getting things wrong still sees varied lessons', () => {
    let p = freshMathProgress();
    const seen: string[] = [];
    for (let s = 1; s <= 6; s++) {
      const plan = buildMathSessionPlan(p, 'guided');
      seen.push(plan.primarySkillId);
      for (const [i, t] of plan.tasks.entries()) {
        if (t.kind === 'model') continue;
        p = recordMathAttempt(p, {
          id: `w${s}-${i}`, sessionId: `w${s}`, skillId: t.skillId, taskFamily: t.taskFamily,
          representation: t.representation, responseDirection: t.responseDirection,
          evidenceKind: t.evidenceKind, correct: false, helpLevel: 'none', occurredAt: `2026-09-18T10:00:00Z`,
        });
      }
      p = recordMathSession(p, {
        id: `w${s}`, date: '2026-09-18', mode: 'guided', skillIds: [plan.primarySkillId],
        primarySkillId: plan.primarySkillId, activeSeconds: 60, attempts: plan.tasks.length,
      });
    }
    // Before the fix this was 1: the same lesson every time, with no way past it.
    expect(new Set(seen).size).toBeGreaterThan(1);
    seen.forEach((id, i) => { if (i) expect(id).not.toBe(seen[i - 1]); });
  });

  it('"Already knows" opens whatever the concept was blocking', () => {
    const before = mathActiveFrontier(freshMathProgress());
    const after = mathActiveFrontier(mathMarkKnown(freshMathProgress(), 'num.count.verbal.1_5'));
    expect(before).toContain('num.count.verbal.1_5');
    expect(after).not.toContain('num.count.verbal.1_5');
    expect(after).toContain('num.count.one_to_one.1_3');
  });

  it('"Practise again" puts a skipped concept back in rotation', () => {
    const known = mathMarkKnown(freshMathProgress(), 'num.count.verbal.1_5');
    const reset = mathResetSkill(known, 'num.count.verbal.1_5');
    expect(reset.skills['num.count.verbal.1_5'].phase).toBe('unseen');
    expect(mathActiveFrontier(reset)).toContain('num.count.verbal.1_5');
  });

  it('a grown-up can start any lesson directly, including one not yet unlocked', () => {
    const plan = buildMathSessionPlan(freshMathProgress(), 'guided', 'op.add.combine.to5');
    expect(plan.primarySkillId).toBe('op.add.combine.to5');
    expect(plan.tasks.length).toBeGreaterThan(1);
    expect(plan.tasks[0].model).toBe(true);
  });
});
