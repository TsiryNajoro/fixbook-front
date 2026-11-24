import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { jsonResponse } from '../setup.js';
import { AuthProvider } from '../../src/context/AuthContext.jsx';
import Login from '../../src/pages/Login.jsx';

function renderLogin(entry = '/login') {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<p>Signed in home</p>} />
        </Routes>
      </AuthProvider>
    </MemoryRouter>,
  );
}

describe('login flow', () => {
  let fetchMock;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });

  // This checks that the form, API client, auth context, and navigation work together.
  it('submits credentials and navigates after a successful login', async () => {
    fetchMock.mockImplementation(async (url) => {
      if (String(url).endsWith('/api/auth/providers')) return jsonResponse({ google: false, microsoft: false });
      if (String(url).endsWith('/api/auth/login')) return jsonResponse({ token: 'fake-token', user: { name: 'Test User' } });
      if (String(url).endsWith('/api/auth/me')) return jsonResponse({ user: { name: 'Test User' } });
      throw new Error(`Unexpected test request: ${url}`);
    });
    const user = userEvent.setup();

    renderLogin();
    await user.type(screen.getByPlaceholderText('you@company.com'), 'dev@example.test');
    await user.type(screen.getByPlaceholderText('Password'), 'fake-password');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(await screen.findByText('Signed in home')).toBeTruthy();
    expect(localStorage.getItem('fixbook_token')).toBe('fake-token');
    expect(fetchMock).toHaveBeenCalledWith('/api/auth/login', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ email: 'dev@example.test', password: 'fake-password' }),
    }));
  });

  // This preserves the API error in the form and keeps the user on the login page.
  it('shows the API error and stays on login after a failed request', async () => {
    fetchMock.mockImplementation(async (url) => {
      if (String(url).endsWith('/api/auth/providers')) return jsonResponse({ google: false, microsoft: false });
      if (String(url).endsWith('/api/auth/login')) return jsonResponse({ error: 'Invalid credentials' }, 401);
      throw new Error(`Unexpected test request: ${url}`);
    });
    const user = userEvent.setup();

    renderLogin();
    await user.type(screen.getByPlaceholderText('you@company.com'), 'dev@example.test');
    await user.type(screen.getByPlaceholderText('Password'), 'wrong-password');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(await screen.findByText('Invalid credentials')).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'FIXBOOK' })).toBeTruthy();
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
  });

  // This keeps password sign-in available if optional OAuth provider lookup fails.
  it('disables OAuth buttons when provider discovery fails', async () => {
    fetchMock.mockRejectedValue(new Error('Provider lookup failed'));

    renderLogin();

    expect(await screen.findByTitle('Not configured on this server yet')).toBeTruthy();
  });

  // This displays known OAuth callback errors supplied in the login URL.
  it('shows a recognized OAuth callback error', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ google: false, microsoft: false }));

    renderLogin('/login?error=oauth');

    expect(await screen.findByText('Something went wrong signing you in. Please try again.')).toBeTruthy();
  });

  // This ignores unknown query errors so arbitrary URL text is never shown as an error.
  it('ignores an unknown login query error', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ google: false, microsoft: false }));

    renderLogin('/login?error=fake-unknown-error');

    expect(screen.getByRole('heading', { name: 'FIXBOOK' })).toBeTruthy();
    expect(screen.queryByText('fake-unknown-error')).toBeNull();
  });
});
