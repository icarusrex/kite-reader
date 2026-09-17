import { useEffect, useRef, useState } from 'react';
import { useStore } from '../app/store';
import { LEVELS, MAX_LEVEL, levelByN } from '../content/levels';
import { GRAPHEMES } from '../content/phonemes';
import { PROMPTS } from '../content/prompts';
import { checkText } from '../engine/decodable';
import { currentBasics, currentLevel, freshProgress, jumpTo, Progress, setTrack, today } from '../engine/progress';
import { BASICS } from '../content/basics';
import { hasManifest, hasRecording, refreshRecordings, say } from '../audio/speaker';
import { remove } from '../engine/storage';
import { meter } from '../audio/mic';
import { LIBRARY, loadBook } from '../content/readaloud';
import { tokenize, wordLevel } from '../engine/wordLevel';
import { BooksAdmin } from '../books/BooksAdmin';
import { StatusTab } from './parent/StatusTab';
import { LessonsTab } from './parent/LessonsTab';
import { RecordWizard } from './parent/RecordWizard';
import { useRecorder } from '../audio/useRecorder';

type Tab = 'status' | 'progress' | 'lessons' | 'sounds' | 'books' | 'settings' | 'backup';

export function Parent({ onClose, onReadiness, onExtraSession, onPractice, onPracticeBasics }: { onClose: () => void; onReadiness: () => void; onExtraSession: () => void; onPractice: (level: number) => void; onPracticeBasics: (lesson: number) => void }) {
  const [tab, setTab] = useState<Tab>('status');
  return (
    <div className="parent">
      <header>
        <h1>Grown-ups</h1>
        {(['status', 'progress', 'lessons', 'sounds', 'books', 'settings', 'backup'] as Tab[]).map((t) => (
          <button key={t} className={`tab ${tab === t ? 'on' : ''}`} onClick={() => setTab(t)}>{t[0].toUpperCase() + t.slice(1)}</button>
        ))}
        <span style={{ flex: 1 }} />
        <button className="btn" onClick={onClose}>Back to child</button>
      </header>
      <main>
        {tab === 'status' && <StatusTab go={setTab} />}
        {tab === 'progress' && <ProgressTab />}
        {tab === 'lessons' && <LessonsTab onPractice={onPractice} onPracticeBasics={onPracticeBasics} />}
        {tab === 'sounds' && <SoundsTab />}
        {tab === 'books' && <BooksTab />}
        {tab === 'settings' && <SettingsTab onReadiness={onReadiness} onExtraSession={onExtraSession} />}
        {tab === 'backup' && <BackupTab />}
      </main>
    </div>
  );
}

function ehri(level: number, readiness: boolean | null) {
  if (readiness === false) return 'Pre-alphabetic';
  if (level <= 20) return 'Partial alphabetic';
  if (level <= 71) return 'Full alphabetic';
  return 'Consolidated alphabetic';
}

function ProgressTab() {
  const { progress: p } = useStore();
  const cur = currentLevel(p);
  const last14 = p.sessions.slice(-14).reverse();
  const trouble = Object.entries(p.errors).sort((a, b) => b[1] - a[1]).slice(0, 8);
  const week = p.sessions.filter((s) => s.date >= new Date(Date.now() - 7 * 864e5).toISOString().slice(0, 10));
  return (
    <>
      <div className="card">
        <h2>Now</h2>
        <p>Level <b>{cur}</b> ({levelByN(cur).title}) · status <span className="pill">{p.levels[cur]?.status}</span> · phase <b>{ehri(cur, p.settings.readinessPassed)}</b></p>
        <p>This week: <b>{week.length}</b> sessions, <b>{Math.round(week.reduce((a, s) => a + s.activeSeconds, 0) / 60)}</b> active minutes</p>
      </div>
      <div className="card">
        <h2>Levels</h2>
        <table><thead><tr><th>Level</th><th>Focus</th><th>Status</th><th>Sessions</th><th>Passed</th></tr></thead><tbody>
          {LEVELS.map((l) => (
            <tr key={l.n}><td>{l.n}</td><td>{l.title}</td><td><span className={`pill ${p.levels[l.n]?.status === 'passed' ? 'good' : p.levels[l.n]?.status === 'locked' ? '' : 'warn'}`}>{p.levels[l.n]?.status}</span></td><td>{p.levels[l.n]?.sessions ?? 0}</td><td>{p.levels[l.n]?.passedOn ?? ''}</td></tr>
          ))}
        </tbody></table>
      </div>
      <div className="card">
        <h2>Trouble spots</h2>
        {trouble.length ? <p>{trouble.map(([id, n]) => <span key={id} className="pill warn" style={{ marginRight: 6 }}>{id.replace(/^[gw]:/, '')} ×{n}</span>)}</p> : <p>None yet.</p>}
      </div>
      <div className="card">
        <h2>Recent sessions</h2>
        <table><thead><tr><th>Date</th><th>Level</th><th>Minutes</th><th>Accuracy</th><th>Ended</th></tr></thead><tbody>
          {last14.map((s, i) => <tr key={i}><td>{s.date}</td><td>{s.level}</td><td>{(s.activeSeconds / 60).toFixed(1)}</td><td>{s.answered ? Math.round((100 * s.correct) / s.answered) + '%' : '–'}</td><td>{s.practice ? 'practice' : s.endedBy}</td></tr>)}
        </tbody></table>
      </div>
    </>
  );
}

