import { useEffect, useRef, useState } from 'react';
import { exportHousehold, useStore } from '../../../core/app/store';
import { parseBackup } from '../../../core/app/backup';
import { LEVELS, MAX_LEVEL, levelByN } from '../content/levels';
import { SOUNDS as GRAPHEMES } from '../content/phonemes';
import { PROMPTS } from '../content/prompts';
import { canDecodeText, canDecodeWord } from '../engine/knowledge';
import { currentBasics, currentLevel, freshProgress, jumpTo, Progress, setTrack, today } from '../engine/progress';
import { BASICS } from '../content/basics';
import { hasManifest, hasRecording, refreshRecordings, say } from '../audio/speaker';
import { remove } from '../../../core/storage';
import { meter } from '../audio/mic';
import { LIBRARY, loadBook } from '../content/readaloud';
import { tokenize } from '../engine/wordLevel';
import { BooksAdmin } from '../books/BooksAdmin';
import { StatusTab } from './parent/StatusTab';
import { LessonsTab } from './parent/LessonsTab';
import { ProfilesTab } from './parent/ProfilesTab';
import { RecordWizard } from './parent/RecordWizard';
import { useRecorder } from '../audio/useRecorder';

type Tab = 'status' | 'progress' | 'lessons' | 'profiles' | 'sounds' | 'books' | 'settings' | 'backup';

export function Parent({ onClose, onReadiness, onExtraSession, onPractice, onExplore, onPracticeBasics, onExploreBasics, onSwitchProfile }: {
  onClose: () => void; onReadiness: () => void; onExtraSession: () => void;
  onPractice: (level: number) => void; onExplore: (level: number) => void;
  onPracticeBasics: (lesson: number) => void; onExploreBasics: (lesson: number) => void;
  onSwitchProfile: () => void;
}) {
  const [tab, setTab] = useState<Tab>('status');
  const tabs: Tab[] = ['status', 'progress', 'lessons', 'profiles', 'sounds', 'books', 'settings', 'backup'];
  return <div className="parent"><header><h1>Grown-ups</h1>{tabs.map((t) => <button key={t} className={`tab ${tab === t ? 'on' : ''}`} onClick={() => setTab(t)}>{t[0].toUpperCase() + t.slice(1)}</button>)}<span style={{ flex: 1 }} /><button className="btn" onClick={onClose}>Back to child</button></header>
    <main>
      {tab === 'status' && <StatusTab go={setTab} />}
      {tab === 'progress' && <ProgressTab />}
      {tab === 'lessons' && <LessonsTab onPractice={onPractice} onExplore={onExplore} onPracticeBasics={onPracticeBasics} onExploreBasics={onExploreBasics} />}
      {tab === 'profiles' && <ProfilesTab onSwitchProfile={onSwitchProfile} />}
      {tab === 'sounds' && <SoundsTab />}
      {tab === 'books' && <BooksTab />}
      {tab === 'settings' && <SettingsTab onReadiness={onReadiness} onExtraSession={onExtraSession} />}
      {tab === 'backup' && <BackupTab />}
    </main></div>;
}

function curriculumStage(level: number, readiness: boolean | null) {
  if (readiness === false) return 'Foundations';
  if (level <= 20) return 'Early alphabetic';
  if (level <= 71) return 'Extended code';
  return 'Advanced word reading';
}

function ProgressTab() {
  const { progress: p } = useStore();
  const cur = currentLevel(p);
  const last14 = p.sessions.slice(-14).reverse();
  const trouble = Object.entries(p.errors).sort((a, b) => b[1] - a[1]).slice(0, 8);
  const cutoff = new Date(Date.now() - 7 * 864e5).toISOString().slice(0, 10);
  const week = p.sessions.filter((s) => !s.practice && s.date >= cutoff);
  return <>
    <div className="card"><h2>Now</h2><p>Level <b>{cur}</b> ({levelByN(cur).title}) · status <span className="pill">{p.levels[cur]?.status}</span> · curriculum stage <b>{curriculumStage(cur, p.settings.readinessPassed)}</b></p><p>This week: <b>{week.length}</b> guided sessions, <b>{Math.round(week.reduce((a, s) => a + s.activeSeconds, 0) / 60)}</b> active minutes</p></div>
    <div className="card"><h2>Levels</h2><table><thead><tr><th>Level</th><th>Focus</th><th>Status</th><th>Sessions</th><th>Passed</th></tr></thead><tbody>{LEVELS.map((l) => <tr key={l.n}><td>{l.n}</td><td>{l.title}</td><td><span className={`pill ${p.levels[l.n]?.status === 'passed' ? 'good' : p.levels[l.n]?.status === 'locked' ? '' : 'warn'}`}>{p.levels[l.n]?.status}</span></td><td>{p.levels[l.n]?.sessions ?? 0}</td><td>{p.levels[l.n]?.passedOn ?? ''}</td></tr>)}</tbody></table></div>
    <div className="card"><h2>Trouble spots</h2>{trouble.length ? <p>{trouble.map(([id, n]) => <span key={id} className="pill warn" style={{ marginRight: 6 }}>{id.replace(/^[gwh]:/, '')} ×{n}</span>)}</p> : <p>None yet.</p>}</div>
    <div className="card"><h2>Recent sessions</h2><table><thead><tr><th>Date</th><th>Level</th><th>Minutes</th><th>Accuracy</th><th>Ended</th></tr></thead><tbody>{last14.map((s, i) => <tr key={i}><td>{s.date}</td><td>{s.level}</td><td>{(s.activeSeconds / 60).toFixed(1)}</td><td>{s.answered ? Math.round((100 * s.correct) / s.answered) + '%' : '–'}</td><td>{s.practice ? 'practice' : s.endedBy}</td></tr>)}</tbody></table></div>
  </>;
}

