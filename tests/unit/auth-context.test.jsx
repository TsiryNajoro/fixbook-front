import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { AuthProvider, useAuth } from '../../src/context/AuthContext.jsx';

const { meMock } = vi.hoisted(() => ({ meMock: vi.fn() }));

vi.mock('../../src/api/client.js', () => ({ api: { me: meMock } }));

function AuthProbe() {
  const auth = useAuth();
  return (
    <>
      <p>{auth.loading ? 'loading' : 'ready'}</p>
      <p>{auth.token || 'no-token'}</p>
      <p>{auth.user?.name || 'no-user'}</p>
      <button onClick={() => auth.login('fake-token', { name: 'Test User' })}>Start session</button>
      <button onClick={() => auth.login('fake-token')}>Start without user</button>
      <button onClick={() => auth.updateUser({ name: 'Updated User' })}>Update profile</button>
      <button onClick={auth.logout}>End session</button>
    </>
  );
}

describe('auth context', () => {
  beforeEach(() => {
    meMock.mockReset();
    meMock.mockResolvedValue({ user: { name: 'Restored User' } });
  });

  // This protects token persistence and clearing when a user starts and ends a session.
  it('persists a login token and clears it on logout', async () => {
    render(<AuthProvider><AuthProbe /></AuthProvider>);
    fireEvent.click(screen.getByRole('button', { name: 'Start session' }));

    expect(await screen.findByText('Restored User')).toBeTruthy();
    expect(meMock).toHaveBeenCalledWith('fake-token');
    expect(localStorage.getItem('fixbook_token')).toBe('fake-token');
    fireEvent.click(screen.getByRole('button', { name: 'End session' }));

    expect(screen.getByText('no-token')).toBeTruthy();
    expect(screen.getByText('no-user')).toBeTruthy();
    expect(localStorage.getItem('fixbook_token')).toBeNull();
  });

  // This keeps profile edits reflected in the shared authenticated user state.
  it('updates the current user in context', async () => {
    render(<AuthProvider><AuthProbe /></AuthProvider>);
    fireEvent.click(screen.getByRole('button', { name: 'Start session' }));
    expect(await screen.findByText('Restored User')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Update profile' }));

    expect(screen.getByText('Updated User')).toBeTruthy();
  });

  // This lets session restoration supply the user when login has only a token.
  it('loads the user after login receives a token without user details', async () => {
    render(<AuthProvider><AuthProbe /></AuthProvider>);
    fireEvent.click(screen.getByRole('button', { name: 'Start without user' }));

    expect(await screen.findByText('Restored User')).toBeTruthy();
    expect(meMock).toHaveBeenCalledWith('fake-token');
  });
});
