import { useEffect, useRef, useState } from 'react';
import { meter } from '../audio/mic';

/**
 * Listens for one spoken attempt: voice starts, then silence for `endSilenceMs`.
 * Returns whether the child has spoken yet; calls onUtterance at the end of speech.
 */
export function useUtterance(enabled: boolean, onUtterance: () => void, endSilenceMs = 700) {
  const [spoke, setSpoke] = useState(false);
  const cb = useRef(onUtterance);
  cb.current = onUtterance;
  useEffect(() => {
    if (!enabled) return;
    setSpoke(false);
    let voicedFrames = 0;
    let lastVoice = 0;
    let fired = false;
    return meter.subscribe(({ voiced }) => {
      const now = performance.now();
      if (voiced) { voicedFrames++; lastVoice = now; if (voicedFrames === 6) setSpoke(true); }
      if (!fired && voicedFrames >= 6 && now - lastVoice > endSilenceMs) { fired = true; cb.current(); }
    });
  }, [enabled, endSilenceMs]);
  return spoke;
}
