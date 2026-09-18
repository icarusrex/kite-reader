import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { speakText, stopSpeech } from '../../../core/audio/speech';
import { MathErrorCode } from '../content/skills';
import { MathHelpLevel } from '../engine/state';
import { BasicShape, CompareAnswer, MathTask } from '../engine/tasks';

export interface MathTaskResult {
  correct: boolean;
  helpLevel: MathHelpLevel;
  errorCode?: MathErrorCode;
}

export interface MathTaskViewProps {
  task: MathTask;
  onDone: (result: MathTaskResult | null) => void;
}

const speak = (task: MathTask) => speakText(task.prompt);
const numberWord = (n: number) => ['zero', 'one', 'two', 'three', 'four', 'five'][n] ?? String(n);

function Prompt({ task }: { task: MathTask }) {
  useEffect(() => { void speak(task); return stopSpeech; }, [task.uid]);
  return <div style={{ display: 'flex', alignItems: 'center', gap: 12, justifyContent: 'center' }}>
    <h2 style={{ fontSize: 'clamp(28px, 5vmin, 56px)', margin: 0, textAlign: 'center' }}>{task.prompt}</h2>
    <button className="btn light" onClick={() => speak(task)} aria-label="Repeat">▶</button>
  </div>;
}

function ParentScore({ onDone }: { onDone: MathTaskViewProps['onDone'] }) {
  return <div className="parent-strip" style={{ gap: 8 }}>
    <button className="pbtn ok" onClick={() => onDone({ correct: true, helpLevel: 'none' })}>✓</button>
    <button className="pbtn" onClick={() => onDone({ correct: true, helpLevel: 'scaffold' })}>~</button>
    <button className="pbtn no" onClick={() => onDone({ correct: false, helpLevel: 'none' })}>✕</button>
    <small>independent · helped · not yet</small>
  </div>;
}

function Dots({ n, spread = false, hidden = false }: { n: number; spread?: boolean; hidden?: boolean }) {
  const positions = useMemo(() => Array.from({ length: n }, (_, i) => ({
    x: spread ? 8 + i * (84 / Math.max(1, n - 1)) : 26 + ((i * 37) % 50),
    y: 25 + ((i * 43) % 55),
  })), [n, spread]);
  return <div style={{ width: 'min(38vw, 300px)', height: 'min(28vw, 210px)', minHeight: 150, position: 'relative', borderRadius: 22, background: '#fff', boxShadow: '0 8px 25px #0001' }}>
    {!hidden && positions.map((p, i) => <span key={i} style={{ position: 'absolute', left: `${p.x}%`, top: `${p.y}%`, transform: 'translate(-50%,-50%)', width: 32, height: 32, borderRadius: '50%', background: '#254A5D' }} />)}
  </div>;
}

