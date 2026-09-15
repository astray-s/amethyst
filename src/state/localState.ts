import type { BlockRule } from '../native/AmethystNativeBridge';
import {
  AMETHYST_STATE_CORRUPT_NOTICE_KEY,
  completeFocusSession,
  createAmethystStore,
  type BlockRuleRecord,
  type FocusSessionState,
  type LocalProfile,
  type LocalSettings,
  type ScoreBreakdown,
  type SessionRecord,
} from './amethystState';
import { dateKeyAt } from '../engine/policy';

export interface StoredRule extends Omit<BlockRuleRecord, 'packageNames' | 'days'> {
  packageNames?: string[];
  days?: number[];
  unblocksUsedToday?: number;
}

export interface FocusSession {
  active: boolean;
  endsAt: number;
  durationMinutes: number;
  blockApps: boolean;
  ruleId?: string;
  presetId?: string;
}

export const MAX_FOCUS_SESSION_MINUTES = 24 * 60 - 1;

const store = createAmethystStore();
export const AMETHYST_STATE_CHANGED_EVENT = 'amethyst-state-changed';

function announceStateChange() {
  window.dispatchEvent(new Event(AMETHYST_STATE_CHANGED_EVENT));
}

function isValidSession(session: FocusSessionState) {
  const sessionLengthMs = session.endsAt - session.startedAt;
  return Number.isInteger(session.durationMinutes)
    && session.durationMinutes >= 1
    && session.durationMinutes <= MAX_FOCUS_SESSION_MINUTES
    && Number.isFinite(session.startedAt)
    && Number.isFinite(session.endsAt)
    && sessionLengthMs > 0
    && sessionLengthMs <= MAX_FOCUS_SESSION_MINUTES * 60_000;
}

function stateWithExpiredSessionReconciled() {
  const state = store.get();
  const session = state.activeSession;
  if (!session || !isValidSession(session) || session.endsAt > Date.now()) return state;

  const next = completeFocusSession(state, {
    id: session.id,
    presetId: session.presetId,
    startedAt: session.startedAt,
    endedAt: session.endsAt,
    durationMinutes: session.durationMinutes,
    blockedApps: session.blockedApps,
    completed: true,
    endState: 'completed',
  });
  store.set(next);
  return next;
}

export const rulesStore = {
  getAll: (): StoredRule[] => {
    const state = store.get();
    const today = dateKeyAt(Date.now());
    return state.rules.map((rule) => toStoredRule(
      rule,
      state.unblockUsage
        .filter((usage) => usage.date === today && usage.ruleId === rule.id)
        .reduce((sum, usage) => sum + usage.used, 0),
    ));
  },
  save: (rules: StoredRule[]) => {
    store.update((state) => ({ ...state, rules: rules.map(toRuleRecord) }));
    announceStateChange();
  },
};

export const streakStore = {
  get: (): number => store.get().profile.streak,
  set: (streak: number) => {
    store.update((state) => ({
      ...state,
      profile: {
        ...state.profile,
        streak,
        longestStreak: Math.max(state.profile.longestStreak, streak),
      },
    }));
  },
};

export const profileStore = {
  get: (): LocalProfile => store.get().profile,
  set: (profile: LocalProfile) => {
    store.update((state) => ({ ...state, profile }));
  },
};

export const gemsStore = {
  getUnlocked: (): string[] => store.get().rewards.unlockedIds,
  unlock: (id: string) => {
    store.update((state) => state.rewards.unlockedIds.includes(id) ? state : {
      ...state,
      rewards: {
        unlockedIds: [...state.rewards.unlockedIds, id],
        lastUnlockedId: id,
      },
    });
  },
  getLastUnlocked: () => store.get().rewards.lastUnlockedId,
};

export const sessionStore = {
  get: (): FocusSession | null => {
    const session = stateWithExpiredSessionReconciled().activeSession;
    if (!session) return null;
    if (!isValidSession(session)) {
      return null;
    }
    return {
      active: session.endsAt > Date.now(),
      endsAt: session.endsAt,
      durationMinutes: session.durationMinutes,
      blockApps: session.blockedApps,
      ruleId: session.ruleId,
      presetId: session.presetId,
    };
  },
  set: (session: FocusSession | null) => {
    store.update((state) => ({
      ...state,
      activeSession: session?.active ? toActiveSession(session) : null,
    }));
  },
};

