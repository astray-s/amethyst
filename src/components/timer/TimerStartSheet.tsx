import { useEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react';
import { ModalHost } from '../ModalHost';
import { usePresenceClose } from '../usePresenceClose';
import type { StoredRule } from '../../state/localState';
import type { TimerPreset } from './TimerPresetRail';

interface Props {
  preset: TimerPreset | null;
  duration: number;
  blockApps: boolean;
  error: string;
  rules: StoredRule[];
  ruleId: string;
  onClose: () => void;
  onBlockAppsChange: (value: boolean) => void;
  onRuleChange: (ruleId: string) => void;
  onStart: () => Promise<boolean>;
}

const HOLD_MS = 500;

export function TimerStartSheet({ preset, duration, blockApps, error, rules, ruleId, onClose, onBlockAppsChange, onRuleChange, onStart }: Props) {
  const [holding, setHolding] = useState(false);
  const [starting, setStarting] = useState(false);
  const [progress, setProgress] = useState(0);
  const startedAt = useRef(0);
  const startedEventAt = useRef(0);
  const frame = useRef<number | null>(null);
  const holdTimer = useRef<number | null>(null);
  const holdActive = useRef(false);
  const { closing, requestClose } = usePresenceClose(onClose);
  useEffect(() => () => {
    if (frame.current) window.cancelAnimationFrame(frame.current);
    if (holdTimer.current) window.clearTimeout(holdTimer.current);
  }, []);
  if (!preset) return null;
  async function completeHold() {
    setHolding(false);
    setStarting(true);
    if (navigator.vibrate) navigator.vibrate(14);
    const started = await onStart();
    if (!started) {
      setStarting(false);
      setProgress(0);
    }
  }
  function releaseHold(eventTimeStamp?: number) {
    if (!holdActive.current) return;
    const elapsedRuntime = performance.now() - startedAt.current;
    const elapsedInput = typeof eventTimeStamp === 'number'
      ? eventTimeStamp - startedEventAt.current
      : 0;
    const completed = Math.max(elapsedRuntime, elapsedInput) >= HOLD_MS;
    holdActive.current = false;
    if (frame.current) { window.cancelAnimationFrame(frame.current); frame.current = null; }
    if (holdTimer.current) { window.clearTimeout(holdTimer.current); holdTimer.current = null; }
    if (completed) {
      setProgress(100);
      void completeHold();
      return;
    }
    setHolding(false); setProgress(0);
  }
  function startHold(eventTimeStamp = performance.now()) {
    if (holdActive.current) return;
    holdActive.current = true;
    startedAt.current = performance.now();
    startedEventAt.current = eventTimeStamp;
    setHolding(true);
    const update = (now: number) => {
      const elapsed = now - startedAt.current;
      setProgress(Math.min(100, (elapsed / HOLD_MS) * 100));
      if (!holdActive.current || elapsed >= HOLD_MS) { frame.current = null; return; }
      frame.current = window.requestAnimationFrame(update);
    };
    frame.current = window.requestAnimationFrame(update);
    holdTimer.current = window.setTimeout(() => {
      if (!holdActive.current) return;
      holdActive.current = false;
      holdTimer.current = null;
      if (frame.current) { window.cancelAnimationFrame(frame.current); frame.current = null; }
      setProgress(100);
      void completeHold();
    }, HOLD_MS);
  }
  function handlePointerDown(event: ReactPointerEvent<HTMLButtonElement>) {
    if (!event.isPrimary || event.button !== 0) return;
    event.currentTarget.setPointerCapture?.(event.pointerId);
    startHold(event.timeStamp);
  }
  function handlePointerUp(event: ReactPointerEvent<HTMLButtonElement>) {
    if (!event.isPrimary) return;
    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    releaseHold(event.timeStamp);
  }
  return <ModalHost onClose={requestClose}><div className="timer-sheet-backdrop" data-motion-state={closing ? 'closing' : 'open'} role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) requestClose(); }}>
    <section className={`timer-sheet ${starting ? 'is-starting' : ''}`} role="dialog" aria-modal="true" aria-labelledby="start-session-title">
      <div className="timer-sheet__handle" aria-hidden="true" /><button className="timer-sheet__close" type="button" onClick={requestClose} aria-label="Close session setup">×</button>
      <span className="timer-sheet__eyebrow">READY WHEN YOU ARE</span><h2 id="start-session-title">{preset.title}</h2><p>{preset.subtitle}. Settle in and hold to begin your focus session.</p>
      <div className="timer-sheet__facts"><div><span>Duration</span><strong>{duration} minutes</strong></div><div><span>Apps</span><strong>{blockApps ? 'Blocked' : 'Available'}</strong></div></div>
      <button type="button" className={`timer-sheet__toggle ${blockApps ? 'is-active' : ''}`} onClick={() => onBlockAppsChange(!blockApps)}><span><b>Block apps</b><small>Keep distractions out of reach</small></span><i aria-hidden="true" /></button>
      {blockApps && <label className="timer-sheet__rule"><span>Blocking rule</span><select value={ruleId} onChange={(event) => onRuleChange(event.target.value)}><option value="">Choose a rule</option>{rules.map((rule) => <option key={rule.id} value={rule.id}>{rule.name}</option>)}</select></label>}
      {error && <p className="timer-sheet__error" role="alert">{error}</p>}
      <button
        type="button"
        className={`timer-hold ${holding ? 'is-holding' : ''} ${starting ? 'is-starting' : ''}`}
        style={{ '--hold-progress': `${progress}%` } as CSSProperties}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerCancel={(event) => releaseHold(event.timeStamp)}
        onContextMenu={(event) => event.preventDefault()}
        aria-label="Hold to start focus session"
        disabled={starting}
      ><span>{starting ? 'Starting…' : holding ? 'Keep holding…' : 'Hold to start'}</span></button>
    </section>
  </div></ModalHost>;
}
