import { useEffect, useRef, useState } from 'react';
import { meter } from '../audio/mic';
import { say, saySegmented, sayYes } from '../audio/speaker';
import { GRAPHEME_BY_ID } from '../content/phonemes';
import { displayChunks, segment } from '../engine/decodable';
import { Caption, Kite, PictureTile, ReplayButton, Tile, Waveform, useTap } from '../ui/components';
import { useSpokenScore } from './scoring';
import { useUtterance } from './useSpeech';
import { ActivityProps, wait } from './types';

/* ---------- A1 Sound Reveal (unscored) ---------- */
export function Reveal({ step, onDone }: ActivityProps) {
  const g = step.g!;
  const [shown, setShown] = useState(false);
  const [phase, setPhase] = useState<'model' | 'you1' | 'you2' | 'done'>('model');
  useEffect(() => {
    (async () => {
      await wait(300); setShown(true);
      await say({ p: 'this_sound_is' }, { pause: 200 }, { g }, { pause: 500 }, { g }, { pause: 300 }, { p: 'your_turn' });
      setPhase('you1');
    })();
  }, [g]);
  const next = async () => {
    if (phase === 'you1') { setPhase('model'); await say({ g }, { pause: 200 }, { p: 'your_turn' }); setPhase('you2'); }
    else if (phase === 'you2') { setPhase('done'); await sayYes(); onDone(null); }
  };
  useUtterance(meter.ready && (phase === 'you1' || phase === 'you2'), next);
  const tap = useTap(next);
  return (
    <div className="stage">
      <div style={{ transform: shown ? 'scale(1)' : 'scale(0.2)', opacity: shown ? 1 : 0, transition: 'all .5s cubic-bezier(.3,1.6,.5,1)' }}>
        <Tile big label={g} onTap={() => say({ g })} />
      </div>
      <Waveform />
      <Caption>{phase.startsWith('you') ? 'Your turn' : ''}</Caption>
      {(phase === 'you1' || phase === 'you2') && (
        <div className="parent-strip"><button className="pbtn ok" onPointerDown={tap} aria-label="Next">→</button><small>grown-up</small></div>
      )}
    </div>
  );
}

/* ---------- Generic "tap the right one" with neutral correction ---------- */
function useTapChoice(opts: {
  answer: string;
  intro: () => Promise<void>;
  correction: () => Promise<void>;
  onDone: ActivityProps['onDone'];
  setNeutral: ActivityProps['setNeutral'];
}) {
  const [attempt, setAttempt] = useState(1);
  const [wrong, setWrong] = useState<string[]>([]);
  const [hint, setHint] = useState(false);
  const [good, setGood] = useState<string | null>(null);
  const [locked, setLocked] = useState(true);
  useEffect(() => { opts.intro().then(() => setLocked(false)); /* eslint-disable-next-line */ }, []);
  const choose = async (o: string) => {
    if (locked || good) return;
    if (o === opts.answer) {
      setGood(o); setLocked(true);
      await sayYes();
      opts.onDone(attempt === 1);
      return;
    }
    if (attempt === 2) return; // only the hinted answer is live on retry
    setLocked(true);
    setWrong((w) => [...w, o]);
    opts.setNeutral(true);
    await opts.correction();
    opts.setNeutral(false);
    setHint(true); setAttempt(2); setLocked(false);
  };
  const stateOf = (o: string): 'good' | 'hint' | 'dim' | undefined =>
    good === o ? 'good' : hint && o === opts.answer ? 'hint' : attempt === 2 || wrong.includes(o) ? 'dim' : undefined;
  return { choose, stateOf };
}

