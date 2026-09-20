import { useMemo } from 'react';
import { useStore } from '../../../core/app/store';
import { ParentCorner } from '../../../core/ui/components';
import { MathSkillId, MATH_SKILL_BY_ID, MATH_SKILLS } from '../content/skills';
import { mathActiveFrontier } from '../engine/state';

export function MathHome({ onGuided, onPractice, onExplore, onLesson, onBack, onParent }: {
  onGuided: () => void;
  onPractice: () => void;
  onExplore: (skillId: MathSkillId) => void;
  onLesson: (skillId: MathSkillId) => void;
  onBack: () => void;
  onParent: () => void;
}) {
  const { math } = useStore();
  const frontier = mathActiveFrontier(math);
  const reached = MATH_SKILLS.filter((s) => math.skills[s.id].phase !== 'unseen');
  const secure = MATH_SKILLS.filter((s) => math.skills[s.id].phase === 'secure' || math.skills[s.id].phase === 'maintenance').length;
  const developing = useMemo(() => frontier.filter((id) => math.skills[id].phase !== 'unseen').slice(0, 3), [frontier, math]);

  return <div className="screen">
    <ParentCorner onOpen={onParent} />
    <div className="stage" style={{ gap: 24, padding: '5vh 6vw' }}>
      <div style={{ fontSize: '15vmin' }}>🔢</div>
      <h1 className="title">Math</h1>
      <p className="subtitle">{secure ? `${secure} ideas secure` : 'Numbers, shapes and measuring'}</p>
      {developing.length > 0 && <div className="card" style={{ maxWidth: 620, textAlign: 'center' }}><b>Developing now</b><div style={{ marginTop: 8 }}>{developing.map((id) => MATH_SKILL_BY_ID[id].title).join(' · ')}</div></div>}
      <div className="row" style={{ gap: 14 }}>
        <button className="primary" onClick={onGuided} aria-label="Start math">▶</button>
        <button className="btn" disabled={!reached.length} onClick={onPractice}>Practice</button>
        <button className="btn light" onClick={onBack}>Kite</button>
      </div>
      <div className="card" style={{ width: 'min(820px, 88vw)' }}>
        <h2 style={{ marginTop: 0 }}>All lessons</h2>
        <p style={{ marginTop: 0 }}>
          Pick any lesson — <b>Start</b> counts towards progress, <b>try</b> is a sandbox that never changes it.
          Nothing is locked: if a lesson is too easy, skip past it.
        </p>
        <div style={{ display: 'grid', gap: 6 }}>
          {MATH_SKILLS.map((skill) => {
            const phase = math.skills[skill.id].phase;
            const done = phase === 'secure' || phase === 'maintenance';
            return <div key={skill.id} className="row" style={{ justifyContent: 'space-between', gap: 8, flexWrap: 'nowrap' }}>
              <span style={{ flex: 1, minWidth: 0, textAlign: 'left', opacity: done ? .6 : 1 }}>
                {done ? '✓ ' : ''}{skill.title}
                {phase !== 'unseen' && !done && <small className="muted"> · {phase}</small>}
              </span>
              <button className="btn" onClick={() => onLesson(skill.id)}>Start</button>
              <button className="btn light" onClick={() => onExplore(skill.id)}>try</button>
            </div>;
          })}
        </div>
      </div>
    </div>
  </div>;
}
