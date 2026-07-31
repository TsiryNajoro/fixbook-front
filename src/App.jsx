import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import Navbar from './components/Navbar';
import Login from './pages/Login';
import Register from './pages/Register';
import OAuthCallback from './pages/OAuthCallback';
import Dashboard from './pages/Dashboard';
import ProblemDetail from './pages/ProblemDetail';
import Profile from './pages/Profile';
import MyEntries from './pages/MyEntries';

function Protected({ children }) {
  const { token, loading } = useAuth();
  if (loading) return <p className="text-center mt-16 font-mono text-muted">Loading…</p>;
  if (!token) return <Navigate to="/login" replace />;
  return children;
}

export default function App() {
  const { token } = useAuth();
  return (
    <div className="min-h-screen">
      {token && <Navbar />}
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/oauth-callback" element={<OAuthCallback />} />
        <Route
          path="/"
          element={
            <Protected>
              <Dashboard />
            </Protected>
          }
        />
        <Route
          path="/my-entries"
          element={
            <Protected>
              <MyEntries />
            </Protected>
          }
        />
        <Route
          path="/profile"
          element={
            <Protected>
              <Profile />
            </Protected>
          }
        />
        <Route
          path="/problems/:id"
          element={
            <Protected>
              <ProblemDetail />
            </Protected>
          }
        />
      </Routes>
    </div>
  );
}