import { Step } from '../engine/session';
import { Settings } from '../engine/progress';

export interface ActivityCtx {
  settings: Settings;
  level: number;
}

export interface ActivityProps {
  step: Step;
  ctx: ActivityCtx;
  /** Called exactly once. `correct` = first-attempt correctness. null = unscored. */
  onDone: (correct: boolean | null) => void;
  setNeutral: (on: boolean) => void;
}

export const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
