import { canonicalSiteId, toTargets } from '../engine/catalog';
import type {
  EmergencyEvent,
  RuleSpec,
  UnblockUsageRecord,
} from '../engine/contracts';
import { dateKeyAt } from '../engine/policy';

export const AMETHYST_STATE_VERSION = 3;
export const AMETHYST_STATE_KEY = 'amethyst.state';
/** Raw string backed up here, unmodified, when stored state couldn't be read - never auto-pruned. */
export const AMETHYST_STATE_CORRUPT_BACKUP_KEY = 'amethyst.state.corrupt-backup';
/** Presence means "show the one-time recovery notice"; cleared on dismiss. */
export const AMETHYST_STATE_CORRUPT_NOTICE_KEY = 'amethyst.state.corrupt-notice-pending';
/** Dispatched on `window` when a write to storage throws (e.g. full or unavailable storage). */
export const STORAGE_WRITE_FAILED_EVENT = 'amethyst-storage-write-failed';

/** How many days of date-keyed unblock usage to retain. */
export const UNBLOCK_USAGE_RETENTION_DAYS = 30;

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): unknown;
  removeItem?(key: string): unknown;
}

export interface LocalProfile {
  displayName: string;
  avatarInitial: string;
  streak: number;
  longestStreak: number;
  lastCompletedDate: string | null;
}

export interface UsageDay {
  date: string;
  screenTimeMinutes: number;
  pickups: number;
  offlineMinutes: number;
  focusMinutes: number;
  hourlyMinutes: number[];
}

export interface ScoreBreakdown {
  sleep: number | null;
  focus: number;
  rest: number | null;
  overall: number;
}

export interface ScoreInput {
  sleep: number | null;
  focus: number;
  rest: number | null;
}

/**
 * v3 rule record. `recurrence` is the union of always/weekly/oneOff; weekly windows
 * use `days` + `startMinutes`/`endMinutes`, one-off rules use `oneOffStart`/`oneOffEnd`.
 */
export interface BlockRuleRecord {
  id: string;
  name: string;
  enabled: boolean;
  mode: 'blocklist' | 'allowlist';
  siteIds: string[];
  packageNames: string[];
  domains?: string[];
  recurrence: 'always' | 'weekly' | 'oneOff';
  days: number[];
  startMinutes?: number;
  endMinutes?: number;
  oneOffStart?: number;
  oneOffEnd?: number;
  difficulty: 'easy' | 'hard';
  unblocksPerDay: number;
  presetIcon?: string;
}

export interface SessionPreset {
  id: string;
  name: string;
  durationMinutes: number;
  image: string;
  category: 'recommended' | 'detox';
  blockApps: boolean;
  description?: string;
}

export interface FocusSessionState {
  id: string;
  presetId?: string;
  startedAt: number;
  endsAt: number;
  durationMinutes: number;
  blockedApps: boolean;
  ruleId?: string;
  endState?: 'completed' | 'manually-ended' | 'emergency-stopped';
}

export interface SessionRecord {
  id: string;
  presetId?: string;
  startedAt: number;
  endedAt: number;
  durationMinutes: number;
  blockedApps: boolean;
  completed: boolean;
  endState?: 'completed' | 'manually-ended' | 'emergency-stopped';
}

export interface RewardState {
  unlockedIds: string[];
  lastUnlockedId: string | null;
}

export interface PermissionState {
  usage: boolean;
  accessibility: boolean;
  notifications: boolean;
}


export interface LocalSettings {
  sessionSounds: boolean;
  gentleReminders: boolean;
}

export interface AmethystState {
  version: number;
  profile: LocalProfile;
  usage: {
    todayFocusMinutes: number;
    days: UsageDay[];
  };
  score: ScoreBreakdown;
  rules: BlockRuleRecord[];
  presets: SessionPreset[];
  activeSession: FocusSessionState | null;
  history: SessionRecord[];
  rewards: RewardState;
  permissions: PermissionState;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  dailyScores: Record<string, any>;
  /** Date-keyed gentle-pause usage; lives outside rules so quotas reset per local day. */
  unblockUsage: UnblockUsageRecord[];
  emergencyEvent: EmergencyEvent | null;
  settings: LocalSettings;
}

