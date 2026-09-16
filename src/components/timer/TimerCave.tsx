interface TimerCaveProps {
  displayed: string;
  running: boolean;
  starting: boolean;
  restored: boolean;
  duration: number;
}

export function TimerCave({ displayed, running, starting, restored, duration }: TimerCaveProps) {
  const totalSeconds = duration * 60;
  const [m, s] = displayed.split(':').map(Number);
  const displayedSeconds = (m ?? 0) * 60 + (s ?? 0);
  const progress = running ? Math.max(0, Math.min(1, 1 - displayedSeconds / totalSeconds)) : 0;
  const radius = 110;
  const stroke = 3;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference * (1 - progress);

  return (
    <section className="timer-cave" data-session-phase={starting ? 'starting' : running ? 'running' : 'ready'} aria-label={running ? `${displayed} remaining` : `${duration} minute timer`}>
      <div className="timer-cave__ring-wrap">
        <svg className="timer-cave__ring" viewBox="0 0 240 240" aria-hidden="true">
          <circle className="timer-cave__ring-track" cx="120" cy="120" r={radius} fill="none" strokeWidth={stroke} />
          <circle
            className="timer-cave__ring-progress"
            cx="120" cy="120" r={radius}
            fill="none"
            strokeWidth={stroke + 1}
            strokeDasharray={circumference}
            strokeDashoffset={dashOffset}
            strokeLinecap="round"
            transform="rotate(-90 120 120)"
          />
        </svg>
        <div className={`timer-cave__countdown ${running ? 'is-running' : ''} ${starting ? 'is-starting' : ''}`}>
          <span aria-live="polite">{displayed}</span>
        </div>
      </div>
      <p className="timer-cave__label" aria-live="polite">
        {running ? (restored ? 'Session restored' : 'Stay with it') : 'Ready when you are'}
      </p>
    </section>
  );
}
