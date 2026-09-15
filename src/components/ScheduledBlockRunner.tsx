import { useEffect } from 'react';
import { AmethystBlocker } from '../native/AmethystNativeBridge';
import {
  AMETHYST_STATE_CHANGED_EVENT,
  rulesStore,
} from '../state/localState';
import { toRuleSpec } from '../state/amethystState';

export function ScheduledBlockRunner() {
  useEffect(() => {
    async function syncPolicy() {
      await AmethystBlocker.syncRules({
        rules: rulesStore.getAll().map((rule) => toRuleSpec({
          ...rule,
          packageNames: rule.packageNames ?? [],
          days: rule.days ?? [0, 1, 2, 3, 4, 5, 6],
        })),
      });
    }

    const resync = () => void syncPolicy();
    void syncPolicy();
    window.addEventListener(AMETHYST_STATE_CHANGED_EVENT, resync);
    window.addEventListener('storage', resync);
    const safetyInterval = window.setInterval(resync, 15 * 60_000);
    return () => {
      window.removeEventListener(AMETHYST_STATE_CHANGED_EVENT, resync);
      window.removeEventListener('storage', resync);
      window.clearInterval(safetyInterval);
    };
  }, []);

  return null;
}
