const STATUS = {
  pending: { label: 'Pending', tone: 'var(--c-warn)', soft: 'var(--c-warn-soft)', live: true },
  progress: { label: 'In progress', tone: 'var(--c-info)', soft: 'var(--c-info-soft)', live: true },
  resolved: { label: 'Resolved', tone: 'var(--c-ok)', soft: 'var(--c-ok-soft)', live: false },
};

export default function StatusBadge({ status, label }) {
  const s = STATUS[status] ?? STATUS.pending;
  return (
    <span
      className={`badge${s.live ? ' badge-live' : ''}`}
      style={{ '--tone': s.tone, '--tone-soft': s.soft }}
    >
      <span className="dot" aria-hidden="true" />
      {label || s.label}
    </span>
  );
}
