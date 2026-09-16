import { cleanup, render, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ScheduledBlockRunner } from './ScheduledBlockRunner';

const { syncRules } = vi.hoisted(() => ({
  syncRules: vi.fn().mockResolvedValue({ synced: true }),
}));

vi.mock('../native/AmethystNativeBridge', () => ({
  AmethystBlocker: {
    syncRules,
  },
}));

describe('ScheduledBlockRunner', () => {
  beforeEach(() => {
    localStorage.clear();
    syncRules.mockClear();
  });

  afterEach(() => {
    cleanup();
  });

  it('syncs rules to native without an app-groups field', async () => {
    render(<ScheduledBlockRunner />);

    await waitFor(() => expect(syncRules).toHaveBeenCalledTimes(1));
    expect(syncRules).toHaveBeenCalledWith(expect.objectContaining({ rules: expect.any(Array) }));
    expect(syncRules.mock.calls[0][0]).not.toHaveProperty('groups');
  });
});
