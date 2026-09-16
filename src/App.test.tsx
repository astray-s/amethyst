import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import App from './App';

describe('Amethyst app shell', () => {
  afterEach(cleanup);

  it('renders the three audited navigation destinations', async () => {
    window.location.hash = '#/home';
    render(<App />);

    expect(await screen.findByRole('link', { name: 'Home' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'My apps' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Timer' })).toBeTruthy();
    expect(screen.queryByRole('link', { name: 'Profile' })).toBeNull();
  });

  it('keeps the tab bar to the three primary destinations', async () => {
    window.location.hash = '#/profile';
    render(<App />);

    expect(await screen.findByRole('button', { name: 'Back home' })).toBeTruthy();
    expect(screen.queryByRole('link', { name: 'Home' })).toBeNull();
  });
});
