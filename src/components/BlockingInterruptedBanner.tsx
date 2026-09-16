import { useEffect, useState } from 'react';
import { AmethystBlocker, isNativePlatform } from '../native/AmethystNativeBridge';

export function BlockingInterruptedBanner() {
  const [interrupted, setInterrupted] = useState(false);

  useEffect(() => {
    if (!isNativePlatform) return;

    let cancelled = false;
    async function check() {
      const [status, permissions] = await Promise.all([
        AmethystBlocker.getActiveBlockingStatus(),
        AmethystBlocker.getPermissionStatus(),
      ]);
      if (!cancelled) {
        setInterrupted(status.active && !permissions.accessibility);
      }
    }

    void check();
    const onFocus = () => void check();
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onFocus);
    // Blocking can also start (a schedule boundary passing) while the app stays
    // foregrounded the whole time, so focus/visibilitychange alone would miss it.
    const pollInterval = window.setInterval(() => void check(), 60_000);
    return () => {
      cancelled = true;
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onFocus);
      window.clearInterval(pollInterval);
    };
  }, []);

  if (!interrupted) return null;

  return (
    <div className="amethyst-interrupted-banner" role="alert">
      <p>
        Blocking was interrupted — Amethyst was force-stopped or its Accessibility permission was
        turned off, so your active session isn't being enforced right now.
      </p>
      <button type="button" onClick={() => void AmethystBlocker.requestAccessibilityPermission()}>
        Re-enable
      </button>
    </div>
  );
}
