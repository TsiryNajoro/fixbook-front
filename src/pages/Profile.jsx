import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../api/client';

function initials(name = '') {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join('');
}

export default function Profile() {
  const { user, token, updateUser } = useAuth();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(user?.name || '');
  const [department, setDepartment] = useState(user?.department || '');
  const [avatarUrl, setAvatarUrl] = useState(user?.avatarUrl || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const { user: updated } = await api.updateProfile(token, { name, department, avatarUrl });
      updateUser(updated);
      setEditing(false);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  if (!user) return null;

  return (
    <div className="max-w-lg mx-auto px-6 py-10">
      <div className="card p-8">
        <div className="flex items-center gap-4 mb-6">
          {user.avatarUrl ? (
            <img src={user.avatarUrl} alt="" className="w-16 h-16 rounded-full object-cover border-2 border-ink" />
          ) : (
            <span className="w-16 h-16 rounded-full bg-navy text-paper flex items-center justify-center text-xl font-bold font-mono">
              {initials(user.name) || '?'}
            </span>
          )}
          <div>
            <h1 className="font-mono text-xl font-bold">{user.name}</h1>
            <p className="text-muted text-sm">{user.email}</p>
          </div>
        </div>

        {!editing ? (
          <>
            <dl className="space-y-3 font-mono text-sm">
              <div>
                <dt className="text-muted text-xs">DEPARTMENT</dt>
                <dd className="text-inkSoft">{user.department || <span className="text-muted italic">Not set</span>}</dd>
              </div>
              <div>
                <dt className="text-muted text-xs">EMAIL</dt>
                <dd className="text-inkSoft">{user.email}</dd>
              </div>
            </dl>
            {!user.department && (
              <p className="text-rust text-sm mt-4">
                Set your department to be able to validate entries — your validations are stamped with it.
              </p>
            )}
            <button
              onClick={() => setEditing(true)}
              className="mt-6 border border-ink font-mono text-sm px-4 py-2 hover:bg-paperDark"
            >
              Edit profile
            </button>
          </>
        ) : (
          <form onSubmit={handleSave} className="space-y-3">
            <div>
              <label className="block font-mono text-xs text-muted mb-1">NAME</label>
              <input className="input w-full" value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            <div>
              <label className="block font-mono text-xs text-muted mb-1">DEPARTMENT</label>
              <input
                className="input w-full"
                placeholder="e.g. DevOps, Database Admin, Network & Systems"
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
              />
            </div>
            <div>
              <label className="block font-mono text-xs text-muted mb-1">AVATAR URL (optional)</label>
              <input className="input w-full" value={avatarUrl} onChange={(e) => setAvatarUrl(e.target.value)} />
            </div>
            {error && <p className="text-rust text-sm">{error}</p>}
            <div className="flex gap-3">
              <button disabled={saving} className="bg-navy text-paper font-mono px-4 py-2 text-sm">
                {saving ? 'Saving…' : 'Save'}
              </button>
              <button type="button" onClick={() => setEditing(false)} className="font-mono text-sm text-muted">
                Cancel
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
