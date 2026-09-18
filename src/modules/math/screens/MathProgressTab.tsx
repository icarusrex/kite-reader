import { useStore } from '../../../core/app/store';
import { MATH_SKILLS } from '../content/skills';
import { mathActiveFrontier } from '../engine/state';

export function MathProgressTab() {
  const { math, updateMath } = useStore();
  const frontier = new Set(mathActiveFrontier(math));
  const recent = math.sessions.slice(-10).reverse();
  const secure = MATH_SKILLS.filter((s) => ['secure', 'maintenance'].includes(math.skills[s.id].phase)).length;
  const provisional = MATH_SKILLS.filter((s) => math.skills[s.id].phase === 'provisional').length;
  const developing = MATH_SKILLS.filter((s) => ['introduced', 'practicing'].includes(math.skills[s.id].phase)).length;

  return <>
    <div className="card"><h2>Math now</h2><p><b>{secure}</b> secure · <b>{provisional}</b> provisional · <b>{developing}</b> developing</p><p>Math is graph-based: number, geometry and measurement can progress in parallel rather than through one numbered level.</p><div className="row" style={{ justifyContent: 'flex-start', gap: 18, flexWrap: 'wrap' }}><label>Recommended minutes <input type="number" min={5} max={20} value={math.settings.capMinutes} onChange={(e) => updateMath((p) => ({ ...p, settings: { ...p.settings, capMinutes: Math.max(5, Math.min(20, +e.target.value || 8)) } }))} /></label><label>Physical-world prompts <input type="checkbox" checked={math.settings.physicalPrompts} onChange={(e) => updateMath((p) => ({ ...p, settings: { ...p.settings, physicalPrompts: e.target.checked } }))} /></label></div></div>
    <div className="card"><h2>Curriculum map</h2><table><thead><tr><th>Concept</th><th>Domain</th><th>Status</th><th>Evidence</th><th>Needs another look</th></tr></thead><tbody>
      {MATH_SKILLS.map((skill) => { const state = math.skills[skill.id]; return <tr key={skill.id} className={frontier.has(skill.id) ? 'current-row' : ''}>
        <td><b>{skill.title}</b><div style={{ fontSize: 12, opacity: .65 }}>{skill.goal}</div></td>
        <td>{skill.domain}</td>
        <td><span className={`pill ${state.phase === 'secure' || state.phase === 'maintenance' ? 'good' : state.phase === 'provisional' || state.phase === 'practicing' ? 'warn' : ''}`}>{state.phase}</span></td>
        <td>{state.independentEvidence} independent · {state.representationCoverage.length} representations</td>
        <td>{state.unresolvedErrors.length ? state.unresolvedErrors.join(', ') : '—'}</td>
      </tr>; })}
    </tbody></table></div>
    <div className="card"><h2>Recent math sessions</h2>{recent.length ? <table><thead><tr><th>Date</th><th>Mode</th><th>Minutes</th><th>Concepts</th><th>Attempts</th></tr></thead><tbody>{recent.map((s) => <tr key={s.id}><td>{s.date}</td><td>{s.mode}</td><td>{(s.activeSeconds / 60).toFixed(1)}</td><td>{s.skillIds.map((id) => MATH_SKILLS.find((x) => x.id === id)?.title ?? id).join(', ')}</td><td>{s.attempts}</td></tr>)}</tbody></table> : <p>No math sessions yet.</p>}</div>
  </>;
}
