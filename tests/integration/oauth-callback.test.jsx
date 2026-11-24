import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import OAuthCallback from '../../src/pages/OAuthCallback.jsx';

const { loginMock } = vi.hoisted(() => ({ loginMock: vi.fn() }));

vi.mock('../../src/context/AuthContext.jsx', () => ({ useAuth: () => ({ login: loginMock }) }));

function renderCallback(entry) {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <Routes>
        <Route path="/oauth-callback" element={<OAuthCallback />} />
        <Route path="/" element={<p>OAuth home</p>} />
        <Route path="/login" element={<p>Login after OAuth failure</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('OAuth callback', () => {
  // This stores the returned fake token and completes the successful callback route.
  it('accepts a callback token and navigates home', async () => {
    renderCallback('/oauth-callback?token=fake-token');

    expect(await screen.findByText('OAuth home')).toBeTruthy();
    expect(loginMock).toHaveBeenCalledWith('fake-token');
  });

  // This sends callbacks without a token back to the login route.
  it('returns to login when the callback has no token', async () => {
    renderCallback('/oauth-callback');

    expect(await screen.findByText('Login after OAuth failure')).toBeTruthy();
    expect(loginMock).not.toHaveBeenCalled();
  });
});
