import { useEffect, useRef, useState } from 'react';
import { save } from '../engine/storage';
import { refreshRecordings, say } from './speaker';

/** Record a pure sound for grapheme g into this device's storage; it overrides the built-in sound right away. */
export function useRecorder(onSaved: () => void) {
  const [recording, setRecording] = useState<string | null>(null);
  const rec = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const stream = useRef<MediaStream | null>(null);
  useEffect(() => () => stream.current?.getTracks().forEach((t) => t.stop()), []);

  const start = async (g: string) => {
    if (rec.current?.state === 'recording') return;
    stream.current ??= await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: true } });
    chunks.current = [];
    const r = new MediaRecorder(stream.current);
    r.ondataavailable = (e) => chunks.current.push(e.data);
    r.onstop = async () => {
      await save(`rec:g:${g}`, new Blob(chunks.current, { type: r.mimeType }));
      await refreshRecordings();
      setRecording(null);
      onSaved();
      say({ g });
    };
    rec.current = r;
    r.start();
    setRecording(g);
  };
  const stop = () => { if (rec.current?.state === 'recording') rec.current.stop(); };
  return { recording, start, stop };
}
