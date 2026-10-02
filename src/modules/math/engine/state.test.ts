import { describe, expect, it } from 'vitest';
import { MathAttempt, freshMathProgress, migrateMathProgress, recordMathAttempt } from './state';

const attempt = (patch: Partial<MathAttempt> = {}): MathAttempt => ({
  id: patch.id ?? Math.random().toString(36),
  sessionId: patch.sessionId ?? 's1',
  skillId: patch.skillId ?? 'num.count.verbal.1_5',
  taskFamily: patch.taskFamily ?? 'verbal_count',
  representation: patch.representation ?? 'spoken',
  responseDirection: patch.responseDirection ?? 'produce',
  evidenceKind: patch.evidenceKind ?? 'independent',
  correct: patch.correct ?? true,
  helpLevel: patch.helpLevel ?? 'none',
  occurredAt: patch.occurredAt ?? '2026-09-18T10:00:00Z',
  errorCode: patch.errorCode,
  strategyCode: patch.strategyCode,
});

describe('math learner state', () => {
  it('does not let helped answers satisfy provisional mastery', () => {
    let p = freshMathProgress();
    for (let i = 0; i < 8; i++) p = recordMathAttempt(p, attempt({ id: `h${i}`, sessionId: `s${i % 2}`, helpLevel: 'scaffold' }));
    expect(p.skills['num.count.verbal.1_5'].phase).toBe('introduced');
  });

  it('requires multiple sessions and task forms before provisional mastery', () => {
    let p = freshMathProgress();
    const forms = [
      { taskFamily: 'count_objects' as const, representation: 'objects' as const, responseDirection: 'produce' as const },
      { taskFamily: 'report_cardinality' as const, representation: 'random_dots' as const, responseDirection: 'recognize' as const },
    ];
    for (let i = 0; i < 5; i++) {
      const form = forms[i % 2];
      p = recordMathAttempt(p, attempt({
        id: `a${i}`,
        skillId: 'num.cardinality.1_3',
        sessionId: i < 3 ? 's1' : 's2',
        occurredAt: i < 3 ? '2026-09-18T10:00:00Z' : '2026-09-19T10:00:00Z',
        ...form,
      }));
    }
    expect(p.skills['num.cardinality.1_3'].phase).toBe('provisional');
  });

  const toProvisional = () => {
    let p = freshMathProgress();
    for (let i = 0; i < 5; i++) {
      p = recordMathAttempt(p, attempt({
        id: `p${i}`,
        sessionId: i < 3 ? 's1' : 's2',
        taskFamily: i % 2 ? 'construct_quantity' : 'physical_transfer',
        representation: i % 2 ? 'objects' : 'physical',
        responseDirection: 'construct',
        skillId: 'num.construct.1_3',
      }));
    }
    expect(p.skills['num.construct.1_3'].phase).toBe('provisional');
    return p;
  };
  const cold = (id: string, sessionId: string, correct = true) => attempt({
    id, sessionId, skillId: 'num.construct.1_3', taskFamily: 'construct_quantity', representation: 'objects', responseDirection: 'construct',
    evidenceKind: 'cold', correct,
  });

  it('secures after a cold check in a later session the same day, as Reading does', () => {
    let p = toProvisional();
    expect(p.skills['num.construct.1_3'].nextReviewAt).toBe('2026-09-18');
    p = recordMathAttempt(p, cold('c1', 's3'));
    expect(p.skills['num.construct.1_3'].phase).toBe('provisional');
    p = recordMathAttempt(p, cold('c2', 's3'));
    expect(p.skills['num.construct.1_3'].phase).toBe('secure');
  });

  it('a cold check in the session that made it provisional does not count', () => {
    let p = toProvisional();
    p = recordMathAttempt(p, cold('c1', 's2'));
    p = recordMathAttempt(p, cold('c2', 's2'));
    expect(p.skills['num.construct.1_3'].phase).toBe('provisional');
  });

  it('a miss in the cold check fails it for that session and the check is due again', () => {
    let p = toProvisional();
    p = recordMathAttempt(p, cold('c1', 's3', false));
    p = recordMathAttempt(p, cold('c2', 's3'));
    p = recordMathAttempt(p, cold('c3', 's3'));
    expect(p.skills['num.construct.1_3'].phase).toBe('provisional');
    expect(p.skills['num.construct.1_3'].nextReviewAt).toBe('2026-09-18');
    p = recordMathAttempt(p, cold('c4', 's4'));
    p = recordMathAttempt(p, cold('c5', 's4'));
    expect(p.skills['num.construct.1_3'].phase).toBe('secure');
  });

  it('recovers the provisional session for evidence saved before it was recorded', () => {
    let p = toProvisional();
    delete p.skills['num.construct.1_3'].provisionalSessionId;
    p = recordMathAttempt(p, cold('c1', 's2'));
    p = recordMathAttempt(p, cold('c2', 's2'));
    expect(p.skills['num.construct.1_3'].phase).toBe('provisional');
    p = recordMathAttempt(p, cold('c3', 's3'));
    p = recordMathAttempt(p, cold('c4', 's3'));
    expect(p.skills['num.construct.1_3'].phase).toBe('secure');
  });

  it('a cold check saved under the old three-day wait is due now after upgrading', () => {
    const p = toProvisional();
    const old = { ...p, skills: { ...p.skills, 'num.construct.1_3': { ...p.skills['num.construct.1_3'], nextReviewAt: '2026-09-21' } } };
    const migrated = migrateMathProgress(old);
    expect(migrated.skills['num.construct.1_3'].nextReviewAt).toBe('2026-09-18');
    expect(migrateMathProgress(migrated)).toEqual(migrated);
  });
});
