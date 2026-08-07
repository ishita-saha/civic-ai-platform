import { Link, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  ExternalLink,
  FileQuestion,
  Hammer,
  MapPin,
  RefreshCw,
  ShieldCheck,
  WifiOff,
} from 'lucide-react';
import BeforeAfter from '../../components/BeforeAfter';
import CaseTimeline from '../../components/CaseTimeline';
import EmptyState from '../../components/EmptyState';
import StatusBadge from '../../components/StatusBadge';
import { photoPair } from '../../lib/demoData';
import { coords, mapsUrl, placeName, statusOf, when } from '../../lib/format';
import { useComplaint } from '../../lib/useComplaint';

/**
 * The public view of one case.
 *
 * Shows no complainant name, phone number or email — the same rule the
 * before/after gallery follows. Who reported a pothole is nobody's business;
 * whether it got fixed, by whom, and when is everybody's. The staff version of
 * this page (pages/admin/ComplaintDetails.jsx) is where that data lives, behind
 * a session.
 */
export default function ComplaintDetails() {
  const { id } = useParams();
  const { complaint, loading, error, missing, reload } = useComplaint(id);

  const back = (
    <Link className="backlink" to="/track">
      <ArrowLeft size={14} aria-hidden="true" />
      Back to tracking
    </Link>
  );

  if (loading) {
    return (
      <div className="stack page-enter" style={{ '--gap': '16px', maxWidth: 860, margin: '0 auto' }}>
        {back}
        <div className="skeleton" style={{ height: 26, width: '45%' }} />
        <div className="card">
          <div className="card-body stack" style={{ '--gap': '12px' }}>
            <div className="skeleton" style={{ height: 13, width: '70%' }} />
            <div className="skeleton" style={{ height: 13, width: '52%' }} />
            <div className="skeleton" style={{ height: 120 }} />
          </div>
        </div>
      </div>
    );
  }

  if (missing || error) {
    return (
      <div className="stack page-enter" style={{ '--gap': '16px', maxWidth: 620, margin: '0 auto' }}>
        {back}
        <div className="card">
          <EmptyState
            icon={missing ? FileQuestion : WifiOff}
            title={missing ? `No case matches #${id}` : 'Could not load that case'}
          >
            {missing
              ? 'Double-check the reference from your confirmation screen — it is just the number, with no letters.'
              : error}
          </EmptyState>
          <div className="card-body" style={{ paddingTop: 0, textAlign: 'center' }}>
            {missing ? (
              <Link className="btn btn-primary" to="/track">
                Search instead
              </Link>
            ) : (
              <button type="button" className="btn btn-primary" onClick={reload}>
                <RefreshCw size={15} aria-hidden="true" />
                Try again
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  const status = statusOf(complaint);
  const gps = coords(complaint);
  const link = mapsUrl(complaint);
  const place = placeName(complaint);
  // Reports filed from the app store their coordinates as the location string
  // too — don't print the same numbers twice.
  const placeIsCoords = !!gps && place.replace(/\s/g, '') === gps.replace(/\s/g, '');
  const { hasAny: hasPhotos } = photoPair(complaint);

  return (
    <div className="stack page-enter" style={{ '--gap': '18px', maxWidth: 980, margin: '0 auto' }}>
      {back}

      <div className="spread" style={{ alignItems: 'flex-start' }}>
        <div style={{ minWidth: 0 }}>
          <div className="row" style={{ '--gap': '8px', marginBottom: 6 }}>
            <span className="mono hint">#{complaint.id}</span>
            <span className="chip">{complaint.category || 'General'}</span>
          </div>
          <h2 className="page-title">{complaint.title || 'Untitled report'}</h2>
          <p className="page-lede">{complaint.description || 'No description was recorded.'}</p>
        </div>
        <StatusBadge status={status} />
      </div>

      <div className="detail-grid">
        <div className="stack" style={{ '--gap': '16px' }}>
          {hasPhotos && (
            <div className="card">
              <div className="card-head">
                <h3>Before and after</h3>
              </div>
              <div className="card-body stack" style={{ '--gap': '10px' }}>
                <BeforeAfter item={complaint} />
                {complaint.before_note && (
                  <p className="ba-note" style={{ margin: 0 }}>
                    <b style={{ color: 'var(--c-ink-2)' }}>Reported:</b> {complaint.before_note}
                  </p>
                )}
                {complaint.after_note && (
                  <p className="ba-note" style={{ margin: 0 }}>
                    <b style={{ color: 'var(--c-ink-2)' }}>Done:</b> {complaint.after_note}
                  </p>
                )}
              </div>
            </div>
          )}

          <div className="card">
            <div className="card-head">
              <h3>Progress</h3>
            </div>
            <div className="card-body">
              <CaseTimeline complaint={complaint} />
              <p className="hint">
                Stages are inferred from the case&rsquo;s current status — the backend does not yet
                store a dated history for each step.
              </p>
            </div>
          </div>
        </div>

        <div className="stack" style={{ '--gap': '16px' }}>
          <div className="card">
            <div className="card-head">
              <h3>Where</h3>
            </div>
            <div className="card-body stack" style={{ '--gap': '10px' }}>
              <div className="row" style={{ '--gap': '7px', alignItems: 'flex-start' }}>
                <MapPin
                  size={14}
                  aria-hidden="true"
                  style={{ marginTop: 3, flex: 'none', color: 'var(--c-ink-4)' }}
                />
                <div style={{ minWidth: 0 }}>
                  {!placeIsCoords && <div style={{ color: 'var(--c-ink)' }}>{place}</div>}
                  {gps && (
                    <div className="mono tnum cell-sub" style={{ marginTop: placeIsCoords ? 0 : 3 }}>
                      {gps}
                    </div>
                  )}
                </div>
              </div>

              {link && (
                <a
                  className="btn"
                  href={link}
                  target="_blank"
                  rel="noreferrer"
                  style={{ justifyContent: 'center' }}
                >
                  Open in Maps
                  <ExternalLink size={14} aria-hidden="true" />
                </a>
              )}
            </div>
          </div>

          <div className="card">
            <div className="card-head">
              <h3>Handled by</h3>
            </div>
            <div className="card-body">
              <dl className="kv">
                <dt>Department</dt>
                <dd>{complaint.department || `${complaint.category || 'Municipal'} Department`}</dd>

                <dt>Engineer</dt>
                <dd>
                  {complaint.officer_assigned ||
                    complaint.assigned_officer || <span className="hint">Awaiting assignment</span>}
                </dd>

                <dt>Filed</dt>
                <dd className="tnum">{when(complaint.timestamp || complaint.created_at)}</dd>

                {complaint.resolved_at && (
                  <>
                    <dt>Closed</dt>
                    <dd className="tnum">{when(complaint.resolved_at)}</dd>
                  </>
                )}
              </dl>

              {complaint.reviewer?.name && (
                <p
                  className="row"
                  style={{ '--gap': '7px', marginTop: 14, fontSize: 13, alignItems: 'flex-start' }}
                >
                  <ShieldCheck
                    size={14}
                    aria-hidden="true"
                    style={{ marginTop: 2, flex: 'none', color: 'var(--c-ok)' }}
                  />
                  Signed off by {complaint.reviewer.name}
                  {complaint.reviewer.designation ? `, ${complaint.reviewer.designation}` : ''}
                </p>
              )}
            </div>
          </div>

          {status !== 'resolved' && (
            <div className="card" style={{ background: 'var(--c-surface-2)' }}>
              <div className="card-body row" style={{ '--gap': '9px', alignItems: 'flex-start' }}>
                <Hammer
                  size={15}
                  aria-hidden="true"
                  style={{ marginTop: 2, flex: 'none', color: 'var(--c-ink-4)' }}
                />
                <p className="hint" style={{ lineHeight: 1.55 }}>
                  This case is still open. When the crew finishes, the photo of the completed work
                  and the inspector&rsquo;s name appear on this page.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
