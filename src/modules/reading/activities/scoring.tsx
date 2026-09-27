import { useCallback, useEffect, useRef, useState } from 'react';
import { meter } from '../audio/mic';
import { STOPS, acceptSound, extract } from '../audio/soundCheck';
import { Clip, Verdict, addExample, judge, keepClip, loadVoice, mfcc, noteCorrected } from '../audio/ownVoice';
import { useStore } from '../../../core/app/store';
import { ActivityCtx } from './types';
import { envelope, loadReferences, Reference } from '../audio/references';
import { SoundCompare } from '../ui/SoundCompare';
import { say, sayYes } from '../audio/speaker';
import { SHORT_VOICED_MS, useUtterance } from './useSpeech';
import { useTap } from '../../../core/ui/components';

const REPROMPT_MS = 7000;
/** How long the grown-up has to tap ✗ before the app's own "Yes!" goes through. */
const AUTO_YES_MS = 1000;
/** Sentences and stories: the child tapped through the words; give the grown-up a little longer to object. */
const AUTO_YES_READ_MS = 2200;

/**
 * Scoring for spoken answers.
 *
 * Practice answers are approved by exception: when the child has had a go, the app says "Yes!" by itself after a
 * short pause, and the grown-up only taps ✗ when it was wrong. For letter sounds the app first checks the try against
 * this child's own accepted tries (ownVoice.ts; before there are enough, the loose check against the grown-up's
 * recordings) and holds back when it sounds like something else, so then it waits for the grown-up after all.
 * It never marks an answer wrong on its own: a false "wrong" would upset the child and can end the session.
 *
 * Checkout and cold-check answers decide whether a level is passed, so the grown-up still approves each of those.
 * `settings.autoYes === false` or `parentScoring` turns the automatic "Yes!" off everywhere.
 */
