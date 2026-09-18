import { describe, expect, it } from 'vitest';
import { MathAttempt, freshMathProgress, mathActiveFrontier, mathAddDays, recordMathAttempt } from './state';

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
  it('starts with parallel eligible number/geometry/measurement frontiers', () => {
    const p = freshMathProgress();
    expect(mathActiveFrontier(p)).toEqual(expect.arrayContaining([
      'num.count.verbal.1_5',
      'num.subitize.perceptual.1_3',
      'geo.shape.properties.basic',
      'measure.length.direct',
    ]));
    expect(mathActiveFrontier(p)).not.toContain('num.cardinality.1_3');
  });

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

  it('requires delayed independent evidence before secure', () => {
    let p = freshMathProgress();
    for (let i = 0; i < 5; i++) {
      p = recordMathAttempt(p, attempt({
        id: `p${i}`,
        sessionId: i < 3 ? 's1' : 's2',
        taskFamily: i % 2 ? 'construct_quantity' : 'physical_transfer',
        representation: i % 2 ? 'objects' : 'physical',
        responseDirection: 'construct',
        skillId: 'num.construct.1_3',
        occurredAt: i < 3 ? '2026-09-18T10:00:00Z' : '2026-09-19T10:00:00Z',
      }));
    }
    expect(p.skills['num.construct.1_3'].phase).toBe('provisional');
    const due = mathAddDays(p.skills['num.construct.1_3'].provisionalAt!, 3);
    p = recordMathAttempt(p, attempt({
      id: 'cold', sessionId: 's3', skillId: 'num.construct.1_3', taskFamily: 'construct_quantity', representation: 'objects', responseDirection: 'construct',
      evidenceKind: 'cold', occurredAt: `${due}T10:00:00Z`,
    }));
    expect(p.skills['num.construct.1_3'].phase).toBe('secure');
  });
});
