import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, CornerDownRight } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { api } from '../api/client';
import StatusStamp from '../components/StatusStamp';
import ConfirmDialog from '../components/ConfirmDialog';

const CATEGORIES = ['N/A', 'Backend', 'Frontend', 'Infrastructure', 'Database', 'Security', 'Networking'];

export default function ProblemDetail() {
  const { id } = useParams();
  const { token, user } = useAuth();
  const navigate = useNavigate();

  const [problem, setProblem] = useState(null);
  const [error, setError] = useState('');

  // Problem edit state
  const [editingProblem, setEditingProblem] = useState(false);
  const [form, setForm] = useState(null);

  // Solution edit state
  const [editingSolution, setEditingSolution] = useState(false);
  const [solutionDesc, setSolutionDesc] = useState('');
  const [steps, setSteps] = useState(['']);

  // Validation form state - department is never entered here, it's pulled
  // straight from the validator's profile so a stamp can't be spoofed.
  const [comment, setComment] = useState('');

  // Independent discussion comment state
  const [newComment, setNewComment] = useState('');
  const [replyingTo, setReplyingTo] = useState(null); // comment _id currently being replied to
  const [replyText, setReplyText] = useState('');

  // Which confirmation dialog is currently open: null | 'delete-entry' | 'delete-solution' | 'archive'
  const [dialog, setDialog] = useState(null);

  async function load() {
    try {
      const { problem } = await api.getProblem(token, id);
      setProblem(problem);
      setSolutionDesc(problem.solution?.description || '');
      setSteps(problem.solution?.troubleshootingSteps?.length ? problem.solution.troubleshootingSteps : ['']);
      setForm({
        title: problem.title || '',
        description: problem.description || '',
        category: problem.category || 'N/A',
        application: problem.application || '',
        environment: problem.environment || '',
        logs: problem.logs || '',
        tags: (problem.tags || []).join(', '),
      });
    } catch (err) {
      setError(err.message);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (error) return <p className="max-w-3xl mx-auto px-6 py-8 text-rust">{error}</p>;
  if (!problem) return <p className="max-w-3xl mx-auto px-6 py-8 text-muted font-mono">Loading…</p>;

  const isAuthor = String(problem.author?._id || problem.author) === String(user.id);
  const isSolutionAuthor =
    problem.solution?.author && String(problem.solution.author._id || problem.solution.author) === String(user.id);
  // You validate a SOLUTION, not an entry - so the only thing that blocks you
  // is having written the solution yourself. Being the entry's author is
  // fine, as long as someone else proposed the fix.
  const canValidate = !isSolutionAuthor;
  const hasUserValidated = (problem.solution?.validations || []).some(
    (v) => String(v.validator?._id || v.validator) === String(user.id)
  );

  async function saveProblem() {
    const { problem: updated } = await api.updateProblem(token, id, {
      ...form,
      tags: form.tags.split(',').map((t) => t.trim()).filter(Boolean),
    });
    setProblem(updated);
    setEditingProblem(false);
  }

  async function saveSolution() {
    const { problem: updated } = await api.updateSolution(token, id, {
      description: solutionDesc,
      troubleshootingSteps: steps.filter((s) => s.trim()),
    });
    setProblem(updated);
    setEditingSolution(false);
  }

  async function handleDeleteSolution() {
    const { problem: updated } = await api.deleteSolution(token, id);
    setProblem(updated);
    setSolutionDesc('');
    setSteps(['']);
    setDialog(null);
  }

  async function submitValidation(e) {
    e.preventDefault();
    try {
      const { problem: updated } = await api.addValidation(token, id, comment);
      setProblem(updated);
      setComment('');
    } catch (err) {
      setError(err.message);
    }
  }

  async function removeValidation(validationId) {
    const { problem: updated } = await api.removeValidation(token, id, validationId);
    setProblem(updated);
  }

  async function submitComment(e) {
    e.preventDefault();
    if (!newComment.trim()) return;
    const { problem: updated } = await api.addComment(token, id, newComment.trim());
    setProblem(updated);
    setNewComment('');
  }

  async function submitReply(e, parentId) {
    e.preventDefault();
    if (!replyText.trim()) return;
    const { problem: updated } = await api.addComment(token, id, replyText.trim(), parentId);
    setProblem(updated);
    setReplyText('');
    setReplyingTo(null);
  }

  async function removeComment(commentId) {
    const { problem: updated } = await api.removeComment(token, id, commentId);
    setProblem(updated);
  }

  async function handlePublish() {
    try {
      const { problem: updated } = await api.publishProblem(token, id);
      setProblem(updated);
    } catch (err) {
      setError(err.message);
    }
  }

  async function toggleArchive() {
    if (problem.status === 'archived') {
      const { problem: updated } = await api.unarchiveProblem(token, id);
      setProblem(updated);
    } else {
      setDialog('archive');
    }
  }

  async function confirmArchive(reason) {
    const { problem: updated } = await api.archiveProblem(token, id, reason);
    setProblem(updated);
    setDialog(null);
  }

  async function handleDelete() {
    await api.deleteProblem(token, id);
    navigate('/');
  }

  const hasSolution = solutionDesc || steps.some((s) => s.trim());

  // Build a one-level comment tree: top-level comments, each with its replies.
  const allComments = problem.comments || [];
  const topLevelComments = allComments.filter((c) => !c.parentComment);
  const repliesFor = (commentId) => allComments.filter((c) => String(c.parentComment) === String(commentId));

  return (
    <div className="max-w-3xl mx-auto px-6 py-8 space-y-6">
      <Link to={problem.isDraft ? '/my-entries' : '/'} className="inline-flex items-center gap-1.5 text-sm font-mono text-navy hover:underline">
        <ArrowLeft size={15} /> {problem.isDraft ? 'Back to My Entries' : 'Back to entries'}
      </Link>

      <div className="card p-6">
        {editingProblem ? (
          <div className="space-y-3">
            <div>
              <label className="block font-mono text-xs text-muted mb-1">TITLE (optional)</label>
              <input className="input w-full" value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
            </div>
            <div>
              <label className="block font-mono text-xs text-muted mb-1">DESCRIPTION *</label>
              <textarea
                className="input w-full"
                rows={3}
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block font-mono text-xs text-muted mb-1">CATEGORY</label>
                <select className="input w-full" value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}>
                  {CATEGORIES.map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block font-mono text-xs text-muted mb-1">ENVIRONMENT</label>
                <input className="input w-full" value={form.environment} onChange={(e) => setForm((f) => ({ ...f, environment: e.target.value }))} />
              </div>
            </div>
            <div>
              <label className="block font-mono text-xs text-muted mb-1">AFFECTED APPLICATION / SERVICE</label>
              <input className="input w-full" value={form.application} onChange={(e) => setForm((f) => ({ ...f, application: e.target.value }))} />
            </div>
            <div>
              <label className="block font-mono text-xs text-muted mb-1">LOGS / ERROR MESSAGES *</label>
              <textarea
                className="input w-full font-mono text-sm"
                rows={3}
                value={form.logs}
                onChange={(e) => setForm((f) => ({ ...f, logs: e.target.value }))}
              />
            </div>
            <div>
              <label className="block font-mono text-xs text-muted mb-1">TAGS (comma separated)</label>
              <input className="input w-full" value={form.tags} onChange={(e) => setForm((f) => ({ ...f, tags: e.target.value }))} />
            </div>
            <div className="flex gap-3">
              <button onClick={saveProblem} className="bg-navy text-paper font-mono px-4 py-2 text-sm">
                Save
              </button>
              <button onClick={() => setEditingProblem(false)} className="font-mono text-sm text-muted">
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="flex items-start justify-between gap-4">
              <h1 className="font-mono text-2xl font-bold">{problem.title}</h1>
              <StatusStamp status={problem.status} />
            </div>
            <p className="text-inkSoft mt-2">{problem.description}</p>
            <div className="flex flex-wrap gap-2 mt-4 text-xs font-mono text-muted">
              <span className="border border-line px-2 py-0.5">{problem.category}</span>
              {problem.application && <span className="border border-line px-2 py-0.5">{problem.application}</span>}
              {problem.environment && <span className="border border-line px-2 py-0.5">{problem.environment}</span>}
              {(problem.tags || []).map((t) => (
                <span key={t} className="text-navy">
                  #{t}
                </span>
              ))}
            </div>
            {problem.logs && (
              <pre className="mt-4 bg-paperDark p-3 text-xs font-mono whitespace-pre-wrap border border-line">{problem.logs}</pre>
            )}
            <p className="text-xs text-muted mt-3 font-mono">
              Logged by {problem.author?.name} on {new Date(problem.occurredAt).toLocaleDateString()}
            </p>

            {isAuthor && (
              <div className="mt-4 flex gap-3">
                {problem.isDraft ? (
                  <button onClick={handlePublish} className="text-xs font-mono bg-navy text-paper px-3 py-1">
                    Publish (Log it)
                  </button>
                ) : (
                  <button
                    onClick={() => (problem.status === 'archived' ? toggleArchive() : setDialog('archive'))}
                    className="text-xs font-mono border border-ink px-3 py-1 hover:bg-paperDark"
                  >
                    {problem.status === 'archived' ? 'Unarchive' : 'Archive entry'}
                  </button>
                )}
                <button onClick={() => setEditingProblem(true)} className="text-xs font-mono border border-ink px-3 py-1 hover:bg-paperDark">
                  Edit entry
                </button>
                <button onClick={() => setDialog('delete-entry')} className="text-xs font-mono text-rust hover:underline">
                  Delete entry
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* ---------- Solution ---------- */}
      <div className="card p-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-mono font-semibold text-lg">Solution</h2>
          {!editingSolution && (
            <div className="flex gap-3">
              <button onClick={() => setEditingSolution(true)} className="text-xs font-mono text-navy hover:underline">
                {hasSolution ? 'Edit' : '+ Add solution'}
              </button>
              {hasSolution && isAuthor && (
                <button onClick={() => setDialog('delete-solution')} className="text-xs font-mono text-rust hover:underline">
                  Delete
                </button>
              )}
            </div>
          )}
        </div>

        {editingSolution ? (
          <div className="space-y-3">
            <textarea
              className="input w-full"
              rows={3}
              placeholder="Direct fix description…"
              value={solutionDesc}
              onChange={(e) => setSolutionDesc(e.target.value)}
            />
            <div>
              <label className="block font-mono text-xs text-muted mb-1">TROUBLESHOOTING STEPS</label>
              {steps.map((step, i) => (
                <div key={i} className="flex gap-2 mb-2">
                  <span className="font-mono text-muted text-sm pt-2">{i + 1}.</span>
                  <input
                    className="input flex-1"
                    value={step}
                    onChange={(e) => setSteps((s) => s.map((v, idx) => (idx === i ? e.target.value : v)))}
                  />
                </div>
              ))}
              <button
                type="button"
                onClick={() => setSteps((s) => [...s, ''])}
                className="text-xs font-mono text-navy hover:underline"
              >
                + Add step
              </button>
            </div>
            <div className="flex gap-3">
              <button onClick={saveSolution} className="bg-navy text-paper font-mono px-4 py-2 text-sm">
                Save solution
              </button>
              <button onClick={() => setEditingSolution(false)} className="font-mono text-sm text-muted">
                Cancel
              </button>
            </div>
          </div>
        ) : hasSolution ? (
          <>
            {problem.solution.description && <p className="text-inkSoft mb-3">{problem.solution.description}</p>}
            {problem.solution.troubleshootingSteps?.length > 0 && (
              <ol className="list-decimal list-inside space-y-1 text-inkSoft">
                {problem.solution.troubleshootingSteps.map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ol>
            )}
          </>
        ) : (
          <p className="text-muted text-sm">No solution recorded yet.</p>
        )}
      </div>

      {problem.isDraft ? (
        <div className="card p-6">
          <p className="text-sm text-muted">
            This is a draft — only you can see it. Publish it (button above) so your team can add solutions, validate
            fixes, and comment.
          </p>
        </div>
      ) : (
        <>
          {/* ---------- Validations ---------- */}
          {hasSolution && problem.status !== 'archived' && (
            <div className="card p-6">
              <h2 className="font-mono font-semibold text-lg mb-3">
                Validations{' '}
                <span className="text-muted text-sm font-normal">({problem.validationSummary?.total || 0})</span>
              </h2>

              <div className="space-y-3 mb-5">
                {(problem.solution.validations || []).map((v) => (
                  <div key={v._id} className="border border-line p-3 flex justify-between items-start">
                    <div>
                      <p className="font-mono text-sm font-semibold text-navy">
                        {v.validatorName} · {v.department}
                      </p>
                      {v.comment && <p className="text-sm text-inkSoft mt-1">{v.comment}</p>}
                      <p className="text-xs text-muted mt-1">{new Date(v.createdAt).toLocaleDateString()}</p>
                    </div>
                    {String(v.validator?._id || v.validator) === String(user.id) && (
                      <button onClick={() => removeValidation(v._id)} className="text-xs text-rust hover:underline">
                        Remove
                      </button>
                    )}
                  </div>
                ))}
                {(!problem.solution.validations || problem.solution.validations.length === 0) && (
                  <p className="text-muted text-sm">No one has validated this yet — be the first to confirm it works.</p>
                )}
              </div>

              {!canValidate ? (
                <p className="text-sm text-muted border-t border-line pt-4">
                  You can't validate a solution you proposed yourself.
                </p>
              ) : hasUserValidated ? (
                <p className="text-sm text-moss border-t border-line pt-4">
                  ✓ You've already validated this entry. Remove your validation above if you want to change it.
                </p>
              ) : user.department ? (
                <form onSubmit={submitValidation} className="space-y-2 border-t border-line pt-4">
                  <p className="font-mono text-xs text-muted">
                    VALIDATING AS <span className="text-navy">{user.name} · {user.department}</span>
                  </p>
                  <input
                    className="input w-full"
                    placeholder="Optional comment…"
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                  />
                  <button className="bg-moss text-paper font-mono px-4 py-2 text-sm">✓ Validate this solution</button>
                </form>
              ) : (
                <p className="text-sm text-muted border-t border-line pt-4">
                  Set your department in your{' '}
                  <Link to="/profile" className="text-navy underline">
                    profile
                  </Link>{' '}
                  to validate entries.
                </p>
              )}
            </div>
          )}

          {/* ---------- Comments ---------- */}
          {/* Independent of validation - anyone can leave a comment any time,
              whether or not they've validated the solution. One level of replies. */}
          <div className="card p-6">
            <h2 className="font-mono font-semibold text-lg mb-3">
              Comments <span className="text-muted text-sm font-normal">({allComments.length})</span>
            </h2>

            <div className="space-y-4 mb-5">
              {topLevelComments.map((c) => (
                <div key={c._id}>
                  <div className="border border-line p-3 flex justify-between items-start">
                    <div>
                      <p className="font-mono text-sm font-semibold text-navy">{c.authorName}</p>
                      <p className="text-sm text-inkSoft mt-1">{c.text}</p>
                      <p className="text-xs text-muted mt-1">{new Date(c.createdAt).toLocaleDateString()}</p>
                      <button
                        onClick={() => setReplyingTo(replyingTo === c._id ? null : c._id)}
                        className="text-xs font-mono text-navy hover:underline mt-1"
                      >
                        Reply
                      </button>
                    </div>
                    {String(c.author?._id || c.author) === String(user.id) && (
                      <button onClick={() => removeComment(c._id)} className="text-xs text-rust hover:underline">
                        Remove
                      </button>
                    )}
                  </div>

                  {repliesFor(c._id).map((r) => (
                    <div key={r._id} className="ml-6 mt-2 border border-line p-3 flex justify-between items-start bg-paperDark/40">
                      <div className="flex gap-2">
                        <CornerDownRight size={14} className="text-muted shrink-0 mt-0.5" />
                        <div>
                          <p className="font-mono text-sm font-semibold text-navy">{r.authorName}</p>
                          <p className="text-sm text-inkSoft mt-1">{r.text}</p>
                          <p className="text-xs text-muted mt-1">{new Date(r.createdAt).toLocaleDateString()}</p>
                        </div>
                      </div>
                      {String(r.author?._id || r.author) === String(user.id) && (
                        <button onClick={() => removeComment(r._id)} className="text-xs text-rust hover:underline">
                          Remove
                        </button>
                      )}
                    </div>
                  ))}

                  {replyingTo === c._id && (
                    <form onSubmit={(e) => submitReply(e, c._id)} className="ml-6 mt-2 flex gap-2">
                      <input
                        className="input flex-1 text-sm"
                        placeholder={`Reply to ${c.authorName}…`}
                        value={replyText}
                        onChange={(e) => setReplyText(e.target.value)}
                        autoFocus
                      />
                      <button className="bg-navy text-paper font-mono px-3 py-1.5 text-xs">Reply</button>
                    </form>
                  )}
                </div>
              ))}
              {topLevelComments.length === 0 && <p className="text-muted text-sm">No comments yet.</p>}
            </div>

            <form onSubmit={submitComment} className="flex gap-2 border-t border-line pt-4">
              <input
                className="input flex-1"
                placeholder="Add a comment…"
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
              />
              <button className="bg-navy text-paper font-mono px-4 py-2 text-sm">Comment</button>
            </form>
          </div>
        </>
      )}

      <ConfirmDialog
        open={dialog === 'delete-entry'}
        title="Delete this entry?"
        message="This permanently removes the problem, its solution, and all validations. This can't be undone."
        confirmLabel="Delete entry"
        danger
        onConfirm={handleDelete}
        onCancel={() => setDialog(null)}
      />

      <ConfirmDialog
        open={dialog === 'delete-solution'}
        title="Delete this solution?"
        message="The entry will go back to having no solution recorded. The problem itself stays."
        confirmLabel="Delete solution"
        danger
        onConfirm={handleDeleteSolution}
        onCancel={() => setDialog(null)}
      />

      <ConfirmDialog
        open={dialog === 'archive'}
        title="Archive this entry?"
        message="Archived entries stay searchable for reference but are marked as no longer the active fix."
        confirmLabel="Archive"
        withInput
        inputPlaceholder='Reason (optional) — e.g. "system decommissioned"'
        onConfirm={confirmArchive}
        onCancel={() => setDialog(null)}
      />
    </div>
  );
}