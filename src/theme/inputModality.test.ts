import { afterEach, describe, expect, it } from 'vitest';
import { attachInputModalityTracking } from './inputModality';

describe('attachInputModalityTracking', () => {
  let detach: (() => void) | undefined;

  afterEach(() => {
    detach?.();
    detach = undefined;
    delete document.documentElement.dataset.inputModality;
  });

  it('marks pointer modality on touchstart', () => {
    detach = attachInputModalityTracking(document.documentElement);
    window.dispatchEvent(new Event('touchstart'));
    expect(document.documentElement.dataset.inputModality).toBe('pointer');
  });

  it('marks pointer modality on pointerdown', () => {
    detach = attachInputModalityTracking(document.documentElement);
    window.dispatchEvent(new Event('pointerdown'));
    expect(document.documentElement.dataset.inputModality).toBe('pointer');
  });

  it('marks keyboard modality on keydown, overriding a prior pointer interaction', () => {
    detach = attachInputModalityTracking(document.documentElement);
    window.dispatchEvent(new Event('touchstart'));
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab' }));
    expect(document.documentElement.dataset.inputModality).toBe('keyboard');
  });

  it('stops updating modality once detached', () => {
    detach = attachInputModalityTracking(document.documentElement);
    detach();
    window.dispatchEvent(new Event('touchstart'));
    expect(document.documentElement.dataset.inputModality).toBeUndefined();
  });
});
