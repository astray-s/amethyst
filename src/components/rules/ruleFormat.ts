const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function formatRuleTime(value: number | undefined) {
  if (value === undefined) return '';
  const suffix = value >= 12 * 60 ? 'PM' : 'AM';
  const hour = Math.floor(value / 60) % 12 || 12;
  const minute = value % 60;
  return `${hour}${minute ? `:${String(minute).padStart(2, '0')}` : ''}${suffix}`;
}

export function daysLabel(days: number[] | undefined) {
  if (!days || days.length === 0) return '—';
  const sorted = [...days].sort();
  if (sorted.length === 7) return 'Every day';
  if (sorted.length === 5 && sorted.every((day) => day >= 1 && day <= 5)) return 'Weekdays';
  if (sorted.length === 2 && sorted.includes(0) && sorted.includes(6)) return 'Weekends';
  return sorted.map((day) => DAY_LABELS[day]).join(', ');
}
