import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { EngineContractBanner } from './EngineContractBanner';
import { ENGINE_CONTRACT_MISMATCH_EVENT } from '../native/AmethystNativeBridge';

describe('EngineContractBanner', () => {
  afterEach(cleanup);

  it('stays silent while the web and native contracts agree', () => {
    render(<EngineContractBanner />);
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('warns that rules are not being enforced once native refuses a sync', async () => {
    render(<EngineContractBanner />);

    await act(async () => {
      window.dispatchEvent(new Event(ENGINE_CONTRACT_MISMATCH_EVENT));
    });

    const notice = await screen.findByRole('alert');
    expect(notice.textContent).toMatch(/aren't being\s+enforced/i);
  });
});
