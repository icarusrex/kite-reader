import { GameCard, GameTheme } from '../../core/games/MiniGames';
import { say, sayYes } from './audio/speaker';
import { BASICS } from './content/basics';
import { LEVELS } from './content/levels';
import { currentBasics, currentLevel, Progress } from './engine/progress';

/** Letter sounds this learner has been taught (Basics lessons reached, then levels reached). */
export function taughtGraphemes(p: Progress): string[] {
  const basics = BASICS.filter((b) => b.newSound && (p.track === 'levels' || b.n <= currentBasics(p))).map((b) => b.newSound!);
  const levels = p.track === 'levels' ? LEVELS.filter((l) => l.n <= currentLevel(p)).flatMap((l) => l.newGraphemes) : [];
  return [...new Set([...basics, ...levels])];
}

/** Reading's game cards: letters that say their sound. Recent sounds are favoured; at least three are needed. */
export function readingGameTheme(p: Progress): GameTheme {
  let gs = taughtGraphemes(p);
  if (gs.length < 3) gs = [...new Set([...gs, 's', 'a', 't'])]; // the very first lessons: the next sounds, heard and seen
  const pick = gs.slice(-6);
  const cards: GameCard[] = pick.map((g) => ({ id: g, face: <span className="game-letter">{g}</span>, speak: () => say({ g }) }));
  return {
    cards,
    ask: (c) => say({ key: 'game:pop_sound', text: 'Pop this sound!' }, { pause: 200 }, { g: c.id }),
    cheer: () => sayYes(),
  };
}
