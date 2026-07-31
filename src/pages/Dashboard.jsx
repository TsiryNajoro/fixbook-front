import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { api } from '../api/client';
import ProblemCard from '../components/ProblemCard';
import NewEntryPanel from '../components/NewEntryPanel';

// "draft" and "published" are deliberately left out here: a Published entry
// with no validations yet is still a normal, visible entry - it doesn't need
// its own filter bucket. Only the statuses that mean something to a reader
// deciding whether to trust a fix are offered.
const STATUSES = ['', 'verified', 'needs_review', 'archived'];

export default function Dashboard() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [problems, setProblems] = useState([]);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [category, setCategory] = useState('');
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showNewEntry, setShowNewEntry] = useState(false);

  async function load() {
    setLoading(true);
    setError('');
    try {
      const { problems } = await api.listProblems(token, { q, status, category });
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
  }, [status, category]);

  useEffect(() => {
    // Categories come from the company's own list so custom categories show
    // up too, plus "N/A" for entries left uncategorized.
    api
      .company(token)
      .then(({ company }) => setCategories(['N/A', ...(company.categories || [])]))
      .catch(() => {});
  }, [token]);

  function handleSearch(e) {
    e.preventDefault();
    load();
  }

  function handleCreated(problem) {
    setShowNewEntry(false);
    navigate(`/problems/${problem._id}`);
  }

  return (
    <div className="max-w-5xl mx-auto px-6 py-8">
      <div className="flex items-center justify-between mb-5">
        <h1 className="font-mono text-xl font-bold">Entries</h1>
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

      <form onSubmit={handleSearch} className="flex flex-wrap gap-3 mb-4">
        <div className="input flex-1 min-w-[200px] flex items-center gap-2">
          <Search size={16} className="text-muted shrink-0" />
          <input
            className="bg-transparent w-full outline-none"
            placeholder='Search e.g. "database connection refused"'
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <select className="input font-mono text-sm" value={category} onChange={(e) => setCategory(e.target.value)}>
          <option value="">All categories</option>
          {[...new Set(categories)].map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <select className="input font-mono text-sm" value={status} onChange={(e) => setStatus(e.target.value)}>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s ? s.replace('_', ' ') : 'All statuses'}
            </option>
          ))}
        </select>
        <button className="bg-ink text-paper font-mono px-4">Search</button>
      </form>

      {error && <p className="text-rust text-sm mb-4">{error}</p>}
      {loading ? (
        <p className="text-muted font-mono text-sm">Loading entries…</p>
      ) : problems.length === 0 ? (
        <div className="card p-8 text-center">
          <p className="font-mono text-inkSoft">No entries yet.</p>
          <p className="text-sm text-muted mt-1">Be the first to log a problem your team solved.</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {problems.map((p) => (
            <ProblemCard key={p._id} problem={p} />
          ))}
        </div>
      )}
    </div>
  );
}