import { useMemo, useState } from 'react';
import {
  CheckCircle2,
  ChevronDown,
  Clock,
  Inbox,
  Layers,
  RefreshCw,
  Search,
  SearchX,
  Wrench,
} from 'lucide-react';
import ComplaintTable from './ComplaintTable';
import EmptyState from './EmptyState';
import StatCard from './StatCard';
import { statusOf } from '../lib/format';
import { demoResolved } from '../lib/demoData';

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
    c.reviewer?.name,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

function Section({ title, icon: Icon, tone, items, showResolutionColumns, loading, empty }) {
  const [open, setOpen] = useState(true);

  return (
    <div className="card anim-rise">
      <div className="card-head">
        <h3>
          <span
            style={{
              display: 'grid',
              placeItems: 'center',
              width: 26,
              height: 26,
              borderRadius: 7,
              background: tone.soft,
              color: tone.fg,
            }}
          >
            <Icon size={14} aria-hidden="true" />
          </span>
          {title}
          <span className="chip tnum">{items.length}</span>
        </h3>

        <button
          type="button"
          className="btn btn-ghost"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
        >
          {open ? 'Collapse' : 'Expand'}
          <ChevronDown
            size={15}
            aria-hidden="true"
            style={{
              transform: open ? 'rotate(180deg)' : 'none',
              transition: 'transform var(--t-mid) var(--ease-out)',
            }}
          />
        </button>
      </div>

      {open &&
        (items.length === 0 && !loading ? (
          <EmptyState icon={empty.icon} title={empty.title}>
            {empty.body}
          </EmptyState>
        ) : (
          <ComplaintTable
            items={items}
            showResolutionColumns={showResolutionColumns}
            loading={loading}
          />
        ))}
    </div>
  );
}

export default function AdminDashboard({ complaints, loading, onRefresh, lastUpdated }) {
  const [query, setQuery] = useState('');

  const lanes = useMemo(() => {
    const real = { pending: [], progress: [], resolved: [] };
    for (const c of complaints) real[statusOf(c)].push(c);
    // Demo rows only stand in while the backend has no resolved cases of its own.
    return { ...real, resolved: real.resolved.length ? real.resolved : demoResolved };
  }, [complaints]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return lanes;
    const match = (list) => list.filter((c) => haystack(c).includes(q));
    return {
      pending: match(lanes.pending),
      progress: match(lanes.progress),
      resolved: match(lanes.resolved),
    };
  }, [lanes, query]);

  const total = lanes.pending.length + lanes.progress.length + lanes.resolved.length;
  const hits = filtered.pending.length + filtered.progress.length + filtered.resolved.length;

  return (
    <div className="stack page-enter" style={{ '--gap': '24px' }}>
      <div className="spread">
        <div>
          <h2 className="page-title">Operations dashboard</h2>
          <p className="page-lede">
            Every report, grouped by where it stands. Resolved cases carry the field photo and the
            inspector who signed off.
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

          <button type="button" className="btn" onClick={onRefresh} disabled={loading}>
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
          value={total}
          tone="var(--c-brand)"
          toneSoft="var(--c-brand-soft)"
        />
        <StatCard
          index={1}
          icon={Clock}
          label="Awaiting triage"
          value={lanes.pending.length}
          tone="var(--c-warn)"
          toneSoft="var(--c-warn-soft)"
        />
        <StatCard
          index={2}
          icon={Wrench}
          label="Crews on site"
          value={lanes.progress.length}
          tone="var(--c-info)"
          toneSoft="var(--c-info-soft)"
        />
        <StatCard
          index={3}
          icon={CheckCircle2}
          label="Resolved & verified"
          value={lanes.resolved.length}
          tone="var(--c-ok)"
          toneSoft="var(--c-ok-soft)"
        />
      </div>

      {query && (
        <p className="hint anim-fade">
          {hits === 0 ? 'No cases match' : `${hits} of ${total} cases match`} “{query}”
          <button
            type="button"
            className="btn btn-ghost"
            style={{ marginLeft: 8, padding: '2px 8px', fontSize: 12 }}
            onClick={() => setQuery('')}
          >
            Clear
          </button>
        </p>
      )}

      <Section
        title="Awaiting triage"
        icon={Clock}
        tone={{ fg: 'var(--c-warn)', soft: 'var(--c-warn-soft)' }}
        items={filtered.pending}
        loading={loading}
        empty={{
          icon: query ? SearchX : Inbox,
          title: query ? 'Nothing here matches your search' : 'Inbox zero',
          body: query
            ? 'Try a shorter search term, or clear it to see everything.'
            : 'No untriaged reports right now. New submissions land here first.',
        }}
      />

      <Section
        title="Work in progress"
        icon={Wrench}
        tone={{ fg: 'var(--c-info)', soft: 'var(--c-info-soft)' }}
        items={filtered.progress}
        loading={loading}
        empty={{
          icon: query ? SearchX : Wrench,
          title: query ? 'No matches in this lane' : 'No active jobs',
          body: query
            ? 'Nothing in progress matches that term.'
            : 'Cases move here once a department picks them up.',
        }}
      />

      <Section
        title="Resolved & verified"
        icon={CheckCircle2}
        tone={{ fg: 'var(--c-ok)', soft: 'var(--c-ok-soft)' }}
        items={filtered.resolved}
        showResolutionColumns
        loading={loading}
        empty={{
          icon: query ? SearchX : CheckCircle2,
          title: query ? 'No matches in this lane' : 'Nothing closed out yet',
          body: query
            ? 'No resolved case matches that term.'
            : 'Completed work shows up here with a photo and the inspector who verified it.',
        }}
      />

      {lastUpdated && (
        <p className="hint" style={{ textAlign: 'right' }}>
          Last synced {lastUpdated.toLocaleTimeString()}
        </p>
      )}
    </div>
  );
}
