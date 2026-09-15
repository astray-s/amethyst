import { useCallback, useEffect, useRef, useState } from 'react';

export function usePresenceClose(onExited: () => void, duration = 220) {
  const [closing, setClosing] = useState(false);
  const timer = useRef<number | null>(null);

  useEffect(() => () => {
    if (timer.current !== null) window.clearTimeout(timer.current);
  }, []);

  const requestClose = useCallback(() => {
    setClosing((current) => {
      if (current) return current;
      timer.current = window.setTimeout(onExited, duration);
      return true;
    });
  }, [onExited, duration]);

  return {
    closing,
    requestClose,
  };
}
