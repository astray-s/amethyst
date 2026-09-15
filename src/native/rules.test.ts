import { describe, expect, it } from 'vitest';
import { toNativeBlockRule } from './rules';
import type { StoredRule } from '../state/localState';

describe('toNativeBlockRule', () => {
  it('normalizes legacy title-cased site IDs into Android packages and domains', () => {
    const rule: StoredRule = {
      id: 'legacy-rule',
      name: 'Legacy defaults',
      enabled: true,
      mode: 'blocklist',
      siteIds: ['Instagram', 'Facebook', 'TikTok'],
      recurrence: 'always',
      difficulty: 'easy',
      unblocksPerDay: 3,
    };

    expect(toNativeBlockRule(rule)).toMatchObject({
      packageNames: [
        'com.instagram.android',
        'com.facebook.katana',
        'com.zhiliaoapp.musically',
      ],
      domains: expect.arrayContaining(['instagram.com', 'facebook.com', 'tiktok.com']),
    });
  });

  it('preserves custom website domains', () => {
    const rule: StoredRule = {
      id: 'custom-rule',
      name: 'Custom website',
      enabled: true,
      mode: 'blocklist',
      siteIds: ['Instagram'],
      packageNames: [],
      domains: ['example.com'],
      recurrence: 'always',
      difficulty: 'easy',
      unblocksPerDay: 3,
    };

    expect(toNativeBlockRule(rule).domains).toEqual(
      expect.arrayContaining(['instagram.com', 'example.com'])
    );
  });
});
