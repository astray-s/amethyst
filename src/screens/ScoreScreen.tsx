import { useMemo, useRef, useState, type CSSProperties } from 'react';
import { useNavigate } from 'react-router-dom';
import { MetricIcon } from '../components/MetricIcon';
import { AnimatedNumber } from '../components/AnimatedNumber';
import type { UsageStats } from '../native/AmethystNativeBridge';
import { scoreColour } from '../score/scoreColour';
import { useDailyScore } from '../score/useDailyScore';
import './ScoreScreen.css';

export interface ScoreMetrics { sleep: number | null; focus: number; rest: number; score: number }
interface ScoreScreenProps { metrics?: ScoreMetrics; usageMinutes?: number; pickups?: number; onBack?: () => void }
type Dimension = 'overall' | 'sleep' | 'focus' | 'rest';
type ScoreDimension = Exclude<Dimension, 'overall'>;

interface Metric {
  name: string;
  value: string;
  progress: number;
  average: number;
  dimension: ScoreDimension;
  status?: string;
  delta?: string;
  deltaDirection?: 'up' | 'down';
  available?: boolean;
}

const EMPTY_USAGE: UsageStats = {
  pickups: 0,
  screenTimeMinutes: 0,
  mostUsedApps: [],
  hourly: [],
  usageAccessGranted: false,
};

function formatMinutes(minutes: number) {
  if (minutes < 60) return `${Math.max(0, Math.round(minutes))}m`;
  return `${Math.floor(minutes / 60)}h ${Math.round(minutes % 60)}m`;
}

function formatHour(epoch: number | undefined) {
  return epoch ? new Date(epoch).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : 'No data';
}