function SoundsTab() {
  const [, force] = useState(0);
  const { recording, start, stop: stopRec } = useRecorder(() => force((n) => n + 1));

  const recorded = GRAPHEMES.filter((g) => hasRecording(g.id)).length;
  return (
    <>
      <RecordWizard onChange={() => force((n) => n + 1)} />
      <div className="card">
        <h2>All sounds ({recorded}/{GRAPHEMES.length} recorded)</h2>
        <p style={{ fontSize: 14 }}>Your recordings replace the built-in sounds on this device straight away. Hold <b>Record</b>, say the sound, release, or use the step-by-step recorder above.</p>
      </div>
      <div className="card">
        <table><thead><tr><th>Sound</th><th>Level</th><th>Key word</th><th>Tip</th><th /></tr></thead><tbody>
          {GRAPHEMES.map((g) => (
            <tr key={g.id}>
              <td style={{ fontSize: 28, fontFamily: 'Andika' }}>{g.id}</td>
              <td>{g.level}</td>
              <td>{g.example}</td>
              <td style={{ fontSize: 14 }}>{g.recordTip}</td>
              <td style={{ whiteSpace: 'nowrap' }}>
                <button className={`btn rec ${recording === g.id ? 'on' : ''}`} onPointerDown={() => start(g.id)} onPointerUp={stopRec} onPointerLeave={stopRec}>{recording === g.id ? 'Recording…' : 'Hold to record'}</button>{' '}
                <button className="btn light" onClick={() => say({ g: g.id })}>▶</button>{' '}
                {hasRecording(g.id) ? <span className="pill good">recorded here</span> : hasManifest(`phoneme:${g.id}`) ? <span className="pill good">built in</span> : <span className="pill warn">device voice</span>}
                {hasRecording(g.id) && <button className="btn light" style={{ marginLeft: 6 }} onClick={async () => { await remove(`rec:g:${g.id}`); await refreshRecordings(); force((n) => n + 1); }} aria-label="Delete recording">✕</button>}
              </td>
            </tr>
          ))}
        </tbody></table>
      </div>
      <div className="card">
        <h2>Instruction audio</h2>
        <p>{Object.keys(PROMPTS).filter((k) => hasManifest(`prompt:${k}`)).length}/{Object.keys(PROMPTS).length} prompts generated with ElevenLabs; the rest use the device voice. Run <code>npm run audio</code> in the repo to generate.</p>
      </div>
    </>
  );
}

function BooksTab() {
  const { progress } = useStore();
  const [level, setLevel] = useState(currentLevel(progress));
  const [text, setText] = useState('');
  const heart = LEVELS.filter((l) => l.n <= level).flatMap((l) => l.heartWords);
  const res = text.trim() ? checkText(text, level, heart) : null;
  const missing = res ? [...new Set(res.failures.map((f) => f.word.toLowerCase()))] : [];
  return (
    <>
    <BooksAdmin />
    <ReadAloudCard />
    <div className="card">
      <h2>Book check</h2>
      <p>Paste a book’s text (typed or OCR’d from a photo). Shows how much he can decode at a level. Aim for ≥ 95%; pre-teach the rest.</p>
      <label>Level <select value={level} onChange={(e) => setLevel(+e.target.value)}>{LEVELS.map((l) => <option key={l.n} value={l.n}>{l.n} – {l.title}</option>)}</select></label>
      <textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="Sam sat. Dad sat…" />
      {res && (
        <>
          <p><b>{Math.round(res.ratio * 100)}%</b> decodable ({res.decodable}/{res.total} words) {res.ratio >= 0.95 ? <span className="pill good">ready</span> : res.ratio >= 0.85 ? <span className="pill warn">almost</span> : <span className="pill">later</span>}</p>
          {missing.length > 0 && <p style={{ fontSize: 14 }}>Not yet decodable: {missing.slice(0, 80).join(', ')}</p>}
        </>
      )}
    </div>
    </>
  );
}

const NAMES = new Set(['dorothy', 'toto', 'oz', 'pooh', 'piglet', 'eeyore', 'kanga', 'roo', 'christopher', 'robin']);

