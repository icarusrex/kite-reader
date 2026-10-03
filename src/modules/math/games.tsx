import { GameCard, GameTheme } from '../../core/games/MiniGames';
import { speakText } from '../../core/audio/speech';
import type { MathProgress } from './engine/state';

const WORDS = ['zero', 'one', 'two', 'three', 'four', 'five'];
const passed = (p: MathProgress, id: keyof MathProgress['lessons']) => p.lessons[id]?.status === 'passed';

/** Dots as on a dice, so amounts can be seen at a glance (or scattered, for the other half of a pair). */
function Dots({ n, scattered = false }: { n: number; scattered?: boolean }) {
  const dice: Record<number, [number, number][]> = { 1: [[50, 50]], 2: [[28, 28], [72, 72]], 3: [[25, 25], [50, 50], [75, 75]], 4: [[28, 28], [72, 28], [28, 72], [72, 72]], 5: [[25, 25], [75, 25], [50, 50], [25, 75], [75, 75]] };
  const loose: Record<number, [number, number][]> = { 1: [[35, 60]], 2: [[30, 35], [65, 70]], 3: [[25, 65], [55, 25], [75, 70]], 4: [[22, 30], [50, 70], [78, 40], [45, 22]], 5: [[20, 60], [42, 25], [60, 75], [80, 35], [35, 82]] };
  return <span className="game-dots">{(scattered ? loose : dice)[n].map(([x, y], i) => <i key={i} style={{ left: `${x}%`, top: `${y}%` }} />)}</span>;
}

/** Math's game cards: numbers the child has met. Numerals appear once their lesson is passed; before that, dots. */
export function mathGameTheme(p: MathProgress): GameTheme {
  const max = passed(p, 'num.count.cardinal.1_5') ? 5 : 3;
  const numerals = passed(p, max === 5 ? 'num.map.numeral.1_5' : 'num.map.numeral.1_3');
  const cards: GameCard[] = Array.from({ length: max }, (_, i) => i + 1).map((n) => ({
    id: String(n),
    face: numerals ? <span className="game-letter">{n}</span> : <Dots n={n} />,
    pairFace: numerals ? <Dots n={n} /> : <Dots n={n} scattered />,
    speak: () => speakText(WORDS[n]),
  }));
  return {
    cards,
    ask: (c) => speakText(`Pop the ${WORDS[+c.id]}!`),
    cheer: () => speakText(['Yes!', 'You got it!', 'Great!'][Math.floor(Math.random() * 3)]),
  };
}
