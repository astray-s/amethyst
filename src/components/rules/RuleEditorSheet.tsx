import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { BLOCKLIST_CATALOG } from '../../data/blocklistCatalog';
import type { InstalledAppInfo } from '../../native/AmethystNativeBridge';
import type { StoredRule } from '../../state/localState';
import { ModalHost } from '../ModalHost';
import { usePresenceClose } from '../usePresenceClose';
import { AppGlyph } from './AppGlyph';
import { daysLabel, formatRuleTime } from './ruleFormat';

const QUICK_SITES = ['instagram', 'tiktok', 'youtube', 'facebook', 'x', 'reddit', 'discord', 'netflix']
  .map((id) => BLOCKLIST_CATALOG.find((site) => site.id === id))
  .filter((site): site is NonNullable<typeof site> => Boolean(site));
const WEEKDAYS = [{ label: 'S', value: 0 }, { label: 'M', value: 1 }, { label: 'T', value: 2 }, { label: 'W', value: 3 }, { label: 'T', value: 4 }, { label: 'F', value: 5 }, { label: 'S', value: 6 }];

type EditorSection = 'apps' | 'when' | 'unblocks';

type RuleEditorSheetProps = {
  initial?: StoredRule;
  installedApps: InstalledAppInfo[];
  onSave: (rule: StoredRule) => void;
  onDelete?: () => void;
  onClose: () => void;
};

function minutesToTime(value: number | undefined) {
  const minutes = value ?? 0;
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
}

function timeToMinutes(value: string) {
  const [hours, minutes] = value.split(':').map(Number);
  return Math.min(1439, Math.max(0, hours * 60 + minutes));
}

function epochToLocalInput(value: number | undefined) {
  if (!value) return '';
  const date = new Date(value);
  const offsetMs = date.getTimezoneOffset() * 60_000;
  return new Date(value - offsetMs).toISOString().slice(0, 16);
}

function localInputToEpoch(value: string) {
  const epoch = new Date(value).getTime();
  return Number.isFinite(epoch) ? epoch : 0;
}

function AppsRowIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true" className="amethyst-glow-icon"><path d="M12 3.5 3.5 7.7v8.6L12 20.5l8.5-4.2V7.7L12 3.5Z" /></svg>;
}

function WhenRowIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true" className="amethyst-glow-icon"><rect x="3.5" y="5" width="17" height="15" rx="3" /><path d="M3.5 9.5h17M8 3v3.5M16 3v3.5" /></svg>;
}

function UnblocksRowIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true" className="amethyst-glow-icon"><path d="M12 2v4M12 18v4M4.9 4.9l2.8 2.8M16.3 16.3l2.8 2.8M2 12h4M18 12h4M4.9 19.1l2.8-2.8M16.3 7.7l2.8-2.8" /></svg>;
}

function ChevronIcon({ open }: { open: boolean }) {
  /* Item 8: Restyle schedule arrow — smooth animated chevron */
  return <svg viewBox="0 0 24 24" aria-hidden="true" className={`amethyst-editor-row__chevron ${open ? 'is-open' : ''}`}><path d="m9 11 3 3 3-3" /></svg>;
}

function EditorRow({ icon, label, value, expanded, onToggle, children }: {
  icon: ReactNode;
  label: string;
  value: string;
  expanded: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <section className="amethyst-editor-row">
      <button type="button" className="amethyst-editor-row__header" onClick={onToggle} aria-expanded={expanded}>
        <span className="amethyst-editor-row__icon amethyst-glow-ring">{icon}</span>
        <span className="amethyst-editor-row__label">{label}</span>
        <span className="amethyst-editor-row__value">{value}</span>
        <ChevronIcon open={expanded} />
      </button>
      {expanded && <div className="amethyst-editor-row__body">{children}</div>}
    </section>
  );
}

