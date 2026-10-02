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
  | 'physical'
  | 'banner';

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
  /** Which part of a lesson this belongs to, as Reading's steps do. */
  phase?: 'main' | 'checkout' | 'cold';
  /** Spaced review of an earlier, passed lesson. */
  review?: boolean;
  bannerEmoji?: string;
  /** The child says the answer and the grown-up taps ✓/✗ — for numbers before numerals are taught. */
  spokenAnswer?: boolean;
  /** Picture used for the objects, so the picture matches the words ("frogs" shows frogs). */
  emoji?: string;
  /** make_split: the split asked for, e.g. 3 as 1 and 2. */
  splitLeft?: number;
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
    // The heading is read aloud, so it uses the child-facing `title`
    // ("Counting words to 5"), not `goal` — which is the curriculum statement
    // written for grown-ups and was being spoken at a four-year-old:
    // "Produce the stable number-word sequence from one to five."
    // The teaching sentence under it still explains the idea in child language.
    ...base(skillId, 'model', spec.title, spec.taskFamilies[0], spec.representations[0], 'recognize', 'guided'),
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
      const dots = index % 2 === 0;
      return {
        ...base(skillId, 'tap_count', `Touch each ${dots ? 'dot' : 'star'} once while you count.`, 'count_objects', dots ? 'random_dots' : 'objects', 'produce', evidenceKind),
        quantity,
        expectedError: 'count.double',
      };
    }
    case 'num.cardinality.1_3': {
      const quantity = 1 + (index % 3);
      return {
        ...base(skillId, 'quantity_choice', 'Count them. How many? Say it!', index % 2 ? 'report_cardinality' : 'count_objects', index % 2 ? 'random_dots' : 'objects', 'recognize', evidenceKind),
        quantity,
        spokenAnswer: true,
        expectedError: 'cardinality.recount',
      };
    }
    case 'num.subitize.perceptual.1_3': {
      const quantity = 1 + (index % 3);
      return {
        ...base(skillId, 'quantity_choice', 'Quick look! How many dots? Say it!', 'recognize_quantity', index % 2 ? 'random_dots' : 'structured_dots', 'recognize', evidenceKind),
        quantity,
        spokenAnswer: true,
        expectedError: 'quantity.pattern_memorized',
      };
    }
    case 'num.construct.1_3': {
      const target = 1 + (index % 3);
      return {
        ...base(skillId, 'construct', `Pick ${target} strawberr${target === 1 ? 'y' : 'ies'}.`, 'construct_quantity', 'objects', 'construct', evidenceKind),
        target,
        expectedError: 'response.guess',
      };
    }
    case 'num.map.numeral.1_3': {
      const target = 1 + (index % 3);
      if (index % 2 === 0) {
        return {
          ...base(skillId, 'construct', `This is ${target}. Pick that many strawberries.`, 'map_numeral_quantity', 'numeral', 'symbol_to_quantity', evidenceKind),
          numeral: target,
          target,
          expectedError: 'numeral.disconnected',
        };
      }
      return {
        ...base(skillId, 'quantity_choice', 'Which number says how many dots?', 'map_numeral_quantity', 'random_dots', 'quantity_to_symbol', evidenceKind),
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
      const quantity = [4, 5, 3, 2, 5][index % 5]; // odd length, so both task forms meet every amount
      return {
        ...base(skillId, 'quantity_choice', 'Count them. How many? Say it!', index % 2 ? 'count_objects' : 'report_cardinality', index % 2 ? 'objects' : 'random_dots', 'recognize', evidenceKind),
        quantity,
        spokenAnswer: true,
        expectedError: 'cardinality.recount',
      };
    }
    case 'num.subitize.structured.4_5': {
      const quantity = [4, 5, 5, 4, 3][index % 5];
      return {
        ...base(skillId, 'quantity_choice', 'Quick look! How many dots? Say it!', 'recognize_quantity', index % 2 ? 'structured_dots' : 'five_frame', 'recognize', evidenceKind),
        quantity,
        spokenAnswer: true,
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
        const splitLeft = target === 2 ? 1 : 1 + (index % (target - 1));
        return {
          ...base(skillId, 'partition', `Make ${target} into ${splitLeft} and ${target - splitLeft}.`, 'partition_whole', 'objects', 'partition', evidenceKind),
          target,
          splitLeft,
          partitionMode: 'make_split',
          expectedError: 'partwhole.total_changes',
        };
      }
      const visiblePart = 1 + ((index >> 1) % (target - 1));
      return {
        ...base(skillId, 'partition', `There are ${target} dots. You can see ${visiblePart}. How many are hiding under the cover?`, 'partition_whole', 'structured_dots', 'recognize', evidenceKind),
        target,
        partitionMode: 'hidden_part',
        visiblePart,
        hiddenPart: target - visiblePart,
        options: numberOptions(target - visiblePart, 3), // only 1–3 are taught as numerals by now
        expectedError: 'partwhole.hidden_part',
      };
    }
    case 'num.compose.5': {
      if (index % 2 === 0) {
        const splitLeft = [1, 2, 3, 4][(index >> 1) % 4];
        return {
          ...base(skillId, 'partition', `Make 5 into ${splitLeft} and ${5 - splitLeft}.`, 'partition_whole', index % 4 === 0 ? 'five_frame' : 'objects', 'partition', evidenceKind),
          target: 5,
          splitLeft,
          partitionMode: 'make_split',
          expectedError: 'partwhole.total_changes',
        };
      }
      const visiblePart = index % 4 === 1 ? 2 : 3;
      return {
        ...base(skillId, 'partition', `There are 5 dots. You can see ${visiblePart}. How many are hiding under the cover?`, 'partition_whole', 'structured_dots', 'recognize', evidenceKind),
        target: 5,
        partitionMode: 'hidden_part',
        visiblePart,
        hiddenPart: 5 - visiblePart,
        options: numberOptions(5 - visiblePart, 3), // answers are 2 or 3; 4 and 5 are not taught as numerals yet
        expectedError: 'partwhole.hidden_part',
      };
    }
    case 'num.map.numeral.1_5': {
      const target = 1 + (index % 5);
      if (index % 2 === 0) {
        return {
          ...base(skillId, 'construct', `This is ${target}. Pick that many strawberries.`, 'map_numeral_quantity', 'numeral', 'symbol_to_quantity', evidenceKind),
          numeral: target, target, expectedError: 'numeral.disconnected',
        };
      }
      return {
        ...base(skillId, 'quantity_choice', 'Which number says how many dots?', 'map_numeral_quantity', index % 4 === 1 ? 'random_dots' : 'five_frame', 'quantity_to_symbol', evidenceKind),
        quantity: target, options: numberOptions(target, 5), expectedError: 'numeral.disconnected',
      };
    }
    case 'num.order.1_5': {
      const sets = [[1, 3, 2], [5, 3, 4], [2, 4, 3], [1, 5, 3]];
      return {
        ...base(skillId, 'order_numbers', index % 2 ? 'Tap the numbers from smallest to biggest.' : 'Tap the groups from fewest dots to most dots.', 'order_quantities', index % 2 ? 'numeral' : 'objects', 'order', evidenceKind),
        orderValues: shuffle(sets[index % sets.length]),
        expectedError: 'response.guess',
      };
    }
    case 'op.add.combine.to5': {
      const cases: [number, number][] = [[1, 1], [2, 1], [2, 2], [3, 2]];
      const [left, right] = cases[index % cases.length];
      const answer = left + right;
      const frogs = index % 2 === 1;
      return {
        ...base(skillId, 'story_operation', frogs ? `${left} frog${left === 1 ? ' is' : 's are'} here. ${right === 1 ? 'One more comes' : `${right} more come`}. How many frogs now?` : `${left} dot${left === 1 ? '' : 's'} here. ${right === 1 ? 'One more comes' : `${right} more come`}. How many dots now?`, 'combine_story', frogs ? 'objects' : 'structured_dots', 'transform', evidenceKind),
        emoji: '🐸', left, right, operation: 'add', operationAnswer: answer, options: numberOptions(answer, 5),
      };
    }
    case 'op.subtract.separate.to5': {
      const cases: [number, number][] = [[3, 1], [4, 1], [5, 2], [4, 2]];
      const [left, right] = cases[index % cases.length];
      const answer = left - right;
      const apples = index % 2 === 1;
      return {
        ...base(skillId, 'story_operation', apples ? `${left} apples. ${right === 1 ? 'One gets' : `${right} get`} eaten. How many apples are left?` : `${left} dots. ${right === 1 ? 'One goes' : `${right} go`} away. How many dots are left?`, 'separate_story', apples ? 'objects' : 'structured_dots', 'transform', evidenceKind),
        emoji: '🍎', left, right, operation: 'subtract', operationAnswer: answer, options: numberOptions(answer, 5),
      };
    }
    case 'num.successor.predecessor.to5': {
      const operation = index % 2 ? 'more1' as const : 'less1' as const;
      const start = operation === 'more1' ? [1, 3, 2, 4][(index >> 1) % 4] : [4, 2, 5, 3][(index >> 1) % 4];
      const answer = operation === 'more1' ? start + 1 : start - 1;
      return {
        ...base(skillId, 'story_operation', operation === 'more1' ? `Here are ${start}. One more comes. How many now?` : `Here are ${start}. One goes away. How many now?`, 'one_more_less', index % 2 ? 'objects' : 'structured_dots', 'transform', evidenceKind),
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

export function buildSkillTasks(skillId: MathSkillId, evidenceKind: MathEvidenceKind, count = 4, includeModel = false, startIndex = 0): MathTask[] {
  const tasks: MathTask[] = [];
  if (includeModel) tasks.push(modelTask(skillId));
  for (let i = 0; i < count; i++) tasks.push(taskFor(skillId, startIndex + i, evidenceKind));
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
