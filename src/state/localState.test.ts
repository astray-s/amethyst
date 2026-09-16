import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AMETHYST_STATE_KEY, createAmethystStore } from './amethystState';
import {
  MAX_FOCUS_SESSION_MINUTES,
  sessionHistoryStore,
  sessionStore,
} from './localState';

describe('sessionStore timer boundaries', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('refuses to restore a session lasting twenty-four hours', () => {
    const state = createAmethystStore().get();
    const startedAt = Date.now();
    state.activeSession = {
      id: 'malformed-day-session',
      startedAt,
      endsAt: startedAt + 1_440 * 60_000,
      durationMinutes: 1_440,
      blockedApps: false,
    };
    localStorage.setItem(AMETHYST_STATE_KEY, JSON.stringify(state));

    expect(sessionStore.get()).toBeNull();
  });

  it('refuses a short duration paired with an absurd future end time', () => {
    const state = createAmethystStore().get();
    const startedAt = Date.now();
    state.activeSession = {
      id: 'malformed-end-time',
      startedAt,
      endsAt: startedAt + (MAX_FOCUS_SESSION_MINUTES + 1) * 60_000,
      durationMinutes: 30,
      blockedApps: false,
    };
    localStorage.setItem(AMETHYST_STATE_KEY, JSON.stringify(state));

    expect(sessionStore.get()).toBeNull();
  });

  it('moves a naturally expired session into completed history', () => {
    const now = new Date(2026, 8, 13, 10).getTime();
    vi.spyOn(Date, 'now').mockReturnValue(now);
    const state = createAmethystStore().get();
    state.activeSession = {
      id: 'completed-while-away',
      startedAt: now - 60 * 60_000,
      endsAt: now - 30 * 60_000,
      durationMinutes: 30,
      blockedApps: true,
    };
    localStorage.setItem(AMETHYST_STATE_KEY, JSON.stringify(state));

    expect(sessionHistoryStore.getAll()).toContainEqual(expect.objectContaining({
      id: 'completed-while-away',
      durationMinutes: 30,
      completed: true,
    }));
    expect(createAmethystStore().get().activeSession).toBeNull();

    vi.restoreAllMocks();
  });
});
