import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import './SettingsScreen.css';
import {
  AmethystBlocker,
} from '../native/AmethystNativeBridge';
import { AMETHYST_STATE_KEY } from '../state/amethystState';
import { emergencyStore, settingsStore } from '../state/localState';

type PermissionKey = 'usage' | 'accessibility' | 'notifications' | 'schedule';
type IconName = 'bell' | 'sound' | 'permissions' | 'download' | 'reset' | 'info' | 'clock' | 'shield';

interface SettingsScreenProps { onBack?: () => void }

const DETAILS: Record<PermissionKey, { title: string; detail: string; icon: IconName; request: () => Promise<{ granted: boolean; available?: boolean }> }> = {
  usage: { title: 'Usage access', detail: 'Lets Amethyst reflect your screen-time rhythm.', icon: 'clock', request: () => AmethystBlocker.requestUsagePermission() },
  accessibility: { title: 'Blocking service', detail: 'Closes protected apps during active blocks.', icon: 'shield', request: () => AmethystBlocker.requestAccessibilityPermission() },
  notifications: { title: 'Gentle nudges', detail: 'Keeps a quiet intention close when a session ends.', icon: 'bell', request: () => AmethystBlocker.requestNotificationPermission() },
  schedule: { title: 'Exact schedules', detail: 'Lets Android start and end rules at the intended minute.', icon: 'clock', request: () => AmethystBlocker.requestExactAlarmPermission() },
};

function SettingsIcon({ name }: { name: IconName }) {
  const paths: Record<IconName, ReactNode> = {
    bell: <><path d="M7 17h10l-1.4-1.8V11a3.6 3.6 0 0 0-7.2 0v4.2L7 17Z" /><path d="M10.5 19a1.8 1.8 0 0 0 3 0" /></>,
    sound: <><path d="M5 10v4h3l4 3V7L8 10H5Z" /><path d="M15 9.2a4 4 0 0 1 0 5.6M17.5 7a7 7 0 0 1 0 10" /></>,
    permissions: <><rect x="4.5" y="8" width="15" height="8" rx="4" /><circle cx="15.5" cy="12" r="2.3" /></>,
    download: <><path d="M12 4v10M8.5 10.5 12 14l3.5-3.5" /><path d="M5 18h14" /></>,
    reset: <><path d="M5.5 8.5A7 7 0 1 1 5 15" /><path d="M5.5 4v4.5H10" /></>,
    info: <><circle cx="12" cy="12" r="8" /><path d="M12 10.5V16M12 7.5h.01" /></>,
    clock: <><circle cx="12" cy="12" r="8" /><path d="M12 7v5h4" /></>,
    shield: <path d="M12 4 18 6.5v4.8c0 4-2.4 6.7-6 8.7-3.6-2-6-4.7-6-8.7V6.5L12 4Z" />,
  };
  return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{paths[name]}</svg>;
}

function SettingsGroup({ title, children }: { title: string; children: ReactNode }) {
  return <section className="amethyst-settings-group"><h2>{title}</h2><div className="amethyst-settings-card">{children}</div></section>;
}

