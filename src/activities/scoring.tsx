import { useCallback, useEffect, useRef, useState } from 'react';
import { meter } from '../audio/mic';
import { acceptSound, extract } from '../audio/soundCheck';
import { envelope, loadReferences, Reference } from '../audio/references';
import { SoundCompare } from '../ui/SoundCompare';
import { say, sayYes } from '../audio/speaker';
import { useUtterance } from './useSpeech';
import { useTap } from '../ui/components';

const REPROMPT_MS = 7000;

/**
 * Scoring for spoken answers.
 *
 * The microphone may detect that an attempt happened and may draw a waveform, but it never decides that a scored
 * answer is correct. A grown-up confirms every scored spoken response with ✓ / ✗. This keeps noisy pediatric speech
 * detection out of mastery, SRS, checkout, and cold-check data.
 *
 * `parentScoring=false` means "mic-assisted": the app listens for an attempt and shows that it heard one. It does not
 * mean automatic correctness. `acceptWhenEnabled` is used for sentence/story screens where tapping through the words
 * makes the answer ready for grown-up scoring without waiting for a separate voice event.
 */
export function useSpokenScore(opts: {
  enabled: boolean;
  parentScoring: boolean;
  correction: () => Promise<void>;
  onDone: (correct: boolean) => void;
  setNeutral: (on: boolean) => void;
  acceptWhenEnabled?: boolean;
  /** Letter sound expected: reference audio is shown as coaching, never as an automatic mastery verdict. */
  sound?: string;
}) {
  const [attempt, setAttempt] = useState(1);
  const [busy, setBusy] = useState(false);
  const [heard, setHeard] = useState(false);
  const [refs, setRefs] = useState<Record<string, Reference> | null>(null);
  const [tryShape, setTryShape] = useState<{ env: number[] } | null>(null);
  useEffect(() => { if (opts.sound && !meter.simulated) loadReferences().then(setRefs); }, [opts.sound]);
  const finished = useRef(false);

  const micAssisted = !opts.parentScoring && meter.ready && !opts.acceptWhenEnabled;
  const listening = opts.enabled && !busy && micAssisted && !heard;

  const resolve = useCallback(async (ok: boolean) => {
    if (finished.current || busy) return;
    setHeard(false);
    if (ok) {
      finished.current = true;
      await sayYes();
      opts.onDone(attempt === 1);
      return;
    }
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
  }, [attempt, busy, opts]);

  const onSpoke = (start: number, end: number) => {
    const target = opts.sound;
    const clip = target && refs?.[target] ? meter.clip(start - 150, end + 150) : null;
    if (clip) setTryShape({ env: envelope(clip.samples, clip.rate) });
    setHeard(true);
  };
  const spoke = useUtterance(listening, onSpoke, 600);

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
    <div className="parent-strip">
      {micAssisted && (heard
        ? <div className="heard" aria-label="Attempt heard">🎤</div>
        : !busy && <div className="mic-cue on" aria-hidden>🎤</div>)}
      <button className="pbtn ok" disabled={busy} onPointerDown={okTap} aria-label="Correct">✓</button>
      <button className="pbtn no" disabled={busy} onPointerDown={noTap} aria-label="Not yet">✗</button>
      <small>grown-up</small>
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
