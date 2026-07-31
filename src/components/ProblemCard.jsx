import { Link } from 'react-router-dom';
import StatusStamp from './StatusStamp';

export default function ProblemCard({ problem }) {
  const { total, byDepartment } = problem.validationSummary || { total: 0, byDepartment: {} };
  const deptSummary = Object.entries(byDepartment)
    .map(([dept, count]) => `${count} ${dept}`)
    .join(', ');

  return (
    <Link to={`/problems/${problem._id}`} className="card block p-5 hover:-translate-y-0.5 transition-transform">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="font-mono font-semibold text-lg text-ink">{problem.title}</h3>
          <p className="text-inkSoft text-sm mt-1 line-clamp-2">{problem.description}</p>
        </div>
        <StatusStamp status={problem.status} />
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-2 text-xs font-mono text-muted">
        <span className="border border-line px-2 py-0.5">{problem.category}</span>
        {problem.application && <span className="border border-line px-2 py-0.5">{problem.application}</span>}
        {problem.environment && <span className="border border-line px-2 py-0.5">{problem.environment}</span>}
        {(problem.tags || []).map((t) => (
          <span key={t} className="text-navy">
            #{t}
          </span>
        ))}
      </div>
      {total > 0 && (
        <p className="mt-3 text-xs text-moss font-mono">
          ✓ Validated by {total} — {deptSummary}
        </p>
      )}
    </Link>
  );
}
