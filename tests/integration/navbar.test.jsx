import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import Navbar from '../../src/components/Navbar.jsx';

const { logoutMock, userMock } = vi.hoisted(() => ({
  logoutMock: vi.fn(),
  userMock: vi.fn(() => ({ name: 'Ada Lovelace Byron' })),
}));

vi.mock('../../src/context/AuthContext.jsx', () => ({
  useAuth: () => ({ user: userMock(), logout: logoutMock }),
}));

vi.mock('../../src/components/NotificationBell.jsx', () => ({ default: () => null }));

describe('navigation bar', () => {
  beforeEach(() => {
    logoutMock.mockReset();
    userMock.mockReset().mockReturnValue({ name: 'Ada Lovelace Byron' });
  });

  // This protects user initials, confirmed logout, and redirect to the sign-in page.
  it('shows initials and logs out only after confirmation', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={['/']}>
        <Navbar />
        <Routes>
          <Route path="/" element={<p>Home page</p>} />
          <Route path="/login" element={<p>Login page</p>} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByText('AL')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Log out' }));
    expect(logoutMock).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('heading', { name: 'Log out?' })).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Log out' }));
    const logoutButtons = screen.getAllByRole('button', { name: 'Log out', exact: true });
    await user.click(logoutButtons.at(-1));

    expect(logoutMock).toHaveBeenCalledOnce();
    expect(await screen.findByText('Login page')).toBeTruthy();
  });

  // This preserves a supplied avatar instead of replacing it with generated initials.
  it('renders a user avatar when an avatar URL is provided', () => {
    userMock.mockReturnValue({ name: 'Test User', avatarUrl: '/fake-avatar.svg' });
    const { container } = render(
      <MemoryRouter>
        <Navbar />
      </MemoryRouter>,
    );

    expect(container.querySelector('img')?.getAttribute('src')).toBe('/fake-avatar.svg');
  });

  // This keeps the avatar placeholder visible when a user has no usable name.
  it('shows a question mark when the user name is empty', () => {
    userMock.mockReturnValue({ name: '' });
    render(<MemoryRouter><Navbar /></MemoryRouter>);

    expect(screen.getByText('?', { exact: true })).toBeTruthy();
  });
});
