import { beforeEach, describe, expect, it, vi } from 'vitest';

const { platform, registerPlugin } = vi.hoisted(() => ({
  platform: { value: 'web' },
  registerPlugin: vi.fn(),
}));

vi.mock('@capacitor/core', () => ({
  Capacitor: { getPlatform: () => platform.value },
  registerPlugin,
}));

describe('Amethyst browser bridge', () => {
  beforeEach(() => {
    vi.resetModules();
    platform.value = 'web';
    registerPlugin.mockReset();
  });

  it('reports usage and permissions as unavailable without fabricated data', async () => {
    const { AmethystBlocker } = await import('./AmethystNativeBridge');

    await expect(AmethystBlocker.getPermissionStatus()).resolves.toEqual({
      available: false,
      usageAccess: false,
      accessibility: false,
      notificationsEnabled: false,
      notificationRuntimeGranted: false,
      exactAlarms: false,
      sdkInt: 0,
      failureReason: 'unsupported-platform',
    });
    await expect(AmethystBlocker.getInstalledApps()).resolves.toEqual({
      available: false,
      apps: [],
      failureReason: 'unsupported-platform',
    });
    await expect(AmethystBlocker.getUsageStats()).resolves.toMatchObject({
      available: false,
      pickups: 0,
      screenTimeMinutes: 0,
      mostUsedApps: [],
      usageByApp: [],
      hourly: [],
      failureReason: 'unsupported-platform',
    });
  });

  it('registers only the current Amethyst blocker plugin', async () => {
    platform.value = 'android';
    registerPlugin.mockImplementation(() => ({}));

    await import('./AmethystNativeBridge');

    expect(registerPlugin).toHaveBeenCalledWith('AmethystBlocker');
    expect(registerPlugin).not.toHaveBeenCalledWith('AmethystHealth');
  });

  it('stamps the engine contract version on every native rule sync', async () => {
    platform.value = 'android';
    const syncRules = vi.fn().mockResolvedValue({ synced: true });
    registerPlugin.mockImplementation((name: string) => name === 'AmethystBlocker'
      ? { syncRules }
      : {});

    const { AmethystBlocker } = await import('./AmethystNativeBridge');
    const { ENGINE_CONTRACT_VERSION } = await import('../engine/contracts');

    await AmethystBlocker.syncRules({ rules: [], nowMs: 1000 });

    expect(syncRules).toHaveBeenCalledWith({
      rules: [],
      nowMs: 1000,
      contractVersion: ENGINE_CONTRACT_VERSION,
    });
  });

  it('surfaces a native contract mismatch instead of swallowing it as a generic error', async () => {
    platform.value = 'android';
    const rejection = Object.assign(
      new Error('Engine contract mismatch: web sent 3, native expects 4.'),
      { code: 'ENGINE_CONTRACT_MISMATCH' }
    );
    registerPlugin.mockImplementation((name: string) => name === 'AmethystBlocker'
      ? { syncRules: vi.fn().mockRejectedValue(rejection) }
      : {});

    const { AmethystBlocker, ENGINE_CONTRACT_MISMATCH_EVENT } = await import('./AmethystNativeBridge');
    const onMismatch = vi.fn();
    window.addEventListener(ENGINE_CONTRACT_MISMATCH_EVENT, onMismatch);

    await expect(AmethystBlocker.syncRules({ rules: [] })).resolves.toEqual({
      available: false,
      failureReason: 'engine-contract-mismatch',
      synced: false,
    });
    expect(onMismatch).toHaveBeenCalledTimes(1);

    window.removeEventListener(ENGINE_CONTRACT_MISMATCH_EVENT, onMismatch);
  });

  it('keeps unrelated native sync failures as generic errors', async () => {
    platform.value = 'android';
    registerPlugin.mockImplementation((name: string) => name === 'AmethystBlocker'
      ? { syncRules: vi.fn().mockRejectedValue(new Error('boom')) }
      : {});

    const { AmethystBlocker, ENGINE_CONTRACT_MISMATCH_EVENT } = await import('./AmethystNativeBridge');
    const onMismatch = vi.fn();
    window.addEventListener(ENGINE_CONTRACT_MISMATCH_EVENT, onMismatch);

    await expect(AmethystBlocker.syncRules({ rules: [] })).resolves.toEqual({
      available: false,
      failureReason: 'native-error',
      synced: false,
    });
    expect(onMismatch).not.toHaveBeenCalled();

    window.removeEventListener(ENGINE_CONTRACT_MISMATCH_EVENT, onMismatch);
  });

  it('preserves exact device-interaction timestamps from native usage stats', async () => {
    platform.value = 'android';
    registerPlugin.mockImplementation((name: string) => name === 'AmethystBlocker'
      ? {
          getUsageStats: vi.fn().mockResolvedValue({
            pickups: 2,
            screenTimeMinutes: 15,
            mostUsedApps: [],
            usageByApp: [],
            hourlyBuckets: [],
            usageAccessGranted: true,
            firstPickupEpoch: 100,
            lastPickupEpoch: 200,
            firstActivityEpoch: 110,
            lastActivityEpoch: 190,
          }),
        }
      : {});

    const { AmethystBlocker } = await import('./AmethystNativeBridge');

    await expect(AmethystBlocker.getUsageStats()).resolves.toMatchObject({
      firstPickupEpoch: 100,
      lastPickupEpoch: 200,
      firstActivityEpoch: 110,
      lastActivityEpoch: 190,
    });
  });
});
