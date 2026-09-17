import { useCallback, useEffect, useRef, useState } from 'react';
import { meter } from '../audio/mic';
import { acceptSound, extract } from '../audio/soundCheck';
import { envelope, loadReferences, Reference } from '../audio/references';
import { SoundCompare } from '../ui/SoundCompare';
import { say, sayYes } from '../audio/speaker';
import { useUtterance } from './useSpeech';
import { useTap } from '../ui/components';

const GRACE_MS = 1100;     // after the child speaks: ✓ shows, the grown-up can still tap ✗
const REPROMPT_MS = 7000;  // silence this long: "Your turn" again

/**
 * Scoring for spoken answers.
 * - Automatic (default): when the child speaks, a ✓ shows and it counts after a moment unless the grown-up taps ✗.
 *   The mic hears *that* he spoke, not *what*; the grown-up is the check. Silence → "Your turn" again.
 *   `acceptWhenEnabled` (sentences, stories): tapping through every word is the answer, no voice needed.
 * - Grown-up checks (setting, or no microphone): grown-up taps ✓ / ✗.
 * On a first-attempt miss, runs `correction` (My turn → Together → Your turn) and allows one retry.
 */
export function useSpokenScore(opts: {
  enabled: boolean;
  parentScoring: boolean;
  correction: () => Promise<void>;
  onDone: (correct: boolean) => void;
  setNeutral: (on: boolean) => void;
  acceptWhenEnabled?: boolean;
  /** Letter sound expected: the spoken sound is checked (loosely) against the grown-up's recording. */
  sound?: string;
}) {
  const [attempt, setAttempt] = useState(1);
  const [busy, setBusy] = useState(false);
  const [heard, setHeard] = useState(false);
  const [refs, setRefs] = useState<Record<string, Reference> | null>(null);
  const [tryShape, setTryShape] = useState<{ env: number[]; ok: boolean } | null>(null);
  useEffect(() => { if (opts.sound && !meter.simulated) loadReferences().then(setRefs); }, [opts.sound]);
  const finished = useRef(false);
  const grace = useRef<number>();
  const parent = opts.parentScoring || (!meter.ready && !opts.acceptWhenEnabled);
  const listening = opts.enabled && !busy && !parent && !heard;

  const resolve = useCallback(async (ok: boolean) => {
    clearTimeout(grace.current);
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
      setBusy(false);
      setAttempt(2);
    } else {
      finished.current = true;
      opts.onDone(false);
    }
  }, [attempt, busy, opts]);

  // Heard an answer: show ✓, count it after a moment unless ✗
  const accept = () => {
    setHeard(true);
    grace.current = window.setTimeout(() => resolve(true), GRACE_MS);
  };
  // For letter sounds: check the kind of sound first (loose); clearly the wrong kind → gentle correction
  const onSpoke = (start: number, end: number) => {
    const target = opts.sound;
    const clip = target && refs?.[target] ? meter.clip(start - 150, end + 150) : null;
    const features = clip && extract(clip.samples, clip.rate);
    if (!target || !refs?.[target] || !clip || !features) { accept(); return; }
    const ok = acceptSound(target, features, Object.fromEntries(Object.entries(refs).map(([g, r]) => [g, r.features])));
    setTryShape({ env: envelope(clip.samples, clip.rate), ok });
    if (ok) accept();
    else { setHeard(false); grace.current = window.setTimeout(() => { setTryShape(null); resolve(false); }, 900); }
  };
  const spoke = useUtterance(listening && !opts.acceptWhenEnabled && !tryShape, onSpoke, 600);
  useEffect(() => {
    if (listening && opts.acceptWhenEnabled) accept();
    // eslint-disable-next-line
  }, [listening, opts.acceptWhenEnabled]);

  // Silence: prompt again (once per attempt)
  useEffect(() => {
    if (!listening || opts.acceptWhenEnabled) return;
    const t = window.setTimeout(() => say({ p: 'your_turn' }), REPROMPT_MS);
    return () => clearTimeout(t);
  }, [listening, attempt, opts.acceptWhenEnabled]);
  useEffect(() => () => clearTimeout(grace.current), []);

  const okTap = useTap(() => resolve(true));
  const noTap = useTap(() => resolve(false));

  // Sound shapes: the grown-up's recording, and his try once he's spoken
  const compare = opts.sound && refs?.[opts.sound] && opts.enabled
    ? <SoundCompare reference={refs[opts.sound].envelope} child={tryShape?.env} ok={tryShape?.ok} />
    : null;

  const strip = opts.enabled ? (
    <div className="parent-strip">
      {parent ? (
        <>
          <button className="pbtn ok" disabled={busy} onPointerDown={okTap} aria-label="Correct">✓</button>
          <button className="pbtn no" disabled={busy} onPointerDown={noTap} aria-label="Not yet">✗</button>
          <small>grown-up</small>
        </>
      ) : (
        <>
          {heard ? <div className="heard" aria-label="Heard it">✓</div> : !busy && <div className={`mic-cue ${opts.acceptWhenEnabled ? '' : 'on'}`} aria-hidden>🎤</div>}
          {!heard && <button className="pbtn ok small" disabled={busy} onPointerDown={okTap} aria-label="Correct">✓</button>}
          <button className="pbtn no small" disabled={busy} onPointerDown={noTap} aria-label="Not yet">✗</button>
          <small>grown-up</small>
        </>
      )}
    </div>
  ) : null;

  return { attempt, busy, spoke, strip, compare };
}

/**
 * Unscored "your turn" for a letter sound (meet a sound, sound reveal): listens, loosely checks the sound, and moves on
 * when it's close; if clearly different it shows him again ("my turn… your turn") once, then moves on regardless.
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
