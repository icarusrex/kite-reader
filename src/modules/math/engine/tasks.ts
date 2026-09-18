import {
  MathErrorCode,
  MathRepresentation,
  MathResponseDirection,
  MathSkillId,
  MathTaskFamily,
  MATH_SKILL_BY_ID,
} from '../content/skills';
import { MathEvidenceKind } from './state';

export type BasicShape = 'circle' | 'triangle' | 'square' | 'rectangle';
export type CompareAnswer = 'left' | 'right' | 'same';

export type MathTaskKind =
  | 'model'
  | 'parent_score'
  | 'tap_count'
  | 'quantity_choice'
  | 'construct'
  | 'compare'
  | 'partition'
  | 'order_numbers'
  | 'story_operation'
  | 'shape_choice'
  | 'shape_compose'
  | 'length_compare'
  | 'physical';

export interface MathTask {
  uid: string;
  skillId: MathSkillId;
  kind: MathTaskKind;
  prompt: string;
  taskFamily: MathTaskFamily;
  representation: MathRepresentation;
  responseDirection: MathResponseDirection;
  evidenceKind: MathEvidenceKind;
  expectedError?: MathErrorCode;
  model?: boolean;
  target?: number;
  quantity?: number;
  options?: number[];
  left?: number;
  right?: number;
  compareAnswer?: CompareAnswer;
  numeral?: number;
  partitionMode?: 'make_split' | 'hidden_part';
  orderValues?: number[];
  operation?: 'add' | 'subtract' | 'more1' | 'less1';
  operationAnswer?: number;
  shapeComposeAnswer?: 'two_triangles' | 'two_circles' | 'rectangle_circle';
  visiblePart?: number;
  hiddenPart?: number;
  shapeTarget?: BasicShape;
  shapeOptions?: { shape: BasicShape; rotation: number }[];
  leftLength?: number;
  rightLength?: number;
  leftOffset?: number;
  rightOffset?: number;
  physicalTemplate?: 'bring_n' | 'compare_objects';
}

let nextTaskId = 0;
const uid = () => `m${Date.now().toString(36)}-${++nextTaskId}`;
const int = (min: number, max: number) => min + Math.floor(Math.random() * (max - min + 1));
const shuffle = <T,>(items: T[]) => {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
};

const numberOptions = (answer: number, max: number) => {
  const distractors = shuffle(Array.from({ length: max }, (_, i) => i + 1).filter((n) => n !== answer)).slice(0, 2);
  return shuffle([answer, ...distractors]);
};

const base = (
  skillId: MathSkillId,
  kind: MathTaskKind,
  prompt: string,
  taskFamily: MathTaskFamily,
  representation: MathRepresentation,
  responseDirection: MathResponseDirection,
  evidenceKind: MathEvidenceKind,
): MathTask => ({ uid: uid(), skillId, kind, prompt, taskFamily, representation, responseDirection, evidenceKind });

export function modelTask(skillId: MathSkillId): MathTask {
  const spec = MATH_SKILL_BY_ID[skillId];
  return {
    ...base(skillId, 'model', spec.goal, spec.taskFamilies[0], spec.representations[0], 'recognize', 'guided'),
    model: true,
  };
}

