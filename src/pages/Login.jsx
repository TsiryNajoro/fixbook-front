import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../api/client';
import { GoogleIcon, MicrosoftIcon } from '../components/BrandIcons';

const ERROR_MESSAGES = {
  google: 'Google sign-in failed or was cancelled. Please try again.',
  microsoft: 'Microsoft sign-in failed or was cancelled. Please try again.',
  google_not_configured: "Google sign-in isn't set up for this server yet — ask your admin to add credentials, or use email/password.",
  microsoft_not_configured:
    "Microsoft sign-in isn't set up for this server yet — ask your admin to add credentials, or use email/password.",
  oauth: 'Something went wrong signing you in. Please try again.',
};

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [providers, setProviders] = useState({ google: true, microsoft: true }); // optimistic default while loading
  const { login } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    const urlError = searchParams.get('error');
    if (urlError && ERROR_MESSAGES[urlError]) setError(ERROR_MESSAGES[urlError]);

    api
      .providers()
      .then(setProviders)
      .catch(() => setProviders({ google: false, microsoft: false }));
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { token, user } = await api.login({ email, password });
      login(token, user);
      navigate('/');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function oauthButtonClasses(enabled) {
    return `flex items-center justify-center gap-2.5 border py-2 font-mono text-sm ${
      enabled ? 'border-ink hover:bg-paperDark cursor-pointer' : 'border-line text-muted cursor-not-allowed opacity-60'
    }`;
  }

  return (
    <div className="max-w-sm mx-auto mt-16 px-6">
      <h1 className="font-mono text-2xl font-bold text-center mb-1">DEMONSTRATION</h1>
      <p className="text-center text-muted text-sm mb-8">Sign in to your team's technical memory.</p>

      <div className="card p-6">
        <form onSubmit={handleSubmit} className="space-y-3">
          <label htmlFor="login-email" className="sr-only">Email address</label>
          <input
            id="login-email"
            className="input w-full"
            type="email"
            placeholder="you@company.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <label htmlFor="login-password" className="sr-only">Password</label>
          <input
            id="login-password"
            className="input w-full"
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          {error && <p role="alert" className="text-rust text-sm">{error}</p>}
          <button
            disabled={loading}
            className="w-full bg-navy text-paper font-mono font-semibold py-2 tracking-wide"
          >
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <div className="flex items-center gap-3 my-5">
          <div className="h-px bg-line flex-1" />
          <span className="text-xs text-muted font-mono">OR</span>
          <div className="h-px bg-line flex-1" />
        </div>

        <div className="space-y-2">
          {providers.google ? (
            <a href={api.googleUrl()} className={oauthButtonClasses(true)}>
              <GoogleIcon /> Continue with Google
            </a>
          ) : (
            <output aria-label="Google sign-in unavailable" title="Not configured on this server yet" className={oauthButtonClasses(false)}>
              <GoogleIcon /> Continue with Google
            </output>
          )}

          {/* {providers.microsoft ? (
            <a href={api.microsoftUrl()} className={oauthButtonClasses(true)}>
              <MicrosoftIcon /> Continue with Microsoft
            </a>
          ) : (
            <span title="Not configured on this server yet" className={oauthButtonClasses(false)}>
              <MicrosoftIcon /> Continue with Microsoft
            </span>
          )} */}
        </div>
      </div>

      <p className="text-center text-sm text-muted mt-5">
        No account?{' '}
        <Link to="/register" className="text-navy underline">
          Register your team
        </Link>
      </p>
    </div>
  );
}