export const focusMinutesStore = {
  getToday: (): number => store.get().usage.todayFocusMinutes,
  addMinutes: (minutes: number) => {
    store.update((state) => ({
      ...state,
      usage: {
        ...state.usage,
        todayFocusMinutes: state.usage.todayFocusMinutes + minutes,
      },
    }));
  },
  setToday: (minutes: number) => {
    store.update((state) => ({
      ...state,
      usage: { ...state.usage, todayFocusMinutes: Math.max(0, minutes) },
    }));
  },
};

export const selectedRuleStore = {
  get: (): string => localStorage.getItem('amethyst.selectedRuleId') ?? '',
  set: (id: string) => localStorage.setItem('amethyst.selectedRuleId', id),
};

export const dataRecoveryNoticeStore = {
  get: (): boolean => {
    // Corruption is only detected (and this key only set) as a side effect of
    // migrateLegacyState running. Force that here rather than trusting some
    // other component to have already read state first - render order across
    // sibling components isn't guaranteed.
    store.get();
    return localStorage.getItem(AMETHYST_STATE_CORRUPT_NOTICE_KEY) === '1';
  },
  dismiss: () => localStorage.removeItem(AMETHYST_STATE_CORRUPT_NOTICE_KEY),
};

export const scoreStore = {
  get: (): ScoreBreakdown => store.get().score,
  set: (score: ScoreBreakdown) => {
    store.update((state) => ({ ...state, score }));
  },
};

export const sessionHistoryStore = {
  getAll: (): SessionRecord[] => stateWithExpiredSessionReconciled().history,
  complete: (record: SessionRecord) => {
    store.set(completeFocusSession(store.get(), record));
    announceStateChange();
  },
  save: (history: SessionRecord[]) => {
    store.update((state) => ({ ...state, history: history.slice(0, 180) }));
    announceStateChange();
  },
};

export const settingsStore = {
  get: (): LocalSettings => store.get().settings,
  save: (settings: LocalSettings) => {
    store.update((state) => ({ ...state, settings }));
    announceStateChange();
  },
};

export const emergencyStore = {
  set: (at: number, endsAt: number) => {
    store.update((state) => ({
      ...state,
      activeSession: null,
      emergencyEvent: { at, endsAt },
    }));
    announceStateChange();
  },
};

function toStoredRule(rule: BlockRuleRecord, unblocksUsedToday: number): StoredRule {
  return { ...rule, packageNames: rule.packageNames, days: rule.days, unblocksUsedToday };
}

function toRuleRecord(rule: StoredRule): BlockRuleRecord {
  const { unblocksUsedToday: _unblocksUsedToday, ...record } = rule;
  return {
    ...record,
    packageNames: rule.packageNames ?? [],
    domains: rule.domains ?? [],
    days: rule.days ?? [0, 1, 2, 3, 4, 5, 6],
  };
}

function toActiveSession(session: FocusSession): FocusSessionState {
  return {
    id: `session-${session.endsAt}`,
    presetId: session.presetId,
    startedAt: session.endsAt - session.durationMinutes * 60_000,
    endsAt: session.endsAt,
    durationMinutes: session.durationMinutes,
    blockedApps: session.blockApps,
    ruleId: session.ruleId,
  };
}

export type { BlockRule };

// FIX 16: Reactive score store hook — ensures Home and ScoreScreen share the same score
import { useSyncExternalStore } from 'react';

const scoreListeners = new Set<() => void>();
const originalScoreSet = scoreStore.set;
scoreStore.set = (score: ScoreBreakdown) => {
  originalScoreSet(score);
  scoreListeners.forEach((listener) => listener());
};

function subscribeScore(callback: () => void) {
  scoreListeners.add(callback);
  return () => { scoreListeners.delete(callback); };
}

function getScoreSnapshot(): ScoreBreakdown {
  try {
    return scoreStore.get();
  } catch {
    return { sleep: null, focus: 0, rest: 0, overall: 0 };
  }
}

export function useScoreStore(): ScoreBreakdown {
  return useSyncExternalStore(subscribeScore, getScoreSnapshot);
}
