import { useEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

interface ModalHostProps {
  children: ReactNode;
  onClose?: () => void;
}

const FOCUSABLE = 'button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),a[href],[tabindex]:not([tabindex="-1"])';

export function ModalHost({ children, onClose }: ModalHostProps) {
  const host = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  // Deliberately runs once per mount, not on every `onClose` identity change:
  // callers often pass an inline closure that's recreated on unrelated parent
  // re-renders (e.g. a keystroke in a field inside this modal, or a ticking
  // timer in the parent screen), and re-running this would steal focus back
  // to the close button mid-interaction. Escape/back-button always read the
  // latest `onClose` via the ref above instead.
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    document.body.style.overflow = 'hidden';
    document.body.dataset.modalOpen = 'true';

    const root = host.current;
    const focusable = root?.querySelector<HTMLElement>(FOCUSABLE);
    focusable?.focus();

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' && onCloseRef.current) {
        event.preventDefault();
        onCloseRef.current();
        return;
      }
      if (event.key !== 'Tab' || !root) return;
      const items = [...root.querySelectorAll<HTMLElement>(FOCUSABLE)];
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    function onAndroidBack() {
      onCloseRef.current?.();
    }

    document.addEventListener('keydown', onKeyDown);
    window.addEventListener('amethyst-back-button', onAndroidBack);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('amethyst-back-button', onAndroidBack);
      document.body.style.overflow = previousOverflow;
      delete document.body.dataset.modalOpen;
      previousFocus?.focus();
    };
  }, []);

  return createPortal(<div ref={host}>{children}</div>, document.body);
}
