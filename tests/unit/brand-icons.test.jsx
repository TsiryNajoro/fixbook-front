import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { GoogleIcon, MicrosoftIcon } from '../../src/components/BrandIcons.jsx';

describe('brand icons', () => {
  // This guards the Google sign-in icon used on the login page.
  it('renders the Google icon as an SVG', () => {
    const { container } = render(<GoogleIcon />);

    expect(container.querySelector('svg')).toBeTruthy();
  });

  // This guards the reusable Microsoft sign-in icon component.
  it('renders the Microsoft icon as an SVG', () => {
    const { container } = render(<MicrosoftIcon />);

    expect(container.querySelector('svg')).toBeTruthy();
  });
});
