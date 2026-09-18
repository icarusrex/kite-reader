declare const process: { exit(code?: number): never };
import { MATH_SKILLS, MathSkillId } from '../src/modules/math/content/skills';

const errors: string[] = [];
const ids = new Set<string>();
for (const skill of MATH_SKILLS) {
  if (ids.has(skill.id)) errors.push(`duplicate skill id: ${skill.id}`);
  ids.add(skill.id);
  if (!skill.goal.trim()) errors.push(`${skill.id}: missing goal`);
  if (!skill.observableChange.trim()) errors.push(`${skill.id}: missing observableChange`);
  if (!skill.taskFamilies.length) errors.push(`${skill.id}: no task families`);
  if (!skill.representations.length) errors.push(`${skill.id}: no representations`);
}
for (const skill of MATH_SKILLS) {
  for (const id of [...skill.hardPrerequisites, ...skill.softPrerequisites]) if (!ids.has(id)) errors.push(`${skill.id}: missing prerequisite ${id}`);
}

const hard = new Map<MathSkillId, MathSkillId[]>(MATH_SKILLS.map((s) => [s.id, s.hardPrerequisites]));
const visiting = new Set<MathSkillId>();
const visited = new Set<MathSkillId>();
function visit(id: MathSkillId, path: MathSkillId[] = []) {
  if (visiting.has(id)) { errors.push(`hard-prerequisite cycle: ${[...path, id].join(' -> ')}`); return; }
  if (visited.has(id)) return;
  visiting.add(id);
  for (const next of hard.get(id) ?? []) visit(next, [...path, id]);
  visiting.delete(id);
  visited.add(id);
}
for (const skill of MATH_SKILLS) visit(skill.id);

const roots = MATH_SKILLS.filter((s) => !s.hardPrerequisites.length);
if (!roots.some((s) => s.domain === 'number')) errors.push('no root number skill');
if (!roots.some((s) => s.domain !== 'number')) errors.push('no parallel non-number root skill');

if (errors.length) {
  console.error(`Math curriculum validation failed (${errors.length})`);
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}
console.log(`Math curriculum OK: ${MATH_SKILLS.length} skills, ${roots.length} roots, no hard-prerequisite cycles.`);
