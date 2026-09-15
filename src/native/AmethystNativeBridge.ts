import { Capacitor, registerPlugin } from '@capacitor/core';
import type {
  BrowserCompatibility,
  EngineStatus,
  RuleSpec,
  UnblockDecision,
} from '../engine/contracts';
import { ENGINE_CONTRACT_VERSION } from '../engine/contracts';
import { normalizeUsageStats } from './usageStats';

/** Native's rejection code when its contract version disagrees with ours. */
export const ENGINE_CONTRACT_MISMATCH_CODE = 'ENGINE_CONTRACT_MISMATCH';
/** Dispatched on `window` when native refuses a sync because the contracts disagree. */
export const ENGINE_CONTRACT_MISMATCH_EVENT = 'amethyst-engine-contract-mismatch';

export type BridgeFailureReason =
  | 'engine-contract-mismatch'
  | 'unsupported-platform'
  | 'native-error'
  | 'permission-required'
  | 'no-data'
  | 'PROVIDER_UPDATE_REQUIRED'
  | 'PROVIDER_UNAVAILABLE'
  | 'PERMISSION_DENIED'
  | 'STATUS_CHECK_FAILED'
  | 'NO_DATA'
  | 'READ_FAILED';

export interface InstalledAppInfo {
  packageName: string;
  label: string;
  iconDataUrl?: string;
}

export interface InstalledAppsResult {
  available: boolean;
  apps: InstalledAppInfo[];
  failureReason?: BridgeFailureReason;
}

export interface HourlyUsageBucket {
  hourStartEpoch: number;
  screenTimeMs: number;
  minutes: number;
  pickups: number;
}

export interface UsageStats {
  available?: boolean;
  failureReason?: BridgeFailureReason;
  pickups: number;
  screenTimeMinutes: number;
  mostUsedApps: { packageName: string; label: string; minutes: number }[];
  startEpoch?: number;
  endEpoch?: number;
  screenTimeMs?: number;
  screenTimeReliable?: boolean;
  screenTimeSource?: 'hourly-events' | 'aggregate-fallback' | 'unavailable';
  usageAccessGranted?: boolean;
  wasRangeClamped?: boolean;
  usageByApp?: Array<{
    packageName: string;
    label: string;
    minutes: number;
    screenTimeMs: number;
  }>;
  hourly?: HourlyUsageBucket[];
  hourlyBuckets?: HourlyUsageBucket[];
  firstPickupEpoch?: number;
  lastPickupEpoch?: number;
  firstActivityEpoch?: number;
  lastActivityEpoch?: number;
}

export interface PermissionStatus {
  available?: boolean;
  usageAccess: boolean;
  accessibility: boolean;
  notificationsEnabled: boolean;
  notificationRuntimeGranted: boolean;
  exactAlarms: boolean;
  sdkInt: number;
  failureReason?: BridgeFailureReason;
}

export interface ActiveBlockingStatus {
  active: boolean;
  storedActive: boolean;
  expired: boolean;
  endsAt: number;
  remainingMs: number;
  fromSchedule: boolean;
  blockedPackages: string[];
}

export interface BlockRule {
  id: string;
  packageNames: string[];
  domains: string[];
  mode: 'blocklist' | 'allowlist';
}

export interface BlockAttemptEvent {
  packageName: string;
  label?: string;
  timestamp: number;
}

interface AvailabilityResult {
  available?: boolean;
  failureReason?: BridgeFailureReason;
}

export interface EngineSettingsUpdate {
  sessionSounds?: boolean;
  gentleReminders?: boolean;
  emergencyStop?: boolean;
}

export interface AmethystBlockerPlugin {
  syncRules(opts: {
    rules: RuleSpec[];
    nowMs?: number;
  }): Promise<{ synced: boolean } & AvailabilityResult>;
  getEngineStatus(): Promise<EngineStatus>;
  requestUnblock(opts: {
    targetPackage?: string;
    targetDomain?: string;
  }): Promise<UnblockDecision>;
  updateSettings(opts: EngineSettingsUpdate): Promise<{
    applied: boolean;
    emergencyEvent?: { at: number; endsAt: number } | null;
  } & AvailabilityResult>;
  getBrowserCompatibility(): Promise<{ browsers: BrowserCompatibility[] }>;
  resetAllData(): Promise<{ reset: boolean } & AvailabilityResult>;

