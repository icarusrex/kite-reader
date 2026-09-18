import { useEffect, useState } from 'react';
import { useStore } from '../../../../core/app/store';
import { LEVELS, MAX_LEVEL } from '../../content/levels';
import { SOUNDS as GRAPHEMES } from '../../content/phonemes';
import { PICTURES, pictureUrl, storyPictureUrl } from '../../content/pictures';
import { PROMPTS } from '../../content/prompts';
import { currentBasics, currentLevel } from '../../engine/progress';
import { BASICS } from '../../content/basics';
import { hasManifest, hasRecording } from '../../audio/speaker';

const STAGES = [
  { name: 'Stage 1 · single letters + blending', from: 1, to: 20 },
  { name: 'Stage 2 · two-letter sounds, clusters, all short vowels', from: 21, to: 50 },
  { name: 'Stage 3 · long vowels, r-controlled', from: 51, to: 71 },
  { name: 'Stage 4 · vowel variants, spelling alternatives', from: 72, to: 103 },
  { name: 'Stage 5 · irregular words, suffixes, book prep', from: 104, to: 120 },
];

/** What's set up, what's built, and what needs building next. */
export function StatusTab({ go }: { go: (tab: 'sounds' | 'settings' | 'lessons') => void }) {
  const { progress: p } = useStore();
  const cur = currentLevel(p);
  const recorded = GRAPHEMES.filter((g) => hasRecording(g.id)).length;
  const [pictures, setPictures] = useState<{ ok: number; total: number } | null>(null);
  useEffect(() => {
    const urls = [...Object.keys(PICTURES).map((w) => pictureUrl(w)!), ...LEVELS.filter((l) => l.story).map((l) => storyPictureUrl(l.n))];
    Promise.all(urls.map((u) => fetch(u, { method: 'HEAD' }).then((r) => r.ok && (r.headers.get('content-type') ?? '').startsWith('image')).catch(() => false)))
      .then((res) => setPictures({ ok: res.filter(Boolean).length, total: urls.length }));
  }, []);
  const levelsLeft = MAX_LEVEL - cur;
  const setup: [boolean, string, (() => void) | null][] = [
    [recorded === GRAPHEMES.length, `Record the ${GRAPHEMES.length} letter sounds (${recorded} done; the rest use built-in sounds)`, () => go('sounds')],
    ...(p.track === 'levels' ? [[p.settings.readinessPassed !== null, `Readiness check ${p.settings.readinessPassed === null ? 'not done' : p.settings.readinessPassed ? 'passed' : 'not passed yet'}`, () => go('settings')] as [boolean, string, () => void]] : []),
    [!!p.settings.childName, "Child's name set", () => go('settings')],
    [pictures?.ok === pictures?.total, pictures ? `Pictures: ${pictures.ok}/${pictures.total}` : 'Pictures: checking…', null],
    [Object.keys(PROMPTS).every((k) => hasManifest(`prompt:${k}`)), 'Instruction audio generated', null],
  ];
  return (
    <>
      <div className="card">
        <h2>Setup</h2>
        <ul className="checklist">
          {setup.map(([ok, text, fix], i) => (
            <li key={i}><span className={`pill ${ok ? 'good' : 'warn'}`}>{ok ? '✓' : 'to do'}</span> {text} {!ok && fix && <button className="btn light" onClick={fix}>Open</button>}</li>
          ))}
        </ul>
      </div>
      <div className="card">
        <h2>Curriculum built</h2>
        <p>{p.track === 'basics' ? <>He's on <b>Basics lesson {currentBasics(p)} of {BASICS.length}</b> (letter sounds and listening games before level 1). </> : <>He's on <b>level {cur}</b>. </>}Levels built: <b>{MAX_LEVEL}</b> of 120 · about {Math.max(0, Math.round(levelsLeft * 1.75))} sessions of new material left (≈1.75 sessions per level).</p>
        <table><thead><tr><th>Stage</th><th>Levels</th><th>Built</th></tr></thead><tbody>
          <tr><td>Basics · letter sounds, say it fast, rhyme (before level 1)</td><td>B1–B{BASICS.length}</td><td><span className="pill good">{BASICS.length}/{BASICS.length}</span></td></tr>
          {STAGES.map((s) => {
            const built = LEVELS.filter((l) => l.n >= s.from && l.n <= s.to).length;
            const size = s.to - s.from + 1;
            return <tr key={s.name}><td>{s.name}</td><td>{s.from}–{s.to}</td><td><span className={`pill ${built === size ? 'good' : built ? 'warn' : ''}`}>{built}/{size}</span></td></tr>;
          })}
        </tbody></table>
      </div>
      <div className="card">
        <h2>Coming next</h2>
        <ul className="checklist">
          <li><span className={`pill ${levelsLeft <= 3 ? 'warn' : ''}`}>{levelsLeft <= 3 ? 'needed soon' : `in ~${levelsLeft} levels`}</span> <span><b>Levels 21–30</b> (the next Jolly Phonics groups: sh, ch, th, ng, j, v, w, z, x, y, qu and first long vowels ai, ee, oa). Needs engine work for two-letter sounds on one tile. Ask Claude at level ~17.</span></li>
          <li><span className="pill">from level 50</span> <span><b>Reading speed</b>: timed word lists against his own previous time.</span></li>
          <li><span className="pill good">built</span> <span><b>Math</b> is now a separate module. <b>Progress sync</b> between Mac and tablet remains later.</span></li>
        </ul>
        <p className="muted" style={{ fontSize: 13 }}>The full checklist for grown-ups is in <code>MANUAL-TASKS.md</code> in the project.</p>
      </div>
    </>
  );
}
