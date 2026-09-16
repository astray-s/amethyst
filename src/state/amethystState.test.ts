import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  AMETHYST_STATE_CORRUPT_BACKUP_KEY,
  AMETHYST_STATE_CORRUPT_NOTICE_KEY,
  STORAGE_WRITE_FAILED_EVENT,
  calculateScore,
  completeFocusSession,
  createAmethystStore,
  migrateLegacyState,
  type ScoreInput,
} from './amethystState';

function memoryStorage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
    clear: () => values.clear(),
  };
}

describe('calculateScore', () => {
  it('combines sleep, focus, and rest with the Amethyst weighting', () => {
    const input: ScoreInput = { sleep: 70, focus: 50, rest: 90 };
    expect(calculateScore(input)).toEqual({ ...input, overall: 68 });
  });

  it('re-normalizes available dimensions when device activity cannot estimate sleep', () => {
    expect(calculateScore({ sleep: null, focus: 80, rest: 80 })).toEqual({
      sleep: null,
      focus: 80,
      rest: 80,
      overall: 80,
    });
  });

  it('migrates version 1 state without losing progress', () => {
    const storage = memoryStorage();
    storage.setItem('amethyst.state', JSON.stringify({
      ...createAmethystStore(memoryStorage()).get(),
      version: 1,
      profile: { displayName: 'A', avatarInitial: 'A', streak: 3, longestStreak: 3, lastCompletedDate: null },
    }));

    const migrated = migrateLegacyState(storage);
    expect(migrated.version).toBe(3);
    expect(migrated.profile.streak).toBe(3);
    expect(migrated.dailyScores).toEqual({});
  });
});

describe('focus completion', () => {
  let storage: ReturnType<typeof memoryStorage>;

  beforeEach(() => {
    storage = memoryStorage();
  });

  it('records history, focus minutes, streak, and the first reward', () => {
    const store = createAmethystStore(storage);
    const completed = completeFocusSession(store.get(), {
      id: 'session-1',
      presetId: 'deep-study',
      startedAt: Date.parse('2026-09-04T08:00:00-07:00'),
      endedAt: Date.parse('2026-09-04T08:30:00-07:00'),
      durationMinutes: 30,
      blockedApps: true,
      completed: true,
    });

    expect(completed.history).toHaveLength(1);
    expect(completed.usage.todayFocusMinutes).toBe(30);
    expect(completed.profile.streak).toBe(1);
    expect(completed.rewards.unlockedIds).toContain('first-light');
  });

  it('does not record the same completed session twice', () => {
    const store = createAmethystStore(storage);
    const record = {
      id: 'session-1',
      startedAt: Date.parse('2026-09-04T08:00:00-07:00'),
      endedAt: Date.parse('2026-09-04T08:30:00-07:00'),
      durationMinutes: 30,
      blockedApps: true,
      completed: true,
    };
    const once = completeFocusSession(store.get(), record);
    const twice = completeFocusSession(once, record);
    expect(twice.history).toHaveLength(1);
    expect(twice.usage.todayFocusMinutes).toBe(30);
  });
});

describe('corrupted or unavailable storage', () => {
  it('backs up unparseable JSON and flags the one-time notice instead of silently discarding it', () => {
    const storage = memoryStorage();
    storage.setItem('amethyst.state', '{not valid json');

    const migrated = migrateLegacyState(storage);

    expect(migrated.version).toBe(3);
    expect(storage.getItem(AMETHYST_STATE_CORRUPT_BACKUP_KEY)).toBe('{not valid json');
    expect(storage.getItem(AMETHYST_STATE_CORRUPT_NOTICE_KEY)).toBe('1');
  });

  it('does not flag corruption on a fresh install with no stored data', () => {
    const storage = memoryStorage();

    migrateLegacyState(storage);

    expect(storage.getItem(AMETHYST_STATE_CORRUPT_BACKUP_KEY)).toBeNull();
    expect(storage.getItem(AMETHYST_STATE_CORRUPT_NOTICE_KEY)).toBeNull();
  });

  it('catches a throwing setItem and dispatches a write-failed event instead of throwing into the caller', () => {
    const storage = {
      getItem: () => null,
      setItem: () => {
        throw new Error('QuotaExceededError');
      },
    };
    const onWriteFailed = vi.fn();
    window.addEventListener(STORAGE_WRITE_FAILED_EVENT, onWriteFailed);

    expect(() => createAmethystStore(storage).set(createAmethystStore(memoryStorage()).get())).not.toThrow();
    expect(onWriteFailed).toHaveBeenCalledTimes(1);

    window.removeEventListener(STORAGE_WRITE_FAILED_EVENT, onWriteFailed);
  });
});
