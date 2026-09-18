export type MathDomain = 'number' | 'operations' | 'geometry' | 'spatial' | 'measurement' | 'patterns' | 'classification' | 'data';

export type MathSkillId =
  | 'num.count.verbal.1_5'
  | 'num.count.one_to_one.1_3'
  | 'num.cardinality.1_3'
  | 'num.subitize.perceptual.1_3'
  | 'num.construct.1_3'
  | 'num.map.numeral.1_3'
  | 'num.compare.quantity.1_3'
  | 'num.count.cardinal.1_5'
  | 'num.subitize.structured.4_5'
  | 'num.compare.quantity.1_5'
  | 'num.compose.2_4'
  | 'num.compose.5'
  | 'num.map.numeral.1_5'
  | 'num.order.1_5'
  | 'op.add.combine.to5'
  | 'op.subtract.separate.to5'
  | 'num.successor.predecessor.to5'
  | 'geo.shape.properties.basic'
  | 'geo.compose.shapes.basic'
  | 'measure.length.direct';

export type MathTaskFamily =
  | 'verbal_count'
  | 'count_objects'
  | 'report_cardinality'
  | 'recognize_quantity'
  | 'construct_quantity'
  | 'map_numeral_quantity'
  | 'compare_sets'
  | 'order_quantities'
  | 'partition_whole'
  | 'combine_story'
  | 'separate_story'
  | 'one_more_less'
  | 'shape_classify'
  | 'shape_compose'
  | 'length_compare'
  | 'physical_transfer';

export type MathRepresentation =
  | 'spoken'
  | 'objects'
  | 'random_dots'
  | 'structured_dots'
  | 'fingers'
  | 'five_frame'
  | 'numeral'
  | 'shape'
  | 'physical';

export type MathResponseDirection =
  | 'produce'
  | 'recognize'
  | 'construct'
  | 'quantity_to_symbol'
  | 'symbol_to_quantity'
  | 'compare'
  | 'order'
  | 'partition'
  | 'transform'
  | 'classify';

export type MathErrorCode =
  | 'count.skip'
  | 'count.double'
  | 'cardinality.recount'
  | 'quantity.pattern_memorized'
  | 'comparison.spatial_extent'
  | 'numeral.disconnected'
  | 'language.more_less'
  | 'partwhole.total_changes'
  | 'partwhole.hidden_part'
  | 'shape.prototype'
  | 'measurement.endpoint'
  | 'response.guess';

export interface MathSkillSpec {
  id: MathSkillId;
  title: string;
  domain: MathDomain;
  goal: string;
  observableChange: string;
  hardPrerequisites: MathSkillId[];
  softPrerequisites: MathSkillId[];
  taskFamilies: MathTaskFamily[];
  representations: MathRepresentation[];
  misconceptionCodes: MathErrorCode[];
  priority: number;
  minFormsForProvisional?: 1 | 2;
  physicalTransferTemplates?: ('bring_n' | 'compare_objects')[];
}

