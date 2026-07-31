import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function OAuthCallback() {
  const [params] = useSearchParams();
  const { login } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const token = params.get('token');
    if (token) {
      login(token);
      navigate('/');
    } else {
      navigate('/login?error=oauth');
    }
  }, [params]);

  return <p className="text-center mt-16 font-mono text-muted">Signing you in…</p>;
}
