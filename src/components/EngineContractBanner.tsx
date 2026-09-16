import { useEffect, useState } from 'react';
import { ENGINE_CONTRACT_MISMATCH_EVENT } from '../native/AmethystNativeBridge';

/**
 * Surfaces a refused rule sync when the web and native engine contracts disagree.
 * Without this the rejection is caught by the bridge and discarded, leaving blocking
 * silently unenforced with nothing on screen to explain it.
 */
export function EngineContractBanner() {
  const [mismatch, setMismatch] = useState(false);

  useEffect(() => {
    const onMismatch = () => setMismatch(true);
    window.addEventListener(ENGINE_CONTRACT_MISMATCH_EVENT, onMismatch);
    return () => window.removeEventListener(ENGINE_CONTRACT_MISMATCH_EVENT, onMismatch);
  }, []);

  if (!mismatch) return null;

  return (
    <div className="amethyst-storage-notice" role="alert">
      <p>
        This version of Amethyst can't talk to its blocking engine, so your rules aren't being
        enforced. Reinstalling the latest version should fix it.
      </p>
    </div>
  );
}
