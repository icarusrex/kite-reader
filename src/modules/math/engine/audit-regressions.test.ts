import { describe, expect, it } from 'vitest';
import { buildMathSessionPlan } from './planner';
import { MathAttempt, MathProgress, freshMathProgress, migrateMathProgress, recordMathAttempt } from './state';

const numeral = 'num.map.numeral.1_5' as const;
function session(progress: MathProgress, id: string, date: string, correct = true) {
  const plan = buildMathSessionPlan(progress, 'guided', numeral);
  const tasks = plan.tasks.filter((task) => !task.model && task.kind !== 'physical');
  expect(tasks).toHaveLength(4);
  for (const [i, task] of tasks.entries()) {
    progress = recordMathAttempt(progress, {
      id: `${id}-${i}`, sessionId: id, skillId: task.skillId, taskFamily: task.taskFamily,
      representation: task.representation, responseDirection: task.responseDirection,
      evidenceKind: task.evidenceKind, target: task.target ?? task.quantity,
      correct, helpLevel: 'none', occurredAt: `${date}T10:00:00Z`,
    } as MathAttempt);
  }
  return progress;
}

describe('audited math journeys', () => {
  it('covers every numeral in both directions through four-task saved sessions', () => {
    let p = freshMathProgress();
    p = session(p, 's1', '2026-09-10');
    p = session(p, 's2', '2026-09-11');
    expect(p.skills[numeral].phase).not.toBe('secure');
    p = session(p, 's3', '2026-09-14');
    const pairs = new Set(p.attempts.map((a) => `${(a as MathAttempt & {target?: number}).target}:${a.responseDirection}`));
    for (const n of [1, 2, 3, 4, 5]) {
      expect(pairs.has(`${n}:symbol_to_quantity`)).toBe(true);
      expect(pairs.has(`${n}:quantity_to_symbol`)).toBe(true);
    }
    expect(p.skills[numeral].phase).toBe('secure');
  });

  it('cannot newly certify secure when all target evidence is missing', () => {
    let p = freshMathProgress();
    for (const [i, date] of ['2026-09-10', '2026-09-11', '2026-09-14'].entries()) {
      const plan = buildMathSessionPlan(p, 'guided', numeral);
      for (const [j, t] of plan.tasks.filter((t) => !t.model).entries()) p = recordMathAttempt(p, {
        id: `${i}-${j}`, sessionId: `s${i}`, skillId: numeral, taskFamily: t.taskFamily,
        representation: t.representation, responseDirection: t.responseDirection,
        evidenceKind: t.evidenceKind, correct: true, helpLevel: 'none', occurredAt: `${date}T10:00:00Z`,
      });
    }
    expect(p.skills[numeral].phase).toBe('provisional');
  });

  it('preserves old earned mastery while flagging missing coverage without inventing targets', () => {
    const old = freshMathProgress();
    old.skills[numeral] = { ...old.skills[numeral], phase: 'secure', securedAt: '2026-09-14T10:00:00Z', independentEvidence: 12 };
    const p = migrateMathProgress(old);
    expect(p.skills[numeral]).toMatchObject({ phase: 'secure', securedAt: old.skills[numeral].securedAt, independentEvidence: 12, needsCoverageCheck: true });
    expect(p.attempts).toHaveLength(0);
  });

  it.each(['secure', 'maintenance'] as const)('retries failed %s checks next day and retains retry after an easier same-session answer', (phase) => {
    let p = freshMathProgress();
    p.skills[numeral] = { ...p.skills[numeral], phase, securedAt: '2026-09-01T10:00:00Z' };
    const a: MathAttempt = { id: 'wrong', sessionId: 'review', skillId: numeral, taskFamily: 'map_numeral_quantity', representation: 'numeral', responseDirection: 'symbol_to_quantity', evidenceKind: 'independent', correct: false, helpLevel: 'none', occurredAt: '2026-10-05T10:00:00Z', target: 5 } as MathAttempt;
    p = recordMathAttempt(p, a);
    expect(p.skills[numeral].nextReviewAt).toBe('2026-10-06');
    p = recordMathAttempt(p, { ...a, id: 'easy', correct: true, target: 1 } as MathAttempt);
    expect(p.skills[numeral].nextReviewAt).toBe('2026-10-06');
    p = recordMathAttempt(p, { ...a, id: 'helped', sessionId: 'retry', correct: true, helpLevel: 'scaffold', occurredAt: '2026-10-06T10:00:00Z' });
    expect(p.skills[numeral].nextReviewAt).toBe('2026-10-07');
    p = recordMathAttempt(p, { ...a, id: 'recovered', sessionId: 'retry2', correct: true, occurredAt: '2026-10-07T10:00:00Z' });
    expect(p.skills[numeral].nextReviewAt).toBe('2026-12-06');
  });
});

it('revisits a failed counting target during ordinary guided review and clears it on recovery', () => {
  const skillId = 'num.count.cardinal.1_5';
  let p = freshMathProgress();
  p.skills[skillId] = { ...p.skills[skillId], phase: 'secure', securedAt: '2026-09-01T10:00:00Z' };
  p = recordMathAttempt(p, { id: 'wrong-count', sessionId: 'failed', skillId, target: 4, taskFamily: 'count_objects', representation: 'random_dots', responseDirection: 'recognize', evidenceKind: 'independent', correct: false, helpLevel: 'none', occurredAt: '2026-09-02T10:00:00Z' });
  const plan = buildMathSessionPlan(p, 'guided', 'geo.shape.properties.basic');
  const retry = plan.tasks.find(t => t.skillId === skillId)!;
  expect(retry).toMatchObject({ quantity: 4, taskFamily: 'count_objects', responseDirection: 'recognize' });
  p = recordMathAttempt(p, { id: 'retry-count', sessionId: 'later', skillId, target: retry.target ?? retry.quantity, taskFamily: retry.taskFamily, representation: retry.representation, responseDirection: retry.responseDirection, evidenceKind: retry.evidenceKind, correct: true, helpLevel: 'none', occurredAt: '2026-09-03T10:00:00Z' });
  expect(p.skills[skillId].reviewFailures).toEqual([]);
  expect(p.skills[skillId].nextReviewAt).toBe('2026-09-24');
});
