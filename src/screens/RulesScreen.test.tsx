import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { rulesStore, type StoredRule } from '../state/localState';
import { RulesScreen } from './RulesScreen';

const instagramRule: StoredRule = {
  id: 'instagram-daily',
  name: '10 Unblock Daily',
  enabled: true,
  mode: 'blocklist',
  siteIds: ['instagram'],
  packageNames: [],
  recurrence: 'always',
  difficulty: 'easy',
  unblocksPerDay: 10,
};

describe('RulesScreen', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(cleanup);

  it('uses the sparse Apps hierarchy from the Android reference', async () => {
    rulesStore.save([instagramRule]);
    render(
      <MemoryRouter>
        <RulesScreen />
      </MemoryRouter>,
    );

    expect(await screen.findByRole('heading', { name: 'Apps' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Blocked apps' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Schedules' })).toBeTruthy();
    expect(screen.queryByText('AMETHYST')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Create a schedule' })).toBeNull();
  });

  it('opens the chip\'s actual owning rule, not a blank new-rule draft, when nothing is selected yet', async () => {
    rulesStore.save([instagramRule]);
    render(
      <MemoryRouter>
        <RulesScreen />
      </MemoryRouter>,
    );

    const chip = await screen.findByRole('button', { name: 'Open Instagram block details' });
    fireEvent.click(chip);

    expect(await screen.findByRole('dialog')).toBeTruthy();
    expect(screen.getByRole('heading', { name: '10 Unblock Daily' })).toBeTruthy();
    expect(screen.queryByText('NEW RULE')).toBeNull();
  });

  it('shows Blocked apps and Schedules with no app-group controls', async () => {
    render(
      <MemoryRouter>
        <RulesScreen />
      </MemoryRouter>,
    );

    await screen.findByRole('heading', { name: 'Schedules' });
    expect(screen.queryByText('Distracting Apps')).toBeNull();
    expect(screen.queryByText('Always Allowed')).toBeNull();
    expect(screen.queryByText('Never Allowed')).toBeNull();
    expect(document.querySelector('.app-group-list')).toBeNull();
  });
});
