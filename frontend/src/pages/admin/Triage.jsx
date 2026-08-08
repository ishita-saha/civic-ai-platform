import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  ChevronUp,
  ClipboardCheck,
  Inbox,
  MapPin,
  RefreshCw,
  ShieldCheck,
  Table2,
  Wrench,
} from 'lucide-react';
import EmptyState from '../../components/EmptyState';
import SeverityBadge from '../../components/SeverityBadge';
import StatCard from '../../components/StatCard';
import StatusBadge from '../../components/StatusBadge';
import { readableError, updateComplaintStatus, verifyComplaint } from '../../lib/api';
import { useAuth } from '../../lib/authContext';
import { useComplaints } from '../../lib/complaintsContext';
import { ago, placeName, severityOf, severityRank, statusOf, upvotesOf, when } from '../../lib/format';
import { useToast } from '../../lib/toastContext';

/**
 * The admin's triage queue.
 *
 * Ranked by the API's priority score, which is severity plus a capped bonus for
 * upvotes. The cap is the important half: ten neighbours annoyed about a faded
 * sign should not outrank one report of a live wire. Both inputs are shown on
 * every card so the ordering is never something the admin has to take on trust.
 *
 * Nothing here dispatches a crew off a report that hasn't been checked. The
 * "Start work" control does not exist until the case is verified, and the API
 * refuses the status change independently — the button is the reminder, the
 * 409 is the rule.
 */
const LANES = [
  { key: 'unverified', label: 'To verify' },
  { key: 'ready', label: 'Verified, not started' },
  { key: 'progress', label: 'Work in progress' },
  { key: 'resolved', label: 'Resolved' },
  { key: 'all', label: 'Everything' },
];

const SORTS = [
  { key: 'priority', label: 'Priority' },
  { key: 'severity', label: 'Severity' },
  { key: 'upvotes', label: 'Upvotes' },
  { key: 'new', label: 'Newest' },
];

function laneOf(c) {
  const s = statusOf(c);
  if (s === 'resolved') return 'resolved';
  if (s === 'progress') return 'progress';
  return c.verified ? 'ready' : 'unverified';
}

function filedAt(c) {
  const d = new Date(c?.timestamp || c?.created_at || 0);
  return Number.isNaN(d.getTime()) ? 0 : d.getTime();
}

function scoreOf(c) {
  const n = Number(c?.priority_score);
  return Number.isFinite(n) ? n : 0;
}

