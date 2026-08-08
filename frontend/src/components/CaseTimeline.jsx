import { Check } from 'lucide-react';
import { statusOf, when } from '../lib/format';

/**
 * The four states a report moves through, matching the pipeline promised on
 * the landing page. Keeping the same four words in both places is the point —
 * a citizen who read "crew assigned" on the front page should find that exact
 * stage here rather than a synonym.
 */
const STAGES = [
  { key: 'filed', title: 'Filed', body: 'Posted to the feed with the place and the problem. Reference issued.' },
  { key: 'verified', title: 'Verified', body: 'Checked by the administrator and confirmed as real. Nothing is dispatched before this.' },
  { key: 'assigned', title: 'Work started', body: 'A crew is on it and the case shows as active work.' },
  { key: 'closed', title: 'Closed with proof', body: 'Finished work photographed and signed off by an inspector.' },
];

/**
 * How far along the pipeline a case has visibly got.
 *
 * Partly a record, partly an inference. Verification is a real flag the API
 * sets, so stage 2 is known. The rest still comes from the single status
 * string: "in progress" implies verification happened, because the API refuses
 * to move an unverified case there at all.
 */
function reachedCount(complaint) {
  switch (statusOf(complaint)) {
    case 'resolved':
      return 4;
    case 'progress':
      return 3;
    default:
      return complaint?.verified ? 2 : 1;
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

        // Three moments have a real timestamp behind them. "Work started" gets
        // no date rather than an invented one — the API stores the transition
        // but not, yet, when the crew actually arrived.
        const stamp =
          (stage.key === 'filed' && filedAt) ||
          (stage.key === 'verified' && complaint?.verified_at) ||
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
