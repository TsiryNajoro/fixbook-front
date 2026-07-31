const LABELS = {
  draft: 'Draft',
  published: 'Published',
  verified: 'Verified',
  needs_review: 'Needs Review',
  archived: 'Archived',
};

export default function StatusStamp({ status }) {
  return <span className={`stamp stamp-${status}`}>{LABELS[status] || status}</span>;
}