function SoundsTab() {
  const [, force] = useState(0);
  const { recording, start, stop: stopRec } = useRecorder(() => force((n) => n + 1));
  const recorded = GRAPHEMES.filter((g) => hasRecording(g.id)).length;
  return <><RecordWizard onChange={() => force((n) => n + 1)} /><div className="card"><h2>All sounds ({recorded}/{GRAPHEMES.length} recorded)</h2><p style={{ fontSize: 14 }}>Your recordings replace built-in sounds on this device and are shared across learner profiles.</p></div>
    <div className="card"><table><thead><tr><th>Sound</th><th>Level</th><th>Key word</th><th>Tip</th><th /></tr></thead><tbody>{GRAPHEMES.map((g) => <tr key={g.id}><td style={{ fontSize: 28, fontFamily: 'Andika' }}>{g.id}</td><td>{g.level}</td><td>{g.example}</td><td style={{ fontSize: 14 }}>{g.recordTip}</td><td style={{ whiteSpace: 'nowrap' }}><button className={`btn rec ${recording === g.id ? 'on' : ''}`} onPointerDown={() => start(g.id)} onPointerUp={stopRec} onPointerLeave={stopRec}>{recording === g.id ? 'Recording…' : 'Hold to record'}</button>{' '}<button className="btn light" onClick={() => say({ g: g.id })}>▶</button>{' '}{hasRecording(g.id) ? <span className="pill good">recorded here</span> : hasManifest(`phoneme:${g.id}`) ? <span className="pill good">built in</span> : <span className="pill warn">device voice</span>}{hasRecording(g.id) && <button className="btn light" style={{ marginLeft: 6 }} onClick={async () => { await remove(`rec:g:${g.id}`); await refreshRecordings(); force((n) => n + 1); }} aria-label="Delete recording">✕</button>}</td></tr>)}</tbody></table></div>
    <div className="card"><h2>Instruction audio</h2><p>{Object.keys(PROMPTS).filter((k) => hasManifest(`prompt:${k}`)).length}/{Object.keys(PROMPTS).length} prompts generated; the rest use the device voice.</p></div></>;
}

function BooksTab() {
  const { progress } = useStore();
  const [level, setLevel] = useState(currentLevel(progress));
  const [text, setText] = useState('');
  const res = text.trim() ? canDecodeText(progress, text, level) : null;
  const missing = res ? [...new Set(res.failures.map((f) => f.toLowerCase()))] : [];
  return <><BooksAdmin /><ReadAloudCard /><div className="card"><h2>Book check</h2><p>Uses this learner's actual taught heart words plus the selected curriculum level.</p><label>Level <select value={level} onChange={(e) => setLevel(+e.target.value)}>{LEVELS.map((l) => <option key={l.n} value={l.n}>{l.n} – {l.title}</option>)}</select></label><textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="Sam sat. Dad sat…" />{res && <><p><b>{Math.round(res.ratio * 100)}%</b> decodable ({res.decodable}/{res.total} words) {res.ratio >= 0.95 ? <span className="pill good">ready</span> : res.ratio >= 0.85 ? <span className="pill warn">almost</span> : <span className="pill">later</span>}</p>{missing.length > 0 && <p style={{ fontSize: 14 }}>Not yet decodable: {missing.slice(0, 80).join(', ')}</p>}</>}</div></>;
}

function ReadAloudCard() {
  const { progress } = useStore();
  const level = currentLevel(progress);
  const [pct, setPct] = useState<Record<string, number>>({});
  useEffect(() => { (async () => { const out: Record<string, number> = {}; for (const b of LIBRARY) { const book = await loadBook(b.id); let total = 0, ok = 0; for (const c of book.chapters) for (const para of c.paragraphs) for (const w of tokenize(para)) { total++; if (canDecodeWord(progress, w, level)) ok++; } out[b.id] = Math.round((100 * ok) / Math.max(1, total)); } setPct(out); })(); }, [level, progress]);
  return <div className="card"><h2>Read-aloud library</h2><table><thead><tr><th>Book</th><th>Chapters read</th><th>Words this learner could decode now (L{level})</th><th>Public domain</th></tr></thead><tbody>{LIBRARY.map((b) => <tr key={b.id}><td>{b.title}</td><td>{progress.readAloud?.[b.id]?.length ?? 0}</td><td>{pct[b.id] ?? '…'}%</td><td style={{ fontSize: 13 }}>{b.id === 'wizard-of-oz' ? 'Yes (1900)' : 'US yes; EU/PT from 1 Jan 2027'}</td></tr>)}</tbody></table></div>;
}

