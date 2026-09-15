import { describe, expect, it } from 'vitest';
import { dateKeyAt } from './policy';

describe('dateKeyAt', () => {
  it('formats an epoch timestamp as a local YYYY-MM-DD date key', () => {
    expect(dateKeyAt(Date.parse('2026-09-04T23:30:00-07:00'), 'America/Los_Angeles')).toBe('2026-09-04');
  });

  it('respects the given time zone independently of the host clock', () => {
    const epochMs = Date.parse('2026-09-05T02:00:00Z');
    expect(dateKeyAt(epochMs, 'America/Los_Angeles')).toBe('2026-09-04');
    expect(dateKeyAt(epochMs, 'UTC')).toBe('2026-09-05');
  });
});
