import { useEffect, useRef, useState } from 'react';
import { meter } from '../audio/mic';
import { Utter, say, saySegmented, sayYes, stop } from '../audio/speaker';
import { GRAPHEME_BY_ID } from '../content/phonemes';
import { displayChunks, segment, trickyParts } from '../engine/decodable';
import { ANCHORS, COMPOUND, SYLLABLE } from '../content/basics';
import { Caption, Kite, PictureTile, ReplayButton, Tile, Waveform, useTap } from '../ui/components';
import { useSoundTry, useSpokenScore } from './scoring';
import { useUtterance } from './useSpeech';
import { ActivityProps, wait } from './types';

/** DI correction for spoken answers: My turn (model) → Together (model while child joins in) → Your turn. */
const correctSpoken = async (...model: Utter[]) => {
  await say({ p: 'my_turn' }, { pause: 150 }, ...model, { pause: 400 }, { p: 'together' }, { pause: 150 }, ...model, { pause: 900 }, { p: 'your_turn' });
};

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
  const { compare } = useSoundTry(g, phase === 'you1' || phase === 'you2', next);
  const tap = useTap(next);
  return (
    <div className="stage">
      <div style={{ transform: shown ? 'scale(1)' : 'scale(0.2)', opacity: shown ? 1 : 0, transition: 'all .5s cubic-bezier(.3,1.6,.5,1)' }}>
        <Tile big label={g} onTap={() => say({ g })} />
      </div>
      {compare ?? <Waveform />}
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
  // Answers are live straight away: tapping while the instruction is still playing cuts it off (a grown-up is
  // sitting alongside). Only the correction and the "yes" lock the tiles.
  const [locked, setLocked] = useState(false);
  useEffect(() => { opts.intro(); /* eslint-disable-next-line */ }, []);
  const choose = async (o: string) => {
    if (locked || good) return;
    stop();
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
export function HearTap(props: ActivityProps) {
  if (props.step.demo) return <TapDemo {...props} intro={() => say({ p: 'find_sound' }, { pause: 150 }, { g: props.step.g! })} outro={() => say({ g: props.step.g! })} answer={props.step.g!} render={(o, state) => <Tile key={o} label={o} state={state} />} />;
  return <HearTapLive {...props} />;
}
function HearTapLive({ step, onDone, setNeutral }: ActivityProps) {
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
  const { strip, attempt, compare } = useSpokenScore({
    enabled: ready, parentScoring: ctx.settings.parentScoring, onDone, setNeutral, sound: g,
    correction: () => correctSpoken({ g }),
  });
  return (
    <div className="stage">
      <Tile big label={g} />
      {compare ?? <Waveform />}
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
    correction: () => correctSpoken({ w: word }),
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
  const [locked, setLocked] = useState(false);
  const erred = useRef(false);
  const intro = () => say({ p: 'build_it' }, { pause: 150 }, { w: word });
  useEffect(() => { intro(); /* eslint-disable-next-line */ }, []);
  const choose = async (t: string) => {
    if (locked) return;
    stop();
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
    await saySegmented(segs, 120);
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
    enabled: next >= words.length, parentScoring: ctx.settings.parentScoring, setNeutral, onDone, acceptWhenEnabled: true,
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
export function Ear(props: ActivityProps) {
  const { step } = props;
  if (step.demo) {
    const e = step.ear!;
    const segsOf = (w: string) => segment(w) ?? [];
    const intro = async () => {
      if (e.mode === 'rhyme') await say({ p: 'ear_rhyme' }, { pause: 150 }, { w: e.target });
      else if (e.mode === 'first') await say({ p: 'ear_first' }, { pause: 150 }, { g: e.target });
      else if (e.mode === 'last') await say({ p: 'ear_last' }, { pause: 150 }, { g: e.target });
      else if (e.mode === 'onset') { const s = segsOf(e.target); await say({ p: 'ear_listen' }, { pause: 300 }, { g: s[0] }, { pause: 300 }, { w: e.target.slice(1) }); }
      else { await say({ p: 'ear_listen' }, { pause: 300 }); await saySegmented(segsOf(e.target), 180); }
    };
    return <TapDemo {...props} step={{ ...step, options: e.options }} intro={intro} outro={() => say({ p: 'it_is' }, { pause: 100 }, { w: step.word! })} answer={step.word!} render={(o, state) => <PictureTile key={o} word={o} state={state} />} />;
  }
  return <EarLive {...props} />;
}
function EarLive({ step, onDone, setNeutral }: ActivityProps) {
  const e = step.ear!;
  const answer = step.word!;
  const segsOf = (w: string) => segment(w) ?? [];
  const intro = async () => {
    switch (e.mode) {
      case 'blend': await say({ p: 'ear_listen' }, { pause: 300 }); await saySegmented(segsOf(e.target), 180); break;
      case 'onset': { const s = segsOf(e.target); await say({ p: 'ear_listen' }, { pause: 300 }, { g: s[0] }, { pause: 500 }, { w: e.target.slice(1) }); break; }
      case 'rhyme': await say({ p: 'ear_rhyme' }, { pause: 150 }, { w: e.target }); break;
      case 'first': await say({ p: 'ear_first' }, { pause: 150 }, { g: e.target }); break;
      case 'last': await say({ p: 'ear_last' }, { pause: 150 }, { g: e.target }); break;
    }
  };
  const { choose, stateOf } = useTapChoice({
    answer, onDone, setNeutral, intro,
    correction: async () => {
      await say({ p: 'my_turn' }, { pause: 150 });
      if (e.mode === 'rhyme') await say({ w: e.target }, { pause: 200 }, { w: answer });
      else if (e.mode === 'first' || e.mode === 'last') await say({ g: e.target }, { pause: 200 }, { w: answer });
      else { await saySegmented(segsOf(answer), 150); await say({ pause: 200 }, { w: answer }); }
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
  const icon = { checkout: '⭐', cold: '🌅', story_time: '📖', new_sound: '🚪', level_done: '🪁' }[b];
  const text = { checkout: 'Show what you know', cold: 'Remember yesterday?', story_time: 'Story time! Go find someone.', new_sound: 'A new sound!', level_done: 'You finished a level!' }[b];
  const story = b === 'story_time' ? step.lines : undefined;
  useEffect(() => {
    say({ p: b }).then(() => {
      if (b === 'story_time') say({ pause: 400 }, { p: 'story_tap' });
      else setTimeout(finish, b === 'level_done' ? 1800 : 500);
    });
    // eslint-disable-next-line
  }, []);
  return (
    <div className="stage" onPointerDown={b === 'story_time' ? undefined : tap}>
      {b === 'level_done' && <div className="burst" aria-hidden>{Array.from({ length: 14 }, (_, i) => <span key={i} style={{ '--i': i } as React.CSSProperties} />)}</div>}
      {!step.image && <div style={{ fontSize: story ? '12vmin' : '26vmin' }}>{icon}</div>}
      <h1 className="title">{text}</h1>
      {story && (
        <div className="story-layout">
          {step.image && <img className="story-picture" src={step.image} alt="" />}
          <div className="story">{story.map((l, i) => <p key={i}>{l}</p>)}</div>
        </div>
      )}
      {b === 'story_time' && (
        <button className="primary soft story-done" onPointerDown={tap} aria-label="We read it">
          <span className="story-done-icons" aria-hidden>📖👍</span>
          <span>We read it!</span>
          <span className="story-done-hand" aria-hidden>👆</span>
        </button>
      )}
    </div>
  );
}

/* ---------- A11 Heart Word ---------- */
/** First exposure (step.model): show the word with the tricky part marked, say it, child repeats (unscored).
 *  Otherwise the child reads it cold: nothing is said first, the grown-up scores. */
export function HeartWord({ step, ctx, onDone, setNeutral }: ActivityProps) {
  const word = step.word!;
  const parts = trickyParts(word, ctx.level);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    (step.model
      ? say({ p: 'heart_word' }, { pause: 200 }, { w: word }, { pause: 400 }, { p: 'together' }, { pause: 150 }, { w: word }, { pause: 900 }, { p: 'your_turn' })
      : say({ p: 'heart_read' })).then(() => setReady(true));
    // eslint-disable-next-line
  }, []);
  const next = useTap(() => onDone(null));
  useUtterance(meter.ready && ready && !!step.model, () => sayYes().then(() => onDone(null)), 600);
  const { strip } = useSpokenScore({
    enabled: ready && !step.model, parentScoring: ctx.settings.parentScoring, onDone, setNeutral,
    correction: () => correctSpoken({ w: word }),
  });
  return (
    <div className="stage">
      <div style={{ fontSize: '8vmin' }}>❤️</div>
      <div className="prompt-word">{parts.map((pt, i) => <span key={i} className={pt.tricky ? 'tricky' : ''}>{pt.text}</span>)}</div>
      {step.source && <div className="subtitle">for <i>{step.source}</i></div>}
      <Waveform />
      {step.model ? ready && <div className="parent-strip">{meter.ready && <div className="mic-cue on" aria-hidden>🎤</div>}<button className="pbtn ok small" onPointerDown={next} aria-label="Next">→</button><small>grown-up</small></div> : strip}
    </div>
  );
}

/* ---------- A13 Story ---------- */
export function Story({ step, ctx, onDone, setNeutral }: ActivityProps) {
  const lines = step.lines!;
  const words = lines.flatMap((l, li) => l.split(' ').map((w) => ({ w, li })));
  const [next, setNext] = useState(0);
  useEffect(() => { say({ p: 'story' }); }, []);
  const { strip } = useSpokenScore({
    enabled: next >= words.length, parentScoring: ctx.settings.parentScoring, setNeutral, onDone, acceptWhenEnabled: true,
    correction: async () => { await say({ p: 'my_turn' }); for (const { w } of words) await say({ w: w.replace(/[^A-Za-z]/g, '') }); await say({ p: 'your_turn' }); setNext(0); },
  });
  return (
    <div className="stage">
      <div className="story-layout">
        {step.image && <img className="story-picture" src={step.image} alt="" />}
        <div className="story">
          {lines.map((_, li) => (
            <p key={li}>{words.map((x, i) => x.li === li && <SentenceChip key={i} w={x.w} state={i < next ? 'done' : i === next ? 'next' : ''} onTap={() => i === next && setNext(next + 1)} />)}</p>
          ))}
        </div>
      </div>
      {strip}
    </div>
  );
}

/* ---------- "Watch me": shows a tap game once with the answer, unscored ---------- */
function TapDemo({ step, onDone, intro, outro, answer, render }: ActivityProps & {
  intro: () => Promise<void>; outro: () => Promise<void>; answer: string;
  render: (option: string, state: 'good' | 'hint' | 'dim' | undefined) => JSX.Element;
}) {
  const [shown, setShown] = useState(false);
  useEffect(() => {
    let live = true;
    (async () => {
      await say({ p: 'watch_me' }, { pause: 200 });
      await intro();
      await wait(500);
      if (!live) return;
      setShown(true);
      await say({ p: 'my_turn' }, { pause: 150 });
      await outro();
      await wait(700);
      if (live) onDone(null);
    })();
    return () => { live = false; };
    // eslint-disable-next-line
  }, []);
  return (
    <div className="stage">
      <Caption>Watch me</Caption>
      <div className="row demo">{step.options!.map((o) => render(o, shown ? (o === answer ? 'good' : 'dim') : undefined))}</div>
    </div>
  );
}

/* ---------- Basics: meet a sound (letter + picture anchor, unscored) ---------- */
export function Meet({ step, onDone }: ActivityProps) {
  const g = step.g!;
  const anchor = ANCHORS[g];
  const [phase, setPhase] = useState<'model' | 'you' | 'done'>('model');
  useEffect(() => {
    say({ p: 'sound_says' }, { pause: 200 }, { g }, { pause: 500 }, { p: 'like_in' }, { pause: 100 }, { w: anchor }, { pause: 600 }, { g }, { pause: 400 }, { p: 'your_turn' })
      .then(() => setPhase('you'));
    // eslint-disable-next-line
  }, [g]);
  const advance = async () => { if (phase !== 'you') return; setPhase('done'); await sayYes(); onDone(null); };
  const next = useTap(advance);
  const { compare } = useSoundTry(g, phase === 'you', advance);
  return (
    <div className="stage">
      <div className="meet">
        <Tile big label={g} onTap={() => say({ g })} />
        {anchor && <PictureTile word={anchor} onTap={() => say({ w: anchor })} />}
      </div>
      {compare}
      <Caption>{phase === 'you' ? 'Your turn' : ''}</Caption>
      {phase === 'you' && <div className="parent-strip">{meter.ready && <div className="mic-cue on" aria-hidden>🎤</div>}<button className="pbtn ok small" onPointerDown={next} aria-label="Next">→</button><small>grown-up</small></div>}
    </div>
  );
}

/* ---------- Basics: say it fast (oral blending with pictures) ---------- */
const splitOf = (word: string) => [...COMPOUND, ...SYLLABLE].find((c) => c.word === word)?.split ?? word;
export function SayFast(props: ActivityProps) {
  const { step } = props;
  const word = step.word!;
  const slow = () => step.fast!.mode === 'stretch'
    ? saySegmented(segment(word) ?? [], 0)
    : say({ key: `split:${word}`, text: splitOf(word) });
  const intro = async () => { await say({ p: 'say_fast_game' }, { pause: 250 }); await slow(); await say({ pause: 300 }, { p: 'which_picture' }); };
  if (step.demo) return <TapDemo {...props} intro={intro} outro={() => say({ p: 'it_is' }, { pause: 100 }, { w: word })} answer={word} render={(o, state) => <PictureTile key={o} word={o} state={state} />} />;
  return <SayFastLive {...props} intro={intro} slow={slow} />;
}
function SayFastLive({ step, onDone, setNeutral, intro, slow }: ActivityProps & { intro: () => Promise<void>; slow: () => Promise<void> }) {
  const word = step.word!;
  const { choose, stateOf } = useTapChoice({
    answer: word, onDone, setNeutral, intro,
    correction: async () => { await say({ p: 'my_turn' }, { pause: 150 }); await slow(); await say({ pause: 250 }, { p: 'it_is' }, { w: word }); },
  });
  return (
    <div className="stage">
      <div style={{ fontSize: '9vmin' }}>👂</div>
      <ReplayButton onTap={slow} />
      <div className="row">{step.options!.map((o) => <PictureTile key={o} word={o} onTap={() => choose(o)} state={stateOf(o)} correct={o === word} />)}</div>
    </div>
  );
}

/* ---------- Basics: rhyme (shown first, then yes / no) ---------- */
export function Rhyme({ step, onDone, setNeutral }: ActivityProps) {
  const [a, b] = step.pair!;
  const [phase, setPhase] = useState<'intro' | 'ask' | 'done'>('intro');
  const [picked, setPicked] = useState<boolean | null>(null);
  const attempt = useRef(1);
  const words = () => say({ w: a }, { pause: 350 }, { w: b });
  useEffect(() => {
    (async () => {
      if (step.demo) {
        await say({ p: 'watch_me' }, { pause: 200 });
        await words();
        await say({ pause: 400 }, { p: 'rhyme_teach' }, { pause: 300 });
        await words();
        setPhase('done');
        await wait(900);
        onDone(null);
        return;
      }
      await say({ p: 'rhyme_ask' }, { pause: 250 });
      await words();
      setPhase('ask');
    })();
    // eslint-disable-next-line
  }, []);
  const answer = async (yes: boolean) => {
    if (phase === 'done' && step.demo) { onDone(null); return; }
    if (phase !== 'ask' && phase !== 'intro') return;
    stop();
    setPicked(yes);
    if (yes === step.rhymes) {
      setPhase('done');
      await say({ p: step.rhymes ? 'rhyme_yes' : 'rhyme_no' });
      onDone(attempt.current === 1);
      return;
    }
    setNeutral(true);
    await say({ p: 'my_turn' }, { pause: 150 });
    await words();
    await say({ pause: 300 }, { p: step.rhymes ? 'rhyme_yes' : 'rhyme_no' });
    setNeutral(false);
    attempt.current = 2;
    setPicked(null);
    setPhase('ask');
  };
  const yes = useTap(() => answer(true));
  const no = useTap(() => answer(false));
  const next = useTap(() => onDone(null));
  return (
    <div className="stage">
      <div className="row">
        <PictureTile word={a} onTap={() => say({ w: a })} />
        <PictureTile word={b} onTap={() => say({ w: b })} />
      </div>
      {step.demo
        ? <><Caption>They rhyme</Caption><div className="parent-strip"><button className="pbtn ok small" onPointerDown={next} aria-label="Next">→</button><small>grown-up</small></div></>
        : (
          <div className="row">
            <button className={`tile yesno ${picked === true ? 'selected' : ''}`} onPointerDown={yes} aria-label="Yes, they rhyme" data-c={step.rhymes ? '1' : undefined}>👍</button>
            <button className={`tile yesno ${picked === false ? 'selected' : ''}`} onPointerDown={no} aria-label="No" data-c={step.rhymes ? undefined : '1'}>👎</button>
          </div>
        )}
      <ReplayButton onTap={words} />
    </div>
  );
}

/* ---------- Basics: left to right (tap the dots in order; unscored) ---------- */
export function TrackGame({ onDone }: ActivityProps) {
  const DOTS = 4;
  const [at, setAt] = useState(0);
  const [wiggle, setWiggle] = useState<number | null>(null);
  useEffect(() => { say({ p: 'track_game' }); }, []);
  const tap = async (i: number) => {
    if (i !== at) { setWiggle(i); setTimeout(() => setWiggle(null), 400); return; }
    stop();
    const n = at + 1;
    setAt(n);
    if (n === DOTS) { await wait(400); await sayYes(); onDone(null); }
  };
  return (
    <div className="stage">
      <div className="track-game">
        <Kite style={{ left: `calc(${(Math.min(at, DOTS - 1) / (DOTS - 1)) * 100}% - 9vmin)`, top: at === DOTS ? '-8vmin' : '-2vmin' }} />
        {Array.from({ length: DOTS }, (_, i) => (
          <TrackDot key={i} done={i < at} next={i === at} wiggle={wiggle === i} onTap={() => tap(i)} />
        ))}
        <div className="arrow" style={{ width: '100%' }} />
      </div>
      <Caption>→</Caption>
    </div>
  );
}
function TrackDot({ done, next, wiggle, onTap }: { done: boolean; next: boolean; wiggle: boolean; onTap: () => void }) {
  const tap = useTap(onTap);
  return <button className={`track-dot ${done ? 'done' : ''} ${next ? 'next' : ''} ${wiggle ? 'wiggle' : ''}`} onPointerDown={tap} aria-label="dot" data-c={next ? '1' : undefined} />;
}
