import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { jsonResponse } from '../setup.js';
import App from '../../src/App.jsx';
import { AuthProvider } from '../../src/context/AuthContext.jsx';

vi.mock('../../src/components/NotificationBell.jsx', () => ({ default: () => null }));

describe('protected routes', () => {
  let fetchMock;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    localStorage.setItem('fixbook_token', 'fake-token');
  });

  // This verifies that an expired saved session is cleared and private pages redirect to login.
  it('redirects to login and clears a saved token after session restoration gets 401', async () => {
    fetchMock.mockImplementation(async (url) => {
      if (String(url).endsWith('/api/auth/me')) return jsonResponse({ error: 'Session expired' }, 401);
      if (String(url).endsWith('/api/auth/providers')) return jsonResponse({ google: false, microsoft: false });
      throw new Error(`Unexpected test request: ${url}`);
    });

    render(
      <MemoryRouter initialEntries={['/my-entries']}>
        <AuthProvider>
          <App />
        </AuthProvider>
      </MemoryRouter>,
    );

    expect(await screen.findByLabelText('Email address')).toBeTruthy();
    expect(localStorage.getItem('fixbook_token')).toBeNull();
  });

  // This protects access to the dashboard after a saved session is validated.
  it('renders a protected page when the saved session is valid', async () => {
    fetchMock.mockImplementation(async (url) => {
      if (String(url).endsWith('/api/auth/me')) return jsonResponse({ user: { name: 'Test User' } });
      if (String(url).includes('/api/problems')) return jsonResponse({ problems: [] });
      if (String(url).endsWith('/api/company/me')) return jsonResponse({ company: { categories: [] } });
      if (String(url).endsWith('/api/notifications')) return jsonResponse({ notifications: [], unreadCount: 0 });
      throw new Error(`Unexpected test request: ${url}`);
    });

    render(
      <MemoryRouter initialEntries={['/']}>
        <AuthProvider>
          <App />
        </AuthProvider>
      </MemoryRouter>,
    );

    expect(await screen.findByText('No entries yet.')).toBeTruthy();
    expect(screen.getByText('Test User')).toBeTruthy();
  });
});
