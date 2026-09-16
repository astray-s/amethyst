import type { CSSProperties } from 'react';
import { useNavigate } from 'react-router-dom';
import { GEMS_CATALOG, type GemDef } from '../data/gemsCatalog';
import { gemsStore, streakStore } from '../state/localState';
import './GemsScreen.css';

function GemCard({ gem, unlocked, index }: { gem: GemDef; unlocked: boolean; index: number }) {
  const style = {
    '--gem-primary': gem.palette[0],
    '--gem-secondary': gem.palette[1],
    '--gem-index': index,
  } as CSSProperties;
  return (
    <article className={`gem-card gem-card--${index % 5} ${unlocked ? 'is-unlocked' : ''}`} style={style}>
      <div className="gem-card__art" aria-hidden="true">
        <span className="gem-card__aura" />
        <img src={gem.image ?? "/gems/amethyst-star.png"} alt="" />
        {!unlocked && <span className="gem-card__locked">🔒</span>}
      </div>
      <div className="gem-card__copy">
        <strong>{gem.name}</strong>
        <small>{unlocked ? 'Collected' : gem.streakThreshold ? `${gem.streakThreshold} day streak` : 'Seasonal'}</small>
      </div>
    </article>
  );
}

export function GemsScreen() {
  const navigate = useNavigate();
  const streak = streakStore.get();
  const unlocked = gemsStore.getUnlocked();
  const milestones = GEMS_CATALOG.filter((gem) => gem.kind === 'milestone').sort((a, b) => (a.streakThreshold ?? 0) - (b.streakThreshold ?? 0));
  const seasonal = GEMS_CATALOG.filter((gem) => gem.kind === 'seasonal');
  const nextMilestone = milestones.find((gem) => (gem.streakThreshold ?? 0) > streak) ?? milestones.at(-1)!;
  const featured = [...milestones].reverse().find((gem) => unlocked.includes(gem.id)) ?? nextMilestone;
  const nextThreshold = nextMilestone.streakThreshold ?? streak;
  const previousThreshold = milestones
    .filter((gem) => (gem.streakThreshold ?? 0) <= streak)
    .at(-1)?.streakThreshold ?? 0;
  const progress = nextThreshold === previousThreshold
    ? 100
    : Math.max(0, Math.min(100, ((streak - previousThreshold) / (nextThreshold - previousThreshold)) * 100));

  return (
    <main className="gems-screen gems-screen--constellation">
      <header className="gems-header">
        <button type="button" onClick={() => navigate(-1)} aria-label="Back">‹</button>
        <div>
          <h1>Gems</h1>
          <p>Your focus collection</p>
        </div>
        <span className="gems-header__counter">
          <span className="gems-header__counter-pill">◈ {unlocked.length} of {GEMS_CATALOG.length}</span>
          <span className="gems-header__counter-bar"><i style={{ width: `${(unlocked.length / Math.max(1, GEMS_CATALOG.length)) * 100}%` } as CSSProperties} /></span>
        </span>
      </header>

      <section className="gems-vault" aria-label={`Featured gem: ${featured.name}`}>
        <div className="gems-vault__stars" aria-hidden="true" />
        {milestones.slice(0, 5).map((gem, index) => (
          <span
            key={gem.id}
            className={`gems-vault__orbit gems-vault__orbit--${index + 1}`}
            style={{ '--orbit-color': gem.palette[index % 2] } as CSSProperties}
            aria-hidden="true"
          >
            <img src={gem.image ?? "/gems/amethyst-star.png"} alt="" />
          </span>
        ))}
        <div className="gems-vault__featured">
          <span className="gems-vault__glow" aria-hidden="true" />
          <img src={featured.image ?? "/gems/amethyst-star.png"} alt="" />
          <small>{unlocked.includes(featured.id) ? 'Latest gem' : 'Next gem'}</small>
          <strong>{featured.name}</strong>
        </div>
      </section>

      <section className="gem-streak gem-streak--energised">
        <div className="gem-streak__hero">
          <span className="gem-streak__flame" aria-hidden="true">🔥</span>
          <strong className="gem-streak__number">{streak}</strong>
          <small className="gem-streak__label">{streak === 0 ? 'Start your streak today' : streak === 1 ? 'day in a row' : 'days in a row'}</small>
        </div>
        <div className="gem-streak__next">
          <small>{Math.max(0, nextThreshold - streak)} days to {nextMilestone.name}</small>
          <span><i style={{ '--streak-progress': `${progress}%` } as CSSProperties} /></span>
        </div>
      </section>

      <section className="gems-section">
        <header><div><small>YOUR JOURNEY</small><h2>Milestones</h2></div><span>{unlocked.filter((id) => milestones.some((gem) => gem.id === id)).length} collected</span></header>
        <div className="gems-grid">{milestones.map((gem, index) => <GemCard key={gem.id} gem={gem} index={index} unlocked={unlocked.includes(gem.id)} />)}</div>
      </section>
      <section className="gems-section">
        <header><div><small>LIMITED COLLECTION</small><h2>Seasonal</h2></div></header>
        <div className="gems-grid">{seasonal.map((gem, index) => <GemCard key={gem.id} gem={gem} index={index + milestones.length} unlocked={unlocked.includes(gem.id)} />)}</div>
      </section>
    </main>
  );
}
