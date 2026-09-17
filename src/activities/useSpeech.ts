import { useEffect, useRef, useState } from 'react';
import { meter } from '../audio/mic';

/** A real attempt needs about 250 ms of actual voiced time. Short noises and echoes do not count. */
const MIN_VOICED_MS = 250;
/** Do not let a dropped animation frame manufacture a long stretch of speech. */
const MAX_SAMPLE_GAP_MS = 50;

/**
 * Listens for one spoken attempt: voice starts, then silence for `endSilenceMs`.
 * Returns whether the child has spoken yet; calls onUtterance(start, end) (performance.now times) at the end of speech.
 *
 * Voice duration is measured in elapsed milliseconds rather than animation frames so the threshold behaves the same
 * on 30/60/90/120 Hz displays and under browser jank.
 */
export function useUtterance(enabled: boolean, onUtterance: (start: number, end: number) => void, endSilenceMs = 700) {
  const [spoke, setSpoke] = useState(false);
  const cb = useRef(onUtterance);
  cb.current = onUtterance;
  useEffect(() => {
    if (!enabled) return;
    setSpoke(false);
    let voicedMs = 0;
    let lastVoice = 0;
    let lastSample = 0;
    let start = 0;
    let fired = false;
    let previousVoiced = false;
    return meter.subscribe(({ voiced }) => {
      if (fired) return;
      const now = performance.now();
      const sampleGap = lastSample ? Math.min(Math.max(0, now - lastSample), MAX_SAMPLE_GAP_MS) : 0;

      if (voiced) {
        if (!start || now - lastVoice > endSilenceMs) {
          start = now;
          voicedMs = 0;
        }
        if (previousVoiced) voicedMs += sampleGap;
        lastVoice = now;
        if (voicedMs >= MIN_VOICED_MS) setSpoke(true);
      }
      lastSample = now;
      previousVoiced = voiced;

      if (voicedMs >= MIN_VOICED_MS && now - lastVoice > endSilenceMs) {
        fired = true;
        cb.current(start, lastVoice);
      } else if (start && voicedMs < MIN_VOICED_MS && now - lastVoice > endSilenceMs) {
        start = 0;
        voicedMs = 0;
      }
    });
  }, [enabled, endSilenceMs]);
  return spoke;
}
