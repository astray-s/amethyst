import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { AppGlyph } from './AppGlyph';

afterEach(cleanup);

describe('AppGlyph', () => {
  it.each(['Instagram', 'Facebook', 'TikTok', 'YouTube', 'Reddit', 'Netflix', 'Discord', 'X'])(
    'renders a real square brand icon for %s',
    (label) => {
      render(<AppGlyph label={label} />);

      const icon = screen.getByTestId(`app-icon-${label.toLowerCase()}`);
      expect(icon.tagName).toBe('svg');
      expect(icon.getAttribute('viewBox')).toBe('0 0 24 24');
      expect(icon.querySelector('path')).not.toBeNull();
    },
  );

  it('keeps native installed-app artwork when Android supplies it', () => {
    render(<AppGlyph label="Instagram" iconDataUrl="data:image/png;base64,abc" />);

    const icon = screen.getByTestId('app-icon-instagram');
    expect(icon.tagName).toBe('IMG');
    expect(icon.getAttribute('src')).toBe('data:image/png;base64,abc');
  });
});
