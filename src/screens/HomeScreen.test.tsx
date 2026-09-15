import { act, cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clearDailyScoreCache } from '../score/dailyScoreRepository';
import { HomeScreen } from './HomeScreen';

const { getUsageStats } = vi.hoisted(() => ({
  getUsageStats: vi.fn(),
}));

vi.mock('../native/AmethystNativeBridge', async () => {
  const actual = await vi.importActual<typeof import('../native/AmethystNativeBridge')>('../native/AmethystNativeBridge');
  return {
    ...actual,
    AmethystBlocker: { ...actual.AmethystBlocker, getUsageStats, getInstalledApps: vi.fn().mockResolvedValue({ apps: [] }) },
  };
});

describe('HomeScreen', () => {
  beforeEach(() => {
    clearDailyScoreCache();
    getUsageStats.mockReset().mockResolvedValue({
      pickups: 0,
      screenTimeMinutes: 0,
      mostUsedApps: [],
      usageAccessGranted: true,
    });
  });

  afterEach(cleanup);

  it('uses Amethyst streak and profile controls without a direct settings control', async () => {
    render(
      <MemoryRouter>
        <HomeScreen />
      </MemoryRouter>,
    );

    expect(await screen.findByRole('button', { name: /current streak:/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Open profile' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Open settings' })).toBeNull();
  });

  it('renders a text-only brand wordmark with no logo image', async () => {
    render(
      <MemoryRouter>
        <HomeScreen />
      </MemoryRouter>,
    );

    await screen.findByRole('button', { name: /current streak:/i });
    expect(screen.getByText('Amethyst').closest('.home-live__brand')?.querySelector('img')).toBeNull();
  });

  it('has no My apps card', async () => {
    render(
      <MemoryRouter>
        <HomeScreen />
      </MemoryRouter>,
    );

    await screen.findByRole('button', { name: /current streak:/i });
    expect(screen.queryByText('My apps')).toBeNull();
    expect(document.querySelector('.home-my-apps')).toBeNull();
  });

  it('does not reveal a provisional score before real usage data has loaded, even past the old fixed timer', async () => {
    vi.useFakeTimers();
    let resolveUsage!: (value: unknown) => void;
    const pendingUsage = new Promise((resolve) => { resolveUsage = resolve; });
    getUsageStats.mockReturnValue(pendingUsage);

    render(
      <MemoryRouter>
        <HomeScreen />
      </MemoryRouter>,
    );

    // Past the old fixed 980ms reveal timer, but the usage call still hasn't resolved.
    await act(async () => { await vi.advanceTimersByTimeAsync(3000); });
    expect(document.querySelector('main')?.getAttribute('data-score-phase')).not.toBe('resolved');
    expect(document.querySelector('.home-arc strong')?.textContent).toBe('—');

    await act(async () => {
      resolveUsage({ pickups: 0, screenTimeMinutes: 400, mostUsedApps: [], usageAccessGranted: true });
    });
    await act(async () => { await vi.advanceTimersByTimeAsync(1000); });

    expect(document.querySelector('main')?.getAttribute('data-score-phase')).toBe('resolved');
    vi.useRealTimers();
  });

  it('reveals the gem when Usage Access is denied', async () => {
    vi.useFakeTimers();
    getUsageStats.mockResolvedValue({
      pickups: 0,
      screenTimeMinutes: 0,
      mostUsedApps: [],
      usageAccessGranted: false,
    });

    render(
      <MemoryRouter>
        <HomeScreen />
      </MemoryRouter>,
    );

    await act(async () => { await Promise.resolve(); });
    await act(async () => { await vi.advanceTimersByTimeAsync(1000); });

    expect(document.querySelector('main')?.getAttribute('data-score-phase')).toBe('resolved');
    expect(document.querySelector('.home-stone img')?.getAttribute('src')).toBe('/gems/amethyst-cluster.png');
    vi.useRealTimers();
  });
});
