import { useState } from 'react';
import { AlertCircle, Tag, Server, Box, Terminal, Hash, ChevronDown, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { api } from '../api/client';

const CATEGORIES = ['N/A', 'Backend', 'Frontend', 'Infrastructure', 'Database', 'Security', 'Networking'];

export default function NewEntryPanel({ onCreated, onCancel }) {
  const { token } = useAuth();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [logs, setLogs] = useState('');
  const [showMore, setShowMore] = useState(false);
  const [category, setCategory] = useState('N/A');
  const [application, setApplication] = useState('');
  const [environment, setEnvironment] = useState('');
  const [tags, setTags] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  function buildPayload(isDraft) {
    return {
      title,
      description,
      category,
      application,
      environment,
      logs,
      tags: tags.split(',').map((t) => t.trim()).filter(Boolean),
      isDraft,
    };
  }

  async function handleLogIt(e) {
    e.preventDefault();
    setError('');
    if (!description.trim()) return setError('Description is required to log this entry.');
    if (!logs.trim()) return setError('Logs are required to log this entry.');
    setSaving(true);
    try {
      const { problem } = await api.createProblem(token, buildPayload(false));
      onCreated(problem);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveDraft() {
    setError('');
    setSaving(true);
    try {
      const { problem } = await api.createProblem(token, buildPayload(true));
      onCreated(problem);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="card p-5 mb-5">
      <div className="flex items-center justify-between mb-3">
        <p className="font-mono text-sm text-navy flex items-center gap-2">
          <AlertCircle size={16} /> What broke?
        </p>
        <button onClick={onCancel} className="text-muted hover:text-ink">
          <X size={18} />
        </button>
      </div>

      <form onSubmit={handleLogIt} className="space-y-3">
        <input
          aria-label="Entry title"
          className="input w-full text-lg font-mono"
          placeholder="Title (optional) — e.g. API returns 500 errors after deployment"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          autoFocus
        />
        <textarea
          aria-label="Entry description"
          className="input w-full"
          placeholder="What happened? * (required to log — optional for a draft)"
          rows={2}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
        <label className="flex items-start gap-2 border border-line px-2 py-1.5">
          <Terminal size={14} className="text-muted shrink-0 mt-2" />
          <textarea
            aria-label="Entry logs"
            className="bg-transparent w-full text-sm font-mono outline-none placeholder:text-muted py-1"
            placeholder="Logs / error messages * (required to log — optional for a draft)"
            rows={2}
            value={logs}
            onChange={(e) => setLogs(e.target.value)}
          />
        </label>

        <button
          type="button"
          onClick={() => setShowMore((s) => !s)}
          className="flex items-center gap-1 text-xs font-mono text-navy hover:underline"
        >
          <ChevronDown size={14} className={`transition-transform ${showMore ? 'rotate-180' : ''}`} />
          {showMore ? 'Hide extra details' : 'Add category, environment, tags… (optional)'}
        </button>

        {showMore && (
          <div className="grid grid-cols-2 gap-3 pt-1">
            <label className="flex items-center gap-2 border border-line px-2 py-1.5">
              <Tag size={14} className="text-muted shrink-0" />
              <select aria-label="Entry category" className="bg-transparent w-full text-sm font-mono outline-none" value={category} onChange={(e) => setCategory(e.target.value)}>
                {CATEGORIES.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </label>
            <label className="flex items-center gap-2 border border-line px-2 py-1.5">
              <Server size={14} className="text-muted shrink-0" />
              <input
                aria-label="Entry environment"
                className="bg-transparent w-full text-sm font-mono outline-none placeholder:text-muted"
                placeholder="Environment (optional)"
                value={environment}
                onChange={(e) => setEnvironment(e.target.value)}
              />
            </label>
            <label className="flex items-center gap-2 border border-line px-2 py-1.5 col-span-2">
              <Box size={14} className="text-muted shrink-0" />
              <input
                aria-label="Affected application"
                className="bg-transparent w-full text-sm font-mono outline-none placeholder:text-muted"
                placeholder="Affected application / service (optional)"
                value={application}
                onChange={(e) => setApplication(e.target.value)}
              />
            </label>
            <label className="flex items-center gap-2 border border-line px-2 py-1.5 col-span-2">
              <Hash size={14} className="text-muted shrink-0" />
              <input
                aria-label="Entry tags"
                className="bg-transparent w-full text-sm font-mono outline-none placeholder:text-muted"
                placeholder="tags, comma, separated (optional)"
                value={tags}
                onChange={(e) => setTags(e.target.value)}
              />
            </label>
          </div>
        )}

        {error && <p className="text-rust text-sm">{error}</p>}

        <div className="flex gap-3 pt-1">
          <button disabled={saving} className="bg-navy text-paper font-mono font-semibold px-4 py-2 text-sm">
            {saving ? 'Logging…' : 'Log it →'}
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={handleSaveDraft}
            className="border border-ink font-mono text-sm px-4 py-2 hover:bg-paperDark"
          >
            Save as draft
          </button>
          <button type="button" onClick={onCancel} className="font-mono text-sm text-muted">
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