/* ---------- A2 Hear & Tap ---------- */
export function HearTap({ step, onDone, setNeutral }: ActivityProps) {
  const g = step.g!;
  const intro = () => say({ p: 'tap_sound' }, { pause: 150 }, { g });
  const { choose, stateOf } = useTapChoice({
    answer: g, intro, onDone, setNeutral,
    correction: () => say({ p: 'my_turn' }, { pause: 150 }, { g }, { pause: 300 }, { p: 'your_turn' }, { g }),
  });
  return (
    <div className="stage">
      <ReplayButton onTap={intro} />
      <div className="row">{step.options!.map((o) => <Tile key={o} label={o} onTap={() => choose(o)} state={stateOf(o)} correct={o === g} />)}</div>
    </div>
  );
}

/* ---------- A3 See & Say ---------- */
export function SeeSay({ step, ctx, onDone, setNeutral }: ActivityProps) {
  const g = step.g!;
  const [ready, setReady] = useState(false);
  useEffect(() => { say({ p: 'say_sound' }).then(() => setReady(true)); }, [g]);
  const { strip, attempt } = useSpokenScore({
    enabled: ready, parentScoring: ctx.settings.parentScoring, onDone, setNeutral,
    correction: () => say({ p: 'my_turn' }, { pause: 150 }, { g }, { pause: 400 }, { p: 'your_turn' }),
  });
  return (
    <div className="stage">
      <Tile big label={g} />
      <Waveform />
      <Caption>{attempt === 2 ? 'Your turn' : ''}</Caption>
      {strip}
    </div>
  );
}

/* ---------- A4 Hold It (unscored) ---------- */
export function Hold({ step, onDone }: ActivityProps) {
  const g = step.g!;
  const [progress, setProgress] = useState(0);
  const [wins, setWins] = useState(0);
  const [live, setLive] = useState(false);
  const done = useRef(false);
  useEffect(() => {
    say({ p: 'hold_it' }, { pause: 250 }, { g }).then(() => setLive(true));
    const giveUp = setTimeout(() => { if (!done.current) { done.current = true; onDone(null); } }, 30000);
    return () => clearTimeout(giveUp);
    // eslint-disable-next-line
  }, []);
  useEffect(() => {
    if (!live) return;
    let start = 0, lastVoice = 0;
    const NEED = 1500;
    return meter.subscribe(({ voiced }) => {
      const now = performance.now();
      if (voiced) { if (!start) start = now; lastVoice = now; }
      if (start && now - lastVoice > 220) { start = 0; setProgress(0); }
      if (start) {
        const p = Math.min(1, (now - start) / NEED);
        setProgress(p);
        if (p >= 1) {
          start = 0;
          setLive(false);
          setWins((w) => {
            const n = w + 1;
            (async () => {
              await sayYes();
              if (n >= 2) { if (!done.current) { done.current = true; onDone(null); } }
              else { setProgress(0); await say({ g }); setLive(true); }
            })();
            return n;
          });
        }
      }
    });
    // eslint-disable-next-line
  }, [live]);
  const skip = useTap(() => { if (!done.current) { done.current = true; onDone(null); } });
  return (
    <div className="stage">
      <div style={{ position: 'relative', height: '34vmin', width: '30vmin' }}>
        <Kite style={{ left: '6vmin', top: `${(1 - progress) * 14}vmin` }} />
      </div>
      <Tile big label={g} onTap={() => say({ g })} />
      <Waveform />
      <Caption>{'★'.repeat(wins)}</Caption>
      <div className="parent-strip"><button className="pbtn no" onPointerDown={skip} aria-label="Skip">→</button><small>grown-up</small></div>
    </div>
  );
}

/* ---------- A5/A6 Glide Blend + Say It Fast (also A10 Alien Names) ---------- */
const MS_PER_CHUNK = 650;
const GAP_MS = 450;