export function useSpokenScore(opts: {
  enabled: boolean;
  ctx: ActivityCtx;
  correction: () => Promise<void>;
  onDone: (correct: boolean) => void;
  setNeutral: (on: boolean) => void;
  acceptWhenEnabled?: boolean;
  /** Letter sound expected: checked before any automatic "Yes!", and learnt from when accepted. */
  sound?: string;
}) {
  const { activeProfileId } = useStore();
  const [attempt, setAttempt] = useState(1);
  const [busy, setBusy] = useState(false);
  const [heard, setHeard] = useState(false);
  const [doubt, setDoubt] = useState(false);
  const [pending, setPending] = useState(false);
  const [refs, setRefs] = useState<Record<string, Reference> | null>(null);
  const [tryShape, setTryShape] = useState<{ env: number[] } | null>(null);
  useEffect(() => { if (opts.sound && !meter.simulated) loadReferences().then(setRefs); }, [opts.sound]);
  const finished = useRef(false);
  const autoTimer = useRef<number | undefined>();
  const tryFeats = useRef<number[][] | null>(null);
  const tryClip = useRef<Clip | null>(null);
  useEffect(() => () => clearTimeout(autoTimer.current), []);

  const settings = opts.ctx.settings;
  const micAssisted = !settings.parentScoring && meter.ready && !opts.acceptWhenEnabled;
  const autoAllowed = !settings.parentScoring && settings.autoYes !== false && opts.ctx.phase === 'main';
  const listening = opts.enabled && !busy && micAssisted && !heard;

  const resolve = useCallback(async (ok: boolean, auto = false) => {
    if (finished.current || busy) return;
    clearTimeout(autoTimer.current);
    if (!ok && pending) void noteCorrected(activeProfileId);
    setPending(false); setHeard(false); setDoubt(false);
    if (ok) {
      finished.current = true;
      if (opts.sound && tryFeats.current) void addExample(activeProfileId, opts.sound, tryFeats.current, auto, tryClip.current);
      await sayYes();
      opts.onDone(attempt === 1);
      return;
    }
    if (opts.sound && tryClip.current) void keepClip(activeProfileId, 'no', opts.sound, tryClip.current);
    tryFeats.current = null; tryClip.current = null;
    if (attempt === 1) {
      setBusy(true);
      opts.setNeutral(true);
      await opts.correction();
      opts.setNeutral(false);
      setTryShape(null);
      setBusy(false);
      setAttempt(2);
    } else {
      finished.current = true;
      opts.onDone(false);
    }
  }, [attempt, busy, pending, opts, activeProfileId]);
  const resolveRef = useRef(resolve); resolveRef.current = resolve;

  const startAutoYes = (ms: number) => {
    setPending(true);
    autoTimer.current = window.setTimeout(() => resolveRef.current(true, true), ms);
  };

  const onSpoke = async (start: number, end: number) => {
    const target = opts.sound;
    const clip = target && !meter.simulated ? meter.clip(start - 150, end + 150) : null;
    if (clip && refs?.[target!]) setTryShape({ env: envelope(clip.samples, clip.rate) });
    tryFeats.current = clip ? mfcc(clip.samples, clip.rate) : null;
    tryClip.current = clip;
    setHeard(true);
    if (!autoAllowed) return;
    let verdict: Verdict = 'match';
    if (target && clip) {
      const own = tryFeats.current ? judge(target, tryFeats.current, await loadVoice(activeProfileId)) : 'unsure';
      const loose = refs && Object.keys(refs).length ? (() => { const f = extract(clip.samples, clip.rate); return f ? acceptSound(target, f, Object.fromEntries(Object.entries(refs).map(([g, r]) => [g, r.features]))) : true; })() : true;
      // The child's own voice decides once it knows the sound; until then the loose check can only hold back.
      verdict = own !== 'unsure' ? own : loose ? 'match' : 'mismatch';
    }
    if (verdict === 'mismatch') { setDoubt(true); return; }
    startAutoYes(AUTO_YES_MS);
  };
  const spoke = useUtterance(listening, onSpoke, 600, opts.sound && STOPS.has(opts.sound) ? SHORT_VOICED_MS : undefined);

  // Sentences and stories: finishing the words is the attempt.
  useEffect(() => {
    if (opts.acceptWhenEnabled && opts.enabled && autoAllowed && !busy && !finished.current) startAutoYes(AUTO_YES_READ_MS);
    return () => { clearTimeout(autoTimer.current); setPending(false); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opts.acceptWhenEnabled, opts.enabled, autoAllowed, busy]);

  // Silence: prompt again (once per attempt). The prompt does not change the score.
  useEffect(() => {
    if (!listening) return;
    const t = window.setTimeout(() => say({ p: 'your_turn' }), REPROMPT_MS);
    return () => clearTimeout(t);
  }, [listening, attempt]);

  const okTap = useTap(() => resolve(true));
  const noTap = useTap(() => resolve(false));

  const compare = opts.sound && refs?.[opts.sound] && opts.enabled
    ? <SoundCompare reference={refs[opts.sound].envelope} child={tryShape?.env} />
    : null;

  const strip = opts.enabled ? (
    <div className={`parent-strip ${pending ? 'pending' : ''} ${doubt ? 'doubt' : ''}`}>
      {micAssisted && (heard
        ? <div className="heard" aria-label="Attempt heard">{doubt ? '🤔' : '🎤'}</div>
        : !busy && <div className="mic-cue on" aria-hidden>🎤</div>)}
      <button className="pbtn ok" disabled={busy} onPointerDown={okTap} aria-label="Correct">✓</button>
      <button className="pbtn no" disabled={busy} onPointerDown={noTap} aria-label="Not yet">✗</button>
      <small>{pending ? 'wrong? tap ✗' : doubt ? 'check this one' : 'grown-up'}</small>
    </div>
  ) : null;

  return { attempt, busy, spoke, strip, compare };
}

/**
 * Unscored "your turn" for a letter sound (meet a sound, sound reveal): listens, loosely checks the sound, and moves
 * on when it is close; if clearly different it models once, then moves on regardless. This classifier is coaching
 * only and never writes mastery/SRS data.
 */
export function useSoundTry(sound: string, enabled: boolean, onGood: () => void) {
  const [refs, setRefs] = useState<Record<string, Reference> | null>(null);
  const [tryShape, setTryShape] = useState<{ env: number[]; ok: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const misses = useRef(0);
  useEffect(() => { if (!meter.simulated) loadReferences().then(setRefs); }, []);
  useEffect(() => { if (enabled) setTryShape(null); }, [enabled]);
  const onSpoke = async (start: number, end: number) => {
    const clip = refs?.[sound] ? meter.clip(start - 150, end + 150) : null;
    const features = clip && extract(clip.samples, clip.rate);
    if (!clip || !features || !refs) { onGood(); return; }
    const ok = acceptSound(sound, features, Object.fromEntries(Object.entries(refs).map(([g, r]) => [g, r.features])));
    setTryShape({ env: envelope(clip.samples, clip.rate), ok });
    if (ok || misses.current >= 1) { await new Promise((r) => setTimeout(r, 700)); onGood(); return; }
    misses.current++;
    setBusy(true);
    await say({ pause: 500 }, { p: 'my_turn' }, { pause: 150 }, { g: sound }, { pause: 400 }, { p: 'your_turn' });
    setTryShape(null);
    setBusy(false);
  };
  useUtterance(enabled && meter.ready && !busy && !tryShape, onSpoke, 600);
  const compare = refs?.[sound] && enabled ? <SoundCompare reference={refs[sound].envelope} child={tryShape?.env} ok={tryShape?.ok} /> : null;
  return { compare };
}
