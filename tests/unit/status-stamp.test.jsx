import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import StatusStamp from '../../src/components/StatusStamp.jsx';

describe('status stamp', () => {
  // These labels keep status values readable throughout entry lists and cards.
  it.each([
    ['draft', 'Draft'],
    ['published', 'Published'],
    ['verified', 'Verified'],
    ['needs_review', 'Needs Review'],
    ['archived', 'Archived'],
    ['custom_status', 'custom_status'],
  ])('renders the label for %s', (status, label) => {
    render(<StatusStamp status={status} />);

    expect(screen.getByText(label).className).toContain(`stamp-${status}`);
  });
});