export function Glide({ step, ctx, onDone, setNeutral }: ActivityProps) {
  const word = step.word!;
  const chunks = displayChunks(word);
  const segs = segment(word) ?? [];
  const lastIsStop = !GRAPHEME_BY_ID[segs[segs.length - 1]]?.continuous;
  const endAt = chunks.length - (lastIsStop ? 0.6 : 0.05);
  const alien = step.kind === 'alien';

  const [pos, setPos] = useState(0);
  const [falls, setFalls] = useState(0);
  const [fall, setFall] = useState(false);
  const [mode, setMode] = useState<'intro' | 'glide' | 'fast'>('intro');
  const fallsRef = useRef(0);

  const model = () => say({ p: 'my_turn' }, { pause: 200 }, ...segs.flatMap((g, i) => (i ? [{ pause: 60 }, { g }] : [{ g }])), { pause: 350 }, { w: word });

  useEffect(() => {
    say({ p: alien ? 'alien' : 'glide' }).then(() => setMode('glide'));
    // eslint-disable-next-line
  }, []);

  useEffect(() => {
    if (mode !== 'glide' || !meter.ready) return;
    let p = 0, last = performance.now(), lastVoice = 0, started = false, busy = false;
    return meter.subscribe(({ voiced }) => {
      if (busy) return;
      const now = performance.now();
      const dt = now - last; last = now;
      if (voiced) { started = true; lastVoice = now; p = Math.min(chunks.length, p + dt / MS_PER_CHUNK); setPos(p); }
      if (started && p >= endAt && (!voiced && now - lastVoice > 250 || p >= chunks.length)) {
        busy = true; setMode('fast');
        return;
      }
      if (started && !voiced && now - lastVoice > GAP_MS && p < endAt) {
        busy = true;
        fallsRef.current += 1; setFalls(fallsRef.current); setFall(true);
        (async () => {
          if (fallsRef.current >= 4) { setNeutral(false); onDone(false); return; }
          if (fallsRef.current >= 2) { setNeutral(true); await model(); setNeutral(false); }
          else await say({ p: 'kite_fell' });
          await wait(300);
          setFall(false); setPos(0); p = 0; started = false; busy = false; last = performance.now();
        })();
      }
    });
    // eslint-disable-next-line
  }, [mode]);

  useEffect(() => { if (mode === 'fast') say({ p: 'say_fast' }); }, [mode]);

  const { strip } = useSpokenScore({
    enabled: mode === 'fast' || (mode === 'glide' && (!meter.ready || falls >= 2)),
    parentScoring: ctx.settings.parentScoring, setNeutral,
    correction: () => say({ p: 'my_turn' }, { pause: 150 }, { w: word }, { pause: 400 }, { p: 'your_turn' }),
    onDone: (ok) => onDone(ok && fallsRef.current === 0),
  });

  const pct = (pos / chunks.length) * 100;
  const current = Math.min(chunks.length - 1, Math.floor(pos));
  return (
    <div className="stage">
      {alien && <div style={{ fontSize: '10vmin' }}>👾</div>}
      <div className="track">
        <Kite fall={fall} style={{ left: `calc(${pct}% - 9vmin)`, top: mode === 'fast' ? '-2vmin' : pos > 0 ? '1vmin' : '6vmin' }} />
        {chunks.map((c, i) => (
          <Tile key={i} label={c} word state={mode === 'fast' ? 'good' : pos > 0 && i === current ? 'selected' : undefined} onTap={() => segs[i] && say({ g: segs[i] })} />
        ))}
        <div className="arrow" style={{ width: `${pct}%` }} />
      </div>
      <Waveform />
      <Caption>{mode === 'fast' ? 'Say it fast!' : falls > 0 ? 'Keep your voice on' : ''}</Caption>
      {strip}
    </div>
  );
}

/* ---------- A7 Read & Match ---------- */
export function ReadMatch({ step, onDone, setNeutral }: ActivityProps) {
  const word = step.word!;
  const { choose, stateOf } = useTapChoice({
    answer: word.toLowerCase(), onDone, setNeutral,
    intro: () => say({ p: 'read_match' }),
    correction: () => say({ p: 'my_turn' }, { pause: 150 }, { w: word }),
  });
  return (
    <div className="stage">
      <div className="prompt-word">{word}</div>
      <div className="row">{step.options!.map((o) => <PictureTile key={o} word={o} onTap={() => choose(o)} state={stateOf(o)} correct={o === word.toLowerCase()} />)}</div>
    </div>
  );
}

