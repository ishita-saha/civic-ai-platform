import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  BarChart3,
  CheckCircle2,
  Clock,
  Inbox,
  Layers,
  RefreshCw,
  Search,
  SearchX,
  Wrench,
} from 'lucide-react';
import EmptyState from '../../components/EmptyState';
import StatCard from '../../components/StatCard';
import { summarize } from '../../lib/analytics';
import { useComplaints } from '../../lib/complaintsContext';
import { statusOf } from '../../lib/format';
import ComplaintTable from './ComplaintTable';

/** Flattens a record into one lowercase haystack so search hits any visible field. */
function haystack(c) {
  return [
    c.id,
    c.title,
    c.description,
    c.category,
    c.location,
    c.department,
    c.officer_assigned,
    c.assigned_officer,
    c.status,
    c.complainant?.fullName,
    c.complainant?.phone,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

const LANES = [
  { key: 'all', label: 'All cases' },
  { key: 'pending', label: 'Awaiting triage' },
  { key: 'progress', label: 'In progress' },
  { key: 'resolved', label: 'Resolved' },
];

/**
 * Operations dashboard.
 *
 * One sortable table with a lane filter, rather than the three always-visible
 * accordions the tabbed build used: now that a row opens a case, ranking the
 * whole queue by priority matters more than keeping the lanes side by side.
 *
 * Unlike that build, this shows no demo rows in the resolved lane. Filler was
 * harmless when the table was read-only; it isn't once every row is a link
 * that has to resolve to a real case.
 */
export default function Dashboard() {
  const { complaints, loading, lastUpdated, refresh } = useComplaints();
  const [query, setQuery] = useState('');
  const [lane, setLane] = useState('all');

  const stats = useMemo(() => summarize(complaints), [complaints]);

  const counts = useMemo(
    () => ({
      all: complaints.length,
      pending: stats.pending,
      progress: stats.progress,
      resolved: stats.resolved,
    }),
    [complaints.length, stats],
  );

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return complaints.filter(
      (c) => (lane === 'all' || statusOf(c) === lane) && (!q || haystack(c).includes(q)),
    );
  }, [complaints, lane, query]);

  const filtering = !!query.trim() || lane !== 'all';

  return (
    <div className="stack page-enter" style={{ '--gap': '22px' }}>
      <div className="spread">
        <div>
          <h2 className="page-title">Operations dashboard</h2>
          <p className="page-lede">
            Every report in one queue, ranked by priority. Open a case to see the reporter&rsquo;s
            details and move it along.
          </p>
        </div>

        <div className="row" style={{ '--gap': '8px' }}>
          <div style={{ position: 'relative' }}>
            <Search
              size={15}
              aria-hidden="true"
              style={{
                position: 'absolute',
                left: 11,
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--c-ink-4)',
                pointerEvents: 'none',
              }}
            />
            <input
              className="input"
              type="search"
              placeholder="Search cases…"
              aria-label="Search complaints"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              style={{ paddingLeft: 34, width: 230 }}
            />
          </div>

          <Link className="btn" to="/admin/analytics">
            <BarChart3 size={15} aria-hidden="true" />
            Analytics
          </Link>

          <button
            type="button"
            className="btn"
            onClick={() => refresh({ announce: true })}
            disabled={loading}
          >
            <RefreshCw size={15} className={loading ? 'spin' : undefined} aria-hidden="true" />
            Refresh
          </button>
        </div>
      </div>

      <div className="stat-grid">
        <StatCard
          index={0}
          icon={Layers}
          label="Total reports"
          value={stats.total}
          tone="var(--c-brand)"
          toneSoft="var(--c-brand-soft)"
        />
        <StatCard
          index={1}
          icon={Clock}
          label="Awaiting triage"
          value={stats.pending}
          tone="var(--c-warn)"
          toneSoft="var(--c-warn-soft)"
        />
        <StatCard
          index={2}
          icon={Wrench}
          label="Crews on site"
          value={stats.progress}
          tone="var(--c-info)"
          toneSoft="var(--c-info-soft)"
        />
        <StatCard
          index={3}
          icon={CheckCircle2}
          label="Resolved & verified"
          value={stats.resolved}
          tone="var(--c-ok)"
          toneSoft="var(--c-ok-soft)"
        />
      </div>

      <div className="card">
        <div className="card-head">
          <div className="segmented" role="tablist" aria-label="Filter by status">
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

          {filtering && (
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => {
                setQuery('');
                setLane('all');
              }}
            >
              Clear filters
            </button>
          )}
        </div>

        {!loading && shown.length === 0 ? (
          <EmptyState
            icon={filtering ? SearchX : Inbox}
            title={filtering ? 'Nothing here matches' : 'Inbox zero'}
          >
            {filtering
              ? 'Try a shorter search term, or switch back to all cases.'
              : 'No reports have come in yet. New submissions land here first.'}
          </EmptyState>
        ) : (
          <ComplaintTable items={shown} loading={loading} />
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
