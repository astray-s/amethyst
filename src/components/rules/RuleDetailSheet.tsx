import type { ReactNode } from 'react';
import type { InstalledAppInfo } from '../../native/AmethystNativeBridge';
import type { StoredRule } from '../../state/localState';
import { ModalHost } from '../ModalHost';
import { usePresenceClose } from '../usePresenceClose';
import { AppGlyph, classFor } from './AppGlyph';
import { daysLabel, formatRuleTime } from './ruleFormat';

type RuleDetailSheetProps = {
  rule: StoredRule;
  installedApps: InstalledAppInfo[];
  onClose: () => void;
  onSelect: () => void;
  onEdit: () => void;
};

function RowIcon({ children }: { children: ReactNode }) {
  return <span className="amethyst-detail-row__icon amethyst-glow-ring">{children}</span>;
}

export function RuleDetailSheet({ rule, installedApps, onClose, onSelect, onEdit }: RuleDetailSheetProps) {
  const { closing, requestClose } = usePresenceClose(onClose);
  const apps: Array<{ label: string; iconDataUrl?: string }> = [
    ...rule.siteIds.map((label) => ({ label })),
    ...(rule.packageNames ?? []).map((packageName) => ({
      label: installedApps.find((app) => app.packageName === packageName)?.label ?? 'Installed app',
      iconDataUrl: installedApps.find((app) => app.packageName === packageName)?.iconDataUrl,
    })),
  ];
  const websiteCount = (rule.domains ?? []).length;
  const blockSummary = [
    apps.length ? `${apps.length} ${apps.length === 1 ? 'app' : 'apps'}` : null,
    websiteCount ? `${websiteCount} ${websiteCount === 1 ? 'website' : 'websites'}` : null,
  ].filter(Boolean).join(', ') || 'Nothing selected';
  const unblocksSummary = rule.difficulty === 'hard'
    ? 'No exits while active'
    : `${Math.max(0, rule.unblocksPerDay - (rule.unblocksUsedToday ?? 0))} remaining today`;

  return <ModalHost onClose={requestClose}>
    <div className="amethyst-sheet-backdrop" data-motion-state={closing ? 'closing' : 'open'} onPointerDown={(event) => { if (event.target === event.currentTarget) requestClose(); }} role="presentation">
      <section className="amethyst-rule-detail-sheet" role="dialog" aria-modal="true" aria-labelledby="rule-detail-title" onPointerDown={(event) => event.stopPropagation()}>
        <div className="amethyst-sheet-handle" />
        <button className="amethyst-detail-close" onClick={requestClose} aria-label="Close rule details">×</button>
        <div className="amethyst-detail-flow" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="28" height="28"><rect x="3" y="5" width="18" height="16" rx="3" fill="none" stroke="currentColor" strokeWidth="1.5" /><path d="M3 10h18M8 3v4M16 3v4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
          <span>{'>'}</span>
          <svg viewBox="0 0 24 24" width="32" height="32"><path d="M12 3.5 3.5 7.7v8.6L12 20.5l8.5-4.2V7.7Z" fill="var(--amethyst-accent, #a778e7)" fillOpacity=".6" stroke="var(--amethyst-accent, #a778e7)" strokeWidth="1" strokeLinejoin="round" /></svg>
        </div>
        <header className="amethyst-detail-header-center">
          <h2 id="rule-detail-title">{rule.name}</h2>
          <p>{rule.mode === 'allowlist' ? 'Allow' : 'Block'} {apps.slice(0, 3).map((app, i) => <span key={i} className="amethyst-detail-inline-icon"><AppGlyph label={app.label} iconDataUrl={app.iconDataUrl} size="small" /></span>)}</p>
        </header>

        <div className="amethyst-detail-rows">
          <div className="amethyst-detail-row">
            <RowIcon><svg viewBox="0 0 24 24" aria-hidden="true" className="amethyst-glow-icon"><rect x="3.5" y="5" width="17" height="15" rx="3" /><path d="M3.5 9.5h17M8 3v3.5M16 3v3.5" /></svg></RowIcon>
            <span><strong>During this time</strong></span>
            <small>{rule.recurrence === 'always' ? 'All day' : `${formatRuleTime(rule.startMinutes)} – ${formatRuleTime(rule.endMinutes)}`}</small>
          </div>

          {rule.recurrence === 'weekly' && (
            <div className="amethyst-detail-row">
              <RowIcon><svg viewBox="0 0 24 24" aria-hidden="true" className="amethyst-glow-icon"><path d="M4 12h16M4 12a8 8 0 1 1 16 0 8 8 0 0 1-16 0Z" /></svg></RowIcon>
              <span><strong>On these days</strong></span>
              <small>{daysLabel(rule.days)}</small>
            </div>
          )}

          <div className="amethyst-detail-row">
            <RowIcon><svg viewBox="0 0 24 24" aria-hidden="true" className="amethyst-glow-icon"><path d="M12 3.5 3.5 7.7v8.6L12 20.5l8.5-4.2V7.7L12 3.5Z" /></svg></RowIcon>
            <span><strong>{rule.mode === 'allowlist' ? 'Allow' : 'Block'}</strong></span>
            <span className="amethyst-detail-row__value">
              <span className="amethyst-detail-stack">
                {apps.slice(0, 3).map((app, index) => (
                  <span key={`${app.label}-${index}`} className="amethyst-detail-stack__item amethyst-glow-ring" data-app-kind={classFor(app.label)}>
                    <AppGlyph label={app.label} iconDataUrl={app.iconDataUrl} />
                  </span>
                ))}
                {apps.length > 3 && <span className="amethyst-detail-stack__more">+{apps.length - 3}</span>}
              </span>
              <small>{blockSummary}</small>
            </span>
          </div>

          <div className="amethyst-detail-row">
            <RowIcon><svg viewBox="0 0 24 24" aria-hidden="true" className="amethyst-glow-icon"><path d="M12 2v4M12 18v4M4.9 4.9l2.8 2.8M16.3 16.3l2.8 2.8M2 12h4M18 12h4M4.9 19.1l2.8-2.8M16.3 7.7l2.8-2.8" /></svg></RowIcon>
            <span><strong>Breaks allowed</strong></span>
            <small>{rule.difficulty === 'hard' ? 'No' : unblocksSummary}</small>
          </div>
        </div>

        <div className="amethyst-detail-actions amethyst-detail-actions--stacked">
          <button className="amethyst-detail-unblock" onClick={onSelect}>Unblock all apps</button>
          <button className="amethyst-detail-edit-link" onClick={onEdit}>✏ Edit rule</button>
        </div>
      </section>
    </div>
  </ModalHost>;
}
