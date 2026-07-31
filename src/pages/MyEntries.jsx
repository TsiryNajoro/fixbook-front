import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { api } from '../api/client';
import ProblemCard from '../components/ProblemCard';
import NewEntryPanel from '../components/NewEntryPanel';

export default function MyEntries() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [problems, setProblems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showNewEntry, setShowNewEntry] = useState(false);

  async function load() {
    setLoading(true);
    setError('');
    try {
      const { problems } = await api.listProblems(token, { mine: 'true' });
      setProblems(problems);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleCreated(problem) {
    setShowNewEntry(false);
    navigate(`/problems/${problem._id}`);
  }

  const drafts = problems.filter((p) => p.status === 'draft');
  const published = problems.filter((p) => p.status !== 'draft');

  return (
    <div className="max-w-5xl mx-auto px-6 py-8">
      <div className="flex items-center justify-between mb-5">
        <h1 className="font-mono text-xl font-bold">My Entries</h1>
        {!showNewEntry && (
          <button
            onClick={() => setShowNewEntry(true)}
            className="flex items-center gap-1.5 bg-navy text-paper font-mono text-sm font-semibold px-4 py-2"
          >
            <Plus size={16} /> New entry
          </button>
        )}
      </div>

      {showNewEntry && <NewEntryPanel onCreated={handleCreated} onCancel={() => setShowNewEntry(false)} />}

      {error && <p className="text-rust text-sm mb-4">{error}</p>}
      {loading ? (
        <p className="text-muted font-mono text-sm">Loading…</p>
      ) : problems.length === 0 ? (
        <div className="card p-8 text-center">
          <p className="font-mono text-inkSoft">You haven't logged anything yet.</p>
          <p className="text-sm text-muted mt-1">Start with your first entry, or save one as a draft to finish later.</p>
        </div>
      ) : (
        <>
          {drafts.length > 0 && (
            <div className="mb-6">
              <p className="font-mono text-xs text-muted mb-2">DRAFTS — only visible to you</p>
              <div className="grid gap-4">
                {drafts.map((p) => (
                  <ProblemCard key={p._id} problem={p} />
                ))}
              </div>
            </div>
          )}
          {published.length > 0 && (
            <div>
              {drafts.length > 0 && <p className="font-mono text-xs text-muted mb-2">PUBLISHED</p>}
              <div className="grid gap-4">
                {published.map((p) => (
                  <ProblemCard key={p._id} problem={p} />
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}