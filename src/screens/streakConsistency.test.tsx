import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { HomeScreen } from './HomeScreen';
import { GemsScreen } from './GemsScreen';
import { ProfileScreen } from './ProfileScreen';

describe('streak count across screens', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(cleanup);

  it('Home, Gems, and Profile all show the same (real, un-floored) streak value', async () => {
    render(<MemoryRouter><HomeScreen /></MemoryRouter>);
    expect(await screen.findByRole('button', { name: 'Current streak: 0 days' })).toBeTruthy();
    cleanup();

    render(<MemoryRouter><GemsScreen /></MemoryRouter>);
    await screen.findByText(/days to/i);
    expect(document.querySelector('.gem-streak strong')?.textContent?.trim().startsWith('0')).toBe(true);
    cleanup();

    render(<MemoryRouter><ProfileScreen /></MemoryRouter>);
    await screen.findByText('DAY STREAK');
    expect(document.querySelector('.is-streak')?.nextElementSibling?.textContent).toBe('0');
  });
});