const DEFAULT_PRESETS: SessionPreset[] = [
  {
    id: 'deep-study',
    name: 'Deep study',
    durationMinutes: 90,
    image: '/gems/amethyst-cluster.png',
    category: 'recommended',
    blockApps: true,
  },
  {
    id: 'commute',
    name: 'Commute',
    durationMinutes: 30,
    image: '/gems/amethyst-banded-stone.png',
    category: 'recommended',
    blockApps: false,
  },
  {
    id: 'touch-grass',
    name: 'Touch grass',
    durationMinutes: 480,
    image: '/gems/amethyst-geode.png',
    category: 'detox',
    blockApps: true,
    description: 'No distracting apps',
  },
  {
    id: 'quiet-day',
    name: 'Quiet day',
    durationMinutes: 1440,
    image: '/gems/amethyst-prism.png',
    category: 'detox',
    blockApps: true,
    description: 'A full day offline',
  },
];

export function calculateScore(input: ScoreInput): ScoreBreakdown {
  const sleep = input.sleep == null ? null : clamp(input.sleep);
  const focus = clamp(input.focus);
  const rest = input.rest == null ? null : clamp(input.rest);
  const weighted = [
    sleep == null ? null : { value: sleep, weight: 0.3 },
    { value: focus, weight: 0.4 },
    rest == null ? null : { value: rest, weight: 0.3 },
  ].filter((item): item is { value: number; weight: number } => item !== null);
  const totalWeight = weighted.reduce((sum, item) => sum + item.weight, 0);
  return {
    sleep,
    focus,
    rest,
    overall: Math.round(weighted.reduce((sum, item) => sum + item.value * item.weight, 0) / totalWeight),
  };
}

export function defaultAmethystState(): AmethystState {
  return {
    version: AMETHYST_STATE_VERSION,
    profile: {
      displayName: 'User',
      avatarInitial: 'U',
      streak: 0,
      longestStreak: 0,
      lastCompletedDate: null,
    },
    usage: { todayFocusMinutes: 0, days: [] },
    score: calculateScore({ sleep: null, focus: 50, rest: 90 }),
    rules: [],
    presets: DEFAULT_PRESETS,
    activeSession: null,
    history: [],
    rewards: { unlockedIds: [], lastUnlockedId: null },
    permissions: {
      usage: false,
      accessibility: false,
      notifications: false,
    },
    dailyScores: {},
    unblockUsage: [],
    emergencyEvent: null,
    settings: { sessionSounds: true, gentleReminders: true },
  };
}

/** Convert a stored rule record into the engine-facing RuleSpec. */
export function toRuleSpec(rule: BlockRuleRecord): RuleSpec {
  const siteIds = canonicalizeSiteIds(rule.siteIds);
  const targets = toTargets(siteIds, rule.packageNames, rule.domains ?? []);
  return {
    id: rule.id,
    name: rule.name,
    enabled: rule.enabled,
    mode: rule.mode,
    siteIds,
    packageNames: targets.packages,
    domains: targets.domains,
    recurrence:
      rule.recurrence === 'weekly'
        ? {
            kind: 'weekly',
            days: rule.days,
            startMinutes: rule.startMinutes ?? 0,
            endMinutes: rule.endMinutes ?? 0,
          }
        : rule.recurrence === 'oneOff'
          ? { kind: 'oneOff', startEpoch: rule.oneOffStart ?? 0, endEpoch: rule.oneOffEnd ?? 0 }
          : { kind: 'always' },
    difficulty: rule.difficulty,
    unblocksPerDay: rule.unblocksPerDay,
    presetIcon: rule.presetIcon,
  };
}

/** Canonicalize site IDs and drop unknown ones. */
function canonicalizeSiteIds(siteIds: unknown): string[] {
  if (!Array.isArray(siteIds)) return [];
  const canonical = new Set<string>();
  for (const id of siteIds) {
    if (typeof id !== 'string') continue;
    const mapped = canonicalSiteId(id);
    if (mapped) canonical.add(mapped);
  }
  return [...canonical];
}

function normalizeRecurrence(rule: Record<string, unknown>): 'always' | 'weekly' | 'oneOff' {
  const raw = rule.recurrence;
  if (raw === 'oneOff' || raw === 'always' || raw === 'weekly' || raw === 'daily') {
    return raw === 'daily' ? 'weekly' : raw;
  }
  // Legacy v2 rules without explicit recurrence but with minutes were daily windows.
  return typeof rule.startMinutes === 'number' ? 'weekly' : 'always';
}