  requestUsagePermission(): Promise<{ granted: boolean } & AvailabilityResult>;
  requestNotificationPermission(): Promise<{ granted: boolean } & AvailabilityResult>;
  requestExactAlarmPermission(): Promise<{ granted: boolean } & AvailabilityResult>;
  requestAccessibilityPermission(): Promise<{ granted: boolean } & AvailabilityResult>;
  getPermissionStatus(): Promise<PermissionStatus>;
  getInstalledApps(): Promise<InstalledAppsResult>;
  startFocusSession(opts: {
    durationMinutes: number;
    blockApps: boolean;
    rule?: BlockRule;
  }): Promise<{ started: boolean } & AvailabilityResult>;
  stopFocusSession(opts?: {
    endState?: 'completed' | 'manually-ended' | 'emergency-stopped';
  }): Promise<{ stopped: boolean } & AvailabilityResult>;
  getUsageStats(opts?: { startEpoch?: number; endEpoch?: number }): Promise<UsageStats>;
  getActiveBlockingStatus(): Promise<ActiveBlockingStatus>;
  getRecentBlockAttempts(opts?: {
    limit?: number;
    startEpoch?: number;
    endEpoch?: number;
  }): Promise<{ events: BlockAttemptEvent[]; maxStored: number; truncated?: boolean }>;
  sendNudge(opts: {
    title: string;
    body: string;
  }): Promise<{ sent: boolean } & AvailabilityResult>;
  shareText(opts: {
    title: string;
    text: string;
  }): Promise<{ shared: boolean } & AvailabilityResult>;
}

type NativeBlockerPlugin = Omit<AmethystBlockerPlugin, 'getInstalledApps' | 'syncRules'> & {
  getInstalledApps(): Promise<Partial<InstalledAppsResult> & { apps?: InstalledAppInfo[] }>;
  /** Native requires the contract version; the bridge stamps it, callers never pass it. */
  syncRules(opts: {
    rules: RuleSpec[];
    nowMs?: number;
    contractVersion: number;
  }): Promise<{ synced: boolean } & AvailabilityResult>;
};

const unsupported = {
  available: false,
  failureReason: 'unsupported-platform' as const,
};

const nativeError = {
  available: false,
  failureReason: 'native-error' as const,
};

const unavailablePermissions: PermissionStatus = {
  ...unsupported,
  usageAccess: false,
  accessibility: false,
  notificationsEnabled: false,
  notificationRuntimeGranted: false,
  exactAlarms: false,
  sdkInt: 0,
};

const inactiveEngineStatus: EngineStatus = {
  active: false,
  emergencySuspended: false,
  emergencyEndsAt: null,
  blockedPackages: [],
  blockedDomains: [],
  activeRuleIds: [],
  session: null,
  nextBoundaryAt: null,
  schedulePrecision: 'inexact',
  allowlistApplied: false,
  allowlistedPackages: [],
  allowlistedDomains: [],
  strictActive: false,
  unblockUsage: [],
  updatedAt: 0,
};

const unsupportedBrowsers: BrowserCompatibility[] = [
  { browser: 'chrome', packageName: 'com.android.chrome', installed: false, adapterStatus: 'not-installed' },
  { browser: 'samsung-internet', packageName: 'com.sec.android.app.sbrowser', installed: false, adapterStatus: 'not-installed' },
  { browser: 'edge', packageName: 'com.microsoft.emmx', installed: false, adapterStatus: 'not-installed' },
  { browser: 'brave', packageName: 'com.brave.browser', installed: false, adapterStatus: 'not-installed' },
];

const browserBlocker: AmethystBlockerPlugin = {
  async syncRules() {
    return { ...unsupported, synced: false };
  },
  async getEngineStatus() {
    return inactiveEngineStatus;
  },
  async requestUnblock() {
    return {
      allowed: false,
      reason: 'no-active-block',
      affectedRuleIds: [],
      remainingQuotaByRule: {},
      expiresAt: null,
    };
  },
  async updateSettings() {
    return { ...unsupported, applied: false };
  },
  async getBrowserCompatibility() {
    return { browsers: unsupportedBrowsers };
  },
  async resetAllData() {
    return { ...unsupported, reset: false };
  },
  async requestUsagePermission() {
    return { ...unsupported, granted: false };
  },
  async requestNotificationPermission() {
    return { ...unsupported, granted: false };
  },
  async requestExactAlarmPermission() {
    return { ...unsupported, granted: false };
  },
  async requestAccessibilityPermission() {
    return { ...unsupported, granted: false };
  },
  async getPermissionStatus() {
    return unavailablePermissions;
  },
  async getInstalledApps() {
    return { ...unsupported, apps: [] };
  },
  async startFocusSession() {
    return { ...unsupported, started: false };
  },
  async stopFocusSession() {
    return { ...unsupported, stopped: false };
  },
  async getUsageStats() {
    return {
      ...unsupported,
      pickups: 0,
      screenTimeMinutes: 0,
      screenTimeMs: 0,
      usageAccessGranted: false,
      mostUsedApps: [],
      usageByApp: [],
      hourly: [],
      hourlyBuckets: [],
    };
  },
  async getActiveBlockingStatus() {
    return {
      active: false,
      storedActive: false,
      expired: false,
      endsAt: 0,
      remainingMs: 0,
      fromSchedule: false,
      blockedPackages: [],
    };
  },
  async getRecentBlockAttempts() {
    return { events: [], maxStored: 0 };
  },
  async sendNudge() {
    return { ...unsupported, sent: false };
  },
  async shareText() {
    return { ...unsupported, shared: false };
  },
};