function sameLocalDay(left: number | Date, right: number | Date) {
  const a = new Date(left);
  const b = new Date(right);
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function MetricRow({ metric }: { metric: Metric }) {
  const available = metric.available !== false;
  return <article className="score-metric">
    <header>
      <strong>{metric.name} <span>{metric.value}</span></strong>
      {metric.delta && <b className={`score-metric__delta score-metric__delta--${metric.deltaDirection ?? 'down'}`}>{metric.deltaDirection === 'up' ? '▲' : '▼'}{metric.delta}</b>}
      {metric.status && <b className="score-metric__status">{metric.status}</b>}
    </header>
    <div
      className={`score-metric__track${available ? '' : ' is-unavailable'}${available && metric.progress <= 0 ? ' is-zero' : ''}`}
      style={{ '--metric-progress': `${metric.progress / 100}` } as CSSProperties}
    >
      <i />
      {available && <span style={{ left: `${metric.average}%` }} />}
    </div>
    {available && <small style={{ left: `${metric.average}%` }}>AVG</small>}
  </article>;
}

function DimensionButton({ name, value, selected, onSelect, onTemporary }: {
  name: ScoreDimension;
  value: number | null;
  selected: boolean;
  onSelect: () => void;
  onTemporary: (active: boolean) => void;
}) {
  const hold = useRef<number | null>(null);
  const wasHeld = useRef(false);
  function clearHold() {
    if (hold.current !== null) window.clearTimeout(hold.current);
    hold.current = null;
    onTemporary(false);
  }
  return <button
    type="button"
    className={selected ? 'is-selected' : ''}
    aria-pressed={selected}
    aria-label={`${name} score ${value ?? 'unavailable'}`}
    onClick={() => {
      if (wasHeld.current) {
        wasHeld.current = false;
        return;
      }
      onSelect();
    }}
    onPointerDown={() => {
      wasHeld.current = false;
      hold.current = window.setTimeout(() => {
        wasHeld.current = true;
        onTemporary(true);
      }, 450);
    }}
    onPointerUp={clearHold}
    onPointerLeave={clearHold}
    onPointerCancel={clearHold}
  >
    <MetricIcon name={name} />
    <span className="score-live__dimension-copy">
      <small>{name}</small>
      <b>{value ?? '—'}</b>
    </span>
  </button>;
}

export function ScoreScreen({ metrics, usageMinutes, pickups, onBack }: ScoreScreenProps) {
  const navigate = useNavigate();
  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const [dimension, setDimension] = useState<Dimension>('overall');
  const [temporaryDimension, setTemporaryDimension] = useState<Dimension | null>(null);
  const { loading, snapshot } = useDailyScore(selectedDate);
  const usage: UsageStats = snapshot?.usage ?? EMPTY_USAGE;
  const attempts = snapshot?.attempts ?? [];
  const longestFocus = snapshot?.longestFocusMinutes ?? 0;
  const unblocksUsed = snapshot?.score.metrics.unblocksUsed ?? null;
  const sleepHours = snapshot?.score.metrics.estimatedSleepHours ?? null;
  const screenTime = usageMinutes ?? usage.screenTimeMinutes;
  const pickupCount = pickups ?? usage.pickups;
  const calculated = snapshot?.score;
  const scoreAvailable = metrics != null
    || (!!snapshot
      && snapshot.status !== 'permission'
      && snapshot.status !== 'error'
      && snapshot.usageReliable !== false);
  const resolved = metrics ?? {
    sleep: calculated?.sleep ?? null,
    focus: calculated?.focus ?? 0,
    rest: calculated?.rest ?? null,
    score: calculated?.overall ?? 0,
  };
  const firstHour = calculated?.metrics.firstPickupEpoch ?? usage.firstPickupEpoch;
  const lastHour = calculated?.metrics.lastScrollEpoch ?? null;
  const offlineMinutes = calculated?.metrics.offlineMinutes ?? 0;
  const distractingMinutes = calculated?.metrics.distractingMinutes ?? null;
  const quietMinutes = calculated?.metrics.longestOfflineStretchMinutes ?? 0;
  const blockAttempts = calculated?.metrics.blockAttempts ?? (snapshot?.attemptsTruncated ? null : attempts.length);
  const usageAvailable = usage.usageAccessGranted !== false && snapshot?.usageReliable !== false;

  const rows = useMemo<Metric[]>(() => {
    const result: Metric[] = [
      { name: 'Screen time', value: usageAvailable ? formatMinutes(screenTime) : 'Unavailable', progress: usageAvailable ? Math.min(100, screenTime / 240 * 100) : 0, average: 75, dimension: 'rest', available: usageAvailable, delta: usageAvailable && screenTime > 0 ? formatMinutes(Math.abs(screenTime - 180)) : undefined, deltaDirection: screenTime <= 180 ? 'up' : 'down' },
      { name: 'Distracting apps', value: distractingMinutes == null ? 'Not classified' : formatMinutes(distractingMinutes), progress: distractingMinutes == null ? 0 : Math.min(100, distractingMinutes / 120 * 100), average: 50, dimension: 'focus', available: distractingMinutes != null },
      { name: 'Phone pickups', value: usageAvailable ? String(pickupCount) : 'Unavailable', progress: usageAvailable ? Math.min(100, pickupCount / 100 * 100) : 0, average: 50, dimension: 'focus', available: usageAvailable, delta: usageAvailable && pickupCount > 0 ? String(Math.abs(pickupCount - 25)) : undefined, deltaDirection: pickupCount <= 25 ? 'up' : 'down' },
      { name: 'Offline', value: usageAvailable ? formatMinutes(offlineMinutes) : 'Unavailable', progress: usageAvailable ? Math.min(100, offlineMinutes / 1440 * 100) : 0, average: 70, dimension: 'rest', available: usageAvailable },
      { name: 'Longest offline stretch', value: usageAvailable ? formatMinutes(quietMinutes) : 'Unavailable', progress: usageAvailable ? Math.min(100, quietMinutes / 240 * 100) : 0, average: 50, dimension: 'rest', available: usageAvailable },
      { name: 'First pickup', value: formatHour(firstHour ?? undefined), progress: firstHour ? 55 : 0, average: 50, dimension: 'sleep', available: firstHour != null },
      { name: 'Last scroll', value: formatHour(lastHour ?? undefined), progress: lastHour ? 55 : 0, average: 50, dimension: 'sleep', available: lastHour != null },
      { name: 'Longest Focus', value: formatMinutes(longestFocus), progress: Math.min(100, longestFocus / 60 * 100), average: 50, dimension: 'focus', status: longestFocus <= 0 ? 'None yet' : undefined },
      { name: 'App unblocks', value: unblocksUsed == null ? 'Unavailable' : String(unblocksUsed), progress: unblocksUsed == null ? 0 : Math.min(100, unblocksUsed * 20), average: 20, dimension: 'focus', available: unblocksUsed != null, status: unblocksUsed === 0 ? 'None' : unblocksUsed != null && unblocksUsed <= 2 ? 'Low' : undefined },
      { name: 'Blocked attempts', value: blockAttempts == null ? 'Partial' : String(blockAttempts), progress: blockAttempts == null ? 0 : Math.min(100, blockAttempts * 5), average: 20, dimension: 'focus', available: blockAttempts != null, status: blockAttempts === 0 ? 'None' : undefined },
    ];
    if (sleepHours != null && resolved.sleep != null) {
      result.splice(2, 0, { name: 'Estimated sleep', value: `${sleepHours.toFixed(1)}h`, progress: resolved.sleep, average: 80, dimension: 'sleep', status: resolved.sleep >= 80 ? 'Good' : undefined });
    }
    return result;
  }, [blockAttempts, distractingMinutes, firstHour, lastHour, longestFocus, offlineMinutes, pickupCount, quietMinutes, resolved.sleep, screenTime, sleepHours, unblocksUsed, usageAvailable]);

  const activeDimension = temporaryDimension ?? dimension;
  const visibleRows = activeDimension === 'overall' ? rows : rows.filter((row) => row.dimension === activeDimension);
  const animationKey = `${selectedDate.toDateString()}-${activeDimension}-${resolved.score}`;
  const isToday = sameLocalDay(selectedDate, new Date());
  function moveDay(delta: number) {
    setSelectedDate((current) => {
      const next = new Date(current);
      next.setDate(next.getDate() + delta);
      return next > new Date() ? current : next;
    });
  }
  function selectDimension(next: ScoreDimension) {
    setDimension((current) => current === next ? 'overall' : next);
  }

  const arcColour = scoreColour(resolved.score ?? 0);

  return <main className="score-live">
    <header className="score-live__header">
      <button type="button" onClick={onBack ?? (() => navigate(-1))} aria-label="Back">‹</button>
      <div><button type="button" onClick={() => moveDay(-1)} aria-label="Previous day">‹</button><strong>{isToday ? 'Today' : selectedDate.toLocaleDateString([], { month: 'short', day: 'numeric' })}</strong><button type="button" onClick={() => moveDay(1)} disabled={isToday} aria-label="Next day">›</button></div>
      <span />
    </header>

    <section className="score-live__hero" data-score-motion={animationKey}>
      <button
        key={animationKey}
        className={`score-live__arc ${activeDimension === 'overall' ? 'is-selected' : ''}`}
        onClick={() => setDimension('overall')}
        aria-label={scoreAvailable ? `Amethyst Score ${resolved.score}` : 'Amethyst Score unavailable'}
        style={{ '--score-progress': String(resolved.score) } as CSSProperties}
      >
        <svg viewBox="0 0 260 140" aria-hidden="true">
          <path className="score-live__arc-track" d="M 18 124 A 112 112 0 0 1 242 124" pathLength="100" />
          <path className="score-live__arc-value" d="M 18 124 A 112 112 0 0 1 242 124" pathLength="100" style={{ stroke: arcColour, filter: `drop-shadow(0 0 8px ${arcColour}44)` }} />
        </svg>
        <strong style={{ color: arcColour, WebkitTextFillColor: arcColour, background: 'none', WebkitBackgroundClip: 'unset', backgroundClip: 'unset' }}>{scoreAvailable && (metrics != null || !loading) ? <AnimatedNumber value={resolved.score} startAt={0} /> : '—'}<svg className="score-live__chevron" viewBox="0 0 16 16" aria-hidden="true"><path d="m4 6 4 4 4-4" /></svg></strong><small>Amethyst Score</small>
      </button>
      <div className="score-live__branches" aria-hidden="true" />
      <div className="score-live__pills">
        <DimensionButton name="sleep" value={scoreAvailable ? resolved.sleep : null} selected={activeDimension === 'sleep'} onSelect={() => selectDimension('sleep')} onTemporary={(active) => setTemporaryDimension(active ? 'sleep' : null)} />
        <DimensionButton name="focus" value={scoreAvailable ? resolved.focus : null} selected={activeDimension === 'focus'} onSelect={() => selectDimension('focus')} onTemporary={(active) => setTemporaryDimension(active ? 'focus' : null)} />
        <DimensionButton name="rest" value={scoreAvailable ? resolved.rest : null} selected={activeDimension === 'rest'} onSelect={() => selectDimension('rest')} onTemporary={(active) => setTemporaryDimension(active ? 'rest' : null)} />
      </div>
    </section>

    <section className="score-live__intro"><h2>What is Amethyst Score?</h2><p>Amethyst Score combines device-estimated sleep behavior, focus, and digital rest. Every value comes from activity Amethyst can read locally; missing signals are excluded rather than invented.</p></section>
    <section className="score-live__metrics">
      {!usage.usageAccessGranted && <p className="score-live__empty">Enable Usage Access in Settings to see screen-time contributors for this day.</p>}
      {activeDimension === 'sleep' && sleepHours == null && <p className="score-live__empty">A sleep estimate appears after Amethyst can identify your last evening interaction and first morning pickup.</p>}
      {visibleRows.map((metric) => <MetricRow key={metric.name} metric={metric} />)}
    </section>
  </main>;
}
