import { calculateScore, type ScoreBreakdown } from '../state/amethystState';

export interface ScoreUsageBucket {
  hourStartEpoch: number;
  minutes: number;
  pickups: number;
}

export interface ScoreUsageSlice {
  pickups: number;
  screenTimeMinutes: number;
  usageAccessGranted?: boolean;
  usageByApp?: Array<{ packageName: string; minutes: number }>;
  hourly?: ScoreUsageBucket[];
  firstPickupEpoch?: number;
  lastPickupEpoch?: number;
  firstActivityEpoch?: number;
  lastActivityEpoch?: number;
}

export interface DeviceSleepEstimate {
  estimatedSleepHours: number | null;
  lastScrollEpoch: number | null;
  firstPickupEpoch: number | null;
  overnightPhoneMinutes: number;
  firstHourUseMinutes: number;
}

export interface DayScoreMetrics extends DeviceSleepEstimate {
  screenTimeMinutes: number;
  distractingMinutes: number | null;
  pickups: number;
  unblocksUsed: number | null;
  blockAttempts: number | null;
  completedFocusMinutes: number;
  offlineMinutes: number;
  quietHourShare: number;
  longestOfflineStretchMinutes: number;
}

export interface DayScoreInput {
  date: Date;
  observedMinutes: number;
  usage: ScoreUsageSlice;
  eveningUsage: ScoreUsageSlice;
  morningUsage: ScoreUsageSlice;
  distractingPackages: Iterable<string>;
  unblocksUsed: number | null;
  blockAttempts: number | null;
  completedFocusMinutes: number;
}

export interface DayScoreResult extends ScoreBreakdown {
  formulaVersion: 'amethyst-score-v1';
  metrics: DayScoreMetrics;
}

interface EpochRange {
  startEpoch: number;
  endEpoch: number;
}

export interface DayScoreRanges {
  day: EpochRange;
  evening: EpochRange;
  morning: EpochRange;
  observedMinutes: number;
}

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;

function clamp(value: number, minimum = 0, maximum = 100) {
  return Math.min(maximum, Math.max(minimum, value));
}

function ascendingScore(value: number, worst: number, best: number) {
  if (best <= worst) return value >= best ? 100 : 0;
  return clamp((value - worst) / (best - worst) * 100);
}

function descendingScore(value: number, best: number, worst: number) {
  if (worst <= best) return value <= best ? 100 : 0;
  return clamp((worst - value) / (worst - best) * 100);
}

function weightedScore(parts: Array<{ value: number | null; weight: number }>) {
  const available = parts.filter((part): part is { value: number; weight: number } => part.value != null);
  const totalWeight = available.reduce((sum, part) => sum + part.weight, 0);
  if (totalWeight <= 0) return 0;
  return Math.round(available.reduce((sum, part) => sum + part.value * part.weight, 0) / totalWeight);
}

function localMinutes(epoch: number) {
  const date = new Date(epoch);
  return date.getHours() * 60 + date.getMinutes();
}

function nightMinutes(epoch: number) {
  const minutes = localMinutes(epoch);
  return minutes < 6 * 60 ? minutes + 24 * 60 : minutes;
}

function hourlyMinutesInWindow(
  hourly: ScoreUsageBucket[],
  startEpoch: number,
  endEpoch: number,
) {
  return hourly.reduce((sum, bucket) => {
    const bucketStart = bucket.hourStartEpoch;
    const bucketEnd = bucketStart + HOUR_MS;
    const overlapMs = Math.max(0, Math.min(bucketEnd, endEpoch) - Math.max(bucketStart, startEpoch));
    return sum + bucket.minutes * overlapMs / HOUR_MS;
  }, 0);
}

function overnightPhoneMinutes(...slices: ScoreUsageSlice[]) {
  return slices.flatMap((slice) => slice.hourly ?? []).reduce((sum, bucket) => {
    const hour = new Date(bucket.hourStartEpoch).getHours();
    return sum + (hour >= 22 || hour < 6 ? bucket.minutes : 0);
  }, 0);
}

function quietHours(hourly: ScoreUsageBucket[], computedAt: number) {
  let current = 0;
  let longest = 0;
  let completed = 0;
  let quiet = 0;
  for (const bucket of [...hourly].sort((a, b) => a.hourStartEpoch - b.hourStartEpoch)) {
    if (bucket.hourStartEpoch + HOUR_MS > computedAt) continue;
    completed++;
    if (bucket.minutes <= 2 && bucket.pickups === 0) {
      quiet++;
      current += 60;
      longest = Math.max(longest, current);
    } else {
      current = 0;
    }
  }
  return {
    share: completed > 0 ? quiet / completed : 0,
    longest,
  };
}

export function estimateSleepFromUsage(
  eveningUsage: ScoreUsageSlice,
  morningUsage: ScoreUsageSlice,
): DeviceSleepEstimate {
  const lastScrollEpoch = eveningUsage.lastActivityEpoch
    ?? eveningUsage.lastPickupEpoch
    ?? null;
  const firstPickupEpoch = morningUsage.firstPickupEpoch
    ?? morningUsage.firstActivityEpoch
    ?? null;
  const rawHours = lastScrollEpoch != null && firstPickupEpoch != null
    ? (firstPickupEpoch - lastScrollEpoch) / HOUR_MS
    : null;
  const estimatedSleepHours = rawHours != null && rawHours > 0 && rawHours <= 14
    ? Math.round(rawHours * 10) / 10
    : null;
  const firstHourUseMinutes = firstPickupEpoch == null
    ? 0
    : hourlyMinutesInWindow(
        morningUsage.hourly ?? [],
        firstPickupEpoch,
        firstPickupEpoch + HOUR_MS,
      );

  return {
    estimatedSleepHours,
    lastScrollEpoch,
    firstPickupEpoch,
    overnightPhoneMinutes: Math.round(overnightPhoneMinutes(eveningUsage, morningUsage)),
    firstHourUseMinutes: Math.round(firstHourUseMinutes),
  };
}

