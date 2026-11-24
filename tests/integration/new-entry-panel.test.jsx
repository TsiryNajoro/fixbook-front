import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import NewEntryPanel from '../../src/components/NewEntryPanel.jsx';

const { createProblemMock } = vi.hoisted(() => ({ createProblemMock: vi.fn() }));

vi.mock('../../src/api/client.js', () => ({
  api: { createProblem: createProblemMock },
}));

vi.mock('../../src/context/AuthContext.jsx', () => ({
  useAuth: () => ({ token: 'fake-token' }),
}));

describe('new entry form', () => {
  beforeEach(() => {
    createProblemMock.mockReset();
    createProblemMock.mockResolvedValue({ problem: { _id: 'fake-entry-id' } });
  });

  // This prevents publishing an entry without its required description.
  it('requires a description before publishing', async () => {
    const user = userEvent.setup();
    render(<NewEntryPanel onCreated={vi.fn()} onCancel={vi.fn()} />);
    await user.type(screen.getByPlaceholderText('Logs / error messages * (required to log — optional for a draft)'), 'fake log');
    await user.click(screen.getByRole('button', { name: 'Log it →' }));

    expect(await screen.findByText('Description is required to log this entry.')).toBeTruthy();
    expect(createProblemMock).not.toHaveBeenCalled();
  });

  // This prevents publishing an entry without diagnostic logs.
  it('requires logs before publishing', async () => {
    const user = userEvent.setup();
    render(<NewEntryPanel onCreated={vi.fn()} onCancel={vi.fn()} />);
    await user.type(screen.getByPlaceholderText('Title (optional) — e.g. API returns 500 errors after deployment'), 'Fake title');
    await user.type(screen.getByPlaceholderText('What happened? * (required to log — optional for a draft)'), 'fake incident');
    await user.click(screen.getByRole('button', { name: 'Log it →' }));

    expect(await screen.findByText('Logs are required to log this entry.')).toBeTruthy();
    expect(createProblemMock).not.toHaveBeenCalled();
  });

  // This protects payload normalization and the callback after a successful publish.
  it('publishes a normalized entry and calls onCreated', async () => {
    const user = userEvent.setup();
    const onCreated = vi.fn();
    render(<NewEntryPanel onCreated={onCreated} onCancel={vi.fn()} />);
    await user.type(screen.getByPlaceholderText('What happened? * (required to log — optional for a draft)'), 'fake incident');
    await user.type(screen.getByPlaceholderText('Logs / error messages * (required to log — optional for a draft)'), 'fake log');
    await user.click(screen.getByRole('button', { name: /Add category, environment, tags/ }));
    await user.type(screen.getByPlaceholderText('tags, comma, separated (optional)'), ' api, urgent , ');
    await user.click(screen.getByRole('button', { name: 'Log it →' }));

    expect(createProblemMock).toHaveBeenCalledWith('fake-token', expect.objectContaining({
      description: 'fake incident',
      logs: 'fake log',
      tags: ['api', 'urgent'],
      isDraft: false,
    }));
    expect(onCreated).toHaveBeenCalledWith({ _id: 'fake-entry-id' });
  });

  // This protects optional category and deployment metadata in the create payload.
  it('includes optional category, environment, and application details', async () => {
    const user = userEvent.setup();
    render(<NewEntryPanel onCreated={vi.fn()} onCancel={vi.fn()} />);
    await user.type(screen.getByPlaceholderText('Title (optional) — e.g. API returns 500 errors after deployment'), 'Fake title');
    await user.type(screen.getByPlaceholderText('What happened? * (required to log — optional for a draft)'), 'fake incident');
    await user.type(screen.getByPlaceholderText('Logs / error messages * (required to log — optional for a draft)'), 'fake log');
    await user.click(screen.getByRole('button', { name: /Add category, environment, tags/ }));
    await user.selectOptions(screen.getByRole('combobox'), 'Database');
    await user.type(screen.getByPlaceholderText('Environment (optional)'), 'test');
    await user.type(screen.getByPlaceholderText('Affected application / service (optional)'), 'fake-service');
    await user.click(screen.getByRole('button', { name: 'Log it →' }));

    expect(createProblemMock).toHaveBeenCalledWith('fake-token', expect.objectContaining({
      title: 'Fake title',
      category: 'Database',
      environment: 'test',
      application: 'fake-service',
    }));
  });

  // This lets a user close the entry panel without creating a record.
  it('calls onCancel when the panel cancel button is selected', async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();
    render(<NewEntryPanel onCreated={vi.fn()} onCancel={onCancel} />);
    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(onCancel).toHaveBeenCalledOnce();
  });

  // This keeps publishing failures visible and restores the enabled form state.
  it('shows an API error when publishing fails', async () => {
    createProblemMock.mockRejectedValue(new Error('Create failed'));
    const user = userEvent.setup();
    render(<NewEntryPanel onCreated={vi.fn()} onCancel={vi.fn()} />);
    await user.type(screen.getByPlaceholderText('What happened? * (required to log — optional for a draft)'), 'fake incident');
    await user.type(screen.getByPlaceholderText('Logs / error messages * (required to log — optional for a draft)'), 'fake log');
    await user.click(screen.getByRole('button', { name: 'Log it →' }));

    expect(await screen.findByText('Create failed')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Log it →' }).hasAttribute('disabled')).toBe(false);
  });

  // This keeps draft-save failures visible without losing the entered form data.
  it('shows an API error when saving a draft fails', async () => {
    createProblemMock.mockRejectedValue(new Error('Draft save failed'));
    const user = userEvent.setup();
    render(<NewEntryPanel onCreated={vi.fn()} onCancel={vi.fn()} />);
    await user.click(screen.getByRole('button', { name: 'Save as draft' }));

    expect(await screen.findByText('Draft save failed')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Save as draft' }).hasAttribute('disabled')).toBe(false);
  });

  // This allows an incomplete entry to be saved as a draft.
  it('saves an empty entry as a draft', async () => {
    const user = userEvent.setup();
    const onCreated = vi.fn();
    render(<NewEntryPanel onCreated={onCreated} onCancel={vi.fn()} />);
    await user.click(screen.getByRole('button', { name: 'Save as draft' }));

    expect(createProblemMock).toHaveBeenCalledWith('fake-token', expect.objectContaining({
      description: '',
      logs: '',
      tags: [],
      isDraft: true,
    }));
    expect(onCreated).toHaveBeenCalledWith({ _id: 'fake-entry-id' });
  });
});
