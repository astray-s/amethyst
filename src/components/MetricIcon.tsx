type MetricName = 'sleep' | 'focus' | 'rest' | 'settings';

export function MetricIcon({ name }: { name: MetricName }) {
  if (name === 'sleep') {
    return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M19 15.2A7.5 7.5 0 0 1 8.8 5a7.5 7.5 0 1 0 10.2 10.2Z" /></svg>;
  }
  if (name === 'focus') {
    return <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="7.5" /><circle cx="12" cy="12" r="2.5" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3" /></svg>;
  }
  if (name === 'rest') {
    return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 5.5h10M7 18.5h10M8 6c0 3 2.3 4 4 6-1.7 2-4 3-4 6M16 6c0 3-2.3 4-4 6 1.7 2 4 3 4 6" /></svg>;
  }
  return <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="3.2" /><path d="M9.7 3.1 10.3 2h3.4l.6 1.1 1.9.8 1.2-.4 2.4 2.4-.4 1.2.8 1.9 1.1.6V13l-1.1.6-.8 1.9.4 1.2-2.4 2.4-1.2-.4-1.9.8-.6 1.1h-3.4l-.6-1.1-1.9-.8-1.2.4-2.4-2.4.4-1.2-.8-1.9-1.1-.6V9.6L3.8 9l.8-1.9-.4-1.2 2.4-2.4 1.2.4 1.9-.8Z" /></svg>;
}