export function RuleEditorSheet({ initial, installedApps, onSave, onDelete, onClose }: RuleEditorSheetProps) {
  const [draft, setDraft] = useState(initial);
  const [ruleDomainDraft, setRuleDomainDraft] = useState('');
  const [expanded, setExpanded] = useState<EditorSection | null>(null);
  const { closing, requestClose } = usePresenceClose(onClose);
  const selectedSiteNames = useMemo(() => (draft?.siteIds ?? []).map((id) => BLOCKLIST_CATALOG.find((site) => site.id === id)?.name ?? id), [draft?.siteIds]);

  useEffect(() => {
    setDraft(initial);
  }, [initial]);

  if (!draft) return null;

  function toggleSection(section: EditorSection) {
    setExpanded((current) => current === section ? null : section);
  }

  function toggleSite(siteId: string) {
    setDraft((current) => current && ({
      ...current,
      siteIds: current.siteIds.includes(siteId) ? current.siteIds.filter((id) => id !== siteId) : [...current.siteIds, siteId],
    }));
  }

  function toggleApp(packageName: string) {
    setDraft((current) => {
      if (!current) return current;
      const selected = current.packageNames ?? [];
      return { ...current, packageNames: selected.includes(packageName) ? selected.filter((item) => item !== packageName) : [...selected, packageName] };
    });
  }

  function addDomain() {
    const normalized = ruleDomainDraft
      .trim()
      .toLowerCase()
      .replace(/^https?:\/\//, '')
      .split(/[/?#]/)[0]
      .replace(/^www\./, '');
    if (!normalized || !normalized.includes('.')) return;
    setDraft((current) => current && ({
      ...current,
      domains: [...new Set([...(current.domains ?? []), normalized])],
    }));
    setRuleDomainDraft('');
  }

  const oneOffValid = draft.recurrence !== 'oneOff'
    || Boolean(draft.oneOffStart && draft.oneOffEnd && draft.oneOffEnd > draft.oneOffStart);
  const canSave = Boolean(
    draft.name.trim()
      && (draft.siteIds.length || draft.packageNames?.length || draft.domains?.length)
      && oneOffValid
  );

  const appsChosen = selectedSiteNames.length + (draft.packageNames?.length ?? 0) + (draft.domains?.length ?? 0);
  const appsValue = `${appsChosen} chosen`;
  const whenValue = draft.recurrence === 'always'
    ? 'All day'
    : draft.recurrence === 'oneOff'
      ? 'One-time'
      : `${daysLabel(draft.days)} · ${formatRuleTime(draft.startMinutes)}–${formatRuleTime(draft.endMinutes)}`;
  const unblocksValue = draft.difficulty === 'hard' ? 'Strict' : `Gentle · ${draft.unblocksPerDay}/day`;

  return <ModalHost onClose={requestClose}>
    <div className="amethyst-sheet-backdrop amethyst-editor-backdrop" data-motion-state={closing ? 'closing' : 'open'} role="presentation" onPointerDown={(event) => { if (event.target === event.currentTarget) requestClose(); }}>
      <section className="amethyst-rule-editor-sheet" role="dialog" aria-modal="true" aria-labelledby="rule-editor-title" onPointerDown={(event) => event.stopPropagation()}>
        <div className="amethyst-sheet-handle" />
        <header>
          <button onClick={requestClose} aria-label="Close rule editor">×</button>
          <div><p>{onDelete ? 'EDIT RULE' : 'NEW RULE'}</p><h2 id="rule-editor-title">{draft.name || 'Untitled rule'}</h2></div>
          <button className="amethyst-editor-save-top" onClick={() => canSave && onSave(draft)} disabled={!canSave}>Save</button>
        </header>

        <label className="amethyst-editor-field">
          <span>RULE NAME</span>
          <input value={draft.name} maxLength={32} onChange={(event) => setDraft({ ...draft, name: event.target.value })} />
        </label>
        <label className="amethyst-settings-row amethyst-settings-toggle">
          <span className="amethyst-settings-icon"><svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3.5 3.5 7.7v8.6L12 20.5l8.5-4.2V7.7L12 3.5Z" /><path d="m8.5 12 2.3 2.3 4.7-4.7" /></svg></span>
          <div><strong>Rule enabled</strong><small>Apply this rule automatically</small></div>
          <input type="checkbox" checked={draft.enabled} onChange={() => setDraft({ ...draft, enabled: !draft.enabled })} />
          <i />
        </label>

        <div className="amethyst-editor-segment amethyst-editor-mode">
          <button className={draft.mode === 'blocklist' ? 'is-selected' : ''} onClick={() => setDraft({ ...draft, mode: 'blocklist' })}>Block</button>
          <button className={draft.mode === 'allowlist' ? 'is-selected' : ''} onClick={() => setDraft({ ...draft, mode: 'allowlist' })}>Allow only</button>
        </div>

        <div className="amethyst-editor-rows">
          <EditorRow icon={<AppsRowIcon />} label="Apps and sites" value={appsValue} expanded={expanded === 'apps'} onToggle={() => toggleSection('apps')}>
            <div className="amethyst-site-choice-list">
              {QUICK_SITES.map((site) => <button key={site.id} className={draft.siteIds.includes(site.id) ? 'is-selected' : ''} onClick={() => toggleSite(site.id)}><AppGlyph label={site.name} /><span>{site.name}</span><i>{draft.siteIds.includes(site.id) ? '✓' : '+'}</i></button>)}
            </div>
            {installedApps.length > 0 && (
              <div className="amethyst-installed-list">
                <p>INSTALLED ON THIS DEVICE</p>
                {installedApps.slice(0, 12).map((app) => {
                  const chosen = draft.packageNames?.includes(app.packageName);
                  return <button key={app.packageName} onClick={() => toggleApp(app.packageName)}><AppGlyph label={app.label} iconDataUrl={app.iconDataUrl} /><span>{app.label}</span><i className={chosen ? 'is-selected' : ''}>{chosen ? '✓' : '+'}</i></button>;
                })}
              </div>
            )}
            {/* Item 9: Styled custom websites input */}
            <div className="amethyst-domain-editor">
              <strong>Custom websites</strong>
              <div className="amethyst-domain-editor__row">
                <input
                  className="amethyst-domain-editor__input"
                  value={ruleDomainDraft}
                  placeholder="example.com"
                  inputMode="url"
                  onChange={(event) => setRuleDomainDraft(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') addDomain();
                  }}
                />
                <button className="amethyst-domain-editor__add" type="button" onClick={addDomain}>Add</button>
              </div>
              <ul className="amethyst-domain-editor__list">
                {(draft.domains ?? []).map((domain) => (
                  <li key={domain}>
                    <span>{domain}</span>
                    <button type="button" onClick={() => setDraft({ ...draft, domains: (draft.domains ?? []).filter((item) => item !== domain) })} aria-label={`Remove ${domain}`}>×</button>
                  </li>
                ))}
              </ul>
            </div>
          </EditorRow>

          <EditorRow icon={<WhenRowIcon />} label="When" value={whenValue} expanded={expanded === 'when'} onToggle={() => toggleSection('when')}>
            {/* Item 10: Use overflow-safe segment for one-time */}
            <div className="amethyst-editor-segment amethyst-editor-segment--when">
              <button className={draft.recurrence === 'always' ? 'is-selected' : ''} onClick={() => setDraft({ ...draft, recurrence: 'always' })}>All day</button>
              <button className={draft.recurrence === 'weekly' ? 'is-selected' : ''} onClick={() => setDraft({ ...draft, recurrence: 'weekly', days: draft.days ?? [0, 1, 2, 3, 4, 5, 6], startMinutes: draft.startMinutes ?? 9 * 60, endMinutes: draft.endMinutes ?? 17 * 60 })}>Schedule</button>
              <button
                className={draft.recurrence === 'oneOff' ? 'is-selected' : ''}
                onClick={() => {
                  const start = Date.now() + 5 * 60_000;
                  setDraft({
                    ...draft,
                    recurrence: 'oneOff',
                    oneOffStart: draft.oneOffStart ?? start,
                    oneOffEnd: draft.oneOffEnd ?? start + 60 * 60_000,
                  });
                }}
              >
                One-time
              </button>
            </div>
            {draft.recurrence === 'weekly' && <>
              <div className="amethyst-time-inputs">
                <label><span>START</span><input type="time" value={minutesToTime(draft.startMinutes)} onChange={(event) => setDraft({ ...draft, startMinutes: timeToMinutes(event.target.value) })} /></label>
                <label><span>END</span><input type="time" value={minutesToTime(draft.endMinutes)} onChange={(event) => setDraft({ ...draft, endMinutes: timeToMinutes(event.target.value) })} /></label>
              </div>
              <div className="amethyst-weekdays">
                {WEEKDAYS.map((day) => {
                  const selected = draft.days?.includes(day.value);
                  return <button key={`${day.label}-${day.value}`} className={selected ? 'is-selected' : ''} aria-pressed={selected} onClick={() => setDraft((current) => current && ({ ...current, days: selected ? current.days?.filter((value) => value !== day.value) : [...(current.days ?? []), day.value] }))}>{day.label}</button>;
                })}
              </div>
            </>}
            {/* Item 10: One-off inputs with overflow containment */}
            {draft.recurrence === 'oneOff' && (
              <div className="amethyst-time-inputs amethyst-time-inputs--oneoff">
                <label><span>START</span><input type="datetime-local" value={epochToLocalInput(draft.oneOffStart)} onChange={(event) => setDraft({ ...draft, oneOffStart: localInputToEpoch(event.target.value) })} /></label>
                <label><span>END</span><input type="datetime-local" value={epochToLocalInput(draft.oneOffEnd)} onChange={(event) => setDraft({ ...draft, oneOffEnd: localInputToEpoch(event.target.value) })} /></label>
              </div>
            )}
          </EditorRow>

          <EditorRow icon={<UnblocksRowIcon />} label="Unblocks" value={unblocksValue} expanded={expanded === 'unblocks'} onToggle={() => toggleSection('unblocks')}>
            <div className="amethyst-choice-cards">
              <button className={draft.difficulty === 'easy' ? 'is-selected' : ''} onClick={() => setDraft({ ...draft, difficulty: 'easy', unblocksPerDay: Math.max(1, draft.unblocksPerDay) })}><b>Gentle</b><small>Keep a few conscious exits</small></button>
              <button className={draft.difficulty === 'hard' ? 'is-selected' : ''} onClick={() => setDraft({ ...draft, difficulty: 'hard', unblocksPerDay: 0 })}><b>Strict</b><small>No exits while active</small></button>
            </div>
            {/* Item 11: Added spacing between pauses stepper and Gentle/Strict buttons */}
            {draft.difficulty === 'easy' && (
              <label className="amethyst-editor-field amethyst-pauses-field">
                <span>5-MINUTE PAUSES PER DAY</span>
                <input
                  type="number"
                  min="1"
                  max="20"
                  value={draft.unblocksPerDay}
                  onChange={(event) => setDraft({
                    ...draft,
                    unblocksPerDay: Math.max(1, Math.min(20, Number(event.target.value) || 1)),
                  })}
                />
              </label>
            )}
          </EditorRow>
        </div>

        <footer>
          {onDelete && <button className="amethyst-editor-delete" onClick={onDelete}>Delete rule</button>}
          <button className="amethyst-editor-save" onClick={() => canSave && onSave(draft)} disabled={!canSave}>{onDelete ? 'Save changes' : 'Create rule'}</button>
        </footer>
      </section>
    </div>
  </ModalHost>;
}
