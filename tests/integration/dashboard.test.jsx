import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { jsonResponse } from '../setup.js';
import Dashboard from '../../src/pages/Dashboard.jsx';

vi.mock('../../src/context/AuthContext.jsx', () => ({
  useAuth: () => ({ token: 'fake-token' }),
}));

function renderDashboard() {
  return render(
    <MemoryRouter>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/problems/:id" element={<p>Created entry detail</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

function respondToDashboardRequests(fetchMock, problemsResponse, categories = []) {
  fetchMock.mockImplementation((url, options = {}) => {
    if (String(url).includes('/api/problems') && options.method === 'POST') {
      return Promise.resolve(jsonResponse({ problem: { _id: 'fake-entry-id' } }));
    }
    if (String(url).includes('/api/problems')) return problemsResponse();
    if (String(url).endsWith('/api/company/me')) return Promise.resolve(jsonResponse({ company: { categories } }));
    throw new Error(`Unexpected test request: ${url}`);
  });
}

describe('dashboard loading states', () => {
  let fetchMock;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });

  // This protects the loading indicator while the real API client waits on fetch.
  it('shows a loading state while entries are pending', async () => {
    let resolveProblems;
    respondToDashboardRequests(fetchMock, () => new Promise((resolve) => { resolveProblems = resolve; }));

    renderDashboard();
    expect(screen.getByText('Loading entries…')).toBeTruthy();

    resolveProblems(jsonResponse({ problems: [] }));
    expect(await screen.findByText('No entries yet.')).toBeTruthy();
  });

  // This keeps the empty state visible when the API successfully returns no entries.
  it('shows an empty state when there are no entries', async () => {
    respondToDashboardRequests(fetchMock, () => Promise.resolve(jsonResponse({ problems: [] })));

    renderDashboard();

    expect(await screen.findByText('No entries yet.')).toBeTruthy();
  });

  // This preserves a readable server error when loading entries fails.
  it('shows the API error when loading entries fails', async () => {
    respondToDashboardRequests(fetchMock, () => Promise.resolve(jsonResponse({ error: 'Entries unavailable' }, 500)));

    renderDashboard();

    expect(await screen.findByText('Entries unavailable')).toBeTruthy();
  });

  // This protects search submission and query encoding through the real API client.
  it('loads entries using the submitted search text', async () => {
    respondToDashboardRequests(fetchMock, () => Promise.resolve(jsonResponse({ problems: [] })));
    const user = userEvent.setup();
    renderDashboard();
    await screen.findByText('No entries yet.');
    await user.type(screen.getByLabelText('Search entries'), 'database down');
    await user.click(screen.getByRole('button', { name: 'Search' }));

    expect(fetchMock.mock.calls.some(([url]) => String(url) === '/api/problems?q=database+down')).toBe(true);
  });

  // This keeps category and status filters synchronized with the API query.
  it('filters by a company category and a problem status', async () => {
    respondToDashboardRequests(fetchMock, () => Promise.resolve(jsonResponse({ problems: [] })), ['Backend']);
    const user = userEvent.setup();
    renderDashboard();
    await screen.findByRole('option', { name: 'Backend' });
    const filters = screen.getAllByRole('combobox');
    await user.selectOptions(filters[0], 'Backend');
    await user.selectOptions(filters[1], 'needs_review');

    expect(fetchMock.mock.calls.some(([url]) => String(url) === '/api/problems?status=needs_review&category=Backend')).toBe(true);
  });

  // This keeps the dashboard's entry form easy to open and dismiss.
  it('opens and cancels the new entry form', async () => {
    respondToDashboardRequests(fetchMock, () => Promise.resolve(jsonResponse({ problems: [] })));
    const user = userEvent.setup();
    renderDashboard();
    await screen.findByText('No entries yet.');
    await user.click(screen.getByRole('button', { name: 'New entry' }));
    expect(screen.getByText('What broke?')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(screen.queryByText('What broke?')).toBeNull();
  });

  // This renders returned entries through the card component on the dashboard.
  it('shows a card for each returned entry', async () => {
    respondToDashboardRequests(fetchMock, () => Promise.resolve(jsonResponse({ problems: [
      { _id: 'fake-entry-id', title: 'Returned issue', description: 'Details', status: 'verified', category: 'Backend' },
    ] })));
    renderDashboard();

    expect(await screen.findByText('Returned issue')).toBeTruthy();
    expect(screen.getByText('Verified')).toBeTruthy();
  });

  // This protects the dashboard create flow through its API call and detail navigation.
  it('creates an entry and navigates to its detail route', async () => {
    respondToDashboardRequests(fetchMock, () => Promise.resolve(jsonResponse({ problems: [] })));
    const user = userEvent.setup();
    renderDashboard();
    await screen.findByText('No entries yet.');
    await user.click(screen.getByRole('button', { name: 'New entry' }));
    await user.type(screen.getByLabelText('Entry description'), 'fake incident');
    await user.type(screen.getByLabelText('Entry logs'), 'fake log');
    await user.click(screen.getByRole('button', { name: 'Log it →' }));

    expect(await screen.findByText('Created entry detail')).toBeTruthy();
  });

  // This preserves the dashboard when optional company category lookup is unavailable.
  it('keeps the default category option when company lookup fails', async () => {
    fetchMock.mockImplementation((url) => {
      if (String(url).includes('/api/problems')) return Promise.resolve(jsonResponse({ problems: [] }));
      if (String(url).endsWith('/api/company/me')) return Promise.resolve(jsonResponse({ error: 'Unavailable' }, 500));
      throw new Error(`Unexpected test request: ${url}`);
    });
    renderDashboard();

    expect(await screen.findByRole('option', { name: 'All categories' })).toBeTruthy();
    expect(screen.queryByRole('option', { name: 'Backend' })).toBeNull();
  });

  // This keeps uncategorized entries filterable when the company has no category list.
  it('uses the uncategorized option when the company response omits categories', async () => {
    fetchMock.mockImplementation((url) => {
      if (String(url).includes('/api/problems')) return Promise.resolve(jsonResponse({ problems: [] }));
      if (String(url).endsWith('/api/company/me')) return Promise.resolve(jsonResponse({ company: {} }));
      throw new Error(`Unexpected test request: ${url}`);
    });
    renderDashboard();

    expect(await screen.findByRole('option', { name: 'N/A' })).toBeTruthy();
  });
});
