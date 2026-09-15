import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { RuleEditorSheet } from './RuleEditorSheet';
import type { StoredRule } from '../../state/localState';

function blankRule(): StoredRule {
  return {
    id: 'rule_test',
    name: 'New Block',
    enabled: true,
    mode: 'blocklist',
    siteIds: ['instagram', 'tiktok'],
    recurrence: 'always',
    difficulty: 'easy',
    unblocksPerDay: 3,
    unblocksUsedToday: 0,
  };
}

describe('RuleEditorSheet', () => {
  afterEach(cleanup);

  it('keeps focus in the rule-name field while typing, instead of stealing it to the Close button', () => {
    render(
      <RuleEditorSheet
        initial={blankRule()}
        installedApps={[]}
        onSave={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    const input = screen.getByDisplayValue('New Block') as HTMLInputElement;
    input.focus();
    expect(document.activeElement).toBe(input);

    fireEvent.change(input, { target: { value: 'New Block ' } });
    expect(input.value).toBe('New Block ');
    expect(document.activeElement).toBe(input);

    fireEvent.change(input, { target: { value: 'New Block Name' } });
    expect(input.value).toBe('New Block Name');
    expect(document.activeElement).toBe(input);
  });

  it('never calls onClose just from typing in the rule-name field', () => {
    const onClose = vi.fn();
    render(
      <RuleEditorSheet
        initial={blankRule()}
        installedApps={[]}
        onSave={vi.fn()}
        onClose={onClose}
      />,
    );

    const input = screen.getByDisplayValue('New Block') as HTMLInputElement;
    input.focus();
    fireEvent.change(input, { target: { value: 'Focus Time' } });

    expect(onClose).not.toHaveBeenCalled();
  });
});