function SettingsTab({ onReadiness, onExtraSession }: { onReadiness: () => void; onExtraSession: () => void }) {
  const { progress: p, update } = useStore();
  const s = p.settings;
  const set = (patch: Partial<Progress['settings']>) => update((x) => ({ ...x, settings: { ...x.settings, ...patch } }));
  return <><div className="card"><h2>Child</h2><label>Name <input type="text" value={s.childName} onChange={(e) => set({ childName: e.target.value })} /></label><label>Recommended active minutes per guided session <input type="number" min={5} max={30} value={s.capMinutes} onChange={(e) => set({ capMinutes: Math.max(5, Math.min(30, +e.target.value || 10)) })} /></label><label>Grown-up scoring buttons always visible <input type="checkbox" checked={s.parentScoring} onChange={(e) => set({ parentScoring: e.target.checked })} /></label><label>Mic sensitivity (1 strict – 5 sensitive) <input type="range" min={1} max={5} value={s.micSensitivity} onChange={(e) => { set({ micSensitivity: +e.target.value }); meter.sensitivity = +e.target.value; }} /></label></div>
    <div className="card"><h2>Placement</h2><p>Readiness: {p.readiness ? `blending ${p.readiness.blending}/5, tracking ${p.readiness.tracking}/8 (${p.readiness.date})` : s.readinessPassed === null ? 'not done' : s.readinessPassed ? 'passed' : 'not yet'}</p><div className="row" style={{ justifyContent: 'flex-start', gap: 8 }}><button className="btn" onClick={onReadiness}>Run readiness check</button><button className="btn light" onClick={onExtraSession}>Clear today's recommendation</button></div><p>Track: <b>{p.track === 'basics' ? `Basics, lesson ${currentBasics(p)} of ${BASICS.length}` : `Levels, level ${currentLevel(p)}`}</b></p><div className="row" style={{ justifyContent: 'flex-start', gap: 8 }}>{p.track === 'basics' ? <button className="btn light" onClick={() => { if (window.confirm('Skip Basics and start level 1?')) update((x) => setTrack(x, 'levels')); }}>Skip Basics → levels</button> : <button className="btn light" onClick={() => update((x) => setTrack(x, 'basics', 1))}>Go back to Basics</button>}</div><label>Jump to level (marks earlier levels passed)<select value={currentLevel(p)} onChange={(e) => update((x) => jumpTo(x, +e.target.value))}>{Array.from({ length: MAX_LEVEL }, (_, i) => i + 1).map((n) => <option key={n} value={n}>{n}</option>)}</select></label></div></>;
}

function BackupTab() {
  const { household, recovery, progress, replace, replaceHousehold } = useStore();
  const file = useRef<HTMLInputElement>(null);
  return <div className="card"><h2>Backup</h2>
    <p>Exports all learner profiles together. Sound recordings remain a separate device-level asset.</p>
    <div className="row" style={{ justifyContent: 'flex-start', gap: 8 }}>
      <button className="btn" onClick={() => exportHousehold(household)}>Export household</button>
      <button className="btn light" onClick={() => file.current?.click()}>Import…</button>
      <button className="btn light" onClick={() => { if (confirmReset()) replace(freshProgress(progress.settings.childName)); }}>Reset reading</button>
      {recovery && <button className="btn light" onClick={() => {
        if (window.confirm('Restore the household saved before your last import or reset? Current progress will become the recovery copy.')) replaceHousehold(recovery);
      }}>Restore previous household</button>}
    </div>
    <input ref={file} type="file" accept="application/json" hidden onChange={async (e) => {
      const input = e.currentTarget;
      const f = input.files?.[0]; if (!f) return;
      try {
        const parsed = parseBackup(JSON.parse(await f.text()));
        const summary = parsed.kind === 'household'
          ? `Replace all current learners with ${Object.values(parsed.household.profiles).map(p => p.name).join(', ')}?`
          : `Replace Reading progress for ${progress.settings.childName || 'this learner'}? Other learners and Math stay as they are.`;
        if (!window.confirm(`${summary} A copy of the current household will be kept for recovery.`)) return;
        if (parsed.kind === 'household') replaceHousehold(parsed.household); else replace(parsed.reading);
      } catch { window.alert('That file is not a supported Kite backup. Your progress has not been changed.'); }
      finally { input.value = ''; }
    }} />
  </div>;
}
function confirmReset() { return window.prompt('Type RESET to erase this learner\'s progress') === 'RESET'; }