/** v2 → v3: canonical IDs, weekly naming, date-keyed unblock usage, settings, emergency. */
export function migrateV2ToV3(previous: Record<string, unknown>, nowMs = Date.now()): AmethystState {
  const base = defaultAmethystState();
  const today = dateKeyAt(nowMs);
  const rulesInput = Array.isArray(previous.rules) ? previous.rules : [];

  const rules: BlockRuleRecord[] = rulesInput
    .filter((item): item is Record<string, unknown> => typeof item === 'object' && item !== null)
    .map((rule) => {
      const recurrence = normalizeRecurrence(rule);
      const difficulty = rule.difficulty === 'hard' ? 'hard' : 'easy';
      const unblocksPerDay =
        typeof rule.unblocksPerDay === 'number' ? Math.max(0, Math.floor(rule.unblocksPerDay)) : difficulty === 'easy' ? 3 : 0;
      const days = Array.isArray(rule.days)
        ? rule.days.filter((day): day is number => typeof day === 'number' && day >= 0 && day <= 6)
        : [];
      return {
        id: typeof rule.id === 'string' && rule.id ? rule.id : `rule_${Math.random().toString(36).slice(2, 9)}`,
        name: typeof rule.name === 'string' && rule.name ? rule.name : 'Untitled rule',
        enabled: rule.enabled !== false,
        mode: rule.mode === 'allowlist' ? 'allowlist' : 'blocklist',
        siteIds: canonicalizeSiteIds(rule.siteIds),
        packageNames: Array.isArray(rule.packageNames)
          ? rule.packageNames.filter((pkg): pkg is string => typeof pkg === 'string' && pkg.trim().length > 0)
          : [],
        domains: Array.isArray(rule.domains)
          ? rule.domains.filter((domain): domain is string => typeof domain === 'string' && domain.trim().length > 0)
          : [],
        recurrence,
        days: recurrence === 'weekly' ? (days.length ? days : [0, 1, 2, 3, 4, 5, 6]) : [],
        startMinutes: typeof rule.startMinutes === 'number' ? rule.startMinutes : undefined,
        endMinutes: typeof rule.endMinutes === 'number' ? rule.endMinutes : undefined,
        oneOffStart: typeof rule.oneOffStart === 'number' ? rule.oneOffStart : undefined,
        oneOffEnd: typeof rule.oneOffEnd === 'number' ? rule.oneOffEnd : undefined,
        difficulty,
        unblocksPerDay: difficulty === 'easy' ? unblocksPerDay : 0,
        presetIcon: typeof rule.presetIcon === 'string' ? rule.presetIcon : undefined,
      } satisfies BlockRuleRecord;
    });

  // Move per-rule counters into date-keyed usage records.
  const unblockUsage: UnblockUsageRecord[] = [];
  for (const rule of rules) {
    const legacyUsed = rulesInput.find((item) => (item as BlockRuleRecord)?.id === rule.id) as
      | { unblocksUsedToday?: number }
      | undefined;
    const used = Math.min(legacyUsed?.unblocksUsedToday ?? 0, rule.unblocksPerDay);
    if (used > 0) {
      unblockUsage.push({ date: today, ruleId: rule.id, used, timestamps: [] });
    }
  }

  return {
    ...base,
    ...pickKnown(previous),
    version: AMETHYST_STATE_VERSION,
    rules,
    unblockUsage,
  };
}

function pickKnown(previous: Record<string, unknown>): Partial<AmethystState> {
  const base = defaultAmethystState();
  const result: Partial<AmethystState> = {};
  for (const key of Object.keys(base) as Array<keyof AmethystState>) {
    if (key === 'version' || key === 'rules' || key === 'unblockUsage') continue;
    if (previous[key] !== undefined) {
      // Shallow-merge objects so newly added nested fields keep their defaults.
      const value = previous[key];
      const defaultValue = base[key];
      if (
        typeof value === 'object' && value !== null && !Array.isArray(value) &&
        typeof defaultValue === 'object' && defaultValue !== null && !Array.isArray(defaultValue)
      ) {
        (result as Record<string, unknown>)[key] = { ...(defaultValue as object), ...(value as object) };
      } else {
        (result as Record<string, unknown>)[key] = value;
      }
    }
  }
  return result;
}

/** Writes via `storage.setItem`, catching a throw (full/unavailable storage) instead of propagating it. */
function safeSetItem(storage: StorageLike, key: string, value: string): boolean {
  try {
    storage.setItem(key, value);
    return true;
  } catch {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event(STORAGE_WRITE_FAILED_EVENT));
    }
    return false;
  }
}

