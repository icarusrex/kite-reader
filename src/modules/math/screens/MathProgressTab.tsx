import { useStore } from '../../../core/app/store';
import { MATH_LESSONS } from '../content/lessons';
import { MATH_SKILL_BY_ID, MATH_SKILLS } from '../content/skills';
import { currentMathLesson, mathAllPassed, mathJumpTo, mathPassCold } from '../engine/lessons';

/** Reading's Lessons tab, for Math: the same statuses and the same grown-up controls. */
export function MathProgressTab({ onPractice, onExplore }: { onPractice: (lesson: number) => void; onExplore: (lesson: number) => void }) {
  const { math, updateMath } = useStore();
  const cur = mathAllPassed(math) ? 0 : currentMathLesson(math);
  const recent = math.sessions.slice(-10).reverse();
  const passed = MATH_LESSONS.filter((id) => math.lessons[id].status === 'passed').length;

  return <>
    <div className="card">
      <h2>Math lessons</h2>
      <p><b>{passed}</b> of {MATH_LESSONS.length} passed{cur ? <> · current: <b>lesson {cur}</b></> : null}</p>
      <p>Works like Reading. <b>▶ on the Math screen</b> plays the current lesson and saves progress. Once a lesson is going well there is a short checkout; the next session starts with a cold check (same day is fine), and passing it moves straight on to the next lesson. Passed lessons come back now and then as review.</p>
      <p><b>✓ Mark passed</b> on the current lesson moves to the next one. <b>Start here</b> sets the current lesson (earlier ones count as done). <b>Practice</b> never changes the child's place; <b>Explore</b> saves nothing.</p>
      <div className="row" style={{ justifyContent: 'flex-start', gap: 18, flexWrap: 'wrap' }}>
        <label>Recommended minutes a day <input type="number" min={5} max={20} value={math.settings.capMinutes} onChange={(e) => updateMath((p) => ({ ...p, settings: { ...p.settings, capMinutes: Math.max(5, Math.min(20, +e.target.value || 8)) } }))} /></label>
        <label>Physical-world prompts <input type="checkbox" checked={math.settings.physicalPrompts} onChange={(e) => updateMath((p) => ({ ...p, settings: { ...p.settings, physicalPrompts: e.target.checked } }))} /></label>
      </div>
    </div>
    <div className="card"><h2>Lessons</h2><table><thead><tr><th>Lesson</th><th>Concept</th><th>Status</th><th>Sessions</th><th /></tr></thead><tbody>
      {MATH_LESSONS.map((id, i) => {
        const n = i + 1;
        const l = math.lessons[id];
        const reached = l.status !== 'locked';
        return <tr key={id} className={n === cur ? 'current-row' : ''}>
          <td>{n}</td>
          <td><b>{MATH_SKILL_BY_ID[id].title}</b><div style={{ fontSize: 12, opacity: .65 }}>{MATH_SKILL_BY_ID[id].goal}</div></td>
          <td><span className={`pill ${l.status === 'passed' ? 'good' : l.status === 'locked' ? '' : 'warn'}`}>{n === cur ? (l.status === 'cold' ? 'current · cold check next' : 'current') : l.status}</span></td>
          <td>{l.sessions}</td>
          <td style={{ whiteSpace: 'nowrap' }}>
            {n === cur
              ? <button className="btn" onClick={() => updateMath((p) => mathPassCold(p, n))}>✓ Mark passed</button>
              : <button className="btn" onClick={() => { if (n < cur || !cur || window.confirm(`Start at lesson ${n}? Lessons before it will count as passed.`)) updateMath((p) => mathJumpTo(p, n)); }}>Start here</button>}
            {' '}{reached && <button className="btn" onClick={() => onPractice(n)}>Practice</button>}
            {' '}<button className="btn light" onClick={() => onExplore(n)}>Explore</button>
          </td>
        </tr>;
      })}
    </tbody></table></div>
    <div className="card"><h2>Recent math sessions</h2>{recent.length ? <table><thead><tr><th>Date</th><th>Mode</th><th>Minutes</th><th>Concepts</th><th>Answers</th></tr></thead><tbody>{recent.map((s) => <tr key={s.id}><td>{s.date}</td><td>{s.mode}</td><td>{(s.activeSeconds / 60).toFixed(1)}</td><td>{s.skillIds.map((id) => MATH_SKILLS.find((x) => x.id === id)?.title ?? id).join(', ')}</td><td>{s.attempts}</td></tr>)}</tbody></table> : <p>No math sessions yet.</p>}</div>
  </>;
}
