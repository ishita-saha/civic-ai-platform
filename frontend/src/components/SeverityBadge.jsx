import { severityOf } from '../lib/format';

/**
 * How dangerous the report is, as classified by the API from the words the
 * reporter used. Kept visually distinct from <StatusBadge> — that one says
 * where a case is in the pipeline, this one says how much it matters.
 *
 * No pulsing dot here: severity is a fixed property of the problem, not a live
 * state, and an animation would imply otherwise.
 */
const TONES = {
  critical: { label: 'Critical', tone: 'var(--c-danger)', soft: 'var(--c-danger-soft)' },
  high: { label: 'High', tone: 'var(--c-warn)', soft: 'var(--c-warn-soft)' },
  moderate: { label: 'Moderate', tone: 'var(--c-info)', soft: 'var(--c-info-soft)' },
  low: { label: 'Low', tone: 'var(--c-ink-3)', soft: 'var(--c-surface-3)' },
};

export default function SeverityBadge({ item, severity }) {
  const key = severity || severityOf(item);
  const s = TONES[key] ?? TONES.moderate;

  return (
    <span className="badge" style={{ '--tone': s.tone, '--tone-soft': s.soft }}>
      <span className="sev-mark" aria-hidden="true" />
      {s.label} severity
    </span>
  );
}