/**
 * Capacitor surfaces a native `call.reject(message, code)` as an Error carrying `code`.
 * The message is also checked because the code is not preserved on every platform path.
 */
function isContractMismatch(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false;
  const { code, message } = error as { code?: unknown; message?: unknown };
  return code === ENGINE_CONTRACT_MISMATCH_CODE
    || (typeof message === 'string' && message.includes(ENGINE_CONTRACT_MISMATCH_CODE));
}

function createNativeBlocker(plugin: NativeBlockerPlugin): AmethystBlockerPlugin {
  return {
    async syncRules(options) {
      try {
        // Stamped here rather than at each call site so no caller can forget it and
        // silently trip native's contract gate.
        return await plugin.syncRules({ ...options, contractVersion: ENGINE_CONTRACT_VERSION });
      } catch (error) {
        if (isContractMismatch(error)) {
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new Event(ENGINE_CONTRACT_MISMATCH_EVENT));
          }
          return { available: false, failureReason: 'engine-contract-mismatch', synced: false };
        }
        return { ...nativeError, synced: false };
      }
    },
    async getEngineStatus() {
      try {
        return await plugin.getEngineStatus();
      } catch {
        return { ...inactiveEngineStatus, updatedAt: Date.now() };
      }
    },
    async requestUnblock(options) {
      try {
        return await plugin.requestUnblock(options);
      } catch {
        return {
          allowed: false,
          reason: 'no-active-block',
          affectedRuleIds: [],
          remainingQuotaByRule: {},
          expiresAt: null,
        };
      }
    },
    async updateSettings(options) {
      try {
        return await plugin.updateSettings(options);
      } catch {
        return { ...nativeError, applied: false };
      }
    },
    async getBrowserCompatibility() {
      try {
        return await plugin.getBrowserCompatibility();
      } catch {
        return { browsers: unsupportedBrowsers };
      }
    },
    async resetAllData() {
      try {
        return await plugin.resetAllData();
      } catch {
        return { ...nativeError, reset: false };
      }
    },
    requestUsagePermission: () => plugin.requestUsagePermission(),
    requestNotificationPermission: () => plugin.requestNotificationPermission(),
    requestExactAlarmPermission: () => plugin.requestExactAlarmPermission(),
    requestAccessibilityPermission: () => plugin.requestAccessibilityPermission(),
    async getPermissionStatus() {
      try {
        const result = await plugin.getPermissionStatus();
        return { ...result, available: result.available ?? true };
      } catch {
        return { ...unavailablePermissions, ...nativeError };
      }
    },
    async getInstalledApps() {
      try {
        const result = await plugin.getInstalledApps();
        return {
          apps: result.apps ?? [],
          available: result.available ?? true,
          failureReason: result.failureReason,
        };
      } catch {
        return { ...nativeError, apps: [] };
      }
    },
    startFocusSession: (options) => plugin.startFocusSession(options),
    stopFocusSession: (options) => plugin.stopFocusSession(options),
    async getUsageStats(options) {
      try {
        const result = await plugin.getUsageStats(options);
        const hourly = result.hourly ?? result.hourlyBuckets ?? [];
        return normalizeUsageStats({
          ...result,
          available: result.available ?? true,
          hourly,
          hourlyBuckets: result.hourlyBuckets ?? hourly,
        });
      } catch {
        return {
          ...nativeError,
          pickups: 0,
          screenTimeMinutes: 0,
          screenTimeMs: 0,
          usageAccessGranted: false,
          mostUsedApps: [],
          usageByApp: [],
          hourly: [],
          hourlyBuckets: [],
        };
      }
    },
    getActiveBlockingStatus: () => plugin.getActiveBlockingStatus(),
    getRecentBlockAttempts: (options) => plugin.getRecentBlockAttempts(options),
    sendNudge: (options) => plugin.sendNudge(options),
    shareText: (options) => plugin.shareText(options),
  };
}

export const isNativePlatform = Capacitor.getPlatform() !== 'web';

const nativeBlocker = isNativePlatform
  ? registerPlugin<NativeBlockerPlugin>('AmethystBlocker')
  : null;

export const AmethystBlocker: AmethystBlockerPlugin = nativeBlocker
  ? createNativeBlocker(nativeBlocker)
  : browserBlocker;
