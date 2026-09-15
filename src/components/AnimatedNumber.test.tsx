import '@testing-library/jest-dom/vitest';
import { act, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AnimatedNumber } from './AnimatedNumber';

describe('AnimatedNumber', () => {
  afterEach(() => vi.useRealTimers());

  it('settles on the supplied value after the configured duration', () => {
    vi.useFakeTimers();
    render(<AnimatedNumber value={86} duration={160} />);

    expect(screen.getByLabelText('86')).toHaveTextContent('0');
    act(() => vi.advanceTimersByTime(160));
    expect(screen.getByLabelText('86')).toHaveTextContent('86');
  });
});