/* ---------- A8 Which Word ---------- */
export function WhichWord({ step, onDone, setNeutral }: ActivityProps) {
  const word = step.word!;
  const intro = () => say({ p: 'which_word' }, { pause: 150 }, { w: word });
  const { choose, stateOf } = useTapChoice({
    answer: word, onDone, setNeutral, intro,
    correction: () => say({ p: 'my_turn' }, { pause: 150 }, { w: word }),
  });
  return (
    <div className="stage">
      <ReplayButton onTap={intro} />
      <div className="row">{step.options!.map((o) => <Tile key={o} word label={o} onTap={() => choose(o)} state={stateOf(o)} correct={o === word} />)}</div>
    </div>
  );
}

/* ---------- A9 Build It ---------- */
export function Build({ step, onDone, setNeutral }: ActivityProps) {
  const word = step.word!;
  const segs = segment(word)!;
  const tiles = [...new Set(step.options!)];
  const [filled, setFilled] = useState(0);
  const [hint, setHint] = useState(false);
  const [locked, setLocked] = useState(true);
  const erred = useRef(false);
  const intro = () => say({ p: 'build_it' }, { pause: 150 }, { w: word });
  useEffect(() => { intro().then(() => setLocked(false)); /* eslint-disable-next-line */ }, []);
  const choose = async (t: string) => {
    if (locked) return;
    if (t === segs[filled]) {
      setHint(false);
      const n = filled + 1;
      setFilled(n);
      say({ g: t });
      if (n === segs.length) { setLocked(true); await wait(500); await say({ w: word }); await sayYes(); onDone(!erred.current); }
      return;
    }
    erred.current = true;
    setLocked(true);
    setNeutral(true);
    await saySegmented(segs, 250);
    await say({ pause: 200 }, { g: segs[filled] });
    setNeutral(false);
    setHint(true); setLocked(false);
  };
  return (
    <div className="stage">
      <ReplayButton onTap={intro} />
      <div className="slots">{segs.map((s, i) => <div key={i} className={`slot ${i < filled ? 'filled' : ''}`}>{i < filled ? s : ''}</div>)}</div>
      <div className="row">{tiles.map((t) => <Tile key={t} label={t} onTap={() => choose(t)} state={hint && t === segs[filled] ? 'hint' : undefined} correct={t === segs[filled]} />)}</div>
    </div>
  );
}

/* ---------- A12 Sentence Read ---------- */
export function Sentence({ step, ctx, onDone, setNeutral }: ActivityProps) {
  const words = step.text!.split(' ');
  const [next, setNext] = useState(0);
  useEffect(() => { say({ p: 'sentence' }); }, []);
  const { strip } = useSpokenScore({
    enabled: next >= words.length, parentScoring: ctx.settings.parentScoring, setNeutral, onDone,
    correction: async () => { await say({ p: 'my_turn' }); for (const w of words) await say({ w: w.replace(/[^A-Za-z]/g, '') }); await say({ p: 'your_turn' }); setNext(0); },
  });
  return (
    <div className="stage">
      {step.source && <div className="subtitle">📖 From <i>{step.source}</i></div>}
      <div className="sentence">
        {words.map((w, i) => (
          <SentenceChip key={i} w={w} state={i < next ? 'done' : i === next ? 'next' : ''} onTap={() => i === next && setNext(next + 1)} />
        ))}
      </div>
      <Waveform />
      {strip}
    </div>
  );
}
function SentenceChip({ w, state, onTap }: { w: string; state: string; onTap: () => void }) {
  const tap = useTap(onTap);
  return <button className={`chip ${state}`} onPointerDown={tap}>{w}</button>;
}

