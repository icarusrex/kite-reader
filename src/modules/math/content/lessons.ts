import { MathSkillId, MATH_SKILLS } from './skills';

/** Math as numbered lessons, the way Reading has numbered levels: one lesson per concept, in curriculum
 *  order (priority, ties keep the skill table's order). Every concept comes after its prerequisites. */
export const MATH_LESSONS: MathSkillId[] = MATH_SKILLS
  .map((s, i) => ({ s, i }))
  .sort((a, b) => a.s.priority - b.s.priority || a.i - b.i)
  .map(({ s }) => s.id);

export const MATH_LESSON_COUNT = MATH_LESSONS.length;
export const mathLessonSkill = (n: number) => MATH_LESSONS[n - 1];
export const mathLessonNumber = (id: MathSkillId) => MATH_LESSONS.indexOf(id) + 1;
