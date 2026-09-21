import { MathSkillId, MATH_SKILL_BY_ID, MATH_SKILLS } from '../content/skills';
import { MathProgress, MathSessionMode, mathActiveFrontier, mathDueSkills, mathLastGuidedPrimary } from './state';
import { MathTask, buildPhysicalTask, buildSkillTasks } from './tasks';

export interface MathSessionPlan {
  primarySkillId: MathSkillId;
  reviewSkillIds: MathSkillId[];
  tasks: MathTask[];
}

function lastSeen(progress: MathProgress, skillId: MathSkillId) {
  return progress.skills[skillId]?.lastEvidenceAt ?? '';
}

function chooseGuidedSkill(progress: MathProgress): MathSkillId {
  const frontier = mathActiveFrontier(progress);

  // A concept still needs evidence from two separate sessions before it can go
  // provisional, but it does not have to be the very next lesson. Serving it
  // back-to-back made every second session a repeat, and a child who was not
  // yet fluent could see the same lesson many times with no way past it.
  // Interleaving keeps the spacing requirement (and spaces the practice, which
  // is better for retention anyway) while each new session opens new material.
  const justDone = mathLastGuidedPrimary(progress);
  const notJustDone = (ids: MathSkillId[]) => {
    const rest = ids.filter((id) => id !== justDone);
    return rest.length ? rest : ids;
  };

  const developing = notJustDone(frontier.filter((id) => progress.skills[id].phase === 'introduced' || progress.skills[id].phase === 'practicing'));
  const unseenNow = frontier.filter((id) => progress.skills[id].phase === 'unseen');
  // After a lesson, prefer opening something new over repeating the same one.
  if (justDone && developing.length && developing.every((id) => id === justDone) && unseenNow.length) {
    return [...unseenNow].sort((a, b) => MATH_SKILL_BY_ID[a].priority - MATH_SKILL_BY_ID[b].priority)[0];
  }
  if (developing.length) {
    return [...developing].sort((a, b) => lastSeen(progress, a).localeCompare(lastSeen(progress, b)) || MATH_SKILL_BY_ID[a].priority - MATH_SKILL_BY_ID[b].priority)[0];
  }

  const unseen = frontier.filter((id) => progress.skills[id].phase === 'unseen');
  if (unseen.length) {
    const recentGuided = progress.sessions.filter((s) => s.mode === 'guided').slice(-4);
    const recentHasNonNumber = recentGuided.some((session) => session.skillIds.some((id) => MATH_SKILL_BY_ID[id].domain !== 'number'));
    const preferNonNumber = recentGuided.length >= 3 && !recentHasNonNumber;
    const sorted = [...unseen].sort((a, b) => MATH_SKILL_BY_ID[a].priority - MATH_SKILL_BY_ID[b].priority);
    return (preferNonNumber ? sorted.find((id) => MATH_SKILL_BY_ID[id].domain !== 'number') : sorted.find((id) => MATH_SKILL_BY_ID[id].domain === 'number')) ?? sorted[0];
  }

  const provisional = MATH_SKILLS.filter((s) => progress.skills[s.id].phase === 'provisional').sort((a, b) => lastSeen(progress, a.id).localeCompare(lastSeen(progress, b.id)));
  return mathDueSkills(progress)[0] ?? provisional[0]?.id ?? MATH_SKILLS[0].id;
}

function choosePracticeSkill(progress: MathProgress): MathSkillId {
  const due = mathDueSkills(progress);
  if (due.length) return due[0];
  const reached = MATH_SKILLS
    .filter((s) => progress.skills[s.id].phase !== 'unseen')
    .sort((a, b) => lastSeen(progress, a.id).localeCompare(lastSeen(progress, b.id)) || a.priority - b.priority);
  return reached[0]?.id ?? chooseGuidedSkill(progress);
}

function savedTasks(progress: MathProgress, id: MathSkillId, evidence: Parameters<typeof buildSkillTasks>[1], count: number, model: boolean) {
  if (id !== 'num.map.numeral.1_5') return buildSkillTasks(id, evidence, count, model);
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

export function buildMathSessionPlan(progress: MathProgress, mode: MathSessionMode, requestedSkillId?: MathSkillId): MathSessionPlan {
  const primarySkillId = requestedSkillId ?? (mode === 'practice' ? choosePracticeSkill(progress) : chooseGuidedSkill(progress));
  const reviewSkillIds = mode === 'guided' ? mathDueSkills(progress).filter((id) => id !== primarySkillId).slice(0, 2) : [];
  const tasks: MathTask[] = [];

  for (const id of reviewSkillIds) {
    const state = progress.skills[id];
    const evidence = state.phase === 'provisional' ? 'cold' : 'independent';
    tasks.push(...savedTasks(progress, id, evidence, 1, false));
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
