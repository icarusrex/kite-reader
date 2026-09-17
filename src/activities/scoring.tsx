import { useCallback, useEffect, useRef, useState } from 'react';
import { meter } from '../audio/mic';
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
}) {
  const [attempt, setAttempt] = useState(1);
  const [busy, setBusy] = useState(false);
  const [heard, setHeard] = useState(false);
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
  const spoke = useUtterance(listening && !opts.acceptWhenEnabled, accept, 600);
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

  return { attempt, busy, spoke, strip };
}
