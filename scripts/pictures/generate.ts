/**
 * Generate picture-book illustrations with Gemini (Nano Banana 2) in a classic ink-and-watercolour storybook style,
 * using the style references in scripts/pictures/refs.
 *   npm run pictures                      # every picture that doesn't exist yet
 *   npm run pictures -- cat story-12      # just these (regenerates)
 *   npm run pictures -- --out=/tmp/test   # write somewhere else (style tests)
 * Needs GEMINI_API_KEY in .env. Writes public/pictures/<id>.jpg (512 px, via macOS sips).
 * Character sheets (scripts/pictures/characters) are passed as references so characters stay on-model in story scenes.
 */
import { execFileSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const KEY = process.env.GEMINI_API_KEY;
if (!KEY) { console.error('Set GEMINI_API_KEY in .env'); process.exit(1); }
const MODEL = 'gemini-3.1-flash-image';
const REFS = 'scripts/pictures/refs';

const STYLE = `Children's picture-book illustration in a classic 1920s English storybook style
(see the style reference images): loose, lively pen-and-ink line with soft transparent watercolour washes, warm muted colours,
lots of white paper. Friendly and gentle, for a 4-year-old. No text, no letters, no numbers, no frame or border.`;

const SCENE = `A single warm, simple storybook scene (landscape) illustrating the sentence-level action described, with the characters
drawn exactly as in their reference images (same design, colours and clothes). Plain white or softly washed background, few props.`;

const OBJECT = `Draw exactly ONE subject, centred, whole and clearly recognisable, on a plain white background
(at most a small soft patch of ground or shadow). It must be instantly nameable by a young child as the word given.`;

type Spec = { prompt: string; refs: string[]; kind: 'character' | 'object' | 'scene'; dir: string; aspect: string };

const CHARACTERS = 'scripts/pictures/characters';
const PICTURES = 'public/pictures';
const STYLE_REFS = ['style-sam.jpg', 'style-cat.jpg'];

// Character sheets (approved 2026-09-16) are generation references only, not shipped. Our own designs; style references
// contain no book characters, and prompts don't name them (either makes the model block the request).
const character = (prompt: string): Spec => ({ kind: 'character', prompt, refs: STYLE_REFS, dir: CHARACTERS, aspect: '1:1' });
const object = (word: string, description: string): Spec => ({ kind: 'object', prompt: `${word}: ${description}`, refs: STYLE_REFS, dir: PICTURES, aspect: '1:1' });
/** Story scene. cast = character sheets passed as references, in order; describe them as "the bear from reference 1" etc. */
const scene = (prompt: string, cast: string[]): Spec => ({ kind: 'scene', prompt, refs: [...cast.map((c) => `char:${c}`), 'style-cat.jpg'], dir: PICTURES, aspect: '4:3' });

export const SPECS: Record<string, Spec> = {
  // Characters
  'character-pooh': character('A small, plump storybook teddy bear with soft light-brown fur, a round tummy, short stubby arms and legs, small round ears and a friendly face with dot eyes. He wears a short yellow knitted scarf and nothing else. Standing upright, smiling.'),
  'character-pig': character('A very small storybook piglet: pale pink standing upright on two legs, with floppy ears, a little round snout and rosy cheeks. He wears blue dungarees. Standing, looking a little shy.'),
  'character-tinman': character('A kind man made entirely of tin: a funnel-shaped hat, a riveted cylindrical tin body, jointed tin arms and legs, and a gentle face, holding nothing in his hands.'),
  'character-sam': character('A cheerful boy of about five with short brown hair, wearing a simple red jumper, shorts and brown shoes, standing and smiling.'),
  'character-dad': character('A kind young father with short dark hair and a short beard, wearing a blue jumper and brown trousers, standing and smiling.'),

  // Word pictures: listening games + readiness (a child must name these from the picture alone)
  cat: object('cat', 'a ginger cat sitting, facing the viewer.'),
  pig: object('pig', 'a pink farm pig standing on all four legs, side view. An ordinary animal, no clothes.'),
  bat: object('bat', 'a small brown bat flying with its wings spread wide.'),
  hat: object('hat', 'a single blue hat with a round brim, on its own.'),
  map: object('map', 'an unfolded paper map with green fields, a winding road and a blue river.'),
  sun: object('sun', 'a bright yellow sun with short rays, no face.'),
  bed: object('bed', "a single child's bed with a white pillow and a patchwork blanket, side view."),
  bus: object('bus', 'a yellow school bus, side view, with round wheels and a row of windows.'),
  dog: object('dog', 'a friendly brown-and-white dog sitting, facing the viewer.'),
  van: object('van', 'a small blue delivery van, side view.'),
  ten: object('ten', 'the number 10, large, painted in bright red watercolour. This is the only picture allowed to contain a number.'),
  leg: object('leg', "one child's leg from the knee down, with a striped sock and a red shoe."),
  web: object('web', 'a round spider web stretched between two twigs, with one small friendly spider in the middle.'),
  log: object('log', 'a single wooden log lying on the grass, with bark and a round cut end showing tree rings.'),
  pen: object('pen', 'a single blue pen, lying diagonally.'),
  // Word pictures: Read & Match (the child reads the word first, so these may be scenes)
  dad: object('dad', 'unused: copied from the Dad character sheet'),
  sad: object('sad', 'a small boy sitting with a very sad face and one tear on his cheek.'),
  dig: object('dig', 'a child digging a hole in the ground with a spade, soil flying.'),
  fan: object('fan', 'an electric desk fan with a round cage.'),
  fin: object('fin', 'a grey shark fin sticking up out of blue water.'),
  tin: object('tin', 'a single tin can with a plain label, standing upright.'),
  man: object('man', 'a smiling man in a green coat standing, full length.'),
  pin: object('pin', 'a single red push pin, large.'),
  lip: object('lip', 'a smiling mouth with rosy lips, close up.'),
  hill: object('hill', 'one round green grassy hill under a pale sky.'),
  cap: object('cap', 'a red baseball cap on its own.'),
  cab: object('cab', 'a yellow taxi cab, side view.'),
  rat: object('rat', 'a grey rat with a long pink tail, side view.'),
  kid: object('kid', 'a happy young child waving, full length.'),
  bag: object('bag', 'a brown paper shopping bag with handles.'),
  gas: object('gas', 'a petrol pump with its hose and nozzle, at a gas station.'),
  nap: object('nap', 'a small child fast asleep, napping on a cushion with a blanket.'),
  ham: object('ham', 'a whole cooked ham on a plate.'),
  bib: object('bib', "a single baby's bib with ties, on its own."),
  pan: object('pan', 'a black frying pan with a long handle.'),
  wig: object('wig', 'a curly orange wig on a wig stand.'),
  lid: object('lid', 'a round metal saucepan lid with a knob on top.'),
  kit: object('kit', 'an open toolbox kit with a hammer, a screwdriver and pins inside.'),
  jam: object('jam', 'a glass jar of red strawberry jam with a checked cloth lid.'),
  rag: object('rag', 'a torn, crumpled old cloth rag.'),
  cup: object('cup', 'a single cup with a handle, with steam rising.'),
  fish: object('fish', 'a single orange fish, side view.'),
  mat: object('mat', 'a rectangular striped doormat lying on the floor.'),
  tap: object('tap', 'a shiny kitchen water tap with one drop of water falling.'),
  fig: object('fig', 'a purple fig, with a second fig cut in half showing the pink inside.'),
  // Basics track
  apple: object('apple', 'a single shiny red apple with a leaf.'),
  nest: object('nest', "a round bird's nest made of twigs with three small blue eggs in it."),
  sunflower: object('sunflower', 'one tall yellow sunflower with a big brown centre.'),
  cupcake: object('cupcake', 'one cupcake with pink icing and a cherry on top.'),
  rainbow: object('rainbow', 'a bright rainbow arc with a small white cloud at each end.'),
  football: object('football', 'a black-and-white football (soccer ball).'),
  snowman: object('snowman', 'a snowman with a carrot nose, a scarf and a hat.'),
  starfish: object('starfish', 'one orange starfish.'),
  ladybug: object('ladybug', 'one red ladybug with black spots, seen from above.'),
  popcorn: object('popcorn', 'a red-and-white striped box full of popcorn.'),
  pancake: object('pancake', 'a stack of three pancakes with butter and syrup on a plate.'),
  teapot: object('teapot', 'a round blue teapot.'),
  raincoat: object('raincoat', 'a yellow raincoat hanging on its own.'),
  toothbrush: object('toothbrush', 'a toothbrush with toothpaste on the bristles.'),
  table: object('table', 'a simple wooden kitchen table with four legs.'),
  monkey: object('monkey', 'a friendly brown monkey sitting, facing the viewer.'),
  rabbit: object('rabbit', 'a grey rabbit with long ears, sitting, side view.'),
  pencil: object('pencil', 'a single yellow pencil with a pink eraser, lying diagonally.'),
  basket: object('basket', 'a woven picnic basket with a handle.'),
  tiger: object('tiger', 'a friendly orange tiger with black stripes, sitting.'),
  carrot: object('carrot', 'one orange carrot with green leaves.'),
  lemon: object('lemon', 'one yellow lemon.'),
  button: object('button', 'one big round red button with four holes.'),
  zebra: object('zebra', 'a zebra standing, side view.'),
  spider: object('spider', 'one small friendly black spider with eight legs.'),
  robot: object('robot', 'a friendly toy robot with a square head and antennae.'),
  moon: object('moon', 'a pale yellow crescent moon.'),
  spoon: object('spoon', 'a single silver spoon.'),
  cake: object('cake', 'a round birthday cake with white icing and three candles.'),
  snake: object('snake', 'a friendly green snake coiled up.'),
  bee: object('bee', 'one round yellow-and-black bumble bee with wings.'),
  tree: object('tree', 'one green leafy tree with a brown trunk.'),
  goat: object('goat', 'a white goat with small horns, standing, side view.'),
  boat: object('boat', 'a small wooden sailing boat on a little blue wave.'),
  fox: object('fox', 'an orange fox sitting, facing the viewer.'),
  box: object('box', 'one closed cardboard box.'),
  mouse: object('mouse', 'a small grey mouse, side view.'),
  house: object('house', 'a small house with a red roof, a door and two windows.'),
  frog: object('frog', 'a green frog sitting.'),
  // Levels 1–20, Jolly Phonics order
  insect: object('insect', 'a friendly green beetle-like insect with six legs, seen from above.'),
  net: object('net', 'a fishing net on a long handle.'),
  hen: object('hen', 'a brown hen standing, side view.'),
  peg: object('peg', 'a single wooden clothes peg.'),
  pot: object('pot', 'a round cooking pot with two handles and a lid.'),
  sock: object('sock', 'a single striped sock.'),
  rock: object('rock', 'a single big grey rock on the grass.'),
  bug: object('bug', 'a small green bug with little legs, side view.'),
  duck: object('duck', 'a yellow duck swimming.'),
  rug: object('rug', 'a round colourful rug on the floor.'),
  nut: object('nut', 'a single brown hazelnut in its shell.'),
  doll: object('doll', 'a rag doll with yarn hair and a dress.'),
  flag: object('flag', 'a red flag on a pole.'),
  bun: object('bun', 'a round bread bun.'),
  crab: object('crab', 'a red crab with big claws.'),
  hand: object('hand', "a child's open hand, palm facing the viewer."),
  tent: object('tent', 'a small orange camping tent.'),
  sand: object('sand', 'a pile of yellow sand with a small spade and bucket.'),
  drum: object('drum', 'a red toy drum with two drumsticks.'),
  truck: object('truck', 'a blue toy truck, side view.'),
  lamp: object('lamp', 'a table lamp with a round shade, switched on.'),
  bell: object('bell', 'a golden bell.'),
  gift: object('gift', 'a wrapped present with a big bow.'),
  mop: object('mop', 'a mop in a bucket.'),

  // Story scenes, one per level with a story (src/modules/reading/content/levels.ts). Pip = the piglet sheet.
  'story-5': scene('The little piglet from reference 1 sits next to a garden water tap, and a boy in a green top sits beside him.', ['pig']),
  'story-6': scene('The little piglet from reference 1 sits in a big tin can; a grandma sits in a big pan and a boy sits in a tin pan, all smiling.', ['pig']),
  'story-7': scene('The teddy bear from reference 1 sits in a big tin can; the little piglet from reference 2 sits in a big pan nearby.', ['pooh', 'pig']),
  'story-8': scene('A brown sack on the floor with the little piglet from reference 2 peeking out; the teddy bear from reference 1 taps the sack.', ['pooh', 'pig']),
  'story-9': scene('A boy holds up a fishing net with the little piglet from reference 2 caught in it, laughing; the teddy bear from reference 1 pats the piglet.', ['pooh', 'pig']),
  'story-10': scene('A brown hen sits in a hat; the little piglet from reference 1 sits in the same hat and the hen gently pecks him; everyone is laughing.', ['pig']),
  'story-11': scene('A grey rat runs in; the little piglet from reference 1 and the teddy bear from reference 2 run away in a funny panic; the rat sits in a pan.', ['pig', 'pooh']),
  'story-12': scene('The tin man from reference 1 meets the little piglet from reference 2; the piglet sits in a tin pan.', ['tinman', 'pig']),
  'story-13': scene('The father from reference 1 wears a red hat; the little piglet from reference 2 peeks out from inside the hat.', ['dad', 'pig']),
  'story-14': scene('The teddy bear from reference 1 and the little piglet from reference 2 sit together in the sand next to a big brown sack.', ['pooh', 'pig']),
  'story-15': scene('The little piglet from reference 1 digs in the sand, sand flying; the teddy bear from reference 2 cheers, holding a pan.', ['pig', 'pooh']),
  'story-16': scene('The teddy bear from reference 1 holds a cooking pot with steam; the little piglet from reference 2 tries to hop onto the pot.', ['pooh', 'pig']),
  'story-17': scene('A hot sunny day. The little piglet from reference 1 is stuck in mud; the teddy bear from reference 2 holds a cup and helps pull him out.', ['pig', 'pooh']),
  'story-18': scene('The tin man from reference 1 has no hat; the little piglet from reference 2 finds the hat inside a hollow log on a hill.', ['tinman', 'pig']),
  'story-19': scene('A foggy morning. The teddy bear from reference 1 sits on a log; a green frog hops up; the little piglet from reference 2 hops happily.', ['pooh', 'pig']),
  'story-20': scene('The teddy bear from reference 1 looks into a bag for his pot; the little piglet from reference 2 points at a big friendly bug.', ['pooh', 'pig']),
};

const outOverride = process.argv.find((a) => a.startsWith('--out='))?.slice(6);
const only = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const COPIES: Record<string, string> = { dad: join(CHARACTERS, 'dad.jpg') }; // word pictures that reuse a character sheet

const img = (file: string) => ({ inline_data: { mime_type: 'image/jpeg', data: readFileSync(file).toString('base64') } });

async function generate(id: string, spec: Spec, out: string, attempt = 0): Promise<void> {
  const parts = [
    { text: `${STYLE}\n\n${{ object: OBJECT, character: 'Character model sheet: one full-length figure, centred, on a plain white background.', scene: SCENE }[spec.kind]}\n\n${spec.prompt}` },
    ...spec.refs.map((r) => img(r.startsWith('char:') ? join(CHARACTERS, `${r.slice(5)}.jpg`) : join(REFS, r))),
  ];
  let res: Response;
  try {
    res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`, {
    method: 'POST',
    headers: { 'x-goog-api-key': KEY!, 'Content-Type': 'application/json' },
    body: JSON.stringify({ contents: [{ parts }], generationConfig: { responseModalities: ['IMAGE'], imageConfig: { aspectRatio: spec.aspect } } }),
    });
  } catch (e) {
    // dropped connection ("fetch failed", "terminated"): wait and retry
    if (attempt < 6) { await new Promise((r) => setTimeout(r, 5000 * 2 ** attempt)); return generate(id, spec, out, attempt + 1); }
    throw e;
  }
  if ((res.status === 429 || res.status >= 500) && attempt < 6) {
    await new Promise((r) => setTimeout(r, 3000 * 2 ** attempt));
    return generate(id, spec, out, attempt + 1);
  }
  const json = await res.json();
  if (!res.ok) throw new Error(`${id}: ${res.status} ${JSON.stringify(json).slice(0, 300)}`);
  const data = json.candidates?.[0]?.content?.parts?.find((p: { inlineData?: { data: string } }) => p.inlineData)?.inlineData?.data;
  if (!data) throw new Error(`${id}: no image (${JSON.stringify(json.candidates?.[0]?.finishReason ?? json.promptFeedback ?? json).slice(0, 200)})`);
  const png = join(out, `${id}.png`);
  writeFileSync(png, Buffer.from(data, 'base64'));
  execFileSync('sips', ['-Z', spec.kind === 'scene' ? '900' : '512', '-s', 'format', 'jpeg', '-s', 'formatOptions', '72', png, '--out', join(out, `${fileName(id)}.jpg`)], { stdio: 'ignore' });
  rmSync(png);
}

const failed: string[] = [];
function fileName(id: string) { return id.replace(/^character-/, ''); }
for (const [id, spec] of Object.entries(SPECS)) {
  const out = outOverride ?? spec.dir;
  mkdirSync(out, { recursive: true });
  const file = join(out, `${fileName(id)}.jpg`);
  if (only.length ? !only.includes(id) : existsSync(file)) continue;
  if (COPIES[id] && !outOverride) { copyFileSync(COPIES[id], file); console.log(`${id} … copied`); continue; }
  process.stdout.write(`${id} … `);
  try { await generate(id, spec, out); console.log('ok'); } catch (e) { failed.push(id); console.log((e as Error).message); }
}
if (failed.length) { console.log(`Failed: ${failed.join(' ')}`); process.exit(1); }
