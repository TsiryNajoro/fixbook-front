import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import ConfirmDialog from './ConfirmDialog';
import NotificationBell from './NotificationBell';

function initials(name = '') {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join('');
}

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [confirmingLogout, setConfirmingLogout] = useState(false);

  function handleLogout() {
    logout();
    navigate('/login');
  }

  return (
    <header className="border-b-2 border-ink">
      <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
        <Link to="/" className="font-mono text-xl font-bold tracking-tight text-ink">
          FIX<span className="text-rust">BOOK</span>
        </Link>
        {user && (
          <nav className="flex items-center gap-4 font-mono text-sm">
            <Link to="/" className="hover:text-navy">
              Entries
            </Link>
            <Link to="/my-entries" className="hover:text-navy">
              My Entries
            </Link>

            <div className="w-px h-5 bg-line mx-1" />

            <NotificationBell />

            <Link to="/profile" className="flex items-center gap-2 hover:opacity-80">
              {user.avatarUrl ? (
                <img src={user.avatarUrl} alt="" className="w-7 h-7 rounded-full object-cover border border-ink" />
              ) : (
                <span className="w-7 h-7 rounded-full bg-navy text-paper flex items-center justify-center text-xs font-bold">
                  {initials(user.name) || '?'}
                </span>
              )}
              <span>{user.name}</span>
            </Link>

            <button onClick={() => setConfirmingLogout(true)} className="text-rust hover:underline">
              Log out
            </button>
          </nav>
        )}
      </div>

      <ConfirmDialog
        open={confirmingLogout}
        title="Log out?"
        message="You'll need to sign back in to access FixBook."
        confirmLabel="Log out"
        danger
        onConfirm={handleLogout}
        onCancel={() => setConfirmingLogout(false)}
      />
    </header>
  );
}