import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AMETHYST_STATE_CHANGED_EVENT } from '../state/localState';
import {
  getDailyScore,
  type DailyScoreSnapshot,
} from './dailyScoreRepository';

export interface DailyScoreViewState {
  loading: boolean;
  snapshot: DailyScoreSnapshot | null;
}

function sameLocalDay(left: Date, right: Date) {
  return left.getFullYear() === right.getFullYear()
    && left.getMonth() === right.getMonth()
    && left.getDate() === right.getDate();
}

export function useDailyScore(date: Date): DailyScoreViewState & { refresh(): void } {
  const dateEpoch = useMemo(() => date.getTime(), [date]);
  const [result, setResult] = useState<{
    dateEpoch: number;
    snapshot: DailyScoreSnapshot | null;
  }>({
    dateEpoch,
    snapshot: null,
  });
  const requestId = useRef(0);

  const load = useCallback((force = false) => {
    const currentRequest = ++requestId.current;
    void getDailyScore(new Date(dateEpoch), { force }).then((snapshot) => {
      if (requestId.current === currentRequest) setResult({ dateEpoch, snapshot });
    }).catch(() => {
      if (requestId.current === currentRequest) setResult({ dateEpoch, snapshot: null });
    });
  }, [dateEpoch]);

  useEffect(() => {
    load(false);
  }, [load]);

  useEffect(() => {
    const selected = new Date(dateEpoch);
    if (!sameLocalDay(selected, new Date())) return;

    const refresh = () => { load(true); };
    const refreshWhenVisible = () => {
      if (document.visibilityState === 'visible') refresh();
    };
    window.addEventListener('focus', refresh);
    window.addEventListener(AMETHYST_STATE_CHANGED_EVENT, refresh);
    document.addEventListener('visibilitychange', refreshWhenVisible);
    return () => {
      window.removeEventListener('focus', refresh);
      window.removeEventListener(AMETHYST_STATE_CHANGED_EVENT, refresh);
      document.removeEventListener('visibilitychange', refreshWhenVisible);
    };
  }, [dateEpoch, load]);

  const snapshot = result.dateEpoch === dateEpoch ? result.snapshot : null;
  return {
    loading: snapshot == null,
    snapshot,
    refresh: () => { load(true); },
  };
}
