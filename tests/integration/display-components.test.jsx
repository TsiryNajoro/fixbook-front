import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import ConfirmDialog from '../../src/components/ConfirmDialog.jsx';
import ProblemCard from '../../src/components/ProblemCard.jsx';

describe('display components', () => {
  // This verifies entry metadata and its detail link render together for readers.
  it('shows an entry summary, tags, validations, and a detail link', () => {
    const problem = {
      _id: 'fake-entry-id',
      title: 'Fake issue',
      description: 'Fake incident details',
      status: 'verified',
      category: 'Backend',
      application: 'fake-service',
      environment: 'test',
      tags: ['api', 'urgent'],
      validationSummary: { total: 2, byDepartment: { Platform: 1, QA: 1 } },
    };

    render(<MemoryRouter><ProblemCard problem={problem} /></MemoryRouter>);

    expect(screen.getByRole('link').getAttribute('href')).toBe('/problems/fake-entry-id');
    expect(screen.getByText('Verified')).toBeTruthy();
    expect(screen.getByText('#api')).toBeTruthy();
    expect(screen.getByText('fake-service')).toBeTruthy();
    expect(screen.getByText('✓ Validated by 2 — 1 Platform, 1 QA')).toBeTruthy();
  });

  // This preserves cards without optional metadata or validation summaries.
  it('shows a basic entry without optional metadata', () => {
    render(
      <MemoryRouter>
        <ProblemCard problem={{ _id: 'fake-entry-id', title: 'Basic issue', description: 'Details', status: 'custom', category: 'N/A' }} />
      </MemoryRouter>,
    );

    expect(screen.getByText('Basic issue')).toBeTruthy();
    expect(screen.getByText('custom')).toBeTruthy();
    expect(screen.queryByText(/Validated by/)).toBeNull();
  });

  // This keeps a closed confirmation dialog out of the page DOM.
  it('renders no dialog while closed', () => {
    render(<ConfirmDialog open={false} title="Confirm action" onConfirm={vi.fn()} onCancel={vi.fn()} />);

    expect(screen.queryByText('Confirm action')).toBeNull();
  });

  // This protects prompt text from being lost before the confirmation callback.
  it('passes the entered value to the confirm callback', async () => {
    const onConfirm = vi.fn();
    const user = userEvent.setup();
    render(<ConfirmDialog open title="Archive entry" withInput inputPlaceholder="Reason" onConfirm={onConfirm} onCancel={vi.fn()} />);
    await user.type(screen.getByPlaceholderText('Reason'), 'fake reason');
    await user.click(screen.getByRole('button', { name: 'Confirm' }));

    expect(onConfirm).toHaveBeenCalledWith('fake reason');
  });

  // This prevents clicks inside the dialog from triggering cancellation accidentally.
  it('keeps the dialog open after an inside click and cancels from its cancel button', async () => {
    const onCancel = vi.fn();
    const user = userEvent.setup();
    render(<ConfirmDialog open title="Confirm action" onConfirm={vi.fn()} onCancel={onCancel} />);
    await user.click(screen.getByText('Confirm action'));
    expect(onCancel).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(onCancel).toHaveBeenCalledOnce();
  });
});
