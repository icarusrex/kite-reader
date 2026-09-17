import { useEffect, useRef, useState } from 'react';
import { say, saySegmented, sayYes, stop } from '../audio/speaker';
import { segment } from '../engine/decodable';
import { PictureTile, ReplayButton, Waveform } from '../ui/components';
import { useSpokenScore } from './scoring';
import { ActivityProps } from './types';

/** Oral medial-phoneme identification: no print is shown. */
export function Medial({ step, onDone, setNeutral }: ActivityProps) {
  const answer = step.word!;
  const sound = step.g!;
  const [attempt, setAttempt] = useState(1);
  const [locked, setLocked] = useState(false);
  const [wrong, setWrong] = useState<string[]>([]);
  const [hint, setHint] = useState(false);
  const [good, setGood] = useState<string | null>(null);

  const prompt = async () => {
    await say({ p: 'ear_middle' }, { pause: 150 }, { g: sound }, { pause: 150 }, { p: 'ear_middle_end' });
  };
  useEffect(() => { prompt(); /* eslint-disable-next-line */ }, []);

  const choose = async (word: string) => {
    if (locked || good) return;
    stop();
    if (word === answer) {
      setLocked(true);
      setGood(word);
      await sayYes();
      onDone(attempt === 1);
      return;
    }
    if (attempt === 2) return;
    setLocked(true);
    setWrong((x) => [...x, word]);
    setNeutral(true);
    await say({ p: 'my_turn' }, { pause: 150 }, { g: sound }, { pause: 200 }, { w: answer }, { pause: 400 }, { p: 'your_turn' });
    setNeutral(false);
    setAttempt(2);
    setHint(true);
    setLocked(false);
  };
  const state = (word: string): 'good' | 'hint' | 'dim' | undefined =>
    good === word ? 'good' : hint && word === answer ? 'hint' : attempt === 2 || wrong.includes(word) ? 'dim' : undefined;

  return (
    <div className="stage">
      <div style={{ fontSize: '9vmin' }}>👂</div>
      <ReplayButton onTap={prompt} />
      <div className="row">{step.options!.map((w) => <PictureTile key={w} word={w} onTap={() => choose(w)} state={state(w)} correct={w === answer} />)}</div>
    </div>
  );
}

/** Oral CVC segmentation. The mic detects an attempt; only the grown-up decides correctness. */
export function Segment({ step, ctx, onDone, setNeutral }: ActivityProps) {
  const word = step.word!;
  const sounds = segment(word) ?? [];
  const [ready, setReady] = useState(false);
  const prompt = async () => {
    await say({ p: 'segment_word' }, { pause: 150 }, { w: word });
    setReady(true);
  };
  useEffect(() => { prompt(); /* eslint-disable-next-line */ }, [word]);

  const { strip, attempt } = useSpokenScore({
    enabled: ready,
    parentScoring: ctx.settings.parentScoring,
    onDone,
    setNeutral,
    correction: async () => {
      await say({ p: 'my_turn' }, { pause: 150 });
      await saySegmented(sounds, 180);
      await say({ pause: 400 }, { p: 'together' }, { pause: 150 });
      await saySegmented(sounds, 180);
      await say({ pause: 700 }, { p: 'your_turn' });
    },
  });

  return (
    <div className="stage">
      <PictureTile word={word} />
      <ReplayButton onTap={prompt} />
      <Waveform />
      {attempt === 2 && <div className="caption">Your turn</div>}
      {strip}
    </div>
  );
}

/** One low-friction meaning check after connected text: choose something that was actually in what was read. */
export function Meaning({ step, onDone, setNeutral }: ActivityProps) {
  const answer = step.word!;
  const [attempt, setAttempt] = useState(1);
  const [locked, setLocked] = useState(false);
  const [hint, setHint] = useState(false);
  const [good, setGood] = useState<string | null>(null);
  const wrong = useRef<string[]>([]);

  const prompt = () => say({ p: 'meaning' });
  useEffect(() => { prompt(); /* eslint-disable-next-line */ }, []);

  const choose = async (word: string) => {
    if (locked || good) return;
    stop();
    if (word === answer) {
      setLocked(true);
      setGood(word);
      await sayYes();
      onDone(attempt === 1);
      return;
    }
    if (attempt === 2) return;
    wrong.current.push(word);
    setLocked(true);
    setNeutral(true);
    await say({ p: 'again' }, { pause: 250 }, { p: 'meaning' });
    setNeutral(false);
    setAttempt(2);
    setHint(true);
    setLocked(false);
  };
  const state = (word: string): 'good' | 'hint' | 'dim' | undefined =>
    good === word ? 'good' : hint && word === answer ? 'hint' : attempt === 2 || wrong.current.includes(word) ? 'dim' : undefined;

  return (
    <div className="stage">
      <div style={{ fontSize: '9vmin' }}>💭</div>
      <ReplayButton onTap={prompt} />
      <div className="row">{step.options!.map((w) => <PictureTile key={w} word={w} onTap={() => choose(w)} state={state(w)} correct={w === answer} />)}</div>
    </div>
  );
}
