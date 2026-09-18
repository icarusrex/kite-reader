import { useStore } from '../../app/store';

export function ProfilesTab({ onSwitchProfile }: { onSwitchProfile: () => void }) {
  const { household, activeProfileId, addProfile, renameProfile, deleteProfile, switchProfile } = useStore();
  const profiles = Object.values(household.profiles);
  return (
    <div className="card">
      <h2>Learners</h2>
      <p>Each learner has isolated levels, SRS, readiness, errors and session history. Sounds, books and app assets are shared on this device.</p>
      <table><thead><tr><th>Name</th><th>Current</th><th /></tr></thead><tbody>
        {profiles.map((p) => <tr key={p.id}>
          <td><b>{p.name}</b></td><td>{p.id === activeProfileId ? <span className="pill good">active</span> : ''}</td>
          <td style={{ whiteSpace: 'nowrap' }}>
            {p.id !== activeProfileId && <button className="btn" onClick={() => { switchProfile(p.id); onSwitchProfile(); }}>Switch</button>}{' '}
            <button className="btn light" onClick={() => { const n = window.prompt('Rename learner', p.name); if (n?.trim()) renameProfile(p.id, n); }}>Rename</button>{' '}
            {profiles.length > 1 && <button className="btn light" onClick={() => { if (window.confirm(`Delete ${p.name}'s learning progress?`)) deleteProfile(p.id); }}>Delete</button>}
          </td>
        </tr>)}
      </tbody></table>
      <button className="btn" onClick={() => { const n = window.prompt('Name for new learner'); if (n?.trim()) { addProfile(n); onSwitchProfile(); } }}>+ Add learner</button>
    </div>
  );
}
