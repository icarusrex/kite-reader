import { describe, expect, it } from 'vitest';
import { buildSkillTasks } from './tasks';
import { savedTasks } from './planner';
import { buildLessonMain, buildLessonCheck } from './lessons';
import { mathLessonNumber } from '../content/lessons';
import { freshMathProgress } from './state';

const many = (id: Parameters<typeof buildSkillTasks>[0]) => Array.from({ length: 40 }, (_, i) => buildSkillTasks(id, 'independent', 1, false, i)[0]);

describe('math audit, October 2026', () => {
  it('numeral → quantity prompts never say the number (reading the numeral is the skill)', () => {
    for (const id of ['num.map.numeral.1_3', 'num.map.numeral.1_5'] as const) {
      for (const t of many(id).filter((t) => t.responseDirection === 'symbol_to_quantity')) {
        expect(t.prompt).not.toMatch(/\d|one|two|three|four|five/i);
      }
    }
  });

  it('"find the rectangle" never also shows a square, which is a rectangle too', () => {
    for (let i = 0; i < 200; i++) {
      const t = buildSkillTasks('geo.shape.properties.basic', 'independent', 1, false, i)[0];
      const shapes = t.shapeOptions!.map((o) => o.shape);
      expect(shapes.filter((s) => s === t.shapeTarget)).toHaveLength(1);
      if (t.shapeTarget === 'rectangle') expect(shapes).not.toContain('square');
    }
  });

  it('shape building asks different questions and the answer is not always in the same place', () => {
    const tasks = many('geo.compose.shapes.basic');
    expect(new Set(tasks.map((t) => t.prompt)).size).toBeGreaterThan(1);
    expect(new Set(tasks.map((t) => t.shapeComposeOptions!.indexOf(t.shapeComposeAnswer!))).size).toBeGreaterThan(1);
    for (const t of tasks) expect(t.shapeComposeOptions).toContain(t.shapeComposeAnswer);
    // two triangles can make a rectangle, so they are never a wrong answer for one
    for (const t of tasks.filter((t) => t.prompt.includes('rectangle'))) expect(t.shapeComposeOptions).not.toContain('two_triangles');
  });

  it('compare tasks spread out either side, so "the longer row" is not a reliable shortcut', () => {
    const sides = new Set(many('num.compare.quantity.1_5').map((t) => t.spreadSide));
    expect(sides).toEqual(new Set(['left', 'right']));
  });

  it('checkout and cold check are not the same fixed sequence every time', () => {
    const p = freshMathProgress();
    const n = mathLessonNumber('num.compare.quantity.1_3');
    const seqs = new Set(Array.from({ length: 20 }, () => buildLessonCheck(p, n, 'cold').slice(1).map((t) => `${t.left}-${t.right}`).join(',')));
    expect(seqs.size).toBeGreaterThan(1);
    expect(savedTasks(p, 'num.compare.quantity.1_3', 'independent', 6, false)).toHaveLength(6);
  });

  it('physical-world prompts reach lessons every third session when switched on', () => {
    const p = freshMathProgress();
    const id = 'num.cardinality.1_3';
    const n = mathLessonNumber(id);
    p.lessons[id] = { status: 'active', sessions: 2 };
    expect(buildLessonMain(p, n).some((t) => t.kind === 'physical')).toBe(true);
    p.settings.physicalPrompts = false;
    expect(buildLessonMain(p, n).some((t) => t.kind === 'physical')).toBe(false);
    p.settings.physicalPrompts = true;
    p.lessons[id] = { status: 'active', sessions: 1 };
    expect(buildLessonMain(p, n).some((t) => t.kind === 'physical')).toBe(false);
  });
});

import { correctionFor } from '../activities/MathActivities';
import { MATH_SKILLS } from '../content/skills';

describe('math audit follow-ups', () => {
  it('every app-scored task has a correction to show after a miss', () => {
    for (const skill of MATH_SKILLS) for (const t of buildSkillTasks(skill.id, 'independent', 8)) {
      const parentScored = t.kind === 'parent_score' || t.kind === 'physical' || t.spokenAnswer;
      if (!parentScored) expect(correctionFor(t), `${skill.id} ${t.kind}`).toBeTruthy();
    }
  });

  it("half the length tasks put the shorter bar's end furthest out", () => {
    const tasks = many('measure.length.direct').filter((t) => t.compareAnswer !== 'same');
    const end = (len?: number, off?: number) => (len ?? 0) + (off ?? 0);
    const misleading = tasks.filter((t) => {
      const l = end(t.leftLength, t.leftOffset), r = end(t.rightLength, t.rightOffset);
      return (l > r) !== (t.compareAnswer === 'left');
    });
    expect(misleading.length).toBeGreaterThan(tasks.length / 3);
    expect(misleading.length).toBeLessThan(tasks.length);
  });
});
