import { describe, expect, it } from 'vitest';
import type { UsageStats } from './AmethystNativeBridge';
import { normalizeUsageStats } from './usageStats';

function usage(overrides: Partial<UsageStats> = {}): UsageStats {
  return {
    pickups: 0,
    screenTimeMinutes: 0,
    mostUsedApps: [],
    usageByApp: [],
    usageAccessGranted: true,
    ...overrides,
  };
}

describe('normalizeUsageStats', () => {
  it('uses exact hourly event totals instead of an inflated Android aggregate', () => {
    const startEpoch = new Date(2026, 8, 6).getTime();
    const result = normalizeUsageStats(usage({
      startEpoch,
      endEpoch: startEpoch + 24 * 60 * 60_000,
      screenTimeMinutes: 2_459,
      screenTimeMs: 2_459 * 60_000,
      mostUsedApps: [
        { packageName: 'com.example.social', label: 'Social', minutes: 1_200 },
      ],
      usageByApp: [
        { packageName: 'com.example.social', label: 'Social', minutes: 1_200, screenTimeMs: 72_000_000 },
        { packageName: 'com.example.video', label: 'Video', minutes: 1_259, screenTimeMs: 75_540_000 },
      ],
      hourlyBuckets: [
        { hourStartEpoch: startEpoch, minutes: 45, screenTimeMs: 45 * 60_000, pickups: 2 },
        { hourStartEpoch: startEpoch + 60 * 60_000, minutes: 59, screenTimeMs: 59 * 60_000, pickups: 1 },
      ],
    }));

    expect(result.screenTimeReliable).toBe(true);
    expect(result.screenTimeMinutes).toBe(104);
    expect(result.screenTimeMs).toBe(104 * 60_000);
    expect(result.usageByApp?.reduce((sum, app) => sum + app.minutes, 0)).toBeCloseTo(104, 0);
    expect(result.mostUsedApps[0].minutes).toBeCloseTo(1200 / 2459 * 104, 1);
  });

  it('marks an aggregate-only historical day unavailable when exact event buckets are empty', () => {
    const startEpoch = new Date(2026, 7, 31).getTime();
    const result = normalizeUsageStats(usage({
      startEpoch,
      endEpoch: startEpoch + 24 * 60 * 60_000,
      screenTimeMinutes: 1_424,
      screenTimeMs: 1_424 * 60_000,
      pickups: 8,
      firstPickupEpoch: startEpoch + 8 * 60 * 60_000,
      hourlyBuckets: Array.from({ length: 24 }, (_, hour) => ({
        hourStartEpoch: startEpoch + hour * 60 * 60_000,
        minutes: 0,
        screenTimeMs: 0,
        pickups: 0,
      })),
    }));

    expect(result.screenTimeReliable).toBe(false);
    expect(result.screenTimeMinutes).toBe(0);
    expect(normalizeUsageStats(result).screenTimeReliable).toBe(false);
  });

  it('keeps a genuine zero-usage day available', () => {
    const startEpoch = new Date(2026, 8, 12).getTime();
    const result = normalizeUsageStats(usage({
      startEpoch,
      endEpoch: startEpoch + 24 * 60 * 60_000,
      screenTimeMinutes: 0,
      screenTimeMs: 0,
      hourlyBuckets: [{
        hourStartEpoch: startEpoch,
        minutes: 0,
        screenTimeMs: 0,
        pickups: 0,
      }],
    }));

    expect(result.screenTimeReliable).toBe(true);
    expect(result.screenTimeMinutes).toBe(0);
  });
});
