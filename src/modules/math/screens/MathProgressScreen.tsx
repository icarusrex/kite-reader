import { MathProgressTab } from './MathProgressTab';

export function MathProgressScreen({ onClose }: { onClose: () => void }) {
  return <div className="parent"><header><h1>Math progress</h1><span style={{ flex: 1 }} /><button className="btn" onClick={onClose}>Back to Math</button></header><main><MathProgressTab /></main></div>;
}
