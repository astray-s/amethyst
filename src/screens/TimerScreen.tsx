import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { useNavigate } from 'react-router-dom';
import './TimerScreen.css';
import { AmethystBlocker } from '../native/AmethystNativeBridge';
import { rulesStore, gemsStore, sessionStore, sessionHistoryStore, selectedRuleStore, type StoredRule } from '../state/localState';
import { toNativeBlockRule } from '../native/rules';
import { TimerCave } from '../components/timer/TimerCave';
import { TimerPresetRail, TIMER_PRESETS } from '../components/timer/TimerPresetRail';
import { TimerStartSheet } from '../components/timer/TimerStartSheet';
import { TimerRewardOverlay } from '../components/timer/TimerRewardOverlay';

const STEP_MINUTES = 15;
const MIN_DURATION = 5;
const MAX_DURATION = 240;

function formatTime(totalSeconds: number) {
  const seconds = Math.max(0, totalSeconds);
  return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
}

function hasBlockingTargets(rule: StoredRule | undefined) {
  if (!rule) return false;
  try {
    const nativeRule = toNativeBlockRule(rule);
    return nativeRule.packageNames.length > 0 || nativeRule.domains.length > 0;
  } catch {
    return false;
  }
}

export function TimerScreen() {
  const navigate = useNavigate();
  const [duration, setDuration] = useState(30);
  const [blockApps, setBlockApps] = useState(false);
  const [rules, setRules] = useState<StoredRule[]>([]);
  const [ruleId, setRuleId] = useState('');
  const [running, setRunning] = useState(false);
  const [starting, setStarting] = useState(false);
  const [remaining, setRemaining] = useState(30 * 60);
  const [selectedPresetId, setSelectedPresetId] = useState(TIMER_PRESETS[0].id);
  const [sheetPresetId, setSheetPresetId] = useState<string | null>(null);
  const [earnedGem, setEarnedGem] = useState<string | null>(null);
  const [restored, setRestored] = useState(false);
  const [error, setError] = useState('');
  const activeDuration = useRef(0);
  const activeStartedAt = useRef(0);
  const activeEndsAt = useRef(0);

  /* Item 12: Hold-to-end state */
  const [holdingEnd, setHoldingEnd] = useState(false);
  const [endProgress, setEndProgress] = useState(0);
  const endStartedAt = useRef(0);
  const endFrame = useRef<number | null>(null);
  const endTimer = useRef<number | null>(null);
  const endHoldActive = useRef(false);
  const startInProgress = useRef(false);

  const HOLD_END_MS = 5000;

  function startEndHold() {
    if (endHoldActive.current) return;
    endHoldActive.current = true;
    endStartedAt.current = performance.now();
    setHoldingEnd(true);
    setEndProgress(0);
    const update = (now: number) => {
      const elapsed = now - endStartedAt.current;
      setEndProgress(Math.min(100, (elapsed / HOLD_END_MS) * 100));
      if (!endHoldActive.current || elapsed >= HOLD_END_MS) { endFrame.current = null; return; }
      endFrame.current = window.requestAnimationFrame(update);
    };
    endFrame.current = window.requestAnimationFrame(update);
    endTimer.current = window.setTimeout(() => {
      if (!endHoldActive.current) return;
      endHoldActive.current = false;
      endTimer.current = null;
      if (endFrame.current) { window.cancelAnimationFrame(endFrame.current); endFrame.current = null; }
      setEndProgress(100);
      setHoldingEnd(false);
      if (navigator.vibrate) navigator.vibrate(20);
      void stop();
    }, HOLD_END_MS);
  }

  function releaseEndHold() {
    if (!endHoldActive.current) return;
    endHoldActive.current = false;
    if (endFrame.current) { window.cancelAnimationFrame(endFrame.current); endFrame.current = null; }
    if (endTimer.current) { window.clearTimeout(endTimer.current); endTimer.current = null; }
    setHoldingEnd(false);
    setEndProgress(0);
  }

  const selectedRule = useMemo(() => rules.find((candidate) => candidate.id === ruleId), [ruleId, rules]);
  const sheetPreset = useMemo(() => TIMER_PRESETS.find((preset) => preset.id === sheetPresetId) ?? null, [sheetPresetId]);
  const displayed = running ? remaining : duration * 60;

  useEffect(() => {
    const availableRules = rulesStore.getAll();
    const savedRuleId = selectedRuleStore.get();
    const selectedRule = availableRules.find((rule) => rule.id === savedRuleId && hasBlockingTargets(rule))
      ?? availableRules.find((rule) => hasBlockingTargets(rule));
    setRules(availableRules);
    setRuleId(selectedRule?.id ?? '');
    if (selectedRule && selectedRule.id !== savedRuleId) selectedRuleStore.set(selectedRule.id);
    const saved = sessionStore.get();
    if (saved?.active && saved.endsAt > Date.now()) {
      const savedPresetId = saved.presetId;
      setDuration(saved.durationMinutes);
      setBlockApps(saved.blockApps);
      setRuleId(saved.ruleId ?? '');
      if (savedPresetId && TIMER_PRESETS.some((preset) => preset.id === savedPresetId)) {
        setSelectedPresetId(savedPresetId);
      }
      setRemaining(Math.ceil((saved.endsAt - Date.now()) / 1000));
      activeDuration.current = saved.durationMinutes;
      activeStartedAt.current = saved.endsAt - saved.durationMinutes * 60_000;
      activeEndsAt.current = saved.endsAt;
      setRunning(true);
      setRestored(true);
    }
    const statusPromise = AmethystBlocker.getEngineStatus?.();
    void statusPromise?.then((status) => {
      const nativeSession = status.session;
      if (!nativeSession || nativeSession.endsAt <= Date.now()) return;
      const nativeDuration = Math.max(1, Math.round((nativeSession.endsAt - nativeSession.startedAt) / 60_000));
      setDuration(nativeDuration);
      setRemaining(Math.max(1, Math.ceil((nativeSession.endsAt - Date.now()) / 1000)));
      activeDuration.current = nativeDuration;
      activeStartedAt.current = nativeSession.startedAt;
      activeEndsAt.current = nativeSession.endsAt;
      setRunning(true);
      setRestored(true);
    });
  }, []);

  function adjustDuration(delta: number) {
    setError('');
    setDuration((current) => {
      const next = Math.max(MIN_DURATION, Math.min(MAX_DURATION, current + delta));
      setRemaining(next * 60);
      return next;
    });
  }

  function openStartSheet(presetId = selectedPresetId, shouldBlockApps = blockApps) {
    void shouldBlockApps;
    setError('');
    setSheetPresetId(presetId);
  }

  function selectPreset(id: string) {
    const preset = TIMER_PRESETS.find((item) => item.id === id);
    if (!preset) return;
    setSelectedPresetId(id);
    setDuration(preset.duration);
    setRemaining(preset.duration * 60);
    setBlockApps(preset.blockApps);
    openStartSheet(id, preset.blockApps);
  }

  async function complete() {
    try {
      await AmethystBlocker.stopFocusSession({ endState: 'completed' });
    } catch {
      setError('The timer ended, but Amethyst could not confirm that blocking stopped.');
    }
    const unlockedBefore = gemsStore.getUnlocked();
    const endedAt = Date.now();
    sessionStore.set(null);
    sessionHistoryStore.complete({
      id: `session-${activeStartedAt.current}`,
      presetId: selectedPresetId,
      startedAt: activeStartedAt.current,
      endedAt,
      durationMinutes: activeDuration.current,
      blockedApps: blockApps,
      completed: true,
    });
    const newest = gemsStore.getUnlocked().find((id) => !unlockedBefore.includes(id));
    if (newest) setEarnedGem(newest);
  }

  useEffect(() => {
    if (!running) return;
    const interval = window.setInterval(() => {
      setRemaining(() => {
        const next = Math.max(0, Math.ceil((activeEndsAt.current - Date.now()) / 1000));
        if (next <= 0) {
          window.clearInterval(interval);
          setRunning(false);
          void complete();
          return 0;
        }
        return next;
      });
    }, 1000);
    return () => window.clearInterval(interval);
  }, [running]);

  async function start() {
    if (startInProgress.current) return false;
    startInProgress.current = true;
    if (blockApps && !hasBlockingTargets(selectedRule)) {
      setError('Choose a blocking rule with at least one app or website before starting.');
      startInProgress.current = false;
      return false;
    }
    const startedAt = Date.now();
    let canonicalStartedAt = startedAt;
    let endsAt = startedAt + duration * 60_000;
    try {
      const result = await AmethystBlocker.startFocusSession({
        durationMinutes: duration,
        blockApps,
        rule: selectedRule ? toNativeBlockRule(selectedRule) : undefined,
      });
      if (blockApps && !result.started) {
        setError('Amethyst could not start blocking. Check its permissions and try again.');
        startInProgress.current = false;
        return false;
      }
      const status = await AmethystBlocker.getEngineStatus?.();
      const nativeSession = status?.session;
      endsAt = nativeSession?.endsAt ?? endsAt;
      canonicalStartedAt = nativeSession?.startedAt ?? canonicalStartedAt;
    } catch {
      if (blockApps) {
        setError('Amethyst could not start blocking. Check its permissions and try again.');
        startInProgress.current = false;
        return false;
      }
    }
    sessionStore.set({ active: true, endsAt, durationMinutes: duration, blockApps, ruleId: selectedRule?.id, presetId: selectedPresetId });
    activeStartedAt.current = canonicalStartedAt;
    activeEndsAt.current = endsAt;
    selectedRuleStore.set(selectedRule?.id ?? '');
    activeDuration.current = duration;
    setRemaining(duration * 60);
    setRestored(false);
    setStarting(true);
    setError('');
    await new Promise<void>((resolve) => window.setTimeout(resolve, 220));
    setSheetPresetId(null);
    setRunning(true);
    setStarting(false);
    startInProgress.current = false;
    return true;
  }

  async function stop() {
    const endedAt = Date.now();
    try {
      await AmethystBlocker.stopFocusSession();
    } catch {
      setError('The timer stopped, but Amethyst could not confirm that blocking stopped.');
    }
    sessionStore.set(null);
    sessionHistoryStore.complete({
      id: `session-${activeStartedAt.current}`,
      presetId: selectedPresetId,
      startedAt: activeStartedAt.current,
      endedAt,
      durationMinutes: Math.max(0, Math.round((endedAt - activeStartedAt.current) / 60_000)),
      blockedApps: blockApps,
      completed: false,
    });
    setRunning(false);
    setStarting(false);
    setRestored(false);
    setRemaining(duration * 60);
  }

  return (
    <main className="timer-screen timer-screen--live" data-session-phase={starting ? 'starting' : running ? 'running' : 'ready'}>
      {/* Item 14: Settings icon — Lucide-style gear matching ProfileScreen */}
      <header className="timer-header">
        <h1>Timer</h1>
        <button className="timer-header__status" type="button" aria-label="Open settings" onClick={() => navigate('/settings')}>
          <svg viewBox="0 0 24 24" aria-hidden="true" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" /><circle cx="12" cy="12" r="3" /></svg>
        </button>
      </header>
      <TimerCave displayed={formatTime(displayed)} running={running} starting={starting} restored={restored} duration={duration} />
      <section className="timer-duration" aria-label="Session duration">
        <button type="button" disabled={running || duration <= MIN_DURATION} onClick={() => adjustDuration(-STEP_MINUTES)} aria-label={`Remove ${STEP_MINUTES} minutes`}><span className="amethyst-glow-icon">−</span></button>
        <div><strong>{duration}m</strong></div>
        <button type="button" disabled={running || duration >= MAX_DURATION} onClick={() => adjustDuration(STEP_MINUTES)} aria-label={`Add ${STEP_MINUTES} minutes`}><span className="amethyst-glow-icon">+</span></button>
      </section>
      {running ? (
        <button
          className={`timer-primary timer-primary--stop ${holdingEnd ? 'is-holding' : ''}`}
          type="button"
          style={{ '--end-progress': `${endProgress}%` } as CSSProperties}
          onPointerDown={(e) => { if (e.isPrimary && e.button === 0) { e.currentTarget.setPointerCapture?.(e.pointerId); startEndHold(); } }}
          onPointerUp={(e) => { if (e.isPrimary) { e.currentTarget.releasePointerCapture?.(e.pointerId); releaseEndHold(); } }}
          onPointerCancel={() => releaseEndHold()}
          onPointerLeave={() => releaseEndHold()}
          onContextMenu={(e) => e.preventDefault()}
          aria-label="Hold 5 seconds to end session"
        >{holdingEnd ? `Hold… ${Math.ceil((HOLD_END_MS - endProgress / 100 * HOLD_END_MS) / 1000)}s` : 'Hold to end session'}</button>
      ) : (
        <button className="timer-primary" type="button" aria-label="Start focus session" aria-describedby={error ? 'timer-error' : undefined} onClick={() => openStartSheet()} disabled={starting}><span aria-hidden="true">▶</span>{starting ? 'Starting…' : 'Start'}</button>
      )}
      {error && <p id="timer-error" role="alert" aria-live="assertive">{error}</p>}
      {/* Item 13: Block toggle with subtitle */}
      <button type="button" className={`timer-block-pill ${blockApps ? 'is-active' : ''}`} disabled={running} onClick={() => { setBlockApps((value) => !value); setError(''); }} aria-label="Toggle app blocking" aria-pressed={blockApps}>
        <span className="amethyst-glow-icon" aria-hidden="true">⬟</span>
        <span className="timer-block-pill__text">
          <b>Block</b><strong>{blockApps ? 'Yes' : 'No'}</strong>
        </span>
        <small className="timer-block-pill__subtitle">Block distracting apps during session</small>
      </button>
      <TimerPresetRail selectedId={selectedPresetId} onSelect={selectPreset} disabled={running} />
      <TimerStartSheet
        preset={sheetPreset}
        duration={duration}
        blockApps={blockApps}
        error={error}
        rules={rules}
        ruleId={ruleId}
        onClose={() => { setSheetPresetId(null); setError(''); }}
        onBlockAppsChange={(value) => { setBlockApps(value); setError(''); }}
        onRuleChange={(value) => { setRuleId(value); selectedRuleStore.set(value); setError(''); }}
        onStart={start}
      />
      <TimerRewardOverlay gemId={earnedGem} onClose={() => { setEarnedGem(null); navigate('/gems'); }} />
    </main>
  );
}