export function calculateDayScore({
  date,
  observedMinutes,
  usage,
  eveningUsage,
  morningUsage,
  distractingPackages,
  unblocksUsed,
  blockAttempts,
  completedFocusMinutes,
}: DayScoreInput): DayScoreResult {
  const sleepMetrics = estimateSleepFromUsage(eveningUsage, morningUsage);
  const distractingSet = new Set(distractingPackages);
  const distractingMinutes = distractingSet.size === 0 ? null : Math.round((usage.usageByApp ?? [])
    .filter((app) => distractingSet.has(app.packageName))
    .reduce((sum, app) => sum + app.minutes, 0));
  const screenTimeMinutes = Math.max(0, usage.screenTimeMinutes);
  const pickups = Math.max(0, usage.pickups);
  const boundedObservedMinutes = Math.max(1, observedMinutes);
  const offlineMinutes = Math.max(0, boundedObservedMinutes - screenTimeMinutes);
  const quiet = quietHours(usage.hourly ?? [], date.getTime());
  const longestOfflineStretchMinutes = quiet.longest;

  const sleep = sleepMetrics.estimatedSleepHours == null
    || sleepMetrics.lastScrollEpoch == null
    || sleepMetrics.firstPickupEpoch == null
    ? null
    : weightedScore([
        {
          value: clamp(100 - Math.abs(sleepMetrics.estimatedSleepHours - 8) * 16),
          weight: 0.30,
        },
        {
          value: descendingScore(
            Math.max(0, nightMinutes(sleepMetrics.lastScrollEpoch) - 22.5 * 60),
            0,
            180,
          ),
          weight: 0.15,
        },
        {
          value: ascendingScore(localMinutes(sleepMetrics.firstPickupEpoch) - 5.5 * 60, 0, 120),
          weight: 0.15,
        },
        {
          value: descendingScore(sleepMetrics.overnightPhoneMinutes, 10, 90),
          weight: 0.20,
        },
        {
          value: descendingScore(sleepMetrics.firstHourUseMinutes, 10, 45),
          weight: 0.10,
        },
        { value: descendingScore(screenTimeMinutes, 120, 360), weight: 0.10 },
      ]);

  const focus = weightedScore([
    { value: descendingScore(screenTimeMinutes, 120, 360), weight: 0.25 },
    { value: distractingMinutes == null ? null : descendingScore(distractingMinutes, 15, 120), weight: 0.25 },
    { value: descendingScore(pickups, 25, 100), weight: 0.20 },
    { value: unblocksUsed == null ? null : descendingScore(Math.max(0, unblocksUsed), 0, 5), weight: 0.15 },
    { value: blockAttempts == null ? null : descendingScore(Math.max(0, blockAttempts), 0, 20), weight: 0.05 },
    { value: ascendingScore(Math.max(0, completedFocusMinutes), 0, 120), weight: 0.10 },
  ]);

  const rest = usage.usageAccessGranted === false
    ? null
    : weightedScore([
        { value: descendingScore(screenTimeMinutes, 150, 480), weight: 0.40 },
        { value: ascendingScore(quiet.share, 0.55, 0.85), weight: 0.25 },
        { value: ascendingScore(longestOfflineStretchMinutes, 60, 240), weight: 0.35 },
      ]);

  return {
    formulaVersion: 'amethyst-score-v1',
    ...calculateScore({ sleep, focus, rest }),
    metrics: {
      ...sleepMetrics,
      screenTimeMinutes,
      distractingMinutes,
      pickups,
      unblocksUsed: unblocksUsed == null ? null : Math.max(0, unblocksUsed),
      blockAttempts: blockAttempts == null ? null : Math.max(0, blockAttempts),
      completedFocusMinutes: Math.max(0, completedFocusMinutes),
      offlineMinutes: Math.round(offlineMinutes),
      quietHourShare: quiet.share,
      longestOfflineStretchMinutes,
    },
  };
}

export function dayRangesForDate(date: Date, now = new Date()): DayScoreRanges {
  const dayStart = new Date(date);
  dayStart.setHours(0, 0, 0, 0);
  const nextDay = new Date(dayStart);
  nextDay.setDate(nextDay.getDate() + 1);

  const dayEnd = Math.min(now.getTime(), nextDay.getTime() - 1);
  const eveningStart = new Date(dayStart);
  eveningStart.setDate(eveningStart.getDate() - 1);
  eveningStart.setHours(18, 0, 0, 0);
  const overnightBoundary = new Date(dayStart);
  overnightBoundary.setHours(4, 0, 0, 0);
  const morningEnd = new Date(dayStart);
  morningEnd.setHours(12, 0, 0, 0);

  return {
    day: { startEpoch: dayStart.getTime(), endEpoch: Math.max(dayStart.getTime(), dayEnd) },
    evening: { startEpoch: eveningStart.getTime(), endEpoch: overnightBoundary.getTime() },
    morning: {
      startEpoch: overnightBoundary.getTime(),
      endEpoch: Math.max(overnightBoundary.getTime(), Math.min(morningEnd.getTime(), now.getTime())),
    },
    observedMinutes: Math.max(1, Math.min(24 * 60, (dayEnd - dayStart.getTime()) / MINUTE_MS)),
  };
}