export function migrateLegacyState(storage: StorageLike, nowMs = Date.now()): AmethystState {
  const rawStored = storage.getItem(AMETHYST_STATE_KEY);
  const rawExisting = readJson<Record<string, unknown>>(rawStored);

  let migrated: AmethystState | null = null;
  if (rawExisting?.version === AMETHYST_STATE_VERSION) {
    migrated = { ...defaultAmethystState(), ...rawExisting } as AmethystState;
  } else if (rawExisting?.version === 2) {
    migrated = migrateV2ToV3(rawExisting, nowMs);
  } else if (rawExisting?.version === 1) {
    const asV2 = { ...rawExisting, version: 2, dailyScores: {} };
    migrated = migrateV2ToV3(asV2, nowMs);
  }

  if (!migrated) {
    // rawStored means data existed but couldn't be read (unparseable JSON, or a
    // version this build doesn't know how to migrate) - back it up and flag the
    // one-time notice before overwriting it with defaults. A null/empty rawStored
    // just means a fresh install; that's not corruption and stays silent.
    if (rawStored) {
      safeSetItem(storage, AMETHYST_STATE_CORRUPT_BACKUP_KEY, rawStored);
      safeSetItem(storage, AMETHYST_STATE_CORRUPT_NOTICE_KEY, '1');
    }
    migrated = defaultAmethystState();
  }

  // Prune stale unblock usage beyond the retention window.
  const cutoff = nowMs - UNBLOCK_USAGE_RETENTION_DAYS * 86_400_000;
  migrated.unblockUsage = migrated.unblockUsage.filter(
    (record) => record.date >= dateKeyAt(cutoff)
  );

  safeSetItem(storage, AMETHYST_STATE_KEY, JSON.stringify(migrated));
  return migrated;
}

export function createAmethystStore(storage: StorageLike = window.localStorage) {
  return {
    get(): AmethystState {
      return migrateLegacyState(storage);
    },
    set(state: AmethystState): AmethystState {
      safeSetItem(storage, AMETHYST_STATE_KEY, JSON.stringify(state));
      return state;
    },
    update(mutator: (state: AmethystState) => AmethystState): AmethystState {
      const next = mutator(migrateLegacyState(storage));
      safeSetItem(storage, AMETHYST_STATE_KEY, JSON.stringify(next));
      return next;
    },
  };
}

export function completeFocusSession(state: AmethystState, record: SessionRecord): AmethystState {
  if (state.history.some((item) => item.id === record.id)) return state;
  // Use YYYY-MM-DD date key to avoid timezone issues with toDateString() re-parsing
  const d = new Date(record.endedAt);
  const completionDate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const isNewStreakDay = record.completed && state.profile.lastCompletedDate !== completionDate;
  const previous = state.profile.lastCompletedDate ? new Date(state.profile.lastCompletedDate) : null;
  const elapsedDays = previous ? Math.round((new Date(completionDate).getTime() - previous.getTime()) / 86_400_000) : 1;
  const streak = isNewStreakDay ? (elapsedDays <= 1 ? state.profile.streak + 1 : 1) : state.profile.streak;
  const unlockedId = rewardForStreak(streak);
  const unlockedIds = unlockedId && !state.rewards.unlockedIds.includes(unlockedId)
    ? [...state.rewards.unlockedIds, unlockedId]
    : state.rewards.unlockedIds;

  return {
    ...state,
    activeSession: null,
    history: [record, ...state.history].slice(0, 180),
    usage: {
      ...state.usage,
      todayFocusMinutes: state.usage.todayFocusMinutes + (record.completed ? record.durationMinutes : 0),
    },
    profile: {
      ...state.profile,
      streak,
      longestStreak: Math.max(state.profile.longestStreak, streak),
      lastCompletedDate: isNewStreakDay ? completionDate : state.profile.lastCompletedDate,
    },
    rewards: {
      unlockedIds,
      lastUnlockedId: unlockedId && unlockedIds.includes(unlockedId) ? unlockedId : state.rewards.lastUnlockedId,
    },
  };
}

function rewardForStreak(streak: number) {
  const thresholds: Array<[number, string]> = [
    [365, 'year-of-intent'],
    [180, 'half-year-glow'],
    [90, 'season-of-focus'],
    [30, 'month-of-intent'],
    [14, 'fortnight-flow'],
    [7, 'violet-week'],
    [3, 'steady-spark'],
    [1, 'first-light'],
  ];
  return thresholds.find(([threshold]) => streak >= threshold)?.[1] ?? null;
}

function readJson<T>(raw: string | null): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function clamp(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}
