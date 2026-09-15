/**
 * Versioned contracts between the React UI and the native FocusEngine.
 * These types are mirrored by the native engine (FocusEngine.kt) — keep them in sync.
 */

export type RuleMode = 'blocklist' | 'allowlist';

/** 'easy' rules are Gentle (quota-based pauses); 'hard' rules are Strict (no pause action). */
export type RuleDifficulty = 'easy' | 'hard';

export type Recurrence =
  | { kind: 'always' }
  | { kind: 'weekly'; days: number[]; startMinutes: number; endMinutes: number }
  | { kind: 'oneOff'; startEpoch: number; endEpoch: number };

export interface RuleSpec {
  id: string;
  name: string;
  enabled: boolean;
  mode: RuleMode;
  /** Canonical site IDs from the blocklist catalog (lowercase). */
  siteIds: string[];
  /** Explicit package names beyond the catalog mapping. */
  packageNames: string[];
  /** Resolved host rules sent to the native engine. */
  domains?: string[];
  recurrence: Recurrence;
  difficulty: RuleDifficulty;
  /** Daily five-minute pauses granted by a Gentle rule. Ignored for Strict rules. */
  unblocksPerDay: number;
  presetIcon?: string;
}

export interface EngineStatus {
  /** True when any enabled rule currently produces blocked targets (or an emergency suspension is active). */
  active: boolean;
  /** True while the emergency stop is holding all blocking open. */
  emergencySuspended: boolean;
  emergencyEndsAt: number | null;
  /** Packages and domains effectively blocked right now (after group/exception resolution). */
  blockedPackages: string[];
  blockedDomains: string[];
  /** Rule IDs that contributed to the current blocked set. */
  activeRuleIds: string[];
  /** Current timer session, if any. Native timestamps are canonical. */
  session: ActiveSession | null;
  /** Next instant at which the effective policy changes (null when static). */
  nextBoundaryAt: number | null;
  /** 'exact' when setExactAndAllowWhileIdle is granted, 'inexact' otherwise. */
  schedulePrecision: 'exact' | 'inexact';
  /** True when any enabled allowlist rule constrains the blocked set. */
  allowlistApplied: boolean;
  /** When allowlistApplied: targets that remain allowed (everything else is blocked). */
  allowlistedPackages: string[];
  allowlistedDomains: string[];
  /** True when any active rule is Strict ('hard') — no gentle unblocking is possible. */
  strictActive: boolean;
  /** Native-canonical date-keyed Gentle pause usage. */
  unblockUsage: UnblockUsageRecord[];
  updatedAt: number;
}

export interface ActiveSession {
  id: string;
  kind: 'timer' | 'schedule' | 'combined';
  startedAt: number;
  endsAt: number;
  ruleIds: string[];
  /** Targets the timer session pins blocked for its duration. */
  blockedPackages?: string[];
  blockedDomains?: string[];
  /** completed | manually-ended | emergency-stopped — recorded when the session finalizes. */
  endState?: SessionEndState;
}

export type SessionEndState = 'completed' | 'manually-ended' | 'emergency-stopped';

export interface UnblockDecision {
  allowed: boolean;
  /** Machine-readable reason: 'gentle-quota-available' | 'strict-rule' | 'quota-exhausted' | 'no-active-block'. */
  reason: UnblockReason;
  /** Affected rule IDs when allowed (each loses one quota unit). */
  affectedRuleIds: string[];
  remainingQuotaByRule: Record<string, number>;
  /** When the pause ends (now + pauseMinutes). Null when denied. */
  expiresAt: number | null;
}

export type UnblockReason =
  | 'gentle-quota-available'
  | 'strict-rule'
  | 'quota-exhausted'
  | 'no-active-block';

export type BrowserId = 'chrome' | 'samsung-internet' | 'edge' | 'brave';

export interface BrowserCompatibility {
  browser: BrowserId;
  packageName: string;
  installed: boolean;
  /** 'ok' | 'not-installed' | 'accessibility-disabled' | 'unverified' */
  adapterStatus: 'ok' | 'not-installed' | 'accessibility-disabled' | 'unverified';
  /** Last URL Amethyst observed from this browser's address bar, if any. */
  detectedUrl?: string;
}

export interface UnblockUsageRecord {
  /** Local calendar date key (YYYY-MM-DD) — quotas reset per local day. */
  date: string;
  ruleId: string;
  used: number;
  timestamps: number[];
}

export interface EmergencyEvent {
  at: number;
  /** Suspension window end; 15 minutes after `at`. */
  endsAt: number;
}

export const ENGINE_CONTRACT_VERSION = 3;
