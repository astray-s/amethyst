import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SettingsScreen } from './SettingsScreen';

const { blockerStatus, requestUsagePermission } = vi.hoisted(() => ({
  blockerStatus: vi.fn(),
  requestUsagePermission: vi.fn(),
}));

vi.mock('../native/AmethystNativeBridge', () => ({
  AmethystBlocker: {
    getPermissionStatus: blockerStatus,
    requestUsagePermission,
    requestAccessibilityPermission: vi.fn().mockResolvedValue({ granted: false }),
    requestNotificationPermission: vi.fn().mockResolvedValue({ granted: false }),
  },
}));

describe('SettingsScreen permission refresh', () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  beforeEach(() => {
    localStorage.clear();
    blockerStatus.mockReset();
    requestUsagePermission.mockReset().mockResolvedValue({ granted: false });
  });

  it('refreshes blocker readiness when the app regains focus', async () => {
    blockerStatus
      .mockResolvedValueOnce({
        available: true,
        usageAccess: false,
        accessibility: false,
        notificationsEnabled: false,
        notificationRuntimeGranted: false,
        sdkInt: 36,
      })
      .mockResolvedValue({
        available: true,
        usageAccess: true,
        accessibility: true,
        notificationsEnabled: true,
        notificationRuntimeGranted: true,
        exactAlarms: true,
        sdkInt: 36,
      });

    render(<MemoryRouter><SettingsScreen /></MemoryRouter>);

    await waitFor(() => expect(blockerStatus).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getByRole('button', { name: /Permissions/ }));
    expect(screen.getAllByRole('button', { name: 'Enable' })).toHaveLength(4);

    window.dispatchEvent(new Event('focus'));

    await waitFor(() => expect(blockerStatus).toHaveBeenCalledTimes(2));
    expect(screen.getAllByRole('button', { name: 'Ready' })).toHaveLength(4);
  });

  it('refreshes readiness when the document becomes visible', async () => {
    blockerStatus.mockResolvedValue({
      available: true,
      usageAccess: false,
      accessibility: false,
      notificationsEnabled: false,
      notificationRuntimeGranted: false,
      sdkInt: 36,
    });
    const visibility = vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible');

    render(<MemoryRouter><SettingsScreen /></MemoryRouter>);
    await waitFor(() => expect(blockerStatus).toHaveBeenCalledTimes(1));

    document.dispatchEvent(new Event('visibilitychange'));

    await waitFor(() => expect(blockerStatus).toHaveBeenCalledTimes(2));
    visibility.mockRestore();
  });

  it('has no Browser blocking section on the permissions page', async () => {
    blockerStatus.mockResolvedValue({
      available: true,
      usageAccess: false,
      accessibility: false,
      notificationsEnabled: false,
      notificationRuntimeGranted: false,
      sdkInt: 36,
    });

    render(<MemoryRouter><SettingsScreen /></MemoryRouter>);
    await waitFor(() => expect(blockerStatus).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getByRole('button', { name: /Permissions/ }));

    expect(screen.queryByText('Browser blocking')).toBeNull();
  });

  it('shows a clear message when a permission request is unavailable, instead of silently reverting', async () => {
    blockerStatus.mockResolvedValue({
      available: true,
      usageAccess: false,
      accessibility: false,
      notificationsEnabled: false,
      notificationRuntimeGranted: false,
      sdkInt: 36,
    });
    requestUsagePermission.mockResolvedValueOnce({ granted: false, available: false });

    render(<MemoryRouter><SettingsScreen /></MemoryRouter>);
    await waitFor(() => expect(blockerStatus).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getByRole('button', { name: /Permissions/ }));

    const usageRow = screen.getByText('Usage access').closest('article')!;
    fireEvent.click(within(usageRow).getByRole('button', { name: 'Enable' }));

    expect(await screen.findByRole('alert')).toHaveProperty(
      'textContent',
      "Usage access isn't available outside the installed Android app.",
    );
  });
});