function QuantityVisual({ n, representation, hidden = false, spread = false }: { n: number; representation: MathTask['representation']; hidden?: boolean; spread?: boolean }) {
  if (hidden) return <Dots n={n} hidden />;
  if (representation === 'objects') return <div style={{ width: 'min(38vw, 300px)', minHeight: 150, display: 'flex', alignItems: 'center', justifyContent: spread ? 'space-between' : 'center', gap: spread ? 4 : 16, flexWrap: 'wrap', padding: 18, borderRadius: 22, background: '#fff', boxShadow: '0 8px 25px #0001' }}>{Array.from({ length: n }, (_, i) => <span key={i} style={{ fontSize: 52 }}>🍎</span>)}</div>;
  if (representation === 'five_frame') return <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 58px)', gap: 8, padding: 12, border: '4px solid #254A5D', borderRadius: 14, background: '#fff' }}>{Array.from({ length: 5 }, (_, i) => <span key={i} style={{ width: 58, height: 58, border: '2px solid #aac4ca', borderRadius: 8, display: 'grid', placeItems: 'center' }}>{i < n ? <span style={{ width: 34, height: 34, borderRadius: '50%', background: '#254A5D' }} /> : null}</span>)}</div>;
  if (representation === 'structured_dots') return <div style={{ width: 250, minHeight: 160, display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', placeItems: 'center', gap: 18, padding: 18, borderRadius: 22, background: '#fff', boxShadow: '0 8px 25px #0001' }}>{Array.from({ length: n }, (_, i) => <span key={i} style={{ width: 38, height: 38, borderRadius: '50%', background: '#254A5D' }} />)}</div>;
  if (representation === 'fingers') return <div style={{ fontSize: '18vmin', lineHeight: 1 }}>🖐️</div>;
  return <Dots n={n} spread={spread} />;
}

function Model({ task, onDone }: MathTaskViewProps) {
  const specExamples: Record<string, string> = {
    'num.count.verbal.1_5': 'Counting words always stay in the same order: 1, 2, 3, 4, 5.',
    'num.count.one_to_one.1_3': 'Give each thing exactly one counting word. Touch or move it as you count.',
    'num.cardinality.1_3': 'The last number you say tells how many there are altogether.',
    'num.subitize.perceptual.1_3': 'Sometimes you can see one, two or three as a whole without counting each dot.',
    'num.construct.1_3': 'Stop when you have exactly the number requested.',
    'num.map.numeral.1_3': 'The written symbol and the amount mean the same number.',
    'num.compare.quantity.1_3': 'More means the group with the greater number of things; spacing can trick your eyes.',
    'num.count.cardinal.1_5': 'Count every object once. The final number tells the whole amount.',
    'num.subitize.structured.4_5': 'Look for useful groups: four can be two and two; five can be a full five-frame.',
    'num.compare.quantity.1_5': 'Compare how many, not how spread out the groups look.',
    'num.compose.2_4': 'Moving the same objects into two groups does not change how many there are altogether.',
    'num.compose.5': 'Five can be split in different ways and still stay five.',
    'num.map.numeral.1_5': 'A numeral is a symbol for an exact amount. Five dots and the symbol 5 mean the same number.',
    'num.order.1_5': 'Numbers have an order. A number with fewer objects comes before a number with more objects.',
    'op.add.combine.to5': 'Addition begins with quantities joining or increasing. Model what changed before using symbols.',
    'op.subtract.separate.to5': 'Subtraction begins with part of a whole leaving. Keep track of the whole, the part that left and what remains.',
    'num.successor.predecessor.to5': 'Adding exactly one makes the next number; taking exactly one makes the previous number.',
    'geo.shape.properties.basic': 'Turning a shape does not change what it is. Look at its sides, corners and curves.',
    'geo.compose.shapes.basic': 'Shapes can be joined to make new shapes. Two triangles can fit together to make a square.',
    'measure.length.direct': 'To compare length fairly, put the starting ends together first.',
  };
  return <div className="stage" style={{ gap: 28 }}>
    <Prompt task={task} />
    <div className="card" style={{ maxWidth: 700, fontSize: 'clamp(24px, 4vmin, 42px)', textAlign: 'center' }}>{specExamples[task.skillId]}</div>
    <button className="primary soft" onClick={() => onDone(null)} style={{ width: 100, height: 100 }}>→</button>
  </div>;
}

function ParentScoreTask({ task, onDone }: MathTaskViewProps) {
  return <div className="stage" style={{ gap: 30 }}><Prompt task={task} /><div style={{ fontSize: '18vmin', lineHeight: 1 }}>🔢</div><ParentScore onDone={onDone} /></div>;
}

function TapCount({ task, onDone }: MathTaskViewProps) {
  const n = task.quantity ?? 1;
  const [tapped, setTapped] = useState<boolean[]>(Array(n).fill(false));
  const [double, setDouble] = useState(false);
  const tap = (i: number) => {
    if (tapped[i]) { setDouble(true); return; }
    setTapped((old) => old.map((v, j) => j === i ? true : v));
    void speakText(numberWord(tapped.filter(Boolean).length + 1));
  };
  const done = () => {
    const count = tapped.filter(Boolean).length;
    onDone({ correct: count === n && !double, helpLevel: 'none', errorCode: double ? 'count.double' : count < n ? 'count.skip' : undefined });
  };
  return <div className="stage" style={{ gap: 28 }}>
    <Prompt task={task} />
    <div className="row" style={{ gap: 28, flexWrap: 'wrap' }}>{Array.from({ length: n }, (_, i) => <button key={i} onClick={() => tap(i)} aria-label={`object ${i + 1}`} style={{ border: 0, background: 'transparent', fontSize: '10vmin', opacity: tapped[i] ? .35 : 1 }}>{task.representation === 'random_dots' ? <span style={{ display: 'inline-block', width: 52, height: 52, borderRadius: '50%', background: '#254A5D' }} /> : '⭐'}</button>)}</div>
    <button className="btn" onClick={done}>Done</button>
  </div>;
}

function QuantityChoice({ task, onDone }: MathTaskViewProps) {
  const answer = task.quantity ?? task.target ?? 1;
  const quick = task.skillId === 'num.subitize.perceptual.1_3';
  const [hidden, setHidden] = useState(false);
  useEffect(() => {
    if (!quick) return;
    const t = window.setTimeout(() => setHidden(true), 1100);
    return () => clearTimeout(t);
  }, [task.uid, quick]);
  return <div className="stage" style={{ gap: 28 }}>
    <Prompt task={task} />
    <QuantityVisual n={answer} representation={task.representation} hidden={hidden} />
    <div className="row">{task.options?.map((n) => <button key={n} className="primary soft" style={{ width: 100, height: 100, fontSize: 44 }} onClick={() => onDone({ correct: n === answer, helpLevel: 'none', errorCode: n === answer ? undefined : task.expectedError })}>{n}</button>)}</div>
  </div>;
}

function Construct({ task, onDone }: MathTaskViewProps) {
  const target = task.target ?? 1;
  const [selected, setSelected] = useState<number[]>([]);
  const pool = 6;
  const toggle = (i: number) => setSelected((old) => old.includes(i) ? old.filter((x) => x !== i) : [...old, i]);
  return <div className="stage" style={{ gap: 24 }}>
    <Prompt task={task} />
    {task.numeral && <div style={{ fontSize: '18vmin', fontWeight: 800 }}>{task.numeral}</div>}
    <div className="row" style={{ flexWrap: 'wrap', maxWidth: 620 }}>{Array.from({ length: pool }, (_, i) => <button key={i} onClick={() => toggle(i)} style={{ border: 0, background: selected.includes(i) ? '#d9f5f7' : 'transparent', borderRadius: 20, fontSize: '9vmin', opacity: selected.includes(i) ? 1 : .55 }}>🍓</button>)}</div>
    <div style={{ fontSize: 22 }}>{selected.length} chosen</div>
    <button className="btn" onClick={() => onDone({ correct: selected.length === target, helpLevel: 'none', errorCode: selected.length === target ? undefined : task.expectedError })}>Done</button>
  </div>;
}

function Compare({ task, onDone }: MathTaskViewProps) {
  const choose = (answer: CompareAnswer) => onDone({ correct: answer === task.compareAnswer, helpLevel: 'none', errorCode: answer === task.compareAnswer ? undefined : task.expectedError });
  return <div className="stage" style={{ gap: 24 }}>
    <Prompt task={task} />
    <div className="row" style={{ alignItems: 'center', gap: 50 }}>
      <QuantityVisual n={task.left ?? 1} representation={task.representation} spread />
      <QuantityVisual n={task.right ?? 1} representation={task.representation} spread={false} />
    </div>
    <div className="row"><button className="btn" onClick={() => choose('left')}>← LEFT</button><button className="btn" onClick={() => choose('same')}>SAME</button><button className="btn" onClick={() => choose('right')}>RIGHT →</button></div>
  </div>;
}

function Partition({ task, onDone }: MathTaskViewProps) {
  const whole = task.target ?? 3;
  if (task.partitionMode === 'hidden_part') {
    return <div className="stage" style={{ gap: 24 }}>
      <Prompt task={task} />
      <div className="row" style={{ gap: 30 }}><QuantityVisual n={task.visiblePart ?? 1} representation={task.representation} /><div style={{ width: 190, height: 160, borderRadius: '80px 80px 16px 16px', background: '#254A5D', display: 'grid', placeItems: 'center', color: 'white', fontSize: 28 }}>hidden</div></div>
      <div className="row">{task.options?.map((n) => <button key={n} className="primary soft" style={{ width: 100, height: 100, fontSize: 44 }} onClick={() => onDone({ correct: n === task.hiddenPart, helpLevel: 'none', errorCode: n === task.hiddenPart ? undefined : task.expectedError })}>{n}</button>)}</div>
    </div>;
  }
  const [right, setRight] = useState(1);
  const left = whole - right;
  return <div className="stage" style={{ gap: 20 }}>
    <Prompt task={task} />
    <div style={{ fontSize: 30 }}>Whole: <b>{whole}</b></div>
    <div className="row" style={{ gap: 35 }}>
      <div className="card" style={{ minWidth: 180, textAlign: 'center' }}><div style={{ fontSize: 64 }}>{'●'.repeat(left)}</div><b>{left}</b></div>
      <div className="card" style={{ minWidth: 180, textAlign: 'center' }}><div style={{ fontSize: 64 }}>{'●'.repeat(right)}</div><b>{right}</b></div>
    </div>
    <div className="row"><button className="btn light" disabled={right <= 1} onClick={() => setRight((n) => n - 1)}>Move left</button><button className="btn light" disabled={right >= whole - 1} onClick={() => setRight((n) => n + 1)}>Move right</button></div>
    <button className="btn" onClick={() => onDone({ correct: left > 0 && right > 0 && left + right === whole, helpLevel: 'none' })}>That still makes {whole}</button>
  </div>;
}

function OrderNumbers({ task, onDone }: MathTaskViewProps) {
  const values = task.orderValues ?? [1, 2, 3];
  const expected = [...values].sort((a, b) => a - b);
  const [picked, setPicked] = useState<number[]>([]);
  const choose = (n: number) => { if (!picked.includes(n)) setPicked((old) => [...old, n]); };
  const complete = picked.length === values.length;
  return <div className="stage" style={{ gap: 28 }}>
    <Prompt task={task} />
    <div className="row">{values.map((n) => <button key={n} className="primary soft" disabled={picked.includes(n)} style={{ width: 118, height: 108, fontSize: task.representation === 'numeral' ? 44 : 20, opacity: picked.includes(n) ? .35 : 1 }} onClick={() => choose(n)}>{task.representation === 'numeral' ? n : <span style={{ display: 'flex', flexWrap: 'wrap', gap: 5, width: 64, justifyContent: 'center' }}>{Array.from({ length: n }, (_, i) => <span key={i} style={{ width: 18, height: 18, borderRadius: '50%', background: '#254A5D' }} />)}</span>}</button>)}</div>
    <div style={{ minHeight: 70, fontSize: 44, letterSpacing: 16 }}>{picked.join(' ')}</div>
    {complete && <button className="btn" onClick={() => onDone({ correct: picked.every((n, i) => n === expected[i]), helpLevel: 'none', errorCode: picked.every((n, i) => n === expected[i]) ? undefined : task.expectedError })}>Done</button>}
    {picked.length > 0 && !complete && <button className="btn light" onClick={() => setPicked([])}>Start again</button>}
  </div>;
}

function StoryOperation({ task, onDone }: MathTaskViewProps) {
  const start = task.left ?? 1;
  const change = task.right ?? 1;
  const operation = task.operation ?? 'add';
  const removed = operation === 'subtract' || operation === 'less1';
  const answer = task.operationAnswer ?? (removed ? start - change : start + change);
  return <div className="stage" style={{ gap: 26 }}>
    <Prompt task={task} />
    <div className="row" style={{ gap: 26, alignItems: 'center' }}>
      <QuantityVisual n={start} representation={task.representation} />
      <div style={{ fontSize: 56 }}>{removed ? '−' : '+'}</div>
      <QuantityVisual n={change} representation="objects" />
    </div>
    <div className="row">{task.options?.map((n) => <button key={n} className="primary soft" style={{ width: 100, height: 100, fontSize: 44 }} onClick={() => onDone({ correct: n === answer, helpLevel: 'none', errorCode: n === answer ? undefined : task.expectedError })}>{n}</button>)}</div>
  </div>;
}

function ShapeCompose({ task, onDone }: MathTaskViewProps) {
  const options: { id: NonNullable<MathTask['shapeComposeAnswer']>; label: JSX.Element }[] = [
    { id: 'two_triangles', label: <svg width="150" height="150" viewBox="0 0 100 100" aria-label="two triangles making a square"><polygon points="0,0 100,0 0,100" fill="#2CCCD3" /><polygon points="100,100 100,0 0,100" fill="#254A5D" /></svg> },
    { id: 'two_circles', label: <span className="row"><Shape shape="circle" rotation={0} /><Shape shape="circle" rotation={0} /></span> },
    { id: 'rectangle_circle', label: <span className="row"><Shape shape="rectangle" rotation={0} /><Shape shape="circle" rotation={0} /></span> },
  ];
  return <div className="stage" style={{ gap: 24 }}><Prompt task={task} /><div className="row" style={{ gap: 18, flexWrap: 'wrap' }}>{options.map((o) => <button key={o.id} className="card" style={{ border: 0, minWidth: 220, minHeight: 170 }} onClick={() => onDone({ correct: o.id === task.shapeComposeAnswer, helpLevel: 'none', errorCode: o.id === task.shapeComposeAnswer ? undefined : task.expectedError })}>{o.label}</button>)}</div></div>;
}

function Shape({ shape, rotation }: { shape: BasicShape; rotation: number }) {
  const base: CSSProperties = { width: 110, height: 110, transform: `rotate(${rotation}deg)`, display: 'inline-block' };
  if (shape === 'circle') return <span style={{ ...base, borderRadius: '50%', background: '#2CCCD3' }} />;
  if (shape === 'triangle') return <span style={{ ...base, width: 0, height: 0, borderLeft: '60px solid transparent', borderRight: '60px solid transparent', borderBottom: '105px solid #2CCCD3' }} />;
  if (shape === 'rectangle') return <span style={{ ...base, width: 150, height: 85, background: '#2CCCD3' }} />;
  return <span style={{ ...base, background: '#2CCCD3' }} />;
}

function ShapeChoice({ task, onDone }: MathTaskViewProps) {
  return <div className="stage" style={{ gap: 34 }}>
    <Prompt task={task} />
    <div className="row" style={{ gap: 45, minHeight: 180 }}>{task.shapeOptions?.map((o, i) => <button key={`${o.shape}${i}`} onClick={() => onDone({ correct: o.shape === task.shapeTarget, helpLevel: 'none', errorCode: o.shape === task.shapeTarget ? undefined : task.expectedError })} style={{ border: 0, background: 'transparent', padding: 20 }}><Shape {...o} /></button>)}</div>
  </div>;
}

function LengthCompare({ task, onDone }: MathTaskViewProps) {
  const [aligned, setAligned] = useState(false);
  const choose = (answer: CompareAnswer) => onDone({ correct: answer === task.compareAnswer, helpLevel: 'none', errorCode: answer === task.compareAnswer ? undefined : task.expectedError });
  const offL = aligned ? 0 : task.leftOffset ?? 0;
  const offR = aligned ? 0 : task.rightOffset ?? 0;
  return <div className="stage" style={{ gap: 24 }}>
    <Prompt task={task} />
    <div className="card" style={{ width: 'min(78vw, 700px)' }}>
      <div style={{ marginLeft: offL, width: task.leftLength, height: 34, background: '#254A5D', borderRadius: 8, marginBottom: 35 }} />
      <div style={{ marginLeft: offR, width: task.rightLength, height: 34, background: '#2CCCD3', borderRadius: 8 }} />
    </div>
    {!aligned ? <button className="btn" onClick={() => setAligned(true)}>Line up starts</button> : <div className="row"><button className="btn" onClick={() => choose('left')}>Top</button><button className="btn" onClick={() => choose('same')}>Same</button><button className="btn" onClick={() => choose('right')}>Bottom</button></div>}
  </div>;
}

function Physical({ task, onDone }: MathTaskViewProps) {
  return <div className="stage" style={{ gap: 30 }}><Prompt task={task} /><div style={{ fontSize: '18vmin' }}>🏠</div><p className="subtitle">Use real things nearby.</p><ParentScore onDone={onDone} /></div>;
}

export function MathTaskView(props: MathTaskViewProps) {
  switch (props.task.kind) {
    case 'model': return <Model {...props} />;
    case 'parent_score': return <ParentScoreTask {...props} />;
    case 'tap_count': return <TapCount {...props} />;
    case 'quantity_choice': return <QuantityChoice {...props} />;
    case 'construct': return <Construct {...props} />;
    case 'compare': return <Compare {...props} />;
    case 'partition': return <Partition {...props} />;
    case 'order_numbers': return <OrderNumbers {...props} />;
    case 'story_operation': return <StoryOperation {...props} />;
    case 'shape_choice': return <ShapeChoice {...props} />;
    case 'shape_compose': return <ShapeCompose {...props} />;
    case 'length_compare': return <LengthCompare {...props} />;
    case 'physical': return <Physical {...props} />;
  }
}
