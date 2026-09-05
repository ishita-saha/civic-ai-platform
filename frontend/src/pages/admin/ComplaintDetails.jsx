import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowLeft,
  ChevronUp,
  ExternalLink,
  FileQuestion,
  Loader2,
  Mail,
  MapPin,
  Phone,
  RefreshCw,
  Send,
  ShieldCheck,
  WifiOff,
} from 'lucide-react';
import BeforeAfter from '../../components/BeforeAfter';
import CaseTimeline from '../../components/CaseTimeline';
import EmptyState from '../../components/EmptyState';
import SeverityBadge from '../../components/SeverityBadge';
import StatusBadge from '../../components/StatusBadge';
import { readableError, updateComplaintStatus, verifyComplaint } from '../../lib/api';
import { priorityScale } from '../../lib/analytics';
import { useAuth } from '../../lib/authContext';
import { useComplaints } from '../../lib/complaintsContext';
import { photoPair } from '../../lib/demoData';
import { coords, initials, mapsUrl, placeName, statusOf, upvotesOf, when } from '../../lib/format';
import { useToast } from '../../lib/toastContext';
import { useComplaint } from '../../lib/useComplaint';

/**
 * Staff view of one case: everything the public page shows, plus the reporter's
 * contact details and the controls to move the case along.
 *
 * Reachable only through a signed-in session (see the route table in App.jsx).
 * That gate is a client-side one — the API itself still answers anybody, so
 * this page is the seam to revisit when real auth lands, not the defence.
 */

/**
 * The strings the backend stores. `statusOf` buckets whatever comes back into
 * three lanes, but writes have to pick an exact value, and these are the ones
 * the existing records already use.
 */
const NEXT_STATUS = [
  { value: 'Pending', label: 'Awaiting triage', lane: 'pending' },
  { value: 'In Progress', label: 'Work in progress', lane: 'progress' },
  { value: 'Resolved', label: 'Resolved', lane: 'resolved' },
];

