import { MathSkillId } from '../content/skills';
import { MATH_COLD_CHECK_ANSWERS, MathProgress, MathSessionMode, mathDueSkills } from './state';
import { MathTask, buildPhysicalTask, buildSkillTasks } from './tasks';

export interface MathSessionPlan {
  primarySkillId: MathSkillId;
  reviewSkillIds: MathSkillId[];
  tasks: MathTask[];
}

/** Tasks for one concept, putting back any review a child missed and rotating numeral targets. */
export function savedTasks(progress: MathProgress, id: MathSkillId, evidence: Parameters<typeof buildSkillTasks>[1], count: number, model: boolean) {
  if (id !== 'num.map.numeral.1_5') {
    // Start somewhere different each time, so practice, checkout and cold check are not the same questions in the
    // same order (an answer pattern a child can remember). Consecutive indices still alternate the task forms.
    const tasks = buildSkillTasks(id, evidence, count, model, Math.floor(Math.random() * 12));
    const candidates = buildSkillTasks(id, evidence, 20);
    for (const [i, failure] of (progress.skills[id].reviewFailures ?? []).slice(0, count).entries()) {
      const matches = (t: MathTask) => t.taskFamily === failure.taskFamily && t.responseDirection === failure.responseDirection && (t.target ?? t.quantity) === failure.target;
      let retry = candidates.find(matches);
      if (!retry && failure.taskFamily === 'physical_transfer') {
        const physical = buildPhysicalTask(id);
        if (physical?.physicalTemplate === 'bring_n' && failure.target !== undefined) {
          physical.target = failure.target;
          physical.prompt = `Bring me ${failure.target} small things from nearby.`;
        }
        if (physical && matches(physical)) retry = physical;
      }
      if (retry) tasks[i + (model ? 1 : 0)] = retry;
    }
    return tasks;
  }
  const counts = Array.from({ length: 10 }, (_, index) => {
    const target = 1 + index % 5;
    const direction = index % 2 === 0 ? 'symbol_to_quantity' : 'quantity_to_symbol';
    return progress.attempts.filter(a => a.skillId === id && a.target === target && a.responseDirection === direction && a.correct && a.helpLevel === 'none').length;
  });
  const tasks = model ? buildSkillTasks(id, evidence, 0, true) : [];
  // A retention retry takes priority, then select the least-assessed pairs.
  const failures = progress.skills[id].reviewFailures ?? [];
  const retryIndices = failures.map(a => Array.from({ length: 10 }, (_, i) => i).find(i => 1 + i % 5 === a.target && (i % 2 === 0 ? 'symbol_to_quantity' : 'quantity_to_symbol') === a.responseDirection)).filter((i): i is number => i !== undefined);
  for (let n = 0; n < count; n++) {
    const index = retryIndices[n] ?? counts.indexOf(Math.min(...counts));
    tasks.push(...buildSkillTasks(id, evidence, 1, false, index));
    counts[index] += 1;
  }
  return tasks;
}

/** Practice and Explore for one lesson's concept (guided lessons are built in lessons.ts). */
export function buildMathSessionPlan(progress: MathProgress, mode: MathSessionMode, primarySkillId: MathSkillId): MathSessionPlan {
  const reviewSkillIds = mode === 'guided' ? mathDueSkills(progress).filter((id) => id !== primarySkillId).slice(0, 2) : [];
  const tasks: MathTask[] = [];

  for (const id of reviewSkillIds) {
    const state = progress.skills[id];
    // A provisional concept's review is its cold check, which needs enough answers to pass.
    const coldCheck = state.phase === 'provisional';
    tasks.push(...savedTasks(progress, id, coldCheck ? 'cold' : 'independent', coldCheck ? MATH_COLD_CHECK_ANSWERS : 1, false));
  }

  const primaryState = progress.skills[primarySkillId];
  const unseen = mode === 'explore' || primaryState.phase === 'unseen';
  const evidence = mode === 'practice' ? 'independent' : primaryState.phase === 'provisional' ? 'cold' : 'independent';
  tasks.push(...(mode === 'explore' ? buildSkillTasks(primarySkillId, evidence, 5, unseen) : savedTasks(progress, primarySkillId, evidence, 4, unseen)));

  if (mode === 'guided' && progress.settings.physicalPrompts) {
    const guidedSessions = progress.sessions.filter((s) => s.mode === 'guided').length;
    if (guidedSessions % 3 === 2) {
      const physical = buildPhysicalTask(primarySkillId);
      if (physical) tasks.push(physical);
    }
  }

  return { primarySkillId, reviewSkillIds, tasks };
}
