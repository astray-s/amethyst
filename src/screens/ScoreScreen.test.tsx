import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ScoreScreen } from './ScoreScreen';

vi.mock('../score/useDailyScore', () => ({
  useDailyScore: () => ({
    loading: false,
    refresh: vi.fn(),
    snapshot: {
      formulaVersion: 'amethyst-score-v1',
      dateKey: '2026-09-13',
      computedAt: new Date(2026, 8, 13, 7).getTime(),
      status: 'ready',
      usageReliable: true,
      usage: {
        pickups: 0,
        screenTimeMinutes: 0,
        usageAccessGranted: true,
        mostUsedApps: [],
        usageByApp: [],
        hourly: [],
        hourlyBuckets: [],
      },
      attempts: [],
      attemptsTruncated: false,
      longestFocusMinutes: 0,
      score: {
        formulaVersion: 'amethyst-score-v1',
        sleep: null,
        focus: 100,
        rest: 100,
        overall: 100,
        metrics: {
          estimatedSleepHours: null,
          lastScrollEpoch: null,
          firstPickupEpoch: null,
          overnightPhoneMinutes: 0,
          firstHourUseMinutes: 0,
          screenTimeMinutes: 0,
          distractingMinutes: null,
          pickups: 0,
          unblocksUsed: 0,
          blockAttempts: 0,
          completedFocusMinutes: 0,
          offlineMinutes: 420,
          quietHourShare: 1,
          longestOfflineStretchMinutes: 300,
        },
      },
    },
  }),
}));

afterEach(cleanup);

describe('ScoreScreen zero-value metrics', () => {
  it('distinguishes loaded zeroes from unavailable metrics', () => {
    render(<MemoryRouter><ScoreScreen /></MemoryRouter>);

    expect(screen.getByText('Longest Focus').closest('article')).toHaveTextContent('0m');
    expect(screen.getByText('Longest Focus').closest('article')).toHaveTextContent('None yet');
    expect(screen.getByText('App unblocks').closest('article')).toHaveTextContent('0');
    expect(screen.getByText('App unblocks').closest('article')).toHaveTextContent('None');
    expect(screen.getByText('Blocked attempts').closest('article')).toHaveTextContent('0');
    expect(screen.getByText('Blocked attempts').closest('article')).toHaveTextContent('None');
    expect(screen.getByText('Offline').closest('article')).toHaveTextContent('7h');
    expect(screen.getByText('Longest offline stretch').closest('article')).toHaveTextContent('5h');
  });
});
