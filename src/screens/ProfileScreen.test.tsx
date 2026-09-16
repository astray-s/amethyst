import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ProfileScreen } from './ProfileScreen';

const { getUsageStats } = vi.hoisted(() => ({
  getUsageStats: vi.fn(),
}));

vi.mock('../native/AmethystNativeBridge', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../native/AmethystNativeBridge')>();
  return {
    ...actual,
    AmethystBlocker: {
      ...actual.AmethystBlocker,
      getUsageStats,
    },
  };
});

afterEach(() => {
  cleanup();
  getUsageStats.mockReset();
  localStorage.clear();
});

describe('ProfileScreen daily screen-time graph', () => {
  function reliableUsage(startEpoch: number, minutes = 120) {
    const wholeHours = Math.floor(minutes / 60);
    const remainder = minutes % 60;
    const hourlyBuckets = Array.from({ length: wholeHours }, (_, hour) => ({
      hourStartEpoch: startEpoch + hour * 60 * 60_000,
      minutes: 60,
      screenTimeMs: 60 * 60_000,
      pickups: hour === 0 ? 1 : 0,
    }));
    if (remainder > 0) {
      hourlyBuckets.push({
        hourStartEpoch: startEpoch + wholeHours * 60 * 60_000,
        minutes: remainder,
        screenTimeMs: remainder * 60_000,
        pickups: 0,
      });
    }
    return {
      pickups: 1,
      screenTimeMinutes: 2_459,
      screenTimeMs: 2_459 * 60_000,
      usageAccessGranted: true,
      mostUsedApps: [],
      usageByApp: [],
      startEpoch,
      endEpoch: startEpoch + 24 * 60 * 60_000,
      hourlyBuckets,
    };
  }

  function unavailableUsage(startEpoch: number) {
    return {
      ...reliableUsage(startEpoch, 0),
      screenTimeMinutes: 1_424,
      screenTimeMs: 1_424 * 60_000,
      hourlyBuckets: [{
        hourStartEpoch: startEpoch,
        minutes: 0,
        screenTimeMs: 0,
        pickups: 0,
      }],
    };
  }

  it('uses a real 24-hour daily scale instead of making the highest day look like the limit', async () => {
    getUsageStats.mockImplementation(async ({ startEpoch }: { startEpoch: number }) => ({
      ...reliableUsage(startEpoch),
    }));

    render(<MemoryRouter><ProfileScreen /></MemoryRouter>);

    expect(await screen.findByText(/14-day average is/i)).toHaveTextContent('2h');
    await waitFor(() => {
      const labels = [...document.querySelectorAll('.amethyst-profile__chart text')]
        .map((element) => element.textContent ?? '');
      expect(labels).not.toContain('41h');
      expect(labels).toContain('24h');
      expect(document.querySelectorAll('[data-usage-day]')).toHaveLength(14);

      const svg = document.querySelector('.amethyst-profile__chart svg');
      const gridLine = document.querySelector('.amethyst-profile__grid-line');
      const viewBoxWidth = Number(svg?.getAttribute('viewBox')?.split(' ')[2]);
      const leftInset = Number(gridLine?.getAttribute('x1'));
      const rightInset = viewBoxWidth - Number(gridLine?.getAttribute('x2'));
      expect(leftInset).toBe(rightInset);
    });
  });

  it('keeps unavailable days in their calendar positions instead of cutting off the chart', async () => {
    let call = 0;
    getUsageStats.mockImplementation(async ({ startEpoch }: { startEpoch: number }) => {
      call += 1;
      return call <= 4
        ? unavailableUsage(startEpoch)
        : reliableUsage(startEpoch, 6 * 60);
    });

    render(<MemoryRouter><ProfileScreen /></MemoryRouter>);

    expect(await screen.findByText(/10-day average is/i)).toHaveTextContent('6h');
    await waitFor(() => {
      const daySlots = [...document.querySelectorAll('[data-usage-day]')];
      expect(daySlots).toHaveLength(14);
      expect(daySlots.slice(0, 4).every((slot) => slot.getAttribute('data-available') === 'false')).toBe(true);
      expect(daySlots.slice(4).every((slot) => slot.getAttribute('data-available') === 'true')).toBe(true);
      expect(document.querySelector('.amethyst-profile__line')).not.toBeInTheDocument();
    });
  });
});
