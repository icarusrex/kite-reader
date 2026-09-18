import { Fragment, useState } from 'react';
import { useStore } from '../../../../core/app/store';
import { LEVELS } from '../../content/levels';
import { ANCHORS, BASICS } from '../../content/basics';
import { storyPictureUrl } from '../../content/pictures';
import { currentLevel } from '../../engine/progress';
import { say, stop } from '../../audio/speaker';

export function LessonsTab({ onPractice, onExplore, onPracticeBasics, onExploreBasics }: {
  onPractice: (level: number) => void; onExplore: (level: number) => void;
  onPracticeBasics: (lesson: number) => void; onExploreBasics: (lesson: number) => void;
}) {
  const { progress: p } = useStore();
  const cur = p.track === 'levels' ? currentLevel(p) : 0;
  const [open, setOpen] = useState<number | null>(null);
  const readAloud = async (lines: string[]) => { stop(); for (const w of lines.join(' ').split(/\s+/)) await say({ w: w.replace(/[^A-Za-z]/g, '') }, { pause: 120 }); };
  return <>
    <div className="card">
      <h2>Explore vs practice</h2>
      <p><b>Explore</b> is a sandbox: unlimited and writes no progress, SRS, errors or session history. <b>Practice</b> is only offered for material already reached and may feed spaced review, but never unlocks levels.</p>
    </div>
    <div className="card"><h2>Basics (before level 1)</h2><table><thead><tr><th>Lesson</th><th>New sound</th><th>Say it fast</th><th>Also</th><th>Status</th><th /></tr></thead><tbody>
      {BASICS.map((b) => { const st = p.basics[b.n]?.status ?? 'locked'; const here = p.track === 'basics' && st === 'active'; const reached = st !== 'locked'; return <tr key={b.n} className={here ? 'current-row' : ''}>
        <td>B{b.n}</td><td style={{ fontFamily: 'Andika', fontSize: 20 }}>{b.newSound ? `${b.newSound} (${ANCHORS[b.newSound]})` : 'review'}</td>
        <td style={{ fontSize: 13 }}>{{ compound: 'sun…flower', syllable: 'ta…ble', stretch: 'mmm-a-p' }[b.sayFast]}</td><td style={{ fontSize: 13 }}>{[b.track && 'left to right', b.rhyme && 'rhyme'].filter(Boolean).join(', ')}</td>
        <td><span className={`pill ${st === 'passed' ? 'good' : st === 'locked' ? '' : 'warn'}`}>{here ? 'current' : st}</span></td>
        <td>{reached && <button className="btn" onClick={() => onPracticeBasics(b.n)}>Practice</button>}{' '}<button className="btn light" onClick={() => onExploreBasics(b.n)}>Explore</button></td>
      </tr>; })}
    </tbody></table></div>
    <div className="card"><h2>Levels</h2><table><thead><tr><th>Level</th><th>New</th><th>Words</th><th>Status</th><th /></tr></thead><tbody>
      {LEVELS.map((l) => { const st = p.levels[l.n]?.status ?? 'locked'; const reached = st !== 'locked' || l.n <= cur; return <Fragment key={l.n}>
        <tr className={l.n === cur ? 'current-row' : ''}><td>{l.n}</td><td style={{ fontFamily: 'Andika', fontSize: 20 }}>{l.newGraphemes.join(' ') || 'review'}{l.heartWords.length ? ` · ♥ ${l.heartWords.join(', ')}` : ''}</td>
          <td style={{ fontSize: 13 }}>{l.words.slice(0, 6).join(', ')}</td><td><span className={`pill ${st === 'passed' ? 'good' : st === 'locked' ? '' : 'warn'}`}>{l.n === cur ? 'current' : st}</span></td>
          <td style={{ whiteSpace: 'nowrap' }}>{reached && <button className="btn" onClick={() => onPractice(l.n)}>Practice</button>}{' '}<button className="btn light" onClick={() => onExplore(l.n)}>Explore</button>{' '}{l.story && <button className="btn light" onClick={() => setOpen(open === l.n ? null : l.n)}>{open === l.n ? 'Hide story' : 'Story'}</button>}</td></tr>
        {open === l.n && l.story && <tr><td colSpan={5}><div className="lesson-story"><img src={storyPictureUrl(l.n)} alt="" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} /><div>{l.story.map((s, i) => <p key={i}>{s}</p>)}<button className="btn light" onClick={() => readAloud(l.story!)}>▶ Read it to me</button></div></div></td></tr>}
      </Fragment>; })}
    </tbody></table></div>
  </>;
}
