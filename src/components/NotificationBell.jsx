import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { api } from '../api/client';

function timeAgo(date) {
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default function NotificationBell() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const containerRef = useRef(null);

  async function load() {
    try {
      const data = await api.listNotifications(token);
      setNotifications(data.notifications);
      setUnreadCount(data.unreadCount);
    } catch {
      // fail silently - notifications are a non-critical nice-to-have
    }
  }

  useEffect(() => {
    load();
    const interval = setInterval(load, 30000); // poll every 30s for new notifications
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    function handleClickOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  async function handleOpen() {
    setOpen((o) => !o);
    if (!open) await load();
  }

  async function handleClickNotification(n) {
    if (!n.read) {
      await api.markNotificationRead(token, n._id);
    }
    setOpen(false);
    if (n.problem?._id) navigate(`/problems/${n.problem._id}`);
    load();
  }

  async function handleMarkAllRead() {
    await api.markAllNotificationsRead(token);
    load();
  }

  return (
    <div className="relative" ref={containerRef}>
      <button onClick={handleOpen} className="relative p-1.5 hover:text-navy">
        <Bell size={18} />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-rust text-paper text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 card p-0 z-40 max-h-96 overflow-y-auto">
          <div className="flex items-center justify-between p-3 border-b border-line">
            <p className="font-mono text-xs text-muted">NOTIFICATIONS</p>
            {unreadCount > 0 && (
              <button onClick={handleMarkAllRead} className="text-xs font-mono text-navy hover:underline">
                Mark all read
              </button>
            )}
          </div>
          {notifications.length === 0 ? (
            <p className="p-4 text-sm text-muted text-center">Nothing yet.</p>
          ) : (
            notifications.map((n) => (
              <button
                key={n._id}
                onClick={() => handleClickNotification(n)}
                className={`block w-full text-left p-3 border-b border-line last:border-b-0 hover:bg-paperDark ${
                  !n.read ? 'bg-paperDark/60' : ''
                }`}
              >
                <p className="text-sm text-inkSoft">{n.message}</p>
                <p className="text-xs text-muted mt-1 font-mono">{timeAgo(n.createdAt)}</p>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}