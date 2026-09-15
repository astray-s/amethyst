import type { StoredRule } from '../../state/localState';

type RuleTileProps = {
  rule: StoredRule;
  index: number;
  selected: boolean;
  compact?: boolean;
  onPress: () => void;
};

function targetText(rule: StoredRule) {
  const appCount = rule.siteIds.length + (rule.packageNames?.length ?? 0);
  return `${appCount} ${appCount === 1 ? 'app' : 'apps'}`;
}

function scheduleText(rule: StoredRule) {
  if (rule.recurrence === 'always') return 'All day';
  if (rule.recurrence === 'weekly' && rule.startMinutes != null && rule.endMinutes != null) {
    const now = new Date();
    const minuteOfDay = now.getHours() * 60 + now.getMinutes();
    const isActive = rule.startMinutes <= rule.endMinutes
      ? minuteOfDay >= rule.startMinutes && minuteOfDay < rule.endMinutes
      : minuteOfDay >= rule.startMinutes || minuteOfDay < rule.endMinutes;
    if (isActive) {
      const endToday = rule.endMinutes > minuteOfDay ? rule.endMinutes : rule.endMinutes + 1440;
      const remaining = endToday - minuteOfDay;
      const h = Math.floor(remaining / 60);
      const m = remaining % 60;
      return h > 0 ? `${h}h ${m}m left` : `${m}m left`;
    }
    const startsIn = rule.startMinutes > minuteOfDay
      ? rule.startMinutes - minuteOfDay
      : rule.startMinutes + 1440 - minuteOfDay;
    const h = Math.floor(startsIn / 60);
    return h > 0 ? `Starts in ${h}h` : 'Starts soon';
  }
  if (rule.difficulty === 'hard') return 'Strict';
  const left = Math.max(0, rule.unblocksPerDay - (rule.unblocksUsedToday ?? 0));
  return `${left} unblocks left`;
}

export function RuleTile({ rule, index, selected, compact = false, onPress }: RuleTileProps) {
  return (
    <button
      className={`amethyst-rule-tile amethyst-rule-tile--${index % 4} ${compact ? 'amethyst-rule-tile--compact' : ''} ${selected ? 'is-selected' : ''}`}
      onClick={onPress}
    >
      <span className="amethyst-rule-tile__top">
        <span className="amethyst-rule-tile__flow" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="22" height="22"><rect x="3" y="5" width="18" height="16" rx="3" fill="none" stroke="currentColor" strokeWidth="1.5" /><path d="M3 10h18M8 3v4M16 3v4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
          <span className="amethyst-rule-tile__arrow">→</span>
          <svg viewBox="0 0 24 24" width="24" height="24"><path d="M12 3.5 3.5 7.7v8.6L12 20.5l8.5-4.2V7.7Z" fill="var(--amethyst-accent, #a778e7)" fillOpacity=".6" stroke="var(--amethyst-accent, #a778e7)" strokeWidth="1" strokeLinejoin="round" /></svg>
        </span>
        {selected && <span className="amethyst-rule-tile__active">Active</span>}
      </span>
      <span className="amethyst-rule-tile__body">
        <strong>{rule.name}</strong>
        <small>{targetText(rule)} blocked</small>
      </span>
      <span className={`amethyst-rule-tile__meta ${scheduleText(rule).includes('left') ? 'is-active-time' : ''}`}>{scheduleText(rule)}</span>
    </button>
  );
}
