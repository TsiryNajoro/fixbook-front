import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../api/client';

export default function Register() {
  const [form, setForm] = useState({ name: '', email: '', password: '', companyName: '', department: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  function update(field) {
    return (e) => setForm((f) => ({ ...f, [field]: e.target.value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { token, user } = await api.register(form);
      login(token, user);
      navigate('/');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-sm mx-auto mt-16 px-6">
      <h1 className="font-mono text-2xl font-bold text-center mb-1">FIXBOOK</h1>
      <p className="text-center text-muted text-sm mb-8">
        First person from your company creates the workspace.
      </p>
      <div className="card p-6">
        <form onSubmit={handleSubmit} className="space-y-3">
          <input className="input w-full" placeholder="Your name" value={form.name} onChange={update('name')} required />
          <input
            className="input w-full"
            type="email"
            placeholder="you@company.com"
            value={form.email}
            onChange={update('email')}
            required
          />
          <input
            className="input w-full"
            type="password"
            placeholder="Password"
            value={form.password}
            onChange={update('password')}
            required
          />
          <input
            className="input w-full"
            placeholder="Company name (e.g. Acme Corp)"
            value={form.companyName}
            onChange={update('companyName')}
            required
          />
          <input
            className="input w-full"
            placeholder="Department / role (e.g. DevOps) — optional"
            value={form.department}
            onChange={update('department')}
          />
          {error && <p className="text-rust text-sm">{error}</p>}
          <button
            disabled={loading}
            className="w-full bg-navy text-paper font-mono font-semibold py-2 tracking-wide"
          >
            {loading ? 'Creating…' : 'Create account'}
          </button>
        </form>
      </div>
      <p className="text-center text-sm text-muted mt-5">
        Already have an account?{' '}
        <Link to="/login" className="text-navy underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}