export const MATH_SKILLS: MathSkillSpec[] = [
  {
    id: 'num.count.verbal.1_5', title: 'Counting words to 5', domain: 'number', priority: 1,
    goal: 'Produce the stable number-word sequence from one to five.',
    observableChange: 'The child can recite, continue and complete the count sequence through five without skipping or reordering words.',
    hardPrerequisites: [], softPrerequisites: [], minFormsForProvisional: 1,
    taskFamilies: ['verbal_count'], representations: ['spoken'], misconceptionCodes: [],
  },
  {
    id: 'num.count.one_to_one.1_3', title: 'Count each thing once', domain: 'number', priority: 2,
    goal: 'Coordinate one counting word with one object for sets of one to three.',
    observableChange: 'The child reliably assigns exactly one number word to each object, including when the objects are not in a neat row.',
    hardPrerequisites: ['num.count.verbal.1_5'], softPrerequisites: [],
    taskFamilies: ['count_objects'], representations: ['objects', 'random_dots', 'physical'], misconceptionCodes: ['count.skip', 'count.double'],
    physicalTransferTemplates: ['bring_n'],
  },
  {
    id: 'num.cardinality.1_3', title: 'How many? 1–3', domain: 'number', priority: 3,
    goal: 'Understand that the last counting word names the quantity of the whole set.',
    observableChange: 'After counting one to three objects, the child can report how many without treating the count as a chant that must restart.',
    hardPrerequisites: ['num.count.one_to_one.1_3'], softPrerequisites: [],
    taskFamilies: ['count_objects', 'report_cardinality'], representations: ['objects', 'random_dots', 'physical'], misconceptionCodes: ['cardinality.recount'],
    physicalTransferTemplates: ['bring_n'],
  },
  {
    id: 'num.subitize.perceptual.1_3', title: 'See 1–3 at a glance', domain: 'number', priority: 4,
    goal: 'Recognize exact quantities one to three without serial counting.',
    observableChange: 'The child recognizes one, two and three across varied arrangements rather than memorizing one familiar dot picture.',
    hardPrerequisites: [], softPrerequisites: ['num.cardinality.1_3'],
    taskFamilies: ['recognize_quantity'], representations: ['random_dots', 'structured_dots', 'fingers'], misconceptionCodes: ['quantity.pattern_memorized'],
  },
  {
    id: 'num.construct.1_3', title: 'Make 1–3', domain: 'number', priority: 5,
    goal: 'Construct an exact requested set of one to three objects.',
    observableChange: 'Given a spoken number, the child deliberately creates a set with exactly that cardinality and stops at the requested amount.',
    hardPrerequisites: ['num.cardinality.1_3'], softPrerequisites: [], minFormsForProvisional: 1,
    taskFamilies: ['construct_quantity', 'physical_transfer'], representations: ['objects', 'physical'], misconceptionCodes: ['response.guess'],
    physicalTransferTemplates: ['bring_n'],
  },
  {
    id: 'num.map.numeral.1_3', title: 'Numerals 1–3 mean quantities', domain: 'number', priority: 6,
    goal: 'Connect written numerals 1, 2 and 3 with spoken number words and exact quantities.',
    observableChange: 'The child can move both directions between a numeral and its quantity rather than only naming the printed symbol.',
    hardPrerequisites: ['num.cardinality.1_3'], softPrerequisites: ['num.construct.1_3'],
    taskFamilies: ['map_numeral_quantity', 'construct_quantity'], representations: ['numeral', 'objects', 'random_dots'], misconceptionCodes: ['numeral.disconnected'],
  },
  {
    id: 'num.compare.quantity.1_3', title: 'More, fewer, same', domain: 'number', priority: 7,
    goal: 'Compare exact quantities one to three.',
    observableChange: 'The child identifies more, fewer and equal sets even when spacing is visually misleading.',
    hardPrerequisites: ['num.cardinality.1_3'], softPrerequisites: [],
    taskFamilies: ['compare_sets'], representations: ['objects', 'random_dots'], misconceptionCodes: ['comparison.spatial_extent', 'language.more_less'],
  },
  {
    id: 'num.count.cardinal.1_5', title: 'Count and know 1–5', domain: 'number', priority: 8,
    goal: 'Extend one-to-one counting and cardinality through five.',
    observableChange: 'The child independently counts sets of four and five in varied arrangements and reports the total as a quantity.',
    hardPrerequisites: ['num.cardinality.1_3', 'num.count.verbal.1_5'], softPrerequisites: ['num.subitize.perceptual.1_3'],
    taskFamilies: ['count_objects', 'report_cardinality', 'physical_transfer'], representations: ['objects', 'random_dots', 'physical'], misconceptionCodes: ['count.skip', 'count.double', 'cardinality.recount'],
    physicalTransferTemplates: ['bring_n'],
  },
  {
    id: 'num.subitize.structured.4_5', title: 'See structure in 4 and 5', domain: 'number', priority: 9,
    goal: 'Recognize four and five from useful structures such as two-and-two or a five-frame.',
    observableChange: 'The child recognizes four and five across more than one structured arrangement and begins to notice their parts instead of always serially counting.',
    hardPrerequisites: ['num.count.cardinal.1_5'], softPrerequisites: ['num.subitize.perceptual.1_3'],
    taskFamilies: ['recognize_quantity'], representations: ['structured_dots', 'five_frame'], misconceptionCodes: ['quantity.pattern_memorized'],
  },
  {
    id: 'num.compare.quantity.1_5', title: 'Compare quantities to 5', domain: 'number', priority: 10,
    goal: 'Compare exact quantities through five, including equal and close quantities.',
    observableChange: 'The child compares quantities through five despite misleading spacing and can identify equal sets.',
    hardPrerequisites: ['num.count.cardinal.1_5'], softPrerequisites: ['num.compare.quantity.1_3'],
    taskFamilies: ['compare_sets'], representations: ['objects', 'random_dots'], misconceptionCodes: ['comparison.spatial_extent', 'language.more_less'],
  },
  {
    id: 'num.compose.2_4', title: 'Numbers have parts', domain: 'number', priority: 11,
    goal: 'Understand that two to four can be partitioned and recombined without changing the whole.',
    observableChange: 'The child can make and recognize more than one partition of the same whole while preserving its total.',
    hardPrerequisites: ['num.cardinality.1_3'], softPrerequisites: ['num.construct.1_3'],
    taskFamilies: ['partition_whole'], representations: ['objects', 'structured_dots', 'fingers'], misconceptionCodes: ['partwhole.total_changes'],
  },
  {
    id: 'num.compose.5', title: 'Ways to make 5', domain: 'number', priority: 12,
    goal: 'Build flexible part-whole understanding of five.',
    observableChange: 'The child treats five as an invariant whole across partitions such as 1+4 and 2+3 and can reason when a part is hidden.',
    hardPrerequisites: ['num.count.cardinal.1_5', 'num.compose.2_4'], softPrerequisites: ['num.subitize.perceptual.1_3'],
    taskFamilies: ['partition_whole'], representations: ['objects', 'five_frame', 'fingers', 'structured_dots'], misconceptionCodes: ['partwhole.total_changes', 'partwhole.hidden_part'],
  },
  {
    id: 'num.map.numeral.1_5', title: 'Numerals 1–5 mean quantities', domain: 'number', priority: 13,
    goal: 'Generalize numeral, spoken-number and quantity mappings through five.',
    observableChange: 'The child moves both directions between numerals one to five and varied exact quantities.',
    hardPrerequisites: ['num.count.cardinal.1_5', 'num.map.numeral.1_3'], softPrerequisites: [],
    taskFamilies: ['map_numeral_quantity', 'construct_quantity'], representations: ['numeral', 'objects', 'random_dots', 'five_frame'], misconceptionCodes: ['numeral.disconnected'],
  },
  {
    id: 'num.order.1_5', title: 'Order 1–5', domain: 'number', priority: 14,
    goal: 'Understand exact numerical order and magnitude through five.',
    observableChange: 'The child orders quantities and numerals through five and can place a missing number between its neighbors.',
    hardPrerequisites: ['num.compare.quantity.1_5', 'num.map.numeral.1_5'], softPrerequisites: [],
    taskFamilies: ['order_quantities'], representations: ['objects', 'numeral'], misconceptionCodes: ['response.guess'],
  },
  {
    id: 'op.add.combine.to5', title: 'Combine quantities to 5', domain: 'operations', priority: 15,
    goal: 'Understand addition first as combining or increasing meaningful quantities.',
    observableChange: 'The child solves varied combine/increase situations through five by modeling what happened, with counting-all accepted as a valid early strategy.',
    hardPrerequisites: ['num.compose.5', 'num.count.cardinal.1_5'], softPrerequisites: [],
    taskFamilies: ['combine_story'], representations: ['objects', 'structured_dots'], misconceptionCodes: ['response.guess'],
  },
  {
    id: 'op.subtract.separate.to5', title: 'Separate quantities to 5', domain: 'operations', priority: 16,
    goal: 'Understand subtraction first as separating or decreasing meaningful quantities.',
    observableChange: 'The child solves varied take-away/separation situations through five by tracking the whole, removed part and remaining part.',
    hardPrerequisites: ['num.compose.5', 'num.count.cardinal.1_5'], softPrerequisites: [],
    taskFamilies: ['separate_story'], representations: ['objects', 'structured_dots'], misconceptionCodes: ['partwhole.total_changes', 'response.guess'],
  },
  {
    id: 'num.successor.predecessor.to5', title: 'One more, one less', domain: 'number', priority: 17,
    goal: 'Understand adding or removing exactly one as a transformation to the adjacent number.',
    observableChange: 'The child predicts and constructs one-more/one-less transformations through five without requiring a formal number line.',
    hardPrerequisites: ['op.add.combine.to5', 'op.subtract.separate.to5'], softPrerequisites: [],
    taskFamilies: ['one_more_less'], representations: ['objects', 'structured_dots'], misconceptionCodes: ['response.guess'],
  },
  {
    id: 'geo.shape.properties.basic', title: 'Shapes by their properties', domain: 'geometry', priority: 3,
    goal: 'Recognize basic shapes by defining properties rather than prototype orientation.',
    observableChange: 'The child classifies circles, triangles, squares and rectangles across rotations, sizes and nonstandard examples.',
    hardPrerequisites: [], softPrerequisites: [], minFormsForProvisional: 1,
    taskFamilies: ['shape_classify'], representations: ['shape', 'physical'], misconceptionCodes: ['shape.prototype'],
  },
  {
    id: 'geo.compose.shapes.basic', title: 'Build shapes from shapes', domain: 'geometry', priority: 8,
    goal: 'Compose and decompose simple shapes spatially.',
    observableChange: 'The child recognizes that familiar shapes can combine into another shape and can choose or manipulate pieces that will make a target whole.',
    hardPrerequisites: ['geo.shape.properties.basic'], softPrerequisites: [], minFormsForProvisional: 1,
    taskFamilies: ['shape_compose'], representations: ['shape'], misconceptionCodes: ['shape.prototype'],
  },
  {
    id: 'measure.length.direct', title: 'Longer, shorter, same', domain: 'measurement', priority: 4,
    goal: 'Compare length by aligning objects at a common starting point.',
    observableChange: 'The child uses a common origin to compare lengths rather than choosing whichever endpoint extends farthest on the screen.',
    hardPrerequisites: [], softPrerequisites: [], minFormsForProvisional: 1,
    taskFamilies: ['length_compare', 'physical_transfer'], representations: ['objects', 'physical'], misconceptionCodes: ['measurement.endpoint'],
    physicalTransferTemplates: ['compare_objects'],
  },
];

export const MATH_SKILL_BY_ID = Object.fromEntries(MATH_SKILLS.map((skill) => [skill.id, skill])) as Record<MathSkillId, MathSkillSpec>;
