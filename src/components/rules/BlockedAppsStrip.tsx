import type { InstalledAppInfo } from '../../native/AmethystNativeBridge';
import { AppGlyph, classFor } from './AppGlyph';

function BlockedLockGlyph() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="5.5" y="10" width="13" height="10" rx="2.5" />
      <path d="M8.5 10V7.5a3.5 3.5 0 0 1 7 0V10" />
      <path d="M12 14v2.5" />
    </svg>
  );
}

export type BlockedAppEntry = {
  id: string;
  label: string;
};

type BlockedAppsStripProps = {
  apps: BlockedAppEntry[];
  installedApps: InstalledAppInfo[];
  onAppPress: (entry: BlockedAppEntry) => void;
};

export function BlockedAppsStrip({ apps, installedApps, onAppPress }: BlockedAppsStripProps) {
  return (
    <section className="blocked-apps-strip" aria-labelledby="blocked-apps-title">
      <div className="blocked-apps-strip__heading">
        <span className="blocked-apps-strip__lock" aria-hidden="true"><svg viewBox="0 0 24 24" style={{width:18,height:18,fill:'none',stroke:'currentColor',strokeWidth:2,strokeLinecap:'round',strokeLinejoin:'round'}}><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></svg></span>
        <h2 id="blocked-apps-title">Blocked apps</h2>
      </div>
      <div className="blocked-apps-strip__rail">
        {apps.map((entry, index) => {
          const app = installedApps.find((candidate) => candidate.label === entry.label);
          return (
            <button key={`${entry.id}-${index}`} className="blocked-app-chip" onClick={() => onAppPress(entry)} aria-label={`Open ${entry.label} block details`}>
              <span className="blocked-app-chip__icon" data-app-kind={classFor(entry.label)}>
                <AppGlyph label={entry.label} iconDataUrl={app?.iconDataUrl} />
                <span className="blocked-app-chip__lock"><BlockedLockGlyph /></span>
              </span>
              <strong>{entry.label}</strong>
              <small>{index === 0 ? 'Unblock' : 'Blocked'}</small>
            </button>
          );
        })}
      </div>
    </section>
  );
}
