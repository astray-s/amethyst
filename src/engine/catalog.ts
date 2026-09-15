import { BLOCKLIST_CATALOG, type SiteEntry } from '../data/blocklistCatalog';

/**
 * Canonical site ID → Android package names. Domains come from the catalog itself.
 * Keep in sync with the native FocusEngine.
 */
export const PACKAGE_BY_SITE_ID: Record<string, string[]> = {
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

/** Canonicalize a site ID or display name to the catalog's lowercase ID, or null when unknown. */
export function canonicalSiteId(id: string): string | null {
  const normalized = id.trim().toLowerCase();
  const site = BLOCKLIST_CATALOG.find(
    (entry) => entry.id === normalized || entry.name.toLowerCase() === normalized
  );
  return site ? site.id : null;
}

export function catalogEntry(siteId: string): SiteEntry | undefined {
  return BLOCKLIST_CATALOG.find((entry) => entry.id === siteId);
}

/** Resolve a set of canonical site IDs plus explicit packages into blocked packages and domains. */
export function toTargets(
  siteIds: string[],
  packageNames: string[] = [],
  explicitDomains: string[] = [],
): { packages: string[]; domains: string[] } {
  const packages = new Set<string>();
  const domains = new Set<string>();
  for (const siteId of siteIds) {
    const entry = catalogEntry(siteId);
    if (!entry) continue;
    for (const domain of entry.domains) domains.add(domain.toLowerCase());
    for (const packageName of PACKAGE_BY_SITE_ID[siteId] ?? []) packages.add(packageName);
  }
  for (const packageName of packageNames) {
    const trimmed = packageName.trim();
    if (trimmed) packages.add(trimmed);
  }
  for (const domain of explicitDomains) {
    const normalized = domain.trim().toLowerCase();
    if (normalized) domains.add(normalized);
  }
  return { packages: [...packages], domains: [...domains] };
}
