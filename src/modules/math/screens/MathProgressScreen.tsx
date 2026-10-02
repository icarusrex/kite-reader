import { MathProgressTab } from './MathProgressTab';

export function MathProgressScreen({ onClose, onPractice, onExplore }: { onClose: () => void; onPractice: (lesson: number) => void; onExplore: (lesson: number) => void }) {
  return <div className="parent"><header><h1>Math progress</h1><span style={{ flex: 1 }} /><button className="btn" onClick={onClose}>Back to Math</button></header><main><MathProgressTab onPractice={onPractice} onExplore={onExplore} /></main></div>;
}
