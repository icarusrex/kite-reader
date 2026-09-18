import { MathSkillId, MATH_SKILL_BY_ID, MATH_SKILLS } from '../content/skills';
import { MathProgress, MathSessionMode, mathActiveFrontier, mathDueSkills } from './state';
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
  const developing = frontier.filter((id) => progress.skills[id].phase === 'introduced' || progress.skills[id].phase === 'practicing');
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

export function buildMathSessionPlan(progress: MathProgress, mode: MathSessionMode, requestedSkillId?: MathSkillId): MathSessionPlan {
  const primarySkillId = requestedSkillId ?? (mode === 'practice' ? choosePracticeSkill(progress) : chooseGuidedSkill(progress));
  const reviewSkillIds = mode === 'guided' ? mathDueSkills(progress).filter((id) => id !== primarySkillId).slice(0, 2) : [];
  const tasks: MathTask[] = [];

  for (const id of reviewSkillIds) {
    const state = progress.skills[id];
    const evidence = state.phase === 'provisional' ? 'cold' : 'independent';
    tasks.push(...buildSkillTasks(id, evidence, 1, false));
  }

  const primaryState = progress.skills[primarySkillId];
  const unseen = mode === 'explore' || primaryState.phase === 'unseen';
  const evidence = mode === 'practice' ? 'independent' : primaryState.phase === 'provisional' ? 'cold' : 'independent';
  tasks.push(...buildSkillTasks(primarySkillId, evidence, mode === 'explore' ? 5 : 4, unseen));

  if (mode === 'guided' && progress.settings.physicalPrompts) {
    const guidedSessions = progress.sessions.filter((s) => s.mode === 'guided').length;
    if (guidedSessions % 3 === 2) {
      const physical = buildPhysicalTask(primarySkillId);
      if (physical) tasks.push(physical);
    }
  }

  return { primarySkillId, reviewSkillIds, tasks };
}
