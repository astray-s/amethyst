import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { EngineStatus } from '../engine/contracts';
import type { UsageStats } from '../native/AmethystNativeBridge';
import {
  clearDailyScoreCache,
  getDailyScore,
  type DailyScoreDependencies,
} from './dailyScoreRepository';

const fixedNow = new Date(2026, 8, 12, 12);

function usage(overrides: Partial<UsageStats> = {}): UsageStats {
  return {
    pickups: 0,
    screenTimeMinutes: 0,
    mostUsedApps: [],
    usageByApp: [],
    hourly: [],
    usageAccessGranted: true,
    ...overrides,
  };
}

function engineStatus(): EngineStatus {
  return {
    active: false,
    emergencySuspended: false,
    emergencyEndsAt: null,
    blockedPackages: [],
    blockedDomains: [],
    activeRuleIds: [],
    session: null,
    nextBoundaryAt: null,
    schedulePrecision: 'exact',
    allowlistApplied: false,
    allowlistedPackages: [],
    allowlistedDomains: [],
    strictActive: false,
    unblockUsage: [{ date: '2026-09-12', ruleId: 'social', used: 2, timestamps: [] }],
    updatedAt: fixedNow.getTime(),
  };
}

describe('daily score repository', () => {
  beforeEach(() => clearDailyScoreCache());

  it('deduplicates Home and Score loads and returns one canonical snapshot', async () => {
    const getUsageStats = vi.fn(async (range: { startEpoch: number; endEpoch: number }) => {
      const start = new Date(range.startEpoch);
      if (start.getDate() === 11) {
        return usage({
          lastActivityEpoch: new Date(2026, 8, 11, 23).getTime(),
          hourly: [
            { hourStartEpoch: new Date(2026, 8, 11, 22).getTime(), screenTimeMs: 1_200_000, minutes: 20, pickups: 1 },
            { hourStartEpoch: new Date(2026, 8, 11, 23).getTime(), screenTimeMs: 600_000, minutes: 10, pickups: 1 },
          ],
        });
      }
      if (start.getHours() === 4) {
        return usage({
          firstPickupEpoch: new Date(2026, 8, 12, 7).getTime(),
          firstActivityEpoch: new Date(2026, 8, 12, 7).getTime(),
          hourly: [
            { hourStartEpoch: new Date(2026, 8, 12, 7).getTime(), screenTimeMs: 300_000, minutes: 5, pickups: 1 },
          ],
        });
      }
      return usage({
        pickups: 40,
        screenTimeMinutes: 240,
        mostUsedApps: [{ packageName: 'com.instagram.android', label: 'Instagram', minutes: 90 }],
        usageByApp: [
          { packageName: 'com.instagram.android', label: 'Instagram', minutes: 90, screenTimeMs: 5_400_000 },
          { packageName: 'com.google.android.gm', label: 'Gmail', minutes: 150, screenTimeMs: 9_000_000 },
        ],
        hourly: [
          { hourStartEpoch: new Date(2026, 8, 12, 4).getTime(), screenTimeMs: 3_600_000, minutes: 60, pickups: 10 },
          { hourStartEpoch: new Date(2026, 8, 12, 5).getTime(), screenTimeMs: 3_600_000, minutes: 60, pickups: 10 },
          { hourStartEpoch: new Date(2026, 8, 12, 6).getTime(), screenTimeMs: 3_600_000, minutes: 60, pickups: 10 },
          { hourStartEpoch: new Date(2026, 8, 12, 7).getTime(), screenTimeMs: 3_600_000, minutes: 60, pickups: 10 },
          { hourStartEpoch: new Date(2026, 8, 12, 8).getTime(), screenTimeMs: 0, minutes: 0, pickups: 0 },
          { hourStartEpoch: new Date(2026, 8, 12, 9).getTime(), screenTimeMs: 0, minutes: 0, pickups: 0 },
          { hourStartEpoch: new Date(2026, 8, 12, 10).getTime(), screenTimeMs: 0, minutes: 0, pickups: 0 },
        ],
      });
    });

    const dependencies: DailyScoreDependencies = {
      now: () => new Date(fixedNow),
      getUsageStats,
      getRecentBlockAttempts: vi.fn().mockResolvedValue({
        events: [
          { packageName: 'com.instagram.android', timestamp: new Date(2026, 8, 12, 8).getTime() },
        ],
        maxStored: 500,
        truncated: false,
      }),
      getEngineStatus: vi.fn().mockResolvedValue(engineStatus()),
      getRules: () => [],
      getHistory: () => [{
        id: 'focus',
        startedAt: new Date(2026, 8, 12, 9).getTime(),
        endedAt: new Date(2026, 8, 12, 10).getTime(),
        durationMinutes: 60,
        blockedApps: true,
        completed: true,
      }],
    };

    const [home, detail] = await Promise.all([
      getDailyScore(fixedNow, { dependencies }),
      getDailyScore(fixedNow, { dependencies }),
    ]);

    expect(detail).toBe(home);
    expect(getUsageStats).toHaveBeenCalledTimes(3);
    expect(home.formulaVersion).toBe('amethyst-score-v1');
    expect(home.score.metrics.distractingMinutes).toBe(90);
    expect(home.score).toMatchObject({
      sleep: expect.any(Number),
      focus: expect.any(Number),
      rest: expect.any(Number),
      overall: expect.any(Number),
    });
  });

  it('marks truncated block-attempt history unavailable instead of treating it as zero', async () => {
    const dependencies: DailyScoreDependencies = {
      now: () => new Date(fixedNow),
      getUsageStats: vi.fn().mockResolvedValue(usage()),
      getRecentBlockAttempts: vi.fn().mockResolvedValue({
        events: [],
        maxStored: 500,
        truncated: true,
      }),
      getEngineStatus: vi.fn().mockResolvedValue(engineStatus()),
      getRules: () => [],
      getHistory: () => [],
    };

    const snapshot = await getDailyScore(fixedNow, { dependencies });

    expect(snapshot.status).toBe('partial');
    expect(snapshot.score.metrics.blockAttempts).toBeNull();
  });
});
