import type { Recurrence } from './contracts';

/** Local calendar date key (YYYY-MM-DD) used for quota reset and daily records. */
export function dateKeyAt(epochMs: number, timeZone?: string): string {
  const date = new Date(epochMs);
  if (!timeZone) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
  return parts;
}

/** Returns true when the given rule's recurrence window covers the supplied instant. */
export function ruleIsActiveAt(
  recurrence: Recurrence,
  nowMs: number = Date.now(),
): boolean {
  if (recurrence.kind === 'always') return true;

  if (recurrence.kind === 'oneOff') {
    return nowMs >= recurrence.startEpoch && nowMs < recurrence.endEpoch;
  }

  // weekly
  const date = new Date(nowMs);
  const day = date.getDay();
  if (!recurrence.days.includes(day)) return false;

  const minuteOfDay = date.getHours() * 60 + date.getMinutes();
  const { startMinutes, endMinutes } = recurrence;

  if (startMinutes <= endMinutes) {
    // Same-day window (e.g. 12:00–13:00)
    return minuteOfDay >= startMinutes && minuteOfDay < endMinutes;
  }
  // Overnight window (e.g. 22:00–08:00)
  return minuteOfDay >= startMinutes || minuteOfDay < endMinutes;
}
