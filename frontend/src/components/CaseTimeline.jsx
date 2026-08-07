import { Check } from 'lucide-react';
import { statusOf, when } from '../lib/format';

/**
 * The four states a report moves through, matching the pipeline promised on
 * the landing page. Keeping the same four words in both places is the point —
 * a citizen who read "crew assigned" on the front page should find that exact
 * stage here rather than a synonym.
 */
const STAGES = [
  { key: 'filed', title: 'Filed', body: 'Photo, GPS fix and contact details logged. Reference issued.' },
  { key: 'triaged', title: 'Triaged', body: 'Read at the desk and handed to the department that owns it.' },
  { key: 'assigned', title: 'Crew assigned', body: 'A named engineer is responsible for the work.' },
  { key: 'closed', title: 'Closed with proof', body: 'Finished work photographed and signed off by an inspector.' },
];

/**
 * How far along the pipeline a case has visibly got.
 *
 * The backend stores one status string, not a stage history — so this is an
 * inference, not a record. "In progress" is treated as reaching stage 3 because
 * a case cannot be worked on without having been triaged and assigned first.
 * When `status_history` is actually served, this function is what to replace.
 */
function reachedCount(complaint) {
  switch (statusOf(complaint)) {
    case 'resolved':
      return 4;
    case 'progress':
      return 3;
    default:
      return 1;
  }
}

export default function CaseTimeline({ complaint }) {
  const reached = reachedCount(complaint);
  const filedAt = complaint?.timestamp || complaint?.created_at;

  return (
    <div className="timeline">
      {STAGES.map((stage, i) => {
        const done = i < reached;
        const current = i === reached - 1;

        // Only two moments have a real timestamp behind them. The stages in
        // between get no date rather than an invented one.
        const stamp =
          (stage.key === 'filed' && filedAt) ||
          (stage.key === 'closed' && complaint?.resolved_at) ||
          null;

        return (
          <div className="step" key={stage.key}>
            <span
              className="step-mark"
              style={
                done
                  ? {
                      background: 'var(--c-ok-soft)',
                      borderColor: 'color-mix(in srgb, var(--c-ok) 40%, transparent)',
                      color: 'var(--c-ok)',
                    }
                  : undefined
              }
            >
              {done ? <Check size={14} aria-hidden="true" /> : i + 1}
            </span>

            <div>
              <h4 style={{ color: done ? 'var(--c-ink)' : 'var(--c-ink-3)' }}>
                {stage.title}
                {current && reached < STAGES.length && (
                  <span className="chip" style={{ marginLeft: 8 }}>
                    Here now
                  </span>
                )}
              </h4>
              <p>{stage.body}</p>
              {stamp && (
                <p className="hint tnum" style={{ marginTop: 4 }}>
                  {when(stamp)}
                </p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
