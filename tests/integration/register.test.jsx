import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import Register from '../../src/pages/Register.jsx';

const { registerMock, loginMock } = vi.hoisted(() => ({ registerMock: vi.fn(), loginMock: vi.fn() }));

vi.mock('../../src/api/client.js', () => ({ api: { register: registerMock } }));
vi.mock('../../src/context/AuthContext.jsx', () => ({ useAuth: () => ({ login: loginMock }) }));

function renderRegister() {
  return render(
    <MemoryRouter initialEntries={['/register']}>
      <Routes>
        <Route path="/register" element={<Register />} />
        <Route path="/" element={<p>Workspace home</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

async function fillRequiredFields(user) {
  await user.type(screen.getByLabelText('Your name'), 'Test User');
  await user.type(screen.getByLabelText('Email address'), 'dev@example.test');
  await user.type(screen.getByLabelText('Password'), 'fake-password');
  await user.type(screen.getByLabelText('Company name'), 'Test Workspace');
}

describe('registration form', () => {
  beforeEach(() => {
    registerMock.mockReset();
    loginMock.mockReset();
  });

  // This protects the account payload and the transition into the new workspace.
  it('creates an account and starts a session after success', async () => {
    registerMock.mockResolvedValue({ token: 'fake-token', user: { name: 'Test User' } });
    const user = userEvent.setup();
    renderRegister();
    await fillRequiredFields(user);
    await user.click(screen.getByRole('button', { name: 'Create account' }));

    expect(await screen.findByText('Workspace home')).toBeTruthy();
    expect(registerMock).toHaveBeenCalledWith({
      name: 'Test User',
      email: 'dev@example.test',
      password: 'fake-password',
      companyName: 'Test Workspace',
      department: '',
    });
    expect(loginMock).toHaveBeenCalledWith('fake-token', { name: 'Test User' });
  }, 15000);

  // This keeps server-side registration errors visible without leaving the form.
  it('shows the registration error and stays on the form', async () => {
    registerMock.mockRejectedValue(new Error('Workspace already exists'));
    const user = userEvent.setup();
    renderRegister();
    await fillRequiredFields(user);
    await user.click(screen.getByRole('button', { name: 'Create account' }));

    expect(await screen.findByText('Workspace already exists')).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'FIXBOOK' })).toBeTruthy();
    expect(loginMock).not.toHaveBeenCalled();
  });
});
