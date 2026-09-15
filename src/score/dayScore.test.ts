import { describe, expect, it } from 'vitest';
import {
  calculateDayScore,
  dayRangesForDate,
  estimateSleepFromUsage,
  type ScoreUsageSlice,
} from './dayScore';

const emptyUsage = (overrides: Partial<ScoreUsageSlice> = {}): ScoreUsageSlice => ({
  pickups: 0,
  screenTimeMinutes: 0,
  usageByApp: [],
  hourly: [],
  usageAccessGranted: true,
  ...overrides,
});

describe('calculateDayScore', () => {
  it('uses the documented device signals without Health Connect', () => {
    const previousEvening = new Date(2026, 8, 11, 23, 0).getTime();
    const firstMorningPickup = new Date(2026, 8, 12, 7, 0).getTime();

    expect(calculateDayScore({
      date: new Date(2026, 8, 12, 12, 0),
      observedMinutes: 1440,
      usage: emptyUsage({
        pickups: 40,
        screenTimeMinutes: 240,
        usageByApp: [
          { packageName: 'com.instagram.android', minutes: 90 },
          { packageName: 'com.google.android.youtube', minutes: 30 },
          { packageName: 'com.google.android.gm', minutes: 60 },
        ],
        hourly: [
          { hourStartEpoch: new Date(2026, 8, 12, 8).getTime(), minutes: 0, pickups: 0 },
          { hourStartEpoch: new Date(2026, 8, 12, 9).getTime(), minutes: 0, pickups: 0 },
          { hourStartEpoch: new Date(2026, 8, 12, 10).getTime(), minutes: 0, pickups: 0 },
        ],
      }),
      eveningUsage: emptyUsage({
        lastActivityEpoch: previousEvening,
        hourly: [
          { hourStartEpoch: new Date(2026, 8, 11, 22).getTime(), minutes: 20, pickups: 1 },
          { hourStartEpoch: new Date(2026, 8, 11, 23).getTime(), minutes: 10, pickups: 1 },
        ],
      }),
      morningUsage: emptyUsage({
        firstPickupEpoch: firstMorningPickup,
        firstActivityEpoch: firstMorningPickup,
        hourly: [
          { hourStartEpoch: new Date(2026, 8, 12, 7).getTime(), minutes: 5, pickups: 1 },
        ],
      }),
      distractingPackages: ['com.instagram.android', 'com.google.android.youtube'],
      unblocksUsed: 2,
      blockAttempts: 4,
      completedFocusMinutes: 60,
    })).toMatchObject({
      formulaVersion: 'amethyst-score-v1',
      sleep: 84,
      focus: 47,
      rest: 77,
      overall: 67,
      metrics: {
        estimatedSleepHours: 8,
        distractingMinutes: 120,
        overnightPhoneMinutes: 30,
        firstHourUseMinutes: 5,
        longestOfflineStretchMinutes: 180,
      },
    });
  });

  it('never invents sleep when device activity cannot bound the sleep window', () => {
    const result = calculateDayScore({
      date: new Date(2026, 8, 12, 12, 0),
      observedMinutes: 720,
      usage: emptyUsage({ pickups: 20, screenTimeMinutes: 180 }),
      eveningUsage: emptyUsage(),
      morningUsage: emptyUsage(),
      distractingPackages: [],
      unblocksUsed: 0,
      blockAttempts: 0,
      completedFocusMinutes: 0,
    });

    expect(result.sleep).toBeNull();
    expect(result.metrics.estimatedSleepHours).toBeNull();
    expect(result.overall).toBeGreaterThan(0);
  });

  it('does not count productive app time as distracting time', () => {
    const result = calculateDayScore({
      date: new Date(2026, 8, 12, 12, 0),
      observedMinutes: 720,
      usage: emptyUsage({
        screenTimeMinutes: 120,
        usageByApp: [
          { packageName: 'com.google.android.gm', minutes: 90 },
          { packageName: 'com.instagram.android', minutes: 30 },
        ],
      }),
      eveningUsage: emptyUsage(),
      morningUsage: emptyUsage(),
      distractingPackages: ['com.instagram.android'],
      unblocksUsed: 0,
      blockAttempts: 0,
      completedFocusMinutes: 0,
    });

    expect(result.metrics.distractingMinutes).toBe(30);
  });

  it('counts quiet hours from midnight when finding the longest offline stretch', () => {
    const dayStart = new Date(2026, 8, 13).getTime();
    const result = calculateDayScore({
      date: new Date(2026, 8, 13, 7),
      observedMinutes: 420,
      usage: emptyUsage({
        screenTimeMinutes: 29,
        hourly: [
          ...Array.from({ length: 5 }, (_, hour) => ({
            hourStartEpoch: dayStart + hour * 60 * 60_000,
            minutes: 0,
            pickups: 0,
          })),
          { hourStartEpoch: dayStart + 5 * 60 * 60_000, minutes: 21, pickups: 3 },
          { hourStartEpoch: dayStart + 6 * 60 * 60_000, minutes: 8, pickups: 3 },
        ],
      }),
      eveningUsage: emptyUsage(),
      morningUsage: emptyUsage(),
      distractingPackages: [],
      unblocksUsed: 0,
      blockAttempts: 2,
      completedFocusMinutes: 0,
    });

    expect(result.metrics.offlineMinutes).toBe(391);
    expect(result.metrics.longestOfflineStretchMinutes).toBe(300);
  });
});

describe('estimateSleepFromUsage', () => {
  it('uses the last evening interaction and first morning pickup', () => {
    const lastActivityEpoch = new Date(2026, 8, 11, 22, 45).getTime();
    const firstPickupEpoch = new Date(2026, 8, 12, 6, 45).getTime();

    expect(estimateSleepFromUsage(
      emptyUsage({ lastActivityEpoch }),
      emptyUsage({ firstPickupEpoch }),
    ).estimatedSleepHours).toBe(8);
  });

  it('keeps a very short device-free window as a low sleep signal instead of no data', () => {
    const lastActivityEpoch = new Date(2026, 8, 12, 3, 33).getTime();
    const firstPickupEpoch = new Date(2026, 8, 12, 5, 31).getTime();

    expect(estimateSleepFromUsage(
      emptyUsage({ lastActivityEpoch }),
      emptyUsage({ firstPickupEpoch }),
    ).estimatedSleepHours).toBe(2);
  });
});

describe('dayRangesForDate', () => {
  it('queries the previous evening and current morning separately', () => {
    const ranges = dayRangesForDate(
      new Date(2026, 8, 12, 12),
      new Date(2026, 8, 12, 12),
    );

    expect(new Date(ranges.day.startEpoch)).toEqual(new Date(2026, 8, 12, 0));
    expect(new Date(ranges.evening.startEpoch)).toEqual(new Date(2026, 8, 11, 18));
    expect(new Date(ranges.evening.endEpoch)).toEqual(new Date(2026, 8, 12, 4));
    expect(new Date(ranges.morning.startEpoch)).toEqual(new Date(2026, 8, 12, 4));
    expect(new Date(ranges.morning.endEpoch)).toEqual(new Date(2026, 8, 12, 12));
  });
});
