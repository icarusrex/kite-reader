import { useCallback, useRef, useState } from 'react';
import { meter } from '../audio/mic';
import { sayYes } from '../audio/speaker';
import { useUtterance } from './useSpeech';
import { useTap } from '../ui/components';

/**
 * Scoring for spoken answers.
 * - Parent scoring on (or mic unavailable): grown-up taps ✓ / ✗.
 * - Parent scoring off: any clear utterance counts as correct.
 * On a first-attempt miss, runs `correction` (My turn → Your turn) and allows one retry.
 */
export function useSpokenScore(opts: {
  enabled: boolean;
  parentScoring: boolean;
  correction: () => Promise<void>;
  onDone: (correct: boolean) => void;
  setNeutral: (on: boolean) => void;
}) {
  const [attempt, setAttempt] = useState(1);
  const [busy, setBusy] = useState(false);
  const finished = useRef(false);
  const parent = opts.parentScoring || !meter.ready;

  const resolve = useCallback(async (ok: boolean) => {
    if (finished.current || busy) return;
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

  const spoke = useUtterance(opts.enabled && !busy && !parent, () => resolve(true));
  const okTap = useTap(() => resolve(true));
  const noTap = useTap(() => resolve(false));

  const strip = opts.enabled ? (
    <div className="parent-strip">
      {parent && (
        <>
          <button className="pbtn ok" disabled={busy} onPointerDown={okTap} aria-label="Correct">✓</button>
          <button className="pbtn no" disabled={busy} onPointerDown={noTap} aria-label="Not yet">✗</button>
          <small>grown-up</small>
        </>
      )}
      {!parent && <button className="pbtn no" disabled={busy} onPointerDown={noTap} aria-label="Not yet">✗</button>}
    </div>
  ) : null;

  return { attempt, busy, spoke, strip };
}
