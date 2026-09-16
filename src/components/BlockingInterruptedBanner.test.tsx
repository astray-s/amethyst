import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BlockingInterruptedBanner } from './BlockingInterruptedBanner';

const { getActiveBlockingStatus, getPermissionStatus, requestAccessibilityPermission } = vi.hoisted(() => ({
  getActiveBlockingStatus: vi.fn(),
  getPermissionStatus: vi.fn(),
  requestAccessibilityPermission: vi.fn().mockResolvedValue({ granted: false }),
}));

vi.mock('../native/AmethystNativeBridge', () => ({
  isNativePlatform: true,
  AmethystBlocker: {
    getActiveBlockingStatus,
    getPermissionStatus,
    requestAccessibilityPermission,
  },
}));

function activeStatus() {
  return {
    active: true,
    storedActive: true,
    expired: false,
    endsAt: Date.now() + 60_000,
    remainingMs: 60_000,
    fromSchedule: false,
    blockedPackages: ['com.instagram.android'],
  };
}

function permissionStatus(accessibility: boolean) {
  return {
    usageAccess: true,
    accessibility,
    notificationsEnabled: true,
    notificationRuntimeGranted: true,
    exactAlarms: true,
    sdkInt: 34,
  };
}

describe('BlockingInterruptedBanner', () => {
  beforeEach(() => {
    getActiveBlockingStatus.mockReset();
    getPermissionStatus.mockReset();
    requestAccessibilityPermission.mockClear();
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it('warns when a session is active but the Accessibility service is disabled', async () => {
    getActiveBlockingStatus.mockResolvedValue(activeStatus());
    getPermissionStatus.mockResolvedValue(permissionStatus(false));

    render(<BlockingInterruptedBanner />);

    const banner = await screen.findByRole('alert');
    expect(banner.textContent).toMatch(/blocking was interrupted/i);
  });

  it('stays silent when the Accessibility service is still enabled', async () => {
    getActiveBlockingStatus.mockResolvedValue(activeStatus());
    getPermissionStatus.mockResolvedValue(permissionStatus(true));

    render(<BlockingInterruptedBanner />);

    await waitFor(() => expect(getActiveBlockingStatus).toHaveBeenCalled());
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('stays silent when no session is active, even without Accessibility enabled', async () => {
    getActiveBlockingStatus.mockResolvedValue({ ...activeStatus(), active: false });
    getPermissionStatus.mockResolvedValue(permissionStatus(false));

    render(<BlockingInterruptedBanner />);

    await waitFor(() => expect(getActiveBlockingStatus).toHaveBeenCalled());
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('re-checks and opens Accessibility settings when the window regains focus', async () => {
    getActiveBlockingStatus.mockResolvedValue(activeStatus());
    getPermissionStatus
      .mockResolvedValueOnce(permissionStatus(false))
      .mockResolvedValueOnce(permissionStatus(true));

    render(<BlockingInterruptedBanner />);
    const banner = await screen.findByRole('alert');
    banner.querySelector('button')!.click();
    expect(requestAccessibilityPermission).toHaveBeenCalledTimes(1);

    await act(async () => {
      window.dispatchEvent(new Event('focus'));
    });

    await waitFor(() => expect(screen.queryByRole('alert')).toBeNull());
  });

  it('notices a session that starts while the app stays foregrounded, with no focus event', async () => {
    vi.useFakeTimers();
    getActiveBlockingStatus.mockResolvedValue({ ...activeStatus(), active: false });
    getPermissionStatus.mockResolvedValue(permissionStatus(false));

    render(<BlockingInterruptedBanner />);
    await vi.waitFor(() => expect(getActiveBlockingStatus).toHaveBeenCalledTimes(1));
    expect(screen.queryByRole('alert')).toBeNull();

    getActiveBlockingStatus.mockResolvedValue(activeStatus());

    await act(async () => {
      vi.advanceTimersByTime(60_000);
    });

    const banner = await vi.waitFor(() => screen.getByRole('alert'));
    expect(banner.textContent).toMatch(/blocking was interrupted/i);
  });
});