export default function Triage() {
  const { user } = useAuth();
  const { complaints, loading, lastUpdated, refresh, patchOne } = useComplaints();
  const toast = useToast();

  const [lane, setLane] = useState('unverified');
  const [sort, setSort] = useState('priority');
  const [busyId, setBusyId] = useState(null);

  const counts = useMemo(() => {
    const c = { unverified: 0, ready: 0, progress: 0, resolved: 0, all: complaints.length };
    for (const item of complaints) c[laneOf(item)] += 1;
    return c;
  }, [complaints]);

  const criticalOpen = useMemo(
    () =>
      complaints.filter((c) => statusOf(c) !== 'resolved' && severityOf(c) === 'critical').length,
    [complaints],
  );

  const shown = useMemo(() => {
    const list = complaints.filter((c) => lane === 'all' || laneOf(c) === lane);
    const ranked = [...list];

    if (sort === 'priority') ranked.sort((a, b) => scoreOf(b) - scoreOf(a) || upvotesOf(b) - upvotesOf(a));
    else if (sort === 'severity') ranked.sort((a, b) => severityRank(a) - severityRank(b) || upvotesOf(b) - upvotesOf(a));
    else if (sort === 'upvotes') ranked.sort((a, b) => upvotesOf(b) - upvotesOf(a) || scoreOf(b) - scoreOf(a));
    else ranked.sort((a, b) => filedAt(b) - filedAt(a));

    return ranked;
  }, [complaints, lane, sort]);

  const act = async (complaint, run, success) => {
    setBusyId(complaint.id);
    try {
      const updated = await run();
      patchOne(complaint.id, updated);
      toast.success(success.title, success.message);
    } catch (err) {
      toast.error('Nothing changed', readableError(err));
    } finally {
      setBusyId(null);
    }
  };

  const verify = (c) =>
    act(
      c,
      () => verifyComplaint(c.id, { verifiedBy: user?.name, note: `Checked and confirmed by ${user?.name}.` }),
      { title: `#${c.id} verified`, message: 'A crew can be dispatched to it now.' },
    );

  const start = (c) =>
    act(c, () => updateComplaintStatus(c.id, 'In Progress', 'Crew dispatched.'), {
      title: `#${c.id} is in progress`,
      message: 'It shows as active work on the public feed.',
    });

  const resolve = (c) =>
    act(c, () => updateComplaintStatus(c.id, 'Resolved', 'Work completed and signed off.'), {
      title: `#${c.id} closed`,
      message: 'The reporter and everyone who backed it can see it as done.',
    });

  return (
    <div className="stack page-enter" style={{ '--gap': '20px' }}>
      <div className="spread" style={{ alignItems: 'flex-start' }}>
        <div>
          <h2 className="page-title">Triage queue</h2>
          <p className="page-lede">
            Ranked by classified severity and how many residents have backed the report. Check a
            case before any crew goes out to it.
          </p>
        </div>

        <div className="row" style={{ '--gap': '8px' }}>
          <Link className="btn" to="/admin/cases">
            <Table2 size={15} aria-hidden="true" />
            All cases
          </Link>
          <Link className="btn" to="/admin/analytics">
            <BarChart3 size={15} aria-hidden="true" />
            Analytics
          </Link>
          <button type="button" className="btn" onClick={() => refresh({ announce: true })} disabled={loading}>
            <RefreshCw size={15} className={loading ? 'spin' : undefined} aria-hidden="true" />
            Refresh
          </button>
        </div>
      </div>

      <div className="stat-grid">
        <StatCard
          index={0}
          icon={ClipboardCheck}
          label="Waiting to be verified"
          value={counts.unverified}
          tone="var(--c-warn)"
          toneSoft="var(--c-warn-soft)"
        />
        <StatCard
          index={1}
          icon={AlertTriangle}
          label="Critical & still open"
          value={criticalOpen}
          tone="var(--c-danger)"
          toneSoft="var(--c-danger-soft)"
        />
        <StatCard
          index={2}
          icon={Wrench}
          label="Crews on site"
          value={counts.progress}
          tone="var(--c-info)"
          toneSoft="var(--c-info-soft)"
        />
        <StatCard
          index={3}
          icon={CheckCircle2}
          label="Resolved"
          value={counts.resolved}
          tone="var(--c-ok)"
          toneSoft="var(--c-ok-soft)"
        />
      </div>

      <div className="card">
        <div className="card-head">
          <div className="segmented" role="tablist" aria-label="Filter the queue">
            {LANES.map((l) => (
              <button
                key={l.key}
                type="button"
                role="tab"
                aria-selected={lane === l.key}
                onClick={() => setLane(l.key)}
              >
                {l.label}
                <span className="chip tnum">{counts[l.key]}</span>
              </button>
            ))}
          </div>

          <div className="row" style={{ '--gap': '8px' }}>
            <label className="hint" htmlFor="triage-sort">
              Order by
            </label>
            <select
              id="triage-sort"
              className="input"
              value={sort}
              onChange={(e) => setSort(e.target.value)}
              style={{ width: 150 }}
            >
              {SORTS.map((s) => (
                <option key={s.key} value={s.key}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {!loading && shown.length === 0 ? (
          <EmptyState icon={Inbox} title="Nothing in this lane">
            {lane === 'unverified'
              ? 'Every report on the feed has been checked. New posts land here first.'
              : 'Switch lanes to see the rest of the queue.'}
          </EmptyState>
        ) : (
          <div className="stack" style={{ '--gap': 0 }}>
            {shown.map((c, i) => {
              const busy = busyId === c.id;
              const where = laneOf(c);

              return (
                <div className="triage-row anim-rise" key={c.id} style={{ '--i': i }}>
                  <div className="triage-score">
                    <span className="triage-priority tnum">{Math.round(scoreOf(c))}</span>
                    <span className="triage-votes tnum" title={`${upvotesOf(c)} residents backed this`}>
                      <ChevronUp size={13} aria-hidden="true" />
                      {upvotesOf(c)}
                    </span>
                  </div>

                  <div className="stack" style={{ '--gap': '9px', minWidth: 0 }}>
                    <div className="row" style={{ '--gap': '8px', flexWrap: 'wrap' }}>
                      <span className="mono hint">#{c.id}</span>
                      <SeverityBadge item={c} />
                      <StatusBadge status={statusOf(c)} />
                      <span className="chip">{c.category || 'General'}</span>
                      {c.verified ? (
                        <span className="chip" style={{ color: 'var(--c-ok)' }}>
                          <ShieldCheck size={12} aria-hidden="true" />
                          Verified by {c.verified_by || 'the desk'}
                        </span>
                      ) : (
                        <span className="chip" style={{ color: 'var(--c-warn)' }}>
                          Unverified
                        </span>
                      )}
                    </div>

                    <div>
                      <Link className="triage-title" to={`/admin/case/${encodeURIComponent(c.id)}`}>
                        {c.title || 'Untitled report'}
                      </Link>
                      {c.description && (
                        <p className="hint" style={{ marginTop: 4, lineHeight: 1.55, maxWidth: '68ch' }}>
                          {c.description}
                        </p>
                      )}
                    </div>

                    <div className="post-meta">
                      <span>{c.author?.name || c.complainant?.fullName || 'Anonymous'}</span>
                      <span className="row" style={{ '--gap': '6px' }}>
                        <MapPin size={13} aria-hidden="true" style={{ color: 'var(--c-ink-4)' }} />
                        {placeName(c)}
                      </span>
                      <span className="hint tnum" title={when(c.timestamp || c.created_at)}>
                        {ago(c.timestamp || c.created_at) || when(c.timestamp || c.created_at)}
                      </span>
                      <span className="hint">{c.department || 'Unassigned department'}</span>
                    </div>
                  </div>

                  <div className="triage-actions">
                    {!c.verified && (
                      <button type="button" className="btn btn-primary" onClick={() => verify(c)} disabled={busy}>
                        <ShieldCheck size={15} aria-hidden="true" />
                        Verify report
                      </button>
                    )}

                    {c.verified && where === 'ready' && (
                      <button type="button" className="btn btn-primary" onClick={() => start(c)} disabled={busy}>
                        <Wrench size={15} aria-hidden="true" />
                        Start work
                      </button>
                    )}

                    {where === 'progress' && (
                      <button type="button" className="btn btn-primary" onClick={() => resolve(c)} disabled={busy}>
                        <CheckCircle2 size={15} aria-hidden="true" />
                        Mark resolved
                      </button>
                    )}

                    <Link className="btn" to={`/admin/case/${encodeURIComponent(c.id)}`}>
                      Open case
                    </Link>

                    {!c.verified && (
                      <span className="hint" style={{ maxWidth: 190, lineHeight: 1.45 }}>
                        Work can&rsquo;t be started until this is verified.
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {lastUpdated && (
        <p className="hint" style={{ textAlign: 'right' }}>
          Last synced {lastUpdated.toLocaleTimeString()}
        </p>
      )}
    </div>
  );
}
