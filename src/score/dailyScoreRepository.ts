import { PACKAGE_BY_SITE_ID, toTargets } from '../engine/catalog';
import { BLOCKLIST_CATALOG } from '../data/blocklistCatalog';
import { dateKeyAt } from '../engine/policy';
import type { EngineStatus } from '../engine/contracts';
import {
  AmethystBlocker,
  type BlockAttemptEvent,
  type UsageStats,
} from '../native/AmethystNativeBridge';
import { normalizeUsageStats } from '../native/usageStats';
import {
  rulesStore,
  scoreStore,
  sessionHistoryStore,
  type StoredRule,
} from '../state/localState';
import type { SessionRecord } from '../state/amethystState';
import {
  calculateDayScore,
  dayRangesForDate,
  type DayScoreResult,
} from './dayScore';

export type DailyScoreStatus = 'ready' | 'partial' | 'permission' | 'error';

export interface DailyScoreSnapshot {
  formulaVersion: 'amethyst-score-v1';
  dateKey: string;
  computedAt: number;
  status: DailyScoreStatus;
  score: DayScoreResult;
  usage: UsageStats;
  attempts: BlockAttemptEvent[];
  attemptsTruncated: boolean;
  longestFocusMinutes: number;
  usageReliable: boolean;
}

interface AttemptResult {
  events: BlockAttemptEvent[];
  maxStored: number;
  truncated?: boolean;
}

export interface DailyScoreDependencies {
  now(): Date;
  getUsageStats(range: { startEpoch: number; endEpoch: number }): Promise<UsageStats>;
  getRecentBlockAttempts(range: {
    startEpoch: number;
    endEpoch: number;
    limit: number;
  }): Promise<AttemptResult>;
  getEngineStatus(): Promise<EngineStatus>;
  getRules(): StoredRule[];
  getHistory(): SessionRecord[];
}

const EMPTY_USAGE: UsageStats = {
  pickups: 0,
  screenTimeMinutes: 0,
  mostUsedApps: [],
  usageByApp: [],
  hourly: [],
  hourlyBuckets: [],
  usageAccessGranted: false,
};

const defaultDependencies: DailyScoreDependencies = {
  now: () => new Date(),
  getUsageStats: (range) => AmethystBlocker.getUsageStats(range),
  getRecentBlockAttempts: (range) => AmethystBlocker.getRecentBlockAttempts(range),
  getEngineStatus: () => AmethystBlocker.getEngineStatus(),
  getRules: () => rulesStore.getAll(),
  getHistory: () => sessionHistoryStore.getAll(),
};

const cache = new Map<string, { createdAt: number; promise: Promise<DailyScoreSnapshot> }>();
const TODAY_CACHE_MS = 30_000;

function sameLocalDay(left: number | Date, right: number | Date) {
  const a = new Date(left);
  const b = new Date(right);
  return a.getFullYear() === b.getFullYear()
    && a.getMonth() === b.getMonth()
    && a.getDate() === b.getDate();
}

function distractingPackages(rules: StoredRule[]) {
  const packages = new Set<string>();
  for (const entry of BLOCKLIST_CATALOG) {
    if (entry.categories.every((category) => category === 'work')) continue;
    for (const packageName of PACKAGE_BY_SITE_ID[entry.id] ?? []) packages.add(packageName);
  }
  for (const rule of rules) {
    if (rule.mode !== 'blocklist') continue;
    const targets = toTargets(rule.siteIds, rule.packageNames ?? [], rule.domains ?? []);
    for (const packageName of targets.packages) packages.add(packageName);
  }
  return packages;
}

async function settledValue<T>(promise: Promise<T>, fallback: T): Promise<{ value: T; ok: boolean }> {
  try {
    return { value: await promise, ok: true };
  } catch {
    return { value: fallback, ok: false };
  }
}

