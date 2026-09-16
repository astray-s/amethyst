import type { CSSProperties } from 'react';

export interface TimerPreset {
  id: string;
  title: string;
  subtitle: string;
  duration: number;
  blockApps: boolean;
  art: string;
}

export const TIMER_PRESETS: TimerPreset[] = [
  { id: 'deep-work', title: 'Deep study', subtitle: 'No distractions', duration: 60, blockApps: true, art: 'radial-gradient(circle at 24% 18%, #9468f7 0, transparent 34%), linear-gradient(145deg, #392060 0%, #151020 52%, #08070d 100%)' },
  { id: 'reset', title: 'Commute', subtitle: 'A quick pause', duration: 15, blockApps: true, art: 'radial-gradient(circle at 72% 22%, #5d7ee9 0, transparent 31%), linear-gradient(150deg, #20294c 0%, #16111f 58%, #09080d 100%)' },
  { id: 'study-sprint', title: 'Study sprint', subtitle: 'One focused set', duration: 45, blockApps: true, art: 'radial-gradient(circle at 32% 28%, #cf6de0 0, transparent 30%), linear-gradient(135deg, #48204f 0%, #1d102a 55%, #09070d 100%)' },
  { id: 'open-space', title: 'Open space', subtitle: 'Timer only', duration: 30, blockApps: false, art: 'radial-gradient(circle at 70% 16%, #54a9bd 0, transparent 32%), linear-gradient(145deg, #183742 0%, #171528 52%, #09080e 100%)' },
];

interface Props { selectedId: string; disabled: boolean; onSelect: (id: string) => void; }

export function TimerPresetRail({ selectedId, disabled, onSelect }: Props) {
  return <section className="timer-collections" aria-label="Timer presets">
    <div className="timer-collections__heading"><h2>For You</h2></div>
    <div className="timer-preset-rail">
      {TIMER_PRESETS.map((preset) => <button key={preset.id} type="button" className={`timer-preset-card ${selectedId === preset.id ? 'is-selected' : ''}`} style={{ '--preset-art': preset.art } as CSSProperties} onClick={() => onSelect(preset.id)} disabled={disabled} aria-pressed={selectedId === preset.id}>
        <span className="timer-preset-card__minutes">{preset.duration} min</span><strong>{preset.title}</strong><small>{preset.subtitle}</small>
      </button>)}
    </div>
  </section>;
}
