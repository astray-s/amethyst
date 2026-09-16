import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './ProfileScreen.css';
import { AmethystBlocker } from '../native/AmethystNativeBridge';
import { normalizeUsageStats } from '../native/usageStats';
import { profileStore, sessionHistoryStore } from '../state/localState';

interface DailyUsagePoint {
  label: string;
  minutes: number | null;
}

function localDayRange(daysAgo: number) {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - daysAgo);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { startEpoch: start.getTime(), endEpoch: end.getTime(), date: start };
}

function formatMinutes(minutes: number) {
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return remainder ? `${hours}h ${remainder}m` : `${hours}h`;
}

export function ProfileScreen() {
  const navigate = useNavigate();
  const profile = profileStore.get();
  const history = sessionHistoryStore.getAll().filter((entry) => entry.completed);
  const totalFocusMinutes = history.reduce((total, entry) => total + entry.durationMinutes, 0);
  const focusHours = totalFocusMinutes < 60 ? (totalFocusMinutes / 60).toFixed(1) : Math.round(totalFocusMinutes / 60).toString();
  const [usage, setUsage] = useState<DailyUsagePoint[]>([]);

  useEffect(() => {
    let cancelled = false;
    const ranges = Array.from({ length: 14 }, (_, index) => localDayRange(13 - index));
    void Promise.all(ranges.map(async ({ startEpoch, endEpoch, date }) => {
      try {
        const result = normalizeUsageStats(
          await AmethystBlocker.getUsageStats({ startEpoch, endEpoch }),
        );
        const available = result.available !== false
          && result.usageAccessGranted !== false
          && result.screenTimeReliable !== false;
        return {
          label: date.toLocaleDateString([], { month: 'short', day: 'numeric' }),
          minutes: available ? Math.min(24 * 60, result.screenTimeMinutes) : null,
        };
      } catch {
        return {
          label: date.toLocaleDateString([], { month: 'short', day: 'numeric' }),
          minutes: null,
        };
      }
    })).then((points) => {
      if (!cancelled) setUsage(points);
    });
    return () => { cancelled = true; };
  }, []);

  const graph = useMemo(() => {
    const available = usage.filter((point) => point.minutes != null);
    if (available.length === 0) return null;
    const dailyMaxMinutes = 24 * 60;
    const graphW = 300;
    const graphH = 176;
    const padL = 38;
    const padR = 38;
    const padT = 10;
    const padB = 24;
    const plotW = graphW - padL - padR;
    const plotH = graphH - padT - padB;
    const slotWidth = plotW / usage.length;
    const barWidth = Math.min(12, slotWidth * 0.62);
    const baseline = padT + plotH;
    const bars = usage.map((point, index) => {
      const x = padL + index * slotWidth + (slotWidth - barWidth) / 2;
      if (point.minutes == null) {
        return { ...point, x, width: barWidth, y: baseline, height: 0, available: false };
      }
      const value = Math.min(dailyMaxMinutes, Math.max(0, point.minutes));
      const scaledHeight = value / dailyMaxMinutes * plotH;
      const height = value === 0 ? 2.5 : Math.max(3, scaledHeight);
      return {
        ...point,
        x,
        width: barWidth,
        y: baseline - height,
        height,
        available: true,
      };
    });
    const average = Math.round(available.reduce((sum, point) => sum + (point.minutes ?? 0), 0) / available.length);
    const averageY = baseline - average / dailyMaxMinutes * plotH;
    const yTicks = [0, 6 * 60, 12 * 60, 18 * 60, dailyMaxMinutes].map((minutes) => {
      const label = minutes === 0 ? '0' : formatMinutes(minutes);
      const y = baseline - minutes / dailyMaxMinutes * plotH;
      return { label, y };
    });
    const xLabelIndices = [0, 3, 6, 9, usage.length - 1];
    const xLabels = xLabelIndices.map((index) => ({
      label: usage[index].label,
      x: padL + (index + 0.5) * slotWidth,
    }));
    return {
      average,
      averageY,
      bars,
      baseline,
      count: available.length,
      missingCount: usage.length - available.length,
      yTicks,
      xLabels,
      graphW,
      graphH,
      padL,
      plotW,
    };
  }, [usage]);

  const remainingDays = Math.max(0, 14 - (graph?.count ?? 0));

  return <main className="amethyst-profile">
    <header className="amethyst-profile__header">
      <button className="amethyst-profile__back-btn" onClick={() => navigate('/home')} aria-label="Back home">
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 19l-7-7 7-7" /></svg>
      </button>
      <button className="amethyst-profile__settings-btn" onClick={() => navigate('/settings')} aria-label="Open settings">
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" /><circle cx="12" cy="12" r="3" /></svg>
      </button>
    </header>

    <section className="amethyst-profile__identity">
      <div className="amethyst-profile__badge">
        <svg viewBox="0 0 140 140" width="120" height="120" aria-hidden="true">
          <defs>

            <radialGradient id="badge-person-bg" cx="50%" cy="50%">
              <stop offset="0%" stopColor="#c4b3e0" />
              <stop offset="100%" stopColor="#8a7aaa" />
            </radialGradient>
            <filter id="badge-glow">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
          </defs>
          {/* Laurel wreath — left branch */}
          <g opacity=".55" fill="none" stroke="#8a9e8f" strokeWidth="1" strokeLinecap="round">
            <path d="M38 100 C32 88 28 74 30 58" />
            <path d="M30 58 C26 62 22 68 24 76" /><path d="M30 62 C26 56 24 48 28 42" />
            <path d="M30 68 C24 72 20 78 22 86" /><path d="M32 72 C26 66 24 58 28 50" />
            <path d="M34 80 C28 76 24 68 27 60" /><path d="M34 84 C28 88 26 94 30 100" />
            <path d="M36 90 C30 86 28 80 30 72" /><path d="M36 94 C32 98 32 104 36 108" />
          </g>
          {/* Laurel wreath — right branch (mirrored) */}
          <g opacity=".55" fill="none" stroke="#8a9e8f" strokeWidth="1" strokeLinecap="round">
            <path d="M102 100 C108 88 112 74 110 58" />
            <path d="M110 58 C114 62 118 68 116 76" /><path d="M110 62 C114 56 116 48 112 42" />
            <path d="M110 68 C116 72 120 78 118 86" /><path d="M108 72 C114 66 116 58 112 50" />
            <path d="M106 80 C112 76 116 68 113 60" /><path d="M106 84 C112 88 114 94 110 100" />
            <path d="M104 90 C110 86 112 80 110 72" /><path d="M104 94 C108 98 108 104 104 108" />
          </g>
          {/* Outer circle */}
          <circle cx="70" cy="70" r="42" fill="none" stroke="rgba(138,158,143,.3)" strokeWidth="0.8" />

          {/* Inner person icon circle with a calm teal tint. */}
          <circle cx="70" cy="64" r="22" fill="url(#badge-person-bg)" opacity=".9" filter="url(#badge-glow)" />
          {/* Person silhouette */}
          <g fill="#3a4a3e">
            <circle cx="70" cy="58" r="7" />
            <path d="M56 78 a14 12 0 0 1 28 0" />
          </g>
        </svg>
      </div>
      <h1>{profile.displayName}</h1>
    </section>

    <section className="amethyst-profile__stats-row">
      <div className="amethyst-profile__stat">
        <span className="amethyst-profile__stat-icon is-focus">
          <svg viewBox="0 0 48 48" width="44" height="44">
            <defs>
              <linearGradient id="hg-body" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#a8d5ba" />
                <stop offset="100%" stopColor="#5a8a6a" />
              </linearGradient>
              <linearGradient id="hg-sand" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#d4c89a" />
                <stop offset="100%" stopColor="#b8a878" />
              </linearGradient>
              <filter id="hg-glow"><feGaussianBlur stdDeviation="2.5" /><feComposite in="SourceGraphic" /></filter>
            </defs>
            <g filter="url(#hg-glow)">
              <rect x="13" y="5" width="22" height="4" rx="2" fill="url(#hg-body)" />
              <rect x="13" y="39" width="22" height="4" rx="2" fill="url(#hg-body)" />
              <path d="M15 9 C15 18 18 22 24 24 C18 26 15 30 15 39" fill="none" stroke="url(#hg-body)" strokeWidth="2.5" strokeLinecap="round" />
              <path d="M33 9 C33 18 30 22 24 24 C30 26 33 30 33 39" fill="none" stroke="url(#hg-body)" strokeWidth="2.5" strokeLinecap="round" />
              <path d="M20 34 Q24 28 28 34 L28 38 L20 38 Z" fill="url(#hg-sand)" opacity=".8" />
              <path d="M20 10 L28 10 L28 14 Q24 20 20 14 Z" fill="url(#hg-sand)" opacity=".5" />
              <line x1="24" y1="24" x2="24" y2="30" stroke="#d4c89a" strokeWidth="1" opacity=".6" />
            </g>
          </svg>
        </span>
        <strong>{focusHours}</strong>
        <small>FOCUS HOURS</small>
      </div>
      <div className="amethyst-profile__stat-divider" />
      <div className="amethyst-profile__stat">
        <span className="amethyst-profile__stat-icon is-streak">
          <svg viewBox="0 0 48 48" width="44" height="44">
            <defs>
              <linearGradient id="flame-outer" x1=".5" y1="0" x2=".5" y2="1">
                <stop offset="0%" stopColor="#ff9d3a" />
                <stop offset="50%" stopColor="#ff7a1a" />
                <stop offset="100%" stopColor="#e85a10" />
              </linearGradient>
              <linearGradient id="flame-inner" x1=".5" y1="0" x2=".5" y2="1">
                <stop offset="0%" stopColor="#ffe566" />
                <stop offset="100%" stopColor="#ffb830" />
              </linearGradient>
              <filter id="flame-glow"><feGaussianBlur stdDeviation="3" /><feComposite in="SourceGraphic" /></filter>
            </defs>
            <g filter="url(#flame-glow)">
              <path d="M24 4 C25 12 20 16 18 20 C15 25 14 30 14 34 a10 10 0 0 0 20 0 C34 30 32 24 28 20 C29 24 27 27 25 28 C26 22 28 14 24 4Z" fill="url(#flame-outer)" />
              <path d="M24 18 C24 24 20 28 20 32 a4.5 4.5 0 0 0 9 0 C29 28 26 24 24 18Z" fill="url(#flame-inner)" opacity=".85" />
              <ellipse cx="24" cy="42" rx="8" ry="2" fill="#ff7a1a" opacity=".3" />
            </g>
          </svg>
        </span>
        <strong>{profile.streak}</strong>
        <small>DAY STREAK</small>
      </div>
    </section>

    <section className="amethyst-profile__journey">
      <div className="amethyst-profile__journey-header">
        <span>AVG SCREEN TIME</span>
      </div>
      <p className="amethyst-profile__journey-desc">{graph
        ? <>Your {graph.count}-day average is <b>{formatMinutes(graph.average)}</b>.</>
        : <>Your journey starts with your first two full weeks. Check back in <b>{remainingDays || 14} days</b>.</>}</p>
      <div className="amethyst-profile__chart">
        <svg
          viewBox={`0 0 ${graph?.graphW ?? 300} ${graph?.graphH ?? 176}`}
          role="img"
          aria-label={graph ? `Daily screen time for the last 14 days. Average ${formatMinutes(graph.average)}.` : 'Daily screen time chart awaiting data.'}
        >
          <defs>
            <linearGradient id="profile-chart-bar" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#c9b8ff" />
              <stop offset="1" stopColor="#7653b7" />
            </linearGradient>
          </defs>
          {graph?.yTicks.map((tick, i) => (
            <g key={i}>
              <line className="amethyst-profile__grid-line" x1={graph.padL} y1={tick.y} x2={graph.padL + graph.plotW} y2={tick.y} />
              <text className="amethyst-profile__tick-label" x={graph.padL - 5} y={tick.y + 3} textAnchor="end">{tick.label}</text>
            </g>
          ))}
          {graph && <>
            <line
              className="amethyst-profile__average-line"
              x1={graph.padL}
              y1={graph.averageY}
              x2={graph.padL + graph.plotW}
              y2={graph.averageY}
            />
            {graph.bars.map((bar, index) => (
              <g
                key={`${bar.label}-${index}`}
                data-usage-day={bar.label}
                data-available={bar.available}
              >
                <title>{bar.available ? `${bar.label}: ${formatMinutes(bar.minutes ?? 0)}` : `${bar.label}: unavailable`}</title>
                {bar.available
                  ? <rect
                      className={`amethyst-profile__bar${index === graph.bars.length - 1 ? ' is-today' : ''}`}
                      x={bar.x}
                      y={bar.y}
                      width={bar.width}
                      height={bar.height}
                      rx={bar.width / 2}
                    />
                  : <circle
                      className="amethyst-profile__missing-day"
                      cx={bar.x + bar.width / 2}
                      cy={graph.baseline - 1.5}
                      r="2.25"
                    />}
              </g>
            ))}
            {graph.xLabels.map(({ label, x }) => (
              <text className="amethyst-profile__date-label" key={label} x={x} y={graph.graphH - 5} textAnchor="middle">{label}</text>
            ))}
          </>}
        </svg>
        {graph && graph.missingCount > 0 && <p className="amethyst-profile__chart-note">
          <span aria-hidden="true" /> Unavailable Android data
        </p>}
      </div>
    </section>


  </main>;
}
