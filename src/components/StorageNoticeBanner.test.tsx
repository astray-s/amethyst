import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { StorageNoticeBanner } from './StorageNoticeBanner';
import { AMETHYST_STATE_CORRUPT_NOTICE_KEY, STORAGE_WRITE_FAILED_EVENT } from '../state/amethystState';

describe('StorageNoticeBanner', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(cleanup);

  it('stays silent when there is nothing to report', () => {
    render(<StorageNoticeBanner />);
    expect(screen.queryByRole('status')).toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('shows the recovery notice once, and dismissing it clears the flag for good', async () => {
    localStorage.setItem(AMETHYST_STATE_CORRUPT_NOTICE_KEY, '1');
    render(<StorageNoticeBanner />);

    const notice = await screen.findByRole('status');
    expect(notice.textContent).toMatch(/couldn't read your saved data/i);

    await act(async () => {
      screen.getByRole('button', { name: 'Dismiss' }).click();
    });

    expect(screen.queryByRole('status')).toBeNull();
    expect(localStorage.getItem(AMETHYST_STATE_CORRUPT_NOTICE_KEY)).toBeNull();
  });

  it('shows the write-failed notice when the storage write-failed event fires', async () => {
    render(<StorageNoticeBanner />);

    await act(async () => {
      window.dispatchEvent(new Event(STORAGE_WRITE_FAILED_EVENT));
    });

    const notice = await screen.findByRole('alert');
    expect(notice.textContent).toMatch(/couldn't save your last change/i);
  });
});
