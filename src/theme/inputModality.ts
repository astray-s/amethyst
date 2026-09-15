const POINTER_EVENTS = ['pointerdown', 'touchstart', 'mousedown'] as const;

export function attachInputModalityTracking(root: HTMLElement) {
  const setPointer = () => {
    root.dataset.inputModality = 'pointer';
  };
  const setKeyboard = () => {
    root.dataset.inputModality = 'keyboard';
  };

  for (const eventName of POINTER_EVENTS) {
    window.addEventListener(eventName, setPointer, true);
  }
  window.addEventListener('keydown', setKeyboard, true);

  return () => {
    for (const eventName of POINTER_EVENTS) {
      window.removeEventListener(eventName, setPointer, true);
    }
    window.removeEventListener('keydown', setKeyboard, true);
  };
}
