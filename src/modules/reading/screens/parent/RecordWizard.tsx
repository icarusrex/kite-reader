import { useState } from 'react';
import { SOUNDS as GRAPHEMES } from '../../content/phonemes';
import { hasManifest, hasRecording, say } from '../../audio/speaker';
import { useRecorder } from '../../audio/useRecorder';
import { exportSounds } from '../../audio/exportSounds';

/** Step through all sounds: see the tip, tap to record, tap to stop, it plays back, then Again or Next. */
export function RecordWizard({ onChange }: { onChange: () => void }) {
  const [i, setI] = useState(() => Math.max(0, GRAPHEMES.findIndex((g) => !hasRecording(g.id))));
  const [, force] = useState(0);
  const [exporting, setExporting] = useState(false);
  const { recording, start, stop } = useRecorder(() => { force((n) => n + 1); onChange(); });
  const g = GRAPHEMES[i];
  const recorded = GRAPHEMES.filter((x) => hasRecording(x.id)).length;
  const isRec = recording === g.id;
  return (
    <div className="card wizard">
      <h2>Record the sounds · {recorded}/{GRAPHEMES.length} done</h2>
      <div className="wizard-dots">
        {GRAPHEMES.map((x, k) => (
          <button key={x.id} className={`wdot ${hasRecording(x.id) ? 'done' : ''} ${k === i ? 'on' : ''}`} onClick={() => setI(k)} aria-label={`Sound ${x.id}`}>{x.id}</button>
        ))}
      </div>
      <div className="wizard-body">
        <div className="wizard-letter">{g.id}</div>
        <div>
          <p className="wizard-word">as in <b>{g.example}</b></p>
          <p>{g.recordTip}</p>
          <p className="muted">{g.continuous ? 'Hold it for about a second.' : 'Short and clipped, no “uh” after it.'}</p>
          <div className="row" style={{ justifyContent: 'flex-start', gap: 8 }}>
            <button className={`btn rec big ${isRec ? 'on' : ''}`} onClick={() => (isRec ? stop() : start(g.id))}>{isRec ? '■ Stop' : hasRecording(g.id) ? '● Record again' : '● Record'}</button>
            <button className="btn light" disabled={!hasRecording(g.id) && !hasManifest(`phoneme:${g.id}`)} onClick={() => say({ g: g.id })}>▶ Play</button>
            <button className="btn light" disabled={i === 0} onClick={() => setI(i - 1)}>← Back</button>
            <button className="btn" disabled={i === GRAPHEMES.length - 1} onClick={() => setI(i + 1)}>Next →</button>
          </div>
          <p className="muted" style={{ fontSize: 13 }}>{hasRecording(g.id) ? 'Your recording is being used.' : hasManifest(`phoneme:${g.id}`) ? 'Not recorded yet: the built-in sound is used.' : 'Not recorded yet.'}</p>
        </div>
      </div>
      <div className="row" style={{ justifyContent: 'flex-start', gap: 8, marginTop: 8 }}>
        <button className="btn" disabled={!recorded || exporting} onClick={async () => { setExporting(true); try { await exportSounds(); } finally { setExporting(false); } }}>
          {exporting ? 'Exporting…' : `Export ${recorded} sound${recorded === 1 ? '' : 's'} for the app`}
        </button>
        <span className="muted" style={{ fontSize: 13 }}>Then tell Claude “sounds exported” so every device (the tablet too) gets them.</span>
      </div>
    </div>
  );
}
