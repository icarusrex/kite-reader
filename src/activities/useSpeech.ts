import { useEffect, useRef, useState } from 'react';
import { meter } from '../audio/mic';

/** A real attempt needs this much voice (~250 ms at 60 frames/s): short noises and echoes don't count. */
const MIN_VOICED_FRAMES = 15;

/**
 * Listens for one spoken attempt: voice starts, then silence for `endSilenceMs`.
 * Returns whether the child has spoken yet; calls onUtterance(start, end) (performance.now times) at the end of speech.
 */
export function useUtterance(enabled: boolean, onUtterance: (start: number, end: number) => void, endSilenceMs = 700) {
  const [spoke, setSpoke] = useState(false);
  const cb = useRef(onUtterance);
  cb.current = onUtterance;
  useEffect(() => {
    if (!enabled) return;
    setSpoke(false);
    let voicedFrames = 0, lastVoice = 0, start = 0, fired = false;
    return meter.subscribe(({ voiced }) => {
      if (fired) return;
      const now = performance.now();
      if (voiced) {
        if (!start || now - lastVoice > endSilenceMs) { start = now; voicedFrames = 0; }
        voicedFrames++; lastVoice = now;
        if (voicedFrames === MIN_VOICED_FRAMES) setSpoke(true);
      }
      if (voicedFrames >= MIN_VOICED_FRAMES && now - lastVoice > endSilenceMs) { fired = true; cb.current(start, lastVoice); }
      else if (start && voicedFrames < MIN_VOICED_FRAMES && now - lastVoice > endSilenceMs) { start = 0; voicedFrames = 0; }
    });
  }, [enabled, endSilenceMs]);
  return spoke;
}