export function SettingsScreen({ onBack }: SettingsScreenProps) {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const permissionsOpen = searchParams.get('view') === 'permissions';
  const [enabled, setEnabled] = useState<Record<PermissionKey, boolean>>({ usage: false, accessibility: false, notifications: false, schedule: false });
  const [requesting, setRequesting] = useState<PermissionKey | null>(null);
  const [permissionError, setPermissionError] = useState('');
  const [sound, setSound] = useState(() => settingsStore.get().sessionSounds);
  const [gentle, setGentle] = useState(() => settingsStore.get().gentleReminders);
  const [holdingEmergency, setHoldingEmergency] = useState(false);
  const [emergencyMessage, setEmergencyMessage] = useState('');
  const emergencyHold = useRef<number | null>(null);

  useEffect(() => {
    const settings = { sessionSounds: sound, gentleReminders: gentle };
    settingsStore.save(settings);
    void AmethystBlocker.updateSettings?.(settings);
  }, [gentle, sound]);

  const refreshPermissions = useCallback(async () => {
    const [blockerResult] = await Promise.allSettled([
      AmethystBlocker.getPermissionStatus(),
    ]);
    setEnabled({
      usage: blockerResult.status === 'fulfilled' && blockerResult.value.available !== false ? blockerResult.value.usageAccess : false,
      accessibility: blockerResult.status === 'fulfilled' && blockerResult.value.available !== false ? blockerResult.value.accessibility : false,
      notifications: blockerResult.status === 'fulfilled' && blockerResult.value.available !== false
        ? blockerResult.value.notificationsEnabled && blockerResult.value.notificationRuntimeGranted
        : false,
      schedule: blockerResult.status === 'fulfilled' && blockerResult.value.available !== false
        ? blockerResult.value.exactAlarms
        : false,
    });
  }, []);

  useEffect(() => {
    const refreshOnFocus = () => { void refreshPermissions(); };
    const refreshOnVisibility = () => {
      if (document.visibilityState === 'visible') void refreshPermissions();
    };
    void refreshPermissions();
    window.addEventListener('focus', refreshOnFocus);
    document.addEventListener('visibilitychange', refreshOnVisibility);
    return () => {
      window.removeEventListener('focus', refreshOnFocus);
      document.removeEventListener('visibilitychange', refreshOnVisibility);
    };
  }, [refreshPermissions]);

  async function request(key: PermissionKey) {
    setRequesting(key);
    setPermissionError('');
    try {
      const result = await DETAILS[key].request();
      if (result.available === false) {
        setPermissionError(`${DETAILS[key].title} isn't available outside the installed Android app.`);
      }
      await refreshPermissions();
    } catch {
      setEnabled((current) => ({ ...current, [key]: false }));
      setPermissionError(`Amethyst could not check ${DETAILS[key].title.toLowerCase()}. Please try again.`);
    } finally {
      setRequesting(null);
    }
  }

  function exportData() {
    const payload = localStorage.getItem(AMETHYST_STATE_KEY) ?? '{}';
    const url = URL.createObjectURL(new Blob([payload], { type: 'application/json' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `amethyst-export-${new Date().toISOString().slice(0, 10)}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  async function resetData() {
    if (!window.confirm('Reset all local Amethyst rules, history, profile, and rewards?')) return;
    await AmethystBlocker.resetAllData();
    localStorage.clear();
    localStorage.removeItem(AMETHYST_STATE_KEY);
    localStorage.removeItem('amethyst.selectedRuleId');
    window.location.hash = '#/home';
    window.location.reload();
  }

  function cancelEmergencyHold() {
    if (emergencyHold.current !== null) window.clearTimeout(emergencyHold.current);
    emergencyHold.current = null;
    setHoldingEmergency(false);
  }

  function beginEmergencyHold() {
    cancelEmergencyHold();
    setEmergencyMessage('');
    setHoldingEmergency(true);
    emergencyHold.current = window.setTimeout(async () => {
      emergencyHold.current = null;
      setHoldingEmergency(false);
      if (!window.confirm('Suspend every Amethyst block for 15 minutes? This will end the current timer.')) return;
      const result = await AmethystBlocker.updateSettings({ emergencyStop: true });
      if (result.emergencyEvent) {
        emergencyStore.set(result.emergencyEvent.at, result.emergencyEvent.endsAt);
        setEmergencyMessage('All blocking is suspended for 15 minutes.');
      } else {
        setEmergencyMessage('Emergency Stop could not be confirmed.');
      }
    }, 5_000);
  }

  function goBack() {
    if (permissionsOpen) {
      navigate(-1);
      return;
    }
    (onBack ?? (() => navigate(-1)))();
  }

  const readyCount = Object.values(enabled).filter(Boolean).length;

  return <main className="amethyst-settings">
    <header className="amethyst-settings-header">
      <button type="button" onClick={goBack} aria-label={permissionsOpen ? 'Back to settings' : 'Back'}>←</button>
      <h1>{permissionsOpen ? 'Permissions' : 'Settings'}</h1>
    </header>

    {permissionsOpen ? <>
      <SettingsGroup title="Access">
        {(Object.keys(DETAILS) as PermissionKey[]).map((key) => {
          const item = DETAILS[key];
          return <article className="amethyst-settings-row amethyst-settings-permission" key={key}>
            <span className="amethyst-settings-icon"><SettingsIcon name={item.icon} /></span>
            <div><strong>{item.title}</strong><small>{item.detail}</small></div>
            <button className={enabled[key] ? 'is-ready' : ''} disabled={requesting !== null} onClick={() => void request(key)}>
              {requesting === key ? 'Checking…' : enabled[key] ? 'Ready' : 'Enable'}
            </button>
          </article>;
        })}
      </SettingsGroup>
      {permissionError && <p className="amethyst-settings-error" role="alert">{permissionError}</p>}
      <p className="amethyst-settings-footnote">Access is checked directly with Android. Amethyst only shows Ready after the operating system confirms it.</p>
    </> : <>
      <SettingsGroup title="Personalize">
        <label className="amethyst-settings-row amethyst-settings-toggle">
          <span className="amethyst-settings-icon"><SettingsIcon name="bell" /></span>
          <div><strong>Gentle reminders</strong><small>A quiet prompt when attention starts to drift</small></div>
          <input type="checkbox" checked={gentle} onChange={() => setGentle((value) => !value)} />
          <i />
        </label>
        <label className="amethyst-settings-row amethyst-settings-toggle">
          <span className="amethyst-settings-icon"><SettingsIcon name="sound" /></span>
          <div><strong>Session sounds</strong><small>Soft feedback when a focus ritual begins or ends</small></div>
          <input type="checkbox" checked={sound} onChange={() => setSound((value) => !value)} />
          <i />
        </label>
      </SettingsGroup>

      <SettingsGroup title="Other">
        <button className="amethyst-settings-row amethyst-settings-link" type="button" onClick={() => setSearchParams({ view: 'permissions' })}>
          <span className="amethyst-settings-icon"><SettingsIcon name="permissions" /></span>
          <div><strong>Permissions</strong><small>{readyCount} of 4 ready</small></div>
          <b>›</b>
        </button>
        <button className="amethyst-settings-row amethyst-settings-link" type="button" onClick={exportData}>
          <span className="amethyst-settings-icon"><SettingsIcon name="download" /></span>
          <div><strong>Export data</strong><small>Download your local history and rules</small></div>
          <b>›</b>
        </button>
        <button className="amethyst-settings-row amethyst-settings-link is-destructive" type="button" onClick={() => void resetData()}>
          <span className="amethyst-settings-icon"><SettingsIcon name="reset" /></span>
          <div><strong>Reset Amethyst</strong><small>Remove all locally stored progress</small></div>
          <b>›</b>
        </button>
      </SettingsGroup>

      <SettingsGroup title="Emergency">
        <button
          className="amethyst-settings-row amethyst-settings-link is-destructive"
          type="button"
          onPointerDown={beginEmergencyHold}
          onPointerUp={cancelEmergencyHold}
          onPointerCancel={cancelEmergencyHold}
          onPointerLeave={cancelEmergencyHold}
          onContextMenu={(event) => event.preventDefault()}
        >
          <span className="amethyst-settings-icon"><SettingsIcon name="shield" /></span>
          <div><strong>{holdingEmergency ? 'Keep holding…' : 'Emergency Stop'}</strong><small>Hold 5 seconds to suspend all blocking for 15 minutes</small></div>
        </button>
        {emergencyMessage && <p className="amethyst-settings-footnote" role="status">{emergencyMessage}</p>}
      </SettingsGroup>

      <SettingsGroup title="About">
        <div className="amethyst-settings-row">
          <span className="amethyst-settings-icon"><SettingsIcon name="info" /></span>
          <div><strong>About Amethyst</strong><small>Local-only and account-free</small></div>
          <em>1.0</em>
        </div>
        <div className="amethyst-settings-row">
          <span className="amethyst-settings-icon"><SettingsIcon name="shield" /></span>
          <div><strong>Data</strong><small>Stored locally</small></div>
        </div>
      </SettingsGroup>
    </>}
  </main>;
}
