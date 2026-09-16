import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatedNumber } from '../components/AnimatedNumber';
import { MetricIcon } from '../components/MetricIcon';
import { AppGlyph } from '../components/rules/AppGlyph';
import { AmethystBlocker, type InstalledAppInfo, type UsageStats } from '../native/AmethystNativeBridge';
import { useDailyScore } from '../score/useDailyScore';
import { streakStore } from '../state/localState';
import './HomeScreen.brand.css';

const EMPTY_USAGE: UsageStats = {
  pickups: 0,
  screenTimeMinutes: 0,
  mostUsedApps: [],
  usageAccessGranted: false,
};

function formatMinutes(minutes: number) {
  if (minutes < 60) return `${Math.max(0, Math.round(minutes))}m`;
  return `${Math.floor(minutes / 60)}h ${Math.round(minutes % 60)}m`;
}

export function HomeScreen() {
  const navigate = useNavigate();
  const [scorePhase, setScorePhase] = useState<'loading' | 'calculating' | 'resolved'>('loading');
  const [installedApps, setInstalledApps] = useState<InstalledAppInfo[]>([]);
  const streak = streakStore.get();
  const today = useMemo(() => new Date(), []);
  const { loading, snapshot } = useDailyScore(today);
  const usage: UsageStats = snapshot?.usage ?? EMPTY_USAGE;
  const usageState: 'loading' | 'ready' | 'permission' | 'error' = loading
    ? 'loading'
    : !snapshot || snapshot.status === 'error'
      ? 'error'
      : snapshot.status === 'permission'
        ? 'permission'
        : 'ready';
  const scoreReady = !!snapshot && (snapshot.status === 'ready' || snapshot.status === 'partial');
  const score = snapshot?.score ?? { sleep: null, focus: 0, rest: null, overall: 0 };

  useEffect(() => {
    void AmethystBlocker.getInstalledApps().then(({ apps }) => setInstalledApps(apps)).catch(() => undefined);
  }, []);

  useEffect(() => {
    if (loading) return;
    const t1 = window.setTimeout(() => setScorePhase('calculating'), 180);
    const t2 = window.setTimeout(() => setScorePhase('resolved'), 980);
    return () => { window.clearTimeout(t1); window.clearTimeout(t2); };
  }, [loading]);

  const apps = usage.mostUsedApps.slice(0, 5);

  return (
    <main className="home-rebuild" data-score-phase={scorePhase}>
      {/* Cave section — backdrop + header + stone + arc + pills */}
      <section className="home-cave" aria-label="Amethyst Score">
        <div className="home-cave__stars" aria-hidden="true" />

        {/* Header — inside the cave for safe-area padding */}
        <header className="home-live__header">
          <div className="home-live__brand">Amethyst</div>
          <div className="home-live__actions">
            <button type="button" onClick={() => navigate('/gems')} aria-label={`Current streak: ${streak} days`}>
              <span className="home-live__flame">♦</span>{streak}
            </button>
            <button className="home-live__profile" type="button" onClick={() => navigate('/profile')} aria-label="Open profile">
              <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8.2" r="3.4" /><path d="M5.6 20c.7-4 2.8-6 6.4-6s5.7 2 6.4 6" /></svg>
            </button>
          </div>
        </header>

        {/* Floating amethyst gem */}
        <button className="home-stone" type="button" onClick={() => navigate('/score')} aria-label={scoreReady ? `Open Amethyst Score: ${score.overall}` : 'Open Amethyst Score'}>
          <span className="home-stone__glow" />
          <img src="/gems/amethyst-cluster.png" alt="" />
          <span className="home-stone__plinth" aria-hidden="true" />
        </button>

        {/* Score arc + pills — centred via home-hero grid */}
        <div className="home-hero">
        <button
          className="home-arc home-arc--cave"
          type="button"
          onClick={() => navigate('/score')}
          aria-label={scoreReady ? `Amethyst Score: ${score.overall}` : 'Amethyst Score unavailable'}
          style={{ '--score-progress': String(score.overall) } as CSSProperties}
        >
          <svg viewBox="0 0 260 140" aria-hidden="true">
            <path className="home-arc__track" d="M 18 124 A 112 112 0 0 1 242 124" pathLength="100" />
            <path className="home-arc__value" d="M 18 124 A 112 112 0 0 1 242 124" pathLength="100" />
          </svg>
          <strong>
            {scorePhase === 'resolved'
              ? <><AnimatedNumber value={score.overall} startAt={0} /><span className="home-arc__heart" aria-hidden="true">♥</span></>
              : '—'}
          </strong>
          <small>Amethyst Score</small>
        </button>

        <div className="home-arc__branches" aria-hidden="true" />

        {/* Sleep / Focus / Rest pills */}
        <div className="home-score-pills">
          <button
            type="button"
            onClick={() => navigate('/score')}
            aria-label={score.sleep == null ? 'Sleep data unavailable' : `Sleep score ${score.sleep}`}
            style={score.sleep == null ? { opacity: 0.45 } as CSSProperties : undefined}
          >
            <span><MetricIcon name="sleep" /></span>
            <strong>{scorePhase === 'resolved' ? (score.sleep ?? '—') : '—'}</strong>
            <small>{score.sleep == null ? 'No data' : 'Sleep'}</small>
          </button>
          <button type="button" onClick={() => navigate('/score')} aria-label={`Focus score ${score.focus}`}>
            <span><MetricIcon name="focus" /></span>
            <strong>{scorePhase === 'resolved' ? score.focus : '—'}</strong>
            <small>Focus</small>
          </button>
          <button type="button" onClick={() => navigate('/score')} aria-label={`Rest score ${score.rest ?? 'unavailable'}`}>
            <span><MetricIcon name="rest" /></span>
            <strong>{scorePhase === 'resolved' ? (score.rest ?? '—') : '—'}</strong>
            <small>Rest</small>
          </button>
        </div>
        </div>
      </section>

      {/* Screen time card */}
      <section className="home-panel home-usage">
        <header>
          <span>Screen time</span>
          <strong>{usageState === 'ready' ? formatMinutes(usage.screenTimeMinutes) : '—'}</strong>
          <small>Today</small>
        </header>
        {usageState === 'permission' && <p className="home-usage__empty">Enable Usage Access in Settings to see today's activity.</p>}
        {usageState === 'error' && <p className="home-usage__empty">Screen-time data could not be read. Try again from Settings.</p>}
        {usageState === 'ready' && apps.length === 0 && <p className="home-usage__empty">No app activity has been recorded for today.</p>}
        {usageState === 'loading' && <p className="home-usage__empty">Reading today's activity…</p>}
        {apps.length > 0 && (
          <div className="home-usage__apps">
            {apps.map((app) => (
              <div className="home-usage__row" key={app.packageName}>
                <AppGlyph label={app.label} iconDataUrl={installedApps.find((i) => i.packageName === app.packageName)?.iconDataUrl} />
                <div>
                  <strong>{app.label}</strong>
                  <span><i style={{ width: `${Math.max(12, Math.min(100, app.minutes / Math.max(1, apps[0]?.minutes ?? 1) * 100))}%` }} /></span>
                </div>
                <small>{formatMinutes(app.minutes)}</small>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Reward card */}
      <section className="home-panel home-first-step amethyst-feature-card">
        <div>
          <strong>First step taken</strong>
          <p>You started. That's the hardest part. Your future self is already thanking you.</p>
        </div>
        <button type="button" onClick={() => navigate('/gems')} aria-label="Open rewards">
          <span>♦</span>
          <strong>{streak}</strong>
        </button>
      </section>
    </main>
  );
}