/* ---------- A14 Ear Game (oral phonemic awareness) ---------- */
export function Ear({ step, onDone, setNeutral }: ActivityProps) {
  const e = step.ear!;
  const answer = step.word!;
  const segsOf = (w: string) => segment(w) ?? [];
  const intro = async () => {
    switch (e.mode) {
      case 'blend': await say({ p: 'ear_listen' }, { pause: 300 }); await saySegmented(segsOf(e.target), 500); break;
      case 'onset': { const s = segsOf(e.target); await say({ p: 'ear_listen' }, { pause: 300 }, { g: s[0] }, { pause: 500 }, { w: e.target.slice(1) }); break; }
      case 'rhyme': await say({ p: 'ear_rhyme' }, { pause: 150 }, { w: e.target }); break;
      case 'first': await say({ p: 'ear_first' }, { pause: 150 }, { g: e.target }); break;
    }
  };
  const { choose, stateOf } = useTapChoice({
    answer, onDone, setNeutral, intro,
    correction: async () => {
      await say({ p: 'my_turn' }, { pause: 150 });
      if (e.mode === 'rhyme') await say({ w: e.target }, { pause: 200 }, { w: answer });
      else if (e.mode === 'first') await say({ g: e.target }, { pause: 200 }, { w: answer });
      else { await saySegmented(segsOf(answer), 350); await say({ pause: 200 }, { w: answer }); }
    },
  });
  return (
    <div className="stage">
      <div style={{ fontSize: '9vmin' }}>👂</div>
      <ReplayButton onTap={intro} />
      <div className="row">{e.options.map((o) => <PictureTile key={o} word={o} onTap={() => choose(o)} state={stateOf(o)} correct={o === answer} />)}</div>
    </div>
  );
}

/* ---------- Banners ---------- */
export function Banner({ step, onDone }: ActivityProps) {
  const b = step.banner!;
  const done = useRef(false);
  const finish = () => { if (!done.current) { done.current = true; onDone(null); } };
  const tap = useTap(finish);
  const icon = { checkout: '⭐', cold: '🌅', story_time: '📖', new_sound: '🚪' }[b];
  const text = { checkout: 'Show what you know', cold: 'Remember yesterday?', story_time: 'Story time! Go find someone.', new_sound: 'A new sound!' }[b];
  useEffect(() => {
    say({ p: b }).then(() => { if (b !== 'story_time') setTimeout(finish, 500); });
    // eslint-disable-next-line
  }, []);
  return (
    <div className="stage" onPointerDown={b === 'story_time' ? undefined : tap}>
      <div style={{ fontSize: '26vmin' }}>{icon}</div>
      <h1 className="title">{text}</h1>
      {b === 'story_time' && <button className="primary soft" onPointerDown={tap}>We read it ✓</button>}
    </div>
  );
}

/* ---------- A11 Heart Word (irregular words from books he owns) ---------- */
export function HeartWord({ step, ctx, onDone, setNeutral }: ActivityProps) {
  const word = step.word!;
  const [ready, setReady] = useState(false);
  useEffect(() => { say({ p: 'heart_word' }, { pause: 200 }, { w: word }, { pause: 400 }, { p: 'your_turn' }).then(() => setReady(true)); /* eslint-disable-next-line */ }, []);
  const { strip } = useSpokenScore({
    enabled: ready, parentScoring: ctx.settings.parentScoring, onDone, setNeutral,
    correction: () => say({ p: 'my_turn' }, { pause: 150 }, { w: word }, { pause: 400 }, { p: 'your_turn' }),
  });
  return (
    <div className="stage">
      <div style={{ fontSize: '8vmin' }}>❤️</div>
      <div className="prompt-word">{word}</div>
      {step.source && <div className="subtitle">for <i>{step.source}</i></div>}
      <Waveform />
      {strip}
    </div>
  );
}