function ReadAloudCard() {
  const { progress } = useStore();
  const level = currentLevel(progress);
  const [pct, setPct] = useState<Record<string, number>>({});
  useEffect(() => {
    (async () => {
      const out: Record<string, number> = {};
      for (const b of LIBRARY) {
        const book = await loadBook(b.id);
        let total = 0, ok = 0;
        for (const c of book.chapters) for (const para of c.paragraphs) for (const w of tokenize(para)) {
          total++; if (!NAMES.has(w.toLowerCase()) && wordLevel(w).level <= level) ok++;
        }
        out[b.id] = Math.round((100 * ok) / Math.max(1, total));
      }
      setPct(out);
    })();
  }, [level]);
  return (
    <div className="card">
      <h2>Read-aloud library (Story chair 📚 on the home screen)</h2>
      <table><thead><tr><th>Book</th><th>Chapters read</th><th>Words he could decode now (L{level})</th><th>Public domain</th></tr></thead><tbody>
        {LIBRARY.map((b) => (
          <tr key={b.id}><td>{b.title}</td><td>{progress.readAloud?.[b.id]?.length ?? 0}</td><td>{pct[b.id] ?? '…'}%</td>
            <td style={{ fontSize: 13 }}>{b.id === 'wizard-of-oz' ? 'Yes (1900)' : 'US yes; EU/PT from 1 Jan 2027'}</td></tr>
        ))}
      </tbody></table>
      <p style={{ fontSize: 14 }}>Read 10–15 min a day, above his reading level. Highlighted green words are ones he can decode: pause and let him read them. Orange words are the chapter’s vocabulary. Real sentences from these books start appearing in his sessions once they’re decodable (from about Level 12; many more from Level 70).</p>
    </div>
  );
}

function SettingsTab({ onReadiness, onExtraSession }: { onReadiness: () => void; onExtraSession: () => void }) {
  const { progress: p, update } = useStore();
  const s = p.settings;
  const set = (patch: Partial<Progress['settings']>) => update((x) => ({ ...x, settings: { ...x.settings, ...patch } }));
  return (
    <>
      <div className="card">
        <h2>Child</h2>
        <label>Name <input type="text" value={s.childName} onChange={(e) => set({ childName: e.target.value })} /></label>
        <label>Session cap (active minutes) <input type="number" min={5} max={30} value={s.capMinutes} onChange={(e) => set({ capMinutes: Math.max(5, Math.min(30, +e.target.value || 15)) })} /></label>
        <label>Grown-up scores spoken answers (✓/✗) <input type="checkbox" checked={s.parentScoring} onChange={(e) => set({ parentScoring: e.target.checked })} /></label>
        <label>Mic sensitivity (1 strict – 5 sensitive) <input type="range" min={1} max={5} value={s.micSensitivity} onChange={(e) => { set({ micSensitivity: +e.target.value }); meter.sensitivity = +e.target.value; }} /></label>
      </div>
      <div className="card">
        <h2>Today & placement</h2>
        <p>Readiness check: {s.readinessPassed === null ? 'not done' : s.readinessPassed ? 'passed' : 'not yet'}</p>
        <div className="row" style={{ justifyContent: 'flex-start', gap: 8 }}>
          <button className="btn" onClick={onReadiness}>Run readiness check</button>
          <button className="btn light" onClick={onExtraSession}>Allow one more session today</button>
        </div>
        <p>Track: <b>{p.track === 'basics' ? `Basics, lesson ${currentBasics(p)} of ${BASICS.length}` : `Levels, level ${currentLevel(p)}`}</b></p>
        <div className="row" style={{ justifyContent: 'flex-start', gap: 8 }}>
          {p.track === 'basics'
            ? <button className="btn light" onClick={() => { if (window.confirm('Skip Basics and start level 1?')) update((x) => setTrack(x, 'levels')); }}>Skip Basics → levels</button>
            : <button className="btn light" onClick={() => update((x) => setTrack(x, 'basics', 1))}>Go back to Basics</button>}
        </div>
        <label>Jump to level (marks earlier levels passed)
          <select value={currentLevel(p)} onChange={(e) => update((x) => jumpTo(x, +e.target.value))}>
            {Array.from({ length: MAX_LEVEL }, (_, i) => i + 1).map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </label>
      </div>
    </>
  );
}

function BackupTab() {
  const { progress, replace } = useStore();
  const file = useRef<HTMLInputElement>(null);
  const exportJson = () => {
    const blob = new Blob([JSON.stringify(progress, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `kite-progress-${today()}.json`;
    a.click();
  };
  return (
    <div className="card">
      <h2>Backup</h2>
      <p>Progress lives on this device. Export a backup weekly (Safari can clear site data). Sound recordings are not included.</p>
      <div className="row" style={{ justifyContent: 'flex-start', gap: 8 }}>
        <button className="btn" onClick={exportJson}>Export progress</button>
        <button className="btn light" onClick={() => file.current?.click()}>Import…</button>
        <button className="btn light" onClick={() => { if (confirmReset()) replace(freshProgress()); }}>Reset all progress</button>
      </div>
      <input ref={file} type="file" accept="application/json" hidden onChange={async (e) => {
        const f = e.target.files?.[0]; if (!f) return;
        try { replace(JSON.parse(await f.text())); } catch { /* ignore bad file */ }
      }} />
    </div>
  );
}

// Grown-up area only; kept out of the child flow.
function confirmReset() { return window.prompt('Type RESET to erase all progress') === 'RESET'; }