async function loadFresh(
  selectedDate: Date,
  dependencies: DailyScoreDependencies,
): Promise<DailyScoreSnapshot> {
  const now = dependencies.now();
  const ranges = dayRangesForDate(selectedDate, now);
  const [dayResult, eveningResult, morningResult, attemptsResult, engineResult] = await Promise.all([
    settledValue(dependencies.getUsageStats(ranges.day), EMPTY_USAGE),
    settledValue(dependencies.getUsageStats(ranges.evening), EMPTY_USAGE),
    settledValue(dependencies.getUsageStats(ranges.morning), EMPTY_USAGE),
    settledValue(
      dependencies.getRecentBlockAttempts({ ...ranges.day, limit: 500 }),
      { events: [], maxStored: 0, truncated: true },
    ),
    settledValue(dependencies.getEngineStatus(), null),
  ]);

  const usage = normalizeUsageStats(dayResult.value);
  const eveningUsage = normalizeUsageStats(eveningResult.value);
  const morningUsage = normalizeUsageStats(morningResult.value);
  const attempts = attemptsResult.value.events.filter((event) => sameLocalDay(event.timestamp, selectedDate));
  const history = dependencies.getHistory().filter((entry) => sameLocalDay(entry.endedAt, selectedDate));
  const completedFocusMinutes = history
    .filter((entry) => entry.completed)
    .reduce((sum, entry) => sum + entry.durationMinutes, 0);
  const longestFocusMinutes = history.reduce(
    (longest, entry) => entry.completed ? Math.max(longest, entry.durationMinutes) : longest,
    0,
  );
  const selectedKey = dateKeyAt(selectedDate.getTime());
  const unblocksUsed = engineResult.value?.unblockUsage
    .filter((record) => record.date === selectedKey)
    .reduce((sum, record) => sum + record.used, 0) ?? null;
  const attemptsTruncated = attemptsResult.value.truncated === true || !attemptsResult.ok;
  const packageSet = distractingPackages(dependencies.getRules());
  const score = calculateDayScore({
    date: new Date(ranges.day.endEpoch + (sameLocalDay(selectedDate, now) ? 0 : 1)),
    observedMinutes: ranges.observedMinutes,
    usage,
    eveningUsage,
    morningUsage,
    distractingPackages: packageSet,
    unblocksUsed,
    blockAttempts: attemptsTruncated ? null : attempts.length,
    completedFocusMinutes,
  });

  let status: DailyScoreStatus = 'ready';
  if (!dayResult.ok) status = 'error';
  else if (usage.usageAccessGranted === false) status = 'permission';
  else if (
    usage.screenTimeReliable === false
    ||
    score.sleep == null
    || attemptsTruncated
    || !engineResult.ok
    || !eveningResult.ok
    || !morningResult.ok
  ) status = 'partial';

  const snapshot: DailyScoreSnapshot = {
    formulaVersion: score.formulaVersion,
    dateKey: selectedKey,
    computedAt: now.getTime(),
    status,
    score,
    usage,
    attempts,
    attemptsTruncated,
    longestFocusMinutes,
    usageReliable: usage.screenTimeReliable !== false,
  };

  if (sameLocalDay(selectedDate, now) && status !== 'permission' && status !== 'error') {
    scoreStore.set({
      sleep: score.sleep,
      focus: score.focus,
      rest: score.rest,
      overall: score.overall,
    });
  }

  return snapshot;
}

export function getDailyScore(
  selectedDate: Date,
  options: {
    force?: boolean;
    dependencies?: DailyScoreDependencies;
  } = {},
): Promise<DailyScoreSnapshot> {
  const dependencies = options.dependencies ?? defaultDependencies;
  const now = dependencies.now();
  const key = dateKeyAt(selectedDate.getTime());
  const existing = cache.get(key);
  const today = sameLocalDay(selectedDate, now);
  const fresh = existing && (!today || now.getTime() - existing.createdAt < TODAY_CACHE_MS);
  if (!options.force && fresh) return existing.promise;

  const promise = loadFresh(new Date(selectedDate), dependencies);
  cache.set(key, { createdAt: now.getTime(), promise });
  void promise.catch(() => {
    if (cache.get(key)?.promise === promise) cache.delete(key);
  });
  return promise;
}

export function clearDailyScoreCache(date?: Date) {
  if (date) {
    cache.delete(dateKeyAt(date.getTime()));
    return;
  }
  cache.clear();
}
