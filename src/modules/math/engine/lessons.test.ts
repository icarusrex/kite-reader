import { describe, expect, it } from 'vitest';
import { MATH_LESSONS, mathLessonSkill } from '../content/lessons';
import {
  MATH_PASS, MATH_TASKS, buildLessonCheck, buildLessonMain, currentMathLesson, lessonsFromSkills, mathColdCheckDue,
  mathCountSession, mathDueReviews, mathFailCold, mathJumpTo, mathPassCheckout, mathPassCold, mathRecordReview, passesMath,
} from './lessons';
import { freshMathProgress, migrateMathProgress } from './state';

const D = '2026-10-02';

describe('math lessons progress like Reading levels', () => {
  it('starts at lesson 1 with everything else waiting', () => {
    const p = freshMathProgress();
    expect(currentMathLesson(p)).toBe(1);
    expect(MATH_LESSONS.slice(1).every((id) => p.lessons[id].status === 'locked')).toBe(true);
  });

  it('checkout, then a cold check the same day, then straight on to the next lesson', () => {
    let p = freshMathProgress();
    p = mathCountSession(p, 1);
    p = mathPassCheckout(p, 1, D);
    expect(mathColdCheckDue(p, 1)).toBe(true);
    expect(currentMathLesson(p)).toBe(1);
    p = mathPassCold(p, 1, D);
    expect(p.lessons[mathLessonSkill(1)]).toMatchObject({ status: 'passed', passedOn: D });
    expect(currentMathLesson(p)).toBe(2);
    expect(p.lessons[mathLessonSkill(2)].status).toBe('active');
  });

  it('a failed cold check sends the lesson back for more practice', () => {
    let p = mathPassCheckout(freshMathProgress(), 1, D);
    p = mathFailCold(p, 1);
    expect(p.lessons[mathLessonSkill(1)].status).toBe('active');
    expect(mathColdCheckDue(p, 1)).toBe(false);
  });

  it('pass marks use the Reading thresholds: one miss allowed in each check', () => {
    expect(passesMath('checkout', 6, 5)).toBe(true);
    expect(passesMath('checkout', 6, 4)).toBe(false);
    expect(passesMath('cold', 5, 4)).toBe(true);
    expect(passesMath('cold', 5, 3)).toBe(false);
    expect(MATH_PASS.cold).toBe(0.8);
  });

  it('Start here: earlier lessons passed, that one current, later ones waiting', () => {
    const p = mathJumpTo(freshMathProgress(), 5, D);
    expect(currentMathLesson(p)).toBe(5);
    expect(MATH_LESSONS.slice(0, 4).every((id) => p.lessons[id].status === 'passed')).toBe(true);
    expect(p.lessons[mathLessonSkill(6)].status).toBe('locked');
    const back = mathJumpTo(p, 2, D);
    expect(currentMathLesson(back)).toBe(2);
  });

  it('passing a lesson skips ahead past lessons that are already passed', () => {
    let p = freshMathProgress();
    p = { ...p, lessons: { ...p.lessons, [mathLessonSkill(2)]: { status: 'passed', sessions: 1 } } };
    p = mathPassCold(p, 1, D);
    expect(currentMathLesson(p)).toBe(3);
  });

  it('passed lessons come back as spaced review, Leitner style', () => {
    let p = mathPassCold(freshMathProgress(), 1, D);
    const id = mathLessonSkill(1);
    expect(mathDueReviews(p, D)).toEqual([]);
    expect(mathDueReviews(p, '2026-10-03')).toEqual([id]);
    p = mathRecordReview(p, id, true, '2026-10-03');
    expect(p.lessons[id]).toMatchObject({ box: 2, due: '2026-10-05' });
    p = mathRecordReview(p, id, false, '2026-10-05');
    expect(p.lessons[id]).toMatchObject({ box: 1, due: '2026-10-06' });
  });

  it('the explanation shows the first time only; due reviews are mixed into practice', () => {
    let p = freshMathProgress();
    expect(buildLessonMain(p, 1, D)[0].kind).toBe('model');
    p = mathCountSession(mathPassCold(p, 1, D), 1);
    const main = buildLessonMain(p, 2, '2026-10-03');
    expect(main[0].kind).toBe('model');
    expect(main.filter((t) => t.review).map((t) => t.skillId)).toEqual([mathLessonSkill(1)]);
    expect(main.filter((t) => !t.review && t.kind !== 'model')).toHaveLength(MATH_TASKS.main);
    p = mathCountSession(p, 2);
    expect(buildLessonMain(p, 2, D).some((t) => t.kind === 'model')).toBe(false);
  });

  it('checks open with a banner and have the planned length', () => {
    const p = freshMathProgress();
    const cold = buildLessonCheck(p, 3, 'cold');
    expect(cold[0].kind).toBe('banner');
    expect(cold.slice(1)).toHaveLength(MATH_TASKS.cold);
    expect(cold.slice(1).every((t) => t.phase === 'cold' && t.evidenceKind === 'cold')).toBe(true);
    expect(buildLessonCheck(p, 3, 'checkout').slice(1)).toHaveLength(MATH_TASKS.checkout);
  });

  it('older progress keeps what was earned: secure lessons passed, a provisional one goes to its cold check', () => {
    const old = freshMathProgress() as Partial<ReturnType<typeof freshMathProgress>>;
    old.skills![mathLessonSkill(1)].phase = 'secure';
    old.skills![mathLessonSkill(2)].phase = 'provisional';
    delete old.lessons;
    const p = migrateMathProgress(old);
    expect(p.lessons[mathLessonSkill(1)].status).toBe('passed');
    expect(currentMathLesson(p)).toBe(2);
    expect(mathColdCheckDue(p, 2)).toBe(true);
    expect(migrateMathProgress(p)).toEqual(p);
  });

  it('a fresh learner with no skills record also starts at lesson 1', () => {
    expect(currentMathLesson({ lessons: lessonsFromSkills({}) })).toBe(1);
  });
});
