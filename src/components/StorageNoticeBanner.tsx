import { useEffect, useState } from 'react';
import { dataRecoveryNoticeStore } from '../state/localState';
import { STORAGE_WRITE_FAILED_EVENT } from '../state/amethystState';

export function StorageNoticeBanner() {
  const [showRecoveryNotice, setShowRecoveryNotice] = useState(() => dataRecoveryNoticeStore.get());
  const [showWriteFailedNotice, setShowWriteFailedNotice] = useState(false);

  useEffect(() => {
    const onWriteFailed = () => setShowWriteFailedNotice(true);
    window.addEventListener(STORAGE_WRITE_FAILED_EVENT, onWriteFailed);
    return () => window.removeEventListener(STORAGE_WRITE_FAILED_EVENT, onWriteFailed);
  }, []);

  if (showWriteFailedNotice) {
    return (
      <div className="amethyst-storage-notice" role="alert">
        <p>We couldn't save your last change. Your device's storage may be full or unavailable.</p>
        <button type="button" onClick={() => setShowWriteFailedNotice(false)}>Dismiss</button>
      </div>
    );
  }

  if (showRecoveryNotice) {
    return (
      <div className="amethyst-storage-notice" role="status">
        <p>We couldn't read your saved data, so we started fresh. Your old data is backed up on this device.</p>
        <button
          type="button"
          onClick={() => {
            dataRecoveryNoticeStore.dismiss();
            setShowRecoveryNotice(false);
          }}
        >
          Dismiss
        </button>
      </div>
    );
  }

  return null;
}
