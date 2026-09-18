import { useStore } from '../app/store';
import { KITE_MODULES, KiteModuleId } from '../module';
import { Kite, ParentCorner } from '../ui/components';

export function ModuleLauncher({ onOpen, onParent }: { onOpen: (id: KiteModuleId) => void; onParent: () => void }) {
  const { reading } = useStore();
  const name = reading.settings.childName;
  return <div className="screen">
    <ParentCorner onOpen={onParent} />
    <div className="stage" style={{ gap: 26, padding: '5vh 6vw' }}>
      <div style={{ position: 'relative', width: '20vmin', height: '22vmin' }}><Kite style={{ left: 0, width: '20vmin', height: '22vmin' }} /></div>
      <h1 className="title">{name ? `Hi ${name}!` : 'Hi!'}</h1>
      <p className="subtitle">What shall we do?</p>
      <div className="row" style={{ gap: 18, flexWrap: 'wrap', justifyContent: 'center' }}>
        {KITE_MODULES.map((module) => <button
          key={module.id}
          className="card"
          onClick={() => onOpen(module.id)}
          style={{ width: 'min(320px, 38vw)', minHeight: 190, cursor: 'pointer', textAlign: 'center', border: 'none' }}
        >
          <div style={{ fontSize: 70 }}>{module.emoji}</div>
          <h2 style={{ fontSize: 34, margin: '8px 0' }}>{module.title}</h2>
          <p style={{ margin: 0 }}>{module.description}</p>
        </button>)}
      </div>
    </div>
  </div>;
}
