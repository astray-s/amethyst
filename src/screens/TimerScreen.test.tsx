import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { StoredRule } from '../state/localState';
import { TimerScreen } from './TimerScreen';

const {
  startFocusSession,
  stopFocusSession,
  getEngineStatus,
  rulesGetAll,
  selectedRuleGet,
  selectedRuleSet,
  sessionGet,
  sessionSet,
  toNativeBlockRule,
} = vi.hoisted(() => ({
  startFocusSession: vi.fn(),
  stopFocusSession: vi.fn(),
  getEngineStatus: vi.fn(),
  rulesGetAll: vi.fn(),
  selectedRuleGet: vi.fn(),
  selectedRuleSet: vi.fn(),
  sessionGet: vi.fn(),
  sessionSet: vi.fn(),
  toNativeBlockRule: vi.fn(),
}));

vi.mock('../native/AmethystNativeBridge', () => ({
  AmethystBlocker: {
    startFocusSession,
    stopFocusSession,
    getEngineStatus,
  },
}));

vi.mock('../native/rules', () => ({
  toNativeBlockRule,
}));

vi.mock('../state/localState', () => ({
  rulesStore: { getAll: rulesGetAll },
  gemsStore: { getUnlocked: vi.fn().mockReturnValue([]) },
  sessionStore: { get: sessionGet, set: sessionSet },
  sessionHistoryStore: { complete: vi.fn() },
  selectedRuleStore: { get: selectedRuleGet, set: selectedRuleSet },
}));

const validRule: StoredRule = {
  id: 'focus-rule',
  name: 'Focus rule',
  enabled: true,
  mode: 'blocklist',
  siteIds: ['Instagram'],
  packageNames: [],
  recurrence: 'always',
  difficulty: 'easy',
  unblocksPerDay: 3,
};

function renderTimer() {
  return render(
    <MemoryRouter initialEntries={['/timer']}>
      <Routes>
        <Route path="/timer" element={<TimerScreen />} />
        <Route path="/settings" element={<div>Settings destination</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('TimerScreen reliability', () => {
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  beforeEach(() => {
    startFocusSession.mockReset().mockResolvedValue({ started: true });
    stopFocusSession.mockReset().mockResolvedValue({ stopped: true });
    getEngineStatus.mockReset().mockResolvedValue({});
    rulesGetAll.mockReset().mockReturnValue([]);
    selectedRuleGet.mockReset().mockReturnValue('');
    selectedRuleSet.mockReset();
    sessionGet.mockReset().mockReturnValue(null);
    sessionSet.mockReset();
    toNativeBlockRule.mockReset().mockReturnValue({
      id: 'focus-rule',
      packageNames: ['com.instagram.android'],
      domains: [],
      mode: 'blocklist',
    });
  });

  it('opens Settings from the timer cog', async () => {
    renderTimer();

    fireEvent.click(screen.getByRole('button', { name: 'Open settings' }));

    expect(await screen.findByText('Settings destination')).toBeTruthy();
  });

  it('opens timer-only setup without requiring a blocking rule', async () => {
    renderTimer();

    fireEvent.click(screen.getByRole('button', { name: 'Start focus session' }));

    expect(await screen.findByRole('dialog')).toBeTruthy();
    expect(screen.queryByLabelText('Blocking rule')).toBeNull();
    expect(startFocusSession).not.toHaveBeenCalled();
  });

  it('selects the first valid rule when the saved selection is empty', async () => {
    rulesGetAll.mockReturnValue([validRule]);
    renderTimer();

    await waitFor(() => expect(selectedRuleSet).toHaveBeenCalledWith('focus-rule'));
    fireEvent.click(screen.getByRole('button', { name: 'Toggle app blocking' }));
    fireEvent.click(screen.getByRole('button', { name: 'Start focus session' }));

    expect(await screen.findByRole('dialog')).toBeTruthy();
    expect(screen.getByLabelText('Blocking rule')).toHaveValue('focus-rule');
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('starts a timer-only session after a pointer hold', async () => {
    vi.useFakeTimers();
    renderTimer();
    fireEvent.click(screen.getByRole('button', { name: 'Start focus session' }));

    const hold = screen.getByRole('button', { name: 'Hold to start focus session' });
    fireEvent.pointerDown(hold, { pointerId: 1, isPrimary: true, button: 0 });
    await vi.advanceTimersByTimeAsync(501);

    expect(startFocusSession).toHaveBeenCalledWith({
      durationMinutes: 30,
      blockApps: false,
      rule: undefined,
    });
  });

  it('starts on pointer release when the contact duration crosses the hold threshold', async () => {
    vi.useFakeTimers();
    const now = vi.spyOn(performance, 'now').mockReturnValue(0);
    renderTimer();
    fireEvent.click(screen.getByRole('button', { name: 'Start focus session' }));

    const hold = screen.getByRole('button', { name: 'Hold to start focus session' });
    fireEvent.pointerDown(hold, { pointerId: 1, isPrimary: true, button: 0, timeStamp: 100 });
    now.mockReturnValue(501);
    fireEvent.pointerUp(hold, { pointerId: 1, isPrimary: true, button: 0, timeStamp: 601 });

    expect(startFocusSession).toHaveBeenCalledTimes(1);
  });

  it('restores a legacy session referencing a removed Digital Detox preset without crashing', async () => {
    const endsAt = Date.now() + 25 * 60_000;
    sessionGet.mockReturnValue({
      active: true,
      endsAt,
      durationMinutes: 25,
      blockApps: true,
      ruleId: '',
      presetId: 'phone-down',
    });

    renderTimer();

    expect(await screen.findByText('25m')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Hold 5 seconds to end session' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Toggle app blocking' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: /Deep study/ })).toHaveAttribute('aria-pressed', 'true');
  });
});