function taskFor(skillId: MathSkillId, index: number, evidenceKind: MathEvidenceKind): MathTask {
  switch (skillId) {
    case 'num.count.verbal.1_5': {
      const prompts = ['Count from 1 to 5.', 'Start at 1 and stop at 4.', 'Finish this: 1, 2, 3…', 'What comes after 4?'];
      return base(skillId, 'parent_score', prompts[index % prompts.length], 'verbal_count', 'spoken', 'produce', evidenceKind);
    }
    case 'num.count.one_to_one.1_3': {
      const quantity = 1 + (index % 3);
      return {
        ...base(skillId, 'tap_count', 'Touch each star once while you count.', 'count_objects', index % 2 ? 'objects' : 'random_dots', 'produce', evidenceKind),
        quantity,
        expectedError: 'count.double',
      };
    }
    case 'num.cardinality.1_3': {
      const quantity = 1 + (index % 3);
      return {
        ...base(skillId, 'quantity_choice', 'How many are there altogether?', index % 2 ? 'report_cardinality' : 'count_objects', index % 2 ? 'random_dots' : 'objects', 'recognize', evidenceKind),
        quantity,
        options: numberOptions(quantity, 3),
        expectedError: 'cardinality.recount',
      };
    }
    case 'num.subitize.perceptual.1_3': {
      const quantity = 1 + (index % 3);
      return {
        ...base(skillId, 'quantity_choice', 'How many did you see?', 'recognize_quantity', index % 2 ? 'random_dots' : 'structured_dots', 'recognize', evidenceKind),
        quantity,
        options: numberOptions(quantity, 3),
        expectedError: 'quantity.pattern_memorized',
      };
    }
    case 'num.construct.1_3': {
      const target = 1 + (index % 3);
      return {
        ...base(skillId, 'construct', `Make ${target}.`, 'construct_quantity', 'objects', 'construct', evidenceKind),
        target,
        expectedError: 'response.guess',
      };
    }
    case 'num.map.numeral.1_3': {
      const target = 1 + (index % 3);
      if (index % 2 === 0) {
        return {
          ...base(skillId, 'construct', `This is ${target}. Make that many.`, 'map_numeral_quantity', 'numeral', 'symbol_to_quantity', evidenceKind),
          numeral: target,
          target,
          expectedError: 'numeral.disconnected',
        };
      }
      return {
        ...base(skillId, 'quantity_choice', 'Which numeral matches this amount?', 'map_numeral_quantity', 'random_dots', 'quantity_to_symbol', evidenceKind),
        quantity: target,
        options: numberOptions(target, 3),
        expectedError: 'numeral.disconnected',
      };
    }
    case 'num.compare.quantity.1_3': {
      const pairs: [number, number][] = [[1, 3], [3, 2], [2, 2], [2, 3]];
      const [left, right] = pairs[index % pairs.length];
      const compareAnswer: CompareAnswer = left === right ? 'same' : left > right ? 'left' : 'right';
      return {
        ...base(skillId, 'compare', 'Which side has more? Choose SAME if they match.', 'compare_sets', index % 2 ? 'objects' : 'random_dots', 'compare', evidenceKind),
        left,
        right,
        compareAnswer,
        expectedError: 'comparison.spatial_extent',
      };
    }
    case 'num.count.cardinal.1_5': {
      const quantity = index % 2 ? 4 : 5;
      return {
        ...base(skillId, 'quantity_choice', 'Count them. How many altogether?', index % 2 ? 'count_objects' : 'report_cardinality', index % 2 ? 'objects' : 'random_dots', 'recognize', evidenceKind),
        quantity,
        options: numberOptions(quantity, 5),
        expectedError: 'cardinality.recount',
      };
    }
    case 'num.subitize.structured.4_5': {
      const quantity = index % 2 ? 4 : 5;
      return {
        ...base(skillId, 'quantity_choice', 'How many do you see?', 'recognize_quantity', index % 2 ? 'structured_dots' : 'five_frame', 'recognize', evidenceKind),
        quantity,
        options: shuffle([3, 4, 5]),
        expectedError: 'quantity.pattern_memorized',
      };
    }
    case 'num.compare.quantity.1_5': {
      const pairs: [number, number][] = [[4, 5], [5, 3], [4, 4], [2, 5]];
      const [left, right] = pairs[index % pairs.length];
      const compareAnswer: CompareAnswer = left === right ? 'same' : left > right ? 'left' : 'right';
      return {
        ...base(skillId, 'compare', 'Which side has more? Choose SAME if they match.', 'compare_sets', index % 2 ? 'objects' : 'random_dots', 'compare', evidenceKind),
        left, right, compareAnswer, expectedError: 'comparison.spatial_extent',
      };
    }
    case 'num.compose.2_4': {
      const target = 2 + (index % 3);
      if (index % 2 === 0) {
        return {
          ...base(skillId, 'partition', `Split ${target} into two groups.`, 'partition_whole', 'objects', 'partition', evidenceKind),
          target,
          partitionMode: 'make_split',
          expectedError: 'partwhole.total_changes',
        };
      }
      const visiblePart = Math.max(1, target - 1);
      return {
        ...base(skillId, 'partition', `${target} is the whole. You can see ${visiblePart}. How many are hidden?`, 'partition_whole', 'structured_dots', 'recognize', evidenceKind),
        target,
        partitionMode: 'hidden_part',
        visiblePart,
        hiddenPart: target - visiblePart,
        options: numberOptions(target - visiblePart, target),
        expectedError: 'partwhole.hidden_part',
      };
    }
    case 'num.compose.5': {
      if (index % 2 === 0) {
        return {
          ...base(skillId, 'partition', 'Split 5 into two groups. Make a different-looking five.', 'partition_whole', index % 4 === 0 ? 'five_frame' : 'objects', 'partition', evidenceKind),
          target: 5,
          partitionMode: 'make_split',
          expectedError: 'partwhole.total_changes',
        };
      }
      const visiblePart = index % 4 === 1 ? 2 : 3;
      return {
        ...base(skillId, 'partition', `There are 5 altogether. ${visiblePart} are showing. How many are hidden?`, 'partition_whole', 'structured_dots', 'recognize', evidenceKind),
        target: 5,
        partitionMode: 'hidden_part',
        visiblePart,
        hiddenPart: 5 - visiblePart,
        options: numberOptions(5 - visiblePart, 5),
        expectedError: 'partwhole.hidden_part',
      };
    }
    case 'num.map.numeral.1_5': {
      const target = 1 + (index % 5);
      if (index % 2 === 0) {
        return {
          ...base(skillId, 'construct', `This is ${target}. Make that many.`, 'map_numeral_quantity', 'numeral', 'symbol_to_quantity', evidenceKind),
          numeral: target, target, expectedError: 'numeral.disconnected',
        };
      }
      return {
        ...base(skillId, 'quantity_choice', 'Which numeral matches this amount?', 'map_numeral_quantity', index % 4 === 1 ? 'random_dots' : 'five_frame', 'quantity_to_symbol', evidenceKind),
        quantity: target, options: numberOptions(target, 5), expectedError: 'numeral.disconnected',
      };
    }
    case 'num.order.1_5': {
      const sets = [[1, 3, 2], [5, 3, 4], [2, 4, 3], [1, 5, 3]];
      return {
        ...base(skillId, 'order_numbers', 'Tap the numbers from smallest to largest.', 'order_quantities', index % 2 ? 'numeral' : 'objects', 'order', evidenceKind),
        orderValues: shuffle(sets[index % sets.length]),
        expectedError: 'response.guess',
      };
    }
    case 'op.add.combine.to5': {
      const cases: [number, number][] = [[1, 1], [2, 1], [2, 2], [3, 2]];
      const [left, right] = cases[index % cases.length];
      const answer = left + right;
      return {
        ...base(skillId, 'story_operation', `${left} frogs are here. ${right} more join. How many now?`, 'combine_story', index % 2 ? 'objects' : 'structured_dots', 'transform', evidenceKind),
        left, right, operation: 'add', operationAnswer: answer, options: numberOptions(answer, 5),
      };
    }
    case 'op.subtract.separate.to5': {
      const cases: [number, number][] = [[3, 1], [4, 1], [5, 2], [4, 2]];
      const [left, right] = cases[index % cases.length];
      const answer = left - right;
      return {
        ...base(skillId, 'story_operation', `${left} apples are here. ${right} go away. How many are left?`, 'separate_story', index % 2 ? 'objects' : 'structured_dots', 'transform', evidenceKind),
        left, right, operation: 'subtract', operationAnswer: answer, options: numberOptions(answer, 5),
      };
    }
    case 'num.successor.predecessor.to5': {
      const start = index % 2 ? 3 : 4;
      const operation = index % 2 ? 'more1' as const : 'less1' as const;
      const answer = operation === 'more1' ? start + 1 : start - 1;
      return {
        ...base(skillId, 'story_operation', operation === 'more1' ? `${start}. Add exactly one. What number now?` : `${start}. Take away exactly one. What number now?`, 'one_more_less', index % 2 ? 'objects' : 'structured_dots', 'transform', evidenceKind),
        left: start, right: 1, operation, operationAnswer: answer, options: numberOptions(answer, 5),
      };
    }
    case 'geo.shape.properties.basic': {
      const shapes: BasicShape[] = ['triangle', 'square', 'circle', 'rectangle'];
      const target = shapes[index % shapes.length];
      const options = shuffle(shapes).slice(0, 3);
      if (!options.includes(target)) options[0] = target;
      return {
        ...base(skillId, 'shape_choice', `Find the ${target}.`, 'shape_classify', 'shape', 'classify', evidenceKind),
        shapeTarget: target,
        shapeOptions: shuffle(options.map((shape, i) => ({ shape, rotation: (index * 37 + i * 29) % 180 }))),
        expectedError: 'shape.prototype',
      };
    }
    case 'geo.compose.shapes.basic': {
      return {
        ...base(skillId, 'shape_compose', 'Which pair can make a square?', 'shape_compose', 'shape', 'classify', evidenceKind),
        shapeComposeAnswer: 'two_triangles',
        expectedError: 'shape.prototype',
      };
    }
    case 'measure.length.direct': {
      const cases = [[70, 110], [120, 85], [100, 100], [90, 125]] as const;
      const [leftLength, rightLength] = cases[index % cases.length];
      const answer: CompareAnswer = leftLength === rightLength ? 'same' : leftLength > rightLength ? 'left' : 'right';
      return {
        ...base(skillId, 'length_compare', 'Line up the starts. Which is longer?', 'length_compare', 'objects', 'compare', evidenceKind),
        leftLength,
        rightLength,
        leftOffset: index % 2 ? 30 : 5,
        rightOffset: index % 2 ? 5 : 35,
        compareAnswer: answer,
        expectedError: 'measurement.endpoint',
      };
    }
  }
}

export function buildSkillTasks(skillId: MathSkillId, evidenceKind: MathEvidenceKind, count = 4, includeModel = false): MathTask[] {
  const tasks: MathTask[] = [];
  if (includeModel) tasks.push(modelTask(skillId));
  for (let i = 0; i < count; i++) tasks.push(taskFor(skillId, i, evidenceKind));
  return tasks;
}

export function buildPhysicalTask(skillId: MathSkillId): MathTask | null {
  const spec = MATH_SKILL_BY_ID[skillId];
  const template = spec.physicalTransferTemplates?.[0];
  if (!template) return null;
  if (template === 'bring_n') {
    const target = skillId === 'num.count.cardinal.1_5' ? int(4, 5) : int(1, 3);
    return {
      ...base(skillId, 'physical', `Bring me ${target} small things from nearby.`, 'physical_transfer', 'physical', 'construct', 'physical'),
      target,
      physicalTemplate: template,
    };
  }
  return {
    ...base(skillId, 'physical', 'Find two objects. Put their starts together. Which one is longer?', 'physical_transfer', 'physical', 'compare', 'physical'),
    physicalTemplate: 'compare_objects',
  };
}
