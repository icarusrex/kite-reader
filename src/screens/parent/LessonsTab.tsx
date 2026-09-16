import { Fragment, useState } from 'react';
import { useStore } from '../../app/store';
import { LEVELS } from '../../content/levels';
import { storyPictureUrl } from '../../content/pictures';
import { currentLevel } from '../../engine/progress';
import { say, stop } from '../../audio/speaker';

/** Every built level: what it teaches, practice it again (progress untouched), preview its story. */
export function LessonsTab({ onPractice }: { onPractice: (level: number) => void }) {
  const { progress: p } = useStore();
  const cur = currentLevel(p);
  const [open, setOpen] = useState<number | null>(null);
  const readAloud = async (lines: string[]) => {
    stop();
    for (const w of lines.join(' ').split(/\s+/)) await say({ w: w.replace(/[^A-Za-z]/g, '') }, { pause: 120 });
  };
  return (
    <div className="card">
      <h2>Lessons</h2>
      <p style={{ fontSize: 14 }}><b>Practice</b> runs a normal session for that level without changing his level or unlocking anything; answers still feed spaced review. Handy for replaying a level he found hard, or trying one yourself.</p>
      <table>
        <thead><tr><th>Level</th><th>New</th><th>Words</th><th>Status</th><th /></tr></thead>
        <tbody>
          {LEVELS.map((l) => {
            const st = p.levels[l.n]?.status ?? 'locked';
            return (
              <Fragment key={l.n}>
                <tr className={l.n === cur ? 'current-row' : ''}>
                  <td>{l.n}</td>
                  <td style={{ fontFamily: 'Andika', fontSize: 20 }}>{l.newGraphemes.join(' ') || 'review'}{l.heartWords.length ? ` · ♥ ${l.heartWords.join(', ')}` : ''}</td>
                  <td style={{ fontSize: 13 }}>{l.words.slice(0, 6).join(', ')}</td>
                  <td><span className={`pill ${st === 'passed' ? 'good' : st === 'locked' ? '' : 'warn'}`}>{l.n === cur ? 'current' : st}</span></td>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    <button className="btn" onClick={() => onPractice(l.n)}>Practice</button>{' '}
                    {l.story && <button className="btn light" onClick={() => setOpen(open === l.n ? null : l.n)}>{open === l.n ? 'Hide story' : 'Story'}</button>}
                  </td>
                </tr>
                {open === l.n && l.story && (
                  <tr>
                    <td colSpan={5}>
                      <div className="lesson-story">
                        <img src={storyPictureUrl(l.n)} alt="" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                        <div>
                          {l.story.map((s, i) => <p key={i}>{s}</p>)}
                          <button className="btn light" onClick={() => readAloud(l.story!)}>▶ Read it to me</button>
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
