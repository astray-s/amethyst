import type {
  HourlyUsageBucket,
  UsageStats,
} from './AmethystNativeBridge';

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

function finiteNonNegative(value: number | undefined) {
  return Number.isFinite(value) ? Math.max(0, value ?? 0) : 0;
}

function rangeLimitMs(usage: UsageStats) {
  if (
    Number.isFinite(usage.startEpoch)
    && Number.isFinite(usage.endEpoch)
    && (usage.endEpoch ?? 0) > (usage.startEpoch ?? 0)
  ) {
    return Math.min(DAY_MS, (usage.endEpoch ?? 0) - (usage.startEpoch ?? 0));
  }
  return DAY_MS;
}

function normalizeBucket(
  bucket: HourlyUsageBucket,
  usage: UsageStats,
): HourlyUsageBucket {
  const rawMs = Number.isFinite(bucket.screenTimeMs)
    ? finiteNonNegative(bucket.screenTimeMs)
    : finiteNonNegative(bucket.minutes) * MINUTE_MS;
  const hourEnd = bucket.hourStartEpoch + HOUR_MS;
  const rangeStart = usage.startEpoch ?? bucket.hourStartEpoch;
  const rangeEnd = usage.endEpoch ?? hourEnd;
  const availableMs = Math.max(
    0,
    Math.min(hourEnd, rangeEnd) - Math.max(bucket.hourStartEpoch, rangeStart),
  );
  const screenTimeMs = Math.min(rawMs, availableMs, HOUR_MS);
  return {
    ...bucket,
    screenTimeMs,
    minutes: screenTimeMs / MINUTE_MS,
    pickups: Math.max(0, Math.floor(finiteNonNegative(bucket.pickups))),
  };
}

function scaleUsageByApp(
  rows: NonNullable<UsageStats['usageByApp']>,
  targetMs: number,
) {
  const rowMs = rows.map((row) => Number.isFinite(row.screenTimeMs)
    ? finiteNonNegative(row.screenTimeMs)
    : finiteNonNegative(row.minutes) * MINUTE_MS);
  const totalMs = rowMs.reduce((sum, value) => sum + value, 0);
  if (totalMs <= 0) {
    return rows.map((row) => ({ ...row, minutes: 0, screenTimeMs: 0 }));
  }
  return rows.map((row, index) => {
    const screenTimeMs = targetMs * rowMs[index] / totalMs;
    return {
      ...row,
      screenTimeMs,
      minutes: screenTimeMs / MINUTE_MS,
    };
  });
}

function scaleMostUsedApps(
  rows: UsageStats['mostUsedApps'],
  aggregateMs: number,
  targetMs: number,
) {
  if (aggregateMs <= 0) return rows;
  const scale = targetMs / aggregateMs;
  return rows.map((row) => ({
    ...row,
    minutes: finiteNonNegative(row.minutes) * scale,
  }));
}

/**
 * Android's aggregate usage API can return overlapping daily buckets even for
 * a narrow requested range. Hourly UsageEvents are range-bound, so they are the
 * source of truth whenever native supplies them.
 */
export function normalizeUsageStats(usage: UsageStats): UsageStats {
  const suppliedBuckets = usage.hourlyBuckets ?? usage.hourly;
  const hasHourlyBuckets = Array.isArray(suppliedBuckets) && suppliedBuckets.length > 0;
  const hourly = hasHourlyBuckets
    ? suppliedBuckets.map((bucket) => normalizeBucket(bucket, usage))
    : [];
  const exactMs = Math.min(
    rangeLimitMs(usage),
    hourly.reduce((sum, bucket) => sum + bucket.screenTimeMs, 0),
  );
  const rawAggregateMs = Number.isFinite(usage.screenTimeMs)
    ? finiteNonNegative(usage.screenTimeMs)
    : finiteNonNegative(usage.screenTimeMinutes) * MINUTE_MS;
  const aggregateMs = Math.min(rangeLimitMs(usage), rawAggregateMs);
  const explicitlyUnavailable = usage.screenTimeReliable === false
    || usage.screenTimeSource === 'unavailable';
  const screenTimeReliable = !explicitlyUnavailable && (
    !hasHourlyBuckets
    || exactMs > 0
    || rawAggregateMs <= 0
  );
  const screenTimeMs = hasHourlyBuckets
    ? (screenTimeReliable ? exactMs : 0)
    : aggregateMs;
  const usageByApp = screenTimeReliable
    ? scaleUsageByApp(usage.usageByApp ?? [], screenTimeMs)
    : [];
  const mostUsedApps = screenTimeReliable
    ? scaleMostUsedApps(usage.mostUsedApps, rawAggregateMs, screenTimeMs)
    : [];

  return {
    ...usage,
    screenTimeMs,
    screenTimeMinutes: screenTimeMs / MINUTE_MS,
    screenTimeReliable,
    screenTimeSource: hasHourlyBuckets
      ? (screenTimeReliable ? 'hourly-events' : 'unavailable')
      : 'aggregate-fallback',
    mostUsedApps,
    usageByApp,
    hourly,
    hourlyBuckets: hourly,
  };
}
