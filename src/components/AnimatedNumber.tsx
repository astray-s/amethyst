import { useEffect, useRef, useState } from 'react';

interface AnimatedNumberProps {
  value: number;
  duration?: number;
  startAt?: number;
  className?: string;
}

export function AnimatedNumber({ value, duration = 560, startAt = 0, className }: AnimatedNumberProps) {
  const [displayed, setDisplayed] = useState(startAt);
  const previous = useRef(startAt);

  useEffect(() => {
    const from = previous.current;
    const difference = value - from;
    const steps = Math.max(1, Math.round(duration / 40));
    let step = 0;
    setDisplayed(from);
    const timer = window.setInterval(() => {
      step += 1;
      const progress = step / steps;
      const eased = 1 - (1 - progress) ** 3;
      const next = Math.round(from + difference * eased);
      setDisplayed(next);
      if (step >= steps) {
        previous.current = value;
        window.clearInterval(timer);
      }
    }, duration / steps);
    return () => window.clearInterval(timer);
  }, [duration, value]);

  return <span className={className} aria-label={String(value)}>{displayed}</span>;
}
