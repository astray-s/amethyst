import { BLOCKLIST_CATALOG } from '../data/blocklistCatalog';
import type { BlockRule } from './AmethystNativeBridge';
import type { StoredRule } from '../state/localState';

const PACKAGE_BY_SITE_ID: Record<string, string[]> = {
  instagram: ['com.instagram.android'],
  tiktok: ['com.zhiliaoapp.musically'],
  youtube: ['com.google.android.youtube'],
  facebook: ['com.facebook.katana'],
  x: ['com.twitter.android'],
  reddit: ['com.reddit.frontpage'],
  discord: ['com.discord'],
  twitch: ['tv.twitch.android.app'],
  pinterest: ['com.pinterest'],
  netflix: ['com.netflix.mediaclient'],
};

export function toNativeBlockRule(rule: StoredRule): BlockRule {
  const sites = rule.siteIds
    .map((id) => {
      const normalized = id.trim().toLowerCase();
      return BLOCKLIST_CATALOG.find((site) =>
        site.id.toLowerCase() === normalized || site.name.toLowerCase() === normalized
      );
    })
    .filter((site): site is NonNullable<typeof site> => Boolean(site));

  return {
    id: rule.id,
    packageNames: [...new Set([...sites.flatMap((site) => PACKAGE_BY_SITE_ID[site.id] ?? []), ...(rule.packageNames ?? [])])],
    domains: [...new Set([...sites.flatMap((site) => site.domains), ...(rule.domains ?? [])])],
    mode: rule.mode,
  };
}
