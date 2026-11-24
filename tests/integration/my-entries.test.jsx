import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { jsonResponse } from '../setup.js';
import MyEntries from '../../src/pages/MyEntries.jsx';

vi.mock('../../src/context/AuthContext.jsx', () => ({ useAuth: () => ({ token: 'fake-token' }) }));

function renderMyEntries() {
  return render(
    <MemoryRouter initialEntries={['/my-entries']}>
      <Routes>
        <Route path="/my-entries" element={<MyEntries />} />
        <Route path="/problems/:id" element={<p>Created entry details</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('my entries page', () => {
  let fetchMock;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });

  // This keeps the page's loading feedback visible while personal entries are pending.
  it('shows a loading state while personal entries are pending', async () => {
    let resolveEntries;
    fetchMock.mockImplementation(() => new Promise((resolve) => { resolveEntries = resolve; }));
    renderMyEntries();
    expect(screen.getByText('Loading…')).toBeTruthy();

    resolveEntries(jsonResponse({ problems: [] }));
    expect(await screen.findByText("You haven't logged anything yet.")).toBeTruthy();
  });

  // This separates drafts from published entries so private work stays identifiable.
  it('groups drafts separately from published entries', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ problems: [
      { _id: 'fake-draft-id', title: 'Draft issue', description: 'Draft details', status: 'draft', category: 'N/A' },
      { _id: 'fake-published-id', title: 'Published issue', description: 'Published details', status: 'published', category: 'Backend' },
    ] }));
    renderMyEntries();

    expect(await screen.findByText('DRAFTS — only visible to you')).toBeTruthy();
    expect(screen.getByText('PUBLISHED')).toBeTruthy();
    expect(screen.getByText('Draft issue')).toBeTruthy();
    expect(screen.getByText('Published issue')).toBeTruthy();
  });

  // This shows an empty state when the user has not created any entries.
  it('shows the empty state when no entries exist', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ problems: [] }));
    renderMyEntries();

    expect(await screen.findByText("You haven't logged anything yet.")).toBeTruthy();
  });

  // This keeps API failures visible instead of presenting them as an empty list.
  it('shows the API error when personal entries cannot be loaded', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ error: 'Entries unavailable' }, 500));
    renderMyEntries();

    expect(await screen.findByText('Entries unavailable')).toBeTruthy();
  });

  // This verifies that a created entry closes the panel and opens its detail route.
  it('creates an entry and navigates to its detail page', async () => {
    fetchMock.mockImplementation((url, options) => {
      if (String(url).includes('/api/problems?mine=true')) return Promise.resolve(jsonResponse({ problems: [] }));
      if (String(url) === '/api/problems' && options.method === 'POST') {
        return Promise.resolve(jsonResponse({ problem: { _id: 'fake-entry-id' } }));
      }
      throw new Error(`Unexpected test request: ${url}`);
    });
    const user = userEvent.setup();
    renderMyEntries();
    await screen.findByText("You haven't logged anything yet.");
    await user.click(screen.getByRole('button', { name: 'New entry' }));
    await user.type(screen.getByLabelText('Entry description'), 'fake incident');
    await user.type(screen.getByLabelText('Entry logs'), 'fake log');
    await user.click(screen.getByRole('button', { name: 'Log it →' }));

    expect(await screen.findByText('Created entry details')).toBeTruthy();
  });
});