function StatusControls({ complaint, onApplied }) {
  const toast = useToast();
  const { user } = useAuth();
  const [status, setStatus] = useState(
    () => NEXT_STATUS.find((s) => s.lane === statusOf(complaint))?.value ?? 'Pending',
  );
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [localOnly, setLocalOnly] = useState(false);

  const unchanged = NEXT_STATUS.find((s) => s.value === status)?.lane === statusOf(complaint);

  const verify = async () => {
    setBusy(true);
    try {
      const updated = await verifyComplaint(complaint.id, {
        verifiedBy: user?.name,
        note: note.trim() || `Checked and confirmed by ${user?.name}.`,
      });
      onApplied({ ...complaint, ...updated });
      setNote('');
      toast.success(`#${complaint.id} verified`, 'A crew can be dispatched to it now.');
    } catch (err) {
      toast.error('Could not verify', readableError(err));
    } finally {
      setBusy(false);
    }
  };

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const updated = await updateComplaintStatus(complaint.id, status, note);
      setLocalOnly(false);
      onApplied({ ...complaint, ...updated, status });
      setNote('');
      toast.success('Case updated', `#${complaint.id} is now “${status}”.`);
    } catch (err) {
      if (err?.unsupported) {
        // The in-memory backend has no status route. Showing the change and
        // saying plainly that it wasn't saved beats a raw 404 the user can do
        // nothing with — and beats a silent no-op, which would be a lie.
        setLocalOnly(true);
        onApplied({ ...complaint, status });
        setNote('');
        toast.info('Shown locally only', 'This backend build has no status endpoint yet.');
      } else {
        toast.error('Could not update', readableError(err));
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="card" onSubmit={submit}>
      <div className="card-head">
        <h3>Move this case</h3>
      </div>
      <div className="card-body stack" style={{ '--gap': '14px' }}>
        {/* Verification is a gate, not a status — the API rejects a move to "in
            progress" on an unchecked report whatever this form sends. Showing
            the gate here means the rejection is never a surprise. */}
        {complaint.verified ? (
          <p className="row" style={{ '--gap': '7px', fontSize: 13, color: 'var(--c-ok)' }}>
            <ShieldCheck size={14} aria-hidden="true" style={{ flex: 'none' }} />
            Verified by {complaint.verified_by || 'the desk'}
            {complaint.verified_at ? ` · ${when(complaint.verified_at)}` : ''}
          </p>
        ) : (
          <div className="geo geo-pending" style={{ flexWrap: 'wrap' }}>
            <AlertTriangle size={15} aria-hidden="true" style={{ flex: 'none' }} />
            <span style={{ flex: 1, minWidth: 160 }}>
              Not verified yet. Nothing can be dispatched until it is.
            </span>
            <button type="button" className="btn" onClick={verify} disabled={busy}>
              <ShieldCheck size={14} aria-hidden="true" />
              Verify
            </button>
          </div>
        )}

        <div className="field">
          <label htmlFor="status">Status</label>
          <select
            id="status"
            className="input"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            {NEXT_STATUS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label htmlFor="note">Note (optional)</label>
          <textarea
            id="note"
            className="input"
            rows={3}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="What changed, and who is doing the work."
            style={{ resize: 'vertical' }}
          />
        </div>

        <button type="submit" className="btn btn-primary" disabled={busy || (unchanged && !note)}>
          {busy ? (
            <>
              <Loader2 size={15} className="spin" aria-hidden="true" />
              Saving…
            </>
          ) : (
            <>
              <Send size={15} aria-hidden="true" />
              Update case
            </>
          )}
        </button>

        {localOnly && (
          // Not `.row` — that's a flex container, and the inline <code> below
          // would split the sentence into three separate flex items.
          <p
            style={{
              display: 'grid',
              gridTemplateColumns: 'auto minmax(0, 1fr)',
              gap: 7,
              fontSize: 12.5,
              lineHeight: 1.5,
              color: 'var(--c-warn)',
            }}
          >
            <AlertTriangle size={14} aria-hidden="true" style={{ marginTop: 3 }} />
            <span>
              Not saved. The running backend serves complaints from memory and has no{' '}
              <code className="mono">PATCH /complaints/&#123;id&#125;/status</code> route — this
              change disappears on refresh.
            </span>
          </p>
        )}

        {user && (
          <p className="hint" style={{ fontSize: 12 }}>
            Acting as {user.name}
            {user.emp_id ? ` · ${user.emp_id}` : ''}
          </p>
        )}
      </div>
    </form>
  );
}

export default function ComplaintDetails() {
  const { id } = useParams();
  const { complaint, setComplaint, loading, error, missing, reload } = useComplaint(id);
  const { complaints, patchOne } = useComplaints();

  const back = (
    <Link className="backlink" to="/admin">
      <ArrowLeft size={14} aria-hidden="true" />
      Back to the triage queue
    </Link>
  );

  if (loading) {
    return (
      <div className="stack page-enter" style={{ '--gap': '16px' }}>
        {back}
        <div className="skeleton" style={{ height: 26, width: '40%' }} />
        <div className="card">
          <div className="card-body stack" style={{ '--gap': '12px' }}>
            <div className="skeleton" style={{ height: 13, width: '65%' }} />
            <div className="skeleton" style={{ height: 13, width: '48%' }} />
            <div className="skeleton" style={{ height: 140 }} />
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
              ? 'It may have been removed, or the reference in the URL may be wrong.'
              : error}
          </EmptyState>
          <div className="card-body" style={{ paddingTop: 0, textAlign: 'center' }}>
            {missing ? (
              <Link className="btn btn-primary" to="/admin">
                Back to the queue
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

  const gps = coords(complaint);
  const link = mapsUrl(complaint);
  const place = placeName(complaint);
  const placeIsCoords = !!gps && place.replace(/\s/g, '') === gps.replace(/\s/g, '');
  const { hasAny: hasPhotos } = photoPair(complaint);

  const rawScore = Number(complaint.priority_score);
  // Scale is inferred from the whole list, not this one record — a lone case
  // scored 0.9 is ambiguous, but a hundred cases all under 1 are not.
  const score = Number.isFinite(rawScore) ? rawScore * priorityScale(complaints) : null;

  /** Keep the detail page and the dashboard's cached list in step after an edit. */
  const applyUpdate = (next) => {
    setComplaint(next);
    patchOne(complaint.id, next);
  };

  return (
    <div className="stack page-enter" style={{ '--gap': '18px' }}>
      {back}

      <div className="spread" style={{ alignItems: 'flex-start' }}>
        <div style={{ minWidth: 0 }}>
          <div className="row" style={{ '--gap': '8px', marginBottom: 6, flexWrap: 'wrap' }}>
            <span className="mono hint">#{complaint.id}</span>
            <span className="chip">{complaint.category || 'General'}</span>
            <SeverityBadge item={complaint} />
            {score !== null && <span className="chip tnum">Priority {Math.round(score)}</span>}
            <span className="chip tnum" title="Residents who backed this report">
              <ChevronUp size={12} aria-hidden="true" />
              {upvotesOf(complaint)} backing
            </span>
          </div>
          <h2 className="page-title">{complaint.title || 'Untitled report'}</h2>
          <p className="page-lede">{complaint.description || 'No description was recorded.'}</p>
        </div>
        <StatusBadge status={statusOf(complaint)} />
      </div>

      <div className="detail-grid">
        <div className="stack" style={{ '--gap': '16px' }}>
          {hasPhotos && (
            <div className="card">
              <div className="card-head">
                <h3>Evidence</h3>
              </div>
              <div className="card-body">
                <BeforeAfter item={complaint} />
              </div>
            </div>
          )}

          <div className="card">
            <div className="card-head">
              <h3>Progress</h3>
            </div>
            <div className="card-body">
              <CaseTimeline complaint={complaint} />
            </div>
          </div>

          <div className="card">
            <div className="card-head">
              <h3>Reported by</h3>
            </div>
            <div className="card-body">
              {complaint.complainant?.fullName ? (
                <div className="person" style={{ alignItems: 'flex-start' }}>
                  <span className="avatar" aria-hidden="true">
                    {initials(complaint.complainant.fullName)}
                  </span>
                  <div className="stack" style={{ '--gap': '6px', minWidth: 0 }}>
                    <span style={{ color: 'var(--c-ink)', fontWeight: 560 }}>
                      {complaint.complainant.fullName}
                    </span>
                    {complaint.complainant.phone && (
                      <a
                        className="row"
                        href={`tel:${complaint.complainant.phone.replace(/\s/g, '')}`}
                        style={{ '--gap': '7px', fontSize: 13.5, color: 'var(--c-brand)', textDecoration: 'none' }}
                      >
                        <Phone size={13} aria-hidden="true" />
                        <span className="tnum">{complaint.complainant.phone}</span>
                      </a>
                    )}
                    {complaint.complainant.email && (
                      <a
                        className="row"
                        href={`mailto:${complaint.complainant.email}`}
                        style={{ '--gap': '7px', fontSize: 13.5, color: 'var(--c-brand)', textDecoration: 'none' }}
                      >
                        <Mail size={13} aria-hidden="true" />
                        {complaint.complainant.email}
                      </a>
                    )}
                  </div>
                </div>
              ) : (
                <p className="hint">
                  Filed anonymously — no contact details were captured, so there is nobody to call
                  back when the work is done.
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="stack" style={{ '--gap': '16px' }}>
          <StatusControls complaint={complaint} onApplied={applyUpdate} />
          {/* Image-assisted severity analysis */}
{complaint.image_analysis && (
  <div className="card">
    <div className="card-head">
      <h3>AI-Assisted Severity Analysis</h3>
      <span className="chip">Image + Text</span>
    </div>

    <div className="card-body stack" style={{ '--gap': '14px' }}>

      <div
        style={{
          padding: '12px',
          borderRadius: 10,
          background: 'var(--c-surface-2)',
          border: '1px solid var(--c-border)',
        }}
      >
        <div
          className="row"
          style={{
            '--gap': '10px',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
          }}
        >
          <div>
            <div className="hint" style={{ fontSize: 12 }}>
              Final severity
            </div>

            <div style={{ marginTop: 4 }}>
              <SeverityBadge item={complaint} />
            </div>
          </div>

          <div>
            <div className="hint" style={{ fontSize: 12 }}>
              Visual score
            </div>

            <strong className="tnum">
              {complaint.image_analysis.visual_score ?? 0} / 15
            </strong>
          </div>
        </div>
      </div>

      <dl className="kv">
        <dt>Text severity</dt>
        <dd>
          <span style={{ textTransform: 'capitalize' }}>
            {complaint.text_severity || 'Not available'}
          </span>
        </dd>

        <dt>Image severity</dt>
        <dd>
          <span style={{ textTransform: 'capitalize' }}>
            {complaint.image_analysis.severity || 'Not available'}
          </span>
        </dd>

        <dt>Visual signals</dt>
        <dd>
          {complaint.image_analysis.signals?.length ? (
            <div className="stack" style={{ '--gap': '5px' }}>
              {complaint.image_analysis.signals.map((signal) => (
                <span key={signal} className="chip">
                  {signal.replaceAll('_', ' ')}
                </span>
              ))}
            </div>
          ) : (
            <span className="hint">No significant visual signals detected</span>
          )}
        </dd>
      </dl>

      {complaint.image_analysis.available ? (
        <p
          className="row"
          style={{
            '--gap': '7px',
            fontSize: 12.5,
            color: 'var(--c-ok)',
          }}
        >
          <ShieldCheck size={14} aria-hidden="true" />
          Image successfully analyzed and included in severity triage.
        </p>
      ) : (
        <p
          className="row"
          style={{
            '--gap': '7px',
            fontSize: 12.5,
            color: 'var(--c-warn)',
          }}
        >
          <AlertTriangle size={14} aria-hidden="true" />
          Image analysis was unavailable. Text severity was used.
        </p>
      )}

    </div>
  </div>
)}

          <div className="card">
            <div className="card-head">
              <h3>Case file</h3>
            </div>
            <div className="card-body stack" style={{ '--gap': '12px' }}>
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

                <dt>Location</dt>
                <dd>
                  <span className="row" style={{ '--gap': '6px', alignItems: 'flex-start' }}>
                    <MapPin
                      size={13}
                      aria-hidden="true"
                      style={{ marginTop: 3, flex: 'none', color: 'var(--c-ink-4)' }}
                    />
                    <span style={{ minWidth: 0 }}>
                      {!placeIsCoords && <span style={{ display: 'block' }}>{place}</span>}
                      {gps && <span className="mono tnum cell-sub">{gps}</span>}
                    </span>
                  </span>
                </dd>
              </dl>

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

              {complaint.reviewer?.name && (
                <p
                  className="row"
                  style={{ '--gap': '7px', alignItems: 'flex-start', fontSize: 13 }}
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

          <Link className="btn" to={`/complaint/${encodeURIComponent(complaint.id)}`}>
            View the public version
            <ExternalLink size={14} aria-hidden="true" />
          </Link>
        </div>
      </div>
    </div>
  );
}
