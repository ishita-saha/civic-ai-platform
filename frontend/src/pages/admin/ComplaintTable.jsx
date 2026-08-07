import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowDown, ArrowUp, ChevronsUpDown, MapPin } from 'lucide-react';
import StatusBadge from '../../components/StatusBadge';
import { priorityScale } from '../../lib/analytics';
import { ago, caseId, coords, initials, placeName, statusOf, when } from '../../lib/format';

/**
 * The triage table.
 *
 * Distinct from components/ComplaintTable, which is a presentational table the
 * old tabbed dashboard rendered three times — once per status lane, already
 * sorted by whoever passed the array in. This one is the working surface: one
 * table over everything, sortable by the columns a triage desk actually ranks
 * on, and every row is a link into the case.
 */

const STATUS_RANK = { pending: 0, progress: 1, resolved: 2 };

const COLUMNS = [
  { key: 'ref', label: 'Case', sortable: true },
  { key: 'issue', label: 'Issue', sortable: true },
  { key: 'location', label: 'Location', sortable: false },
  { key: 'priority', label: 'Priority', sortable: true },
  { key: 'status', label: 'Status', sortable: true },
  { key: 'filed', label: 'Filed', sortable: true },
  { key: 'reporter', label: 'Reported by', sortable: false },
];

function sortValue(item, key, factor) {
  switch (key) {
    case 'ref':
      return String(item.id ?? '');
    case 'issue':
      return String(item.title || item.description || '').toLowerCase();
    case 'priority': {
      const raw = Number(item.priority_score);
      // Unscored cases sort to the bottom of a descending list rather than
      // pretending to be a zero-priority case somebody has already assessed.
      return Number.isFinite(raw) ? raw * factor : -1;
    }
    case 'status':
      return STATUS_RANK[statusOf(item)];
    case 'filed': {
      const d = new Date(item.timestamp || item.created_at);
      return Number.isNaN(d.getTime()) ? 0 : d.getTime();
    }
    default:
      return 0;
  }
}

function SkeletonRows() {
  return Array.from({ length: 4 }, (_, r) => (
    <tr key={r}>
      {COLUMNS.map((c, i) => (
        <td key={c.key}>
          <div className="skeleton" style={{ height: 12, width: `${45 + ((r + i) % 4) * 14}%` }} />
        </td>
      ))}
    </tr>
  ));
}

/** Priority chip. Colour is the sequential ramp — magnitude, not identity. */
function PriorityCell({ score }) {
  if (!Number.isFinite(score)) return <span className="cell-sub">Not scored</span>;

  const step = score >= 80 ? 4 : score >= 60 ? 3 : score >= 40 ? 2 : 1;
  const label = score >= 80 ? 'Critical' : score >= 60 ? 'High' : score >= 40 ? 'Moderate' : 'Low';

  return (
    <span className="row" style={{ '--gap': '7px' }}>
      <span
        aria-hidden="true"
        style={{
          width: 8,
          height: 8,
          flex: 'none',
          borderRadius: 2,
          background: `var(--c-seq-${step})`,
        }}
      />
      <span>
        <span style={{ display: 'block', color: 'var(--c-ink)', fontWeight: 550 }}>{label}</span>
        <span className="cell-sub tnum">{Math.round(score)}</span>
      </span>
    </span>
  );
}

export default function ComplaintTable({ items, loading = false }) {
  const navigate = useNavigate();
  // Highest priority first is the order a triage desk wants on arrival.
  const [sort, setSort] = useState({ key: 'priority', dir: 'desc' });

  const factor = useMemo(() => priorityScale(items), [items]);

  const rows = useMemo(() => {
    const copy = [...items];
    copy.sort((a, b) => {
      const av = sortValue(a, sort.key, factor);
      const bv = sortValue(b, sort.key, factor);
      const cmp = typeof av === 'string' ? av.localeCompare(bv) : av - bv;
      return sort.dir === 'asc' ? cmp : -cmp;
    });
    return copy;
  }, [items, sort, factor]);

  const toggle = (key) => {
    setSort((s) =>
      s.key === key
        ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' }
        : // Text reads best A→Z; numbers and dates read best biggest-first.
          { key, dir: key === 'ref' || key === 'issue' ? 'asc' : 'desc' },
    );
  };

  const open = (item) => {
    if (item.id != null) navigate(`/admin/case/${encodeURIComponent(item.id)}`);
  };

  return (
    <div className="table-scroll">
      <table className="data data-wide">
        <thead>
          <tr>
            {COLUMNS.map((col) => {
              const active = sort.key === col.key;
              return (
                <th
                  scope="col"
                  key={col.key}
                  aria-sort={active ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}
                >
                  {col.sortable ? (
                    <button type="button" className="th-sort" onClick={() => toggle(col.key)}>
                      {col.label}
                      {active ? (
                        sort.dir === 'asc' ? (
                          <ArrowUp size={12} aria-hidden="true" />
                        ) : (
                          <ArrowDown size={12} aria-hidden="true" />
                        )
                      ) : (
                        <ChevronsUpDown size={12} aria-hidden="true" style={{ opacity: 0.45 }} />
                      )}
                    </button>
                  ) : (
                    col.label
                  )}
                </th>
              );
            })}
          </tr>
        </thead>

        <tbody>
          {loading && <SkeletonRows />}

          {!loading &&
            rows.map((item, i) => {
              const ref = caseId(item, i);
              const raw = Number(item.priority_score);
              const gps = coords(item);
              const place = placeName(item);
              const placeIsCoords = !!gps && place.replace(/\s/g, '') === gps.replace(/\s/g, '');
              const filed = ago(item.timestamp || item.created_at);

              return (
                <tr
                  key={ref}
                  style={{ '--i': i }}
                  className={item.id != null ? 'clickable' : undefined}
                  // The anchor in the first cell is the real, keyboard-reachable
                  // link; this just widens the target for mouse users.
                  onClick={(e) => {
                    if (e.target.closest('a')) return;
                    open(item);
                  }}
                >
                  <td>
                    {item.id != null ? (
                      <a
                        className="row-link mono"
                        href={`/admin/case/${encodeURIComponent(item.id)}`}
                        onClick={(e) => {
                          // Let ctrl/cmd-click and middle-click open a real tab.
                          if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
                          e.preventDefault();
                          open(item);
                        }}
                      >
                        #{ref}
                      </a>
                    ) : (
                      <span className="mono cell-sub">#{ref}</span>
                    )}
                  </td>

                  <td>
                    <div className="cell-title">{item.title || 'Untitled report'}</div>
                    <span className="chip">{item.category || 'General'}</span>
                    {item.description && (
                      <div className="cell-sub" style={{ marginTop: 7 }}>
                        {item.description}
                      </div>
                    )}
                  </td>

                  <td>
                    <div className="row" style={{ '--gap': '6px', alignItems: 'flex-start' }}>
                      <MapPin
                        size={14}
                        aria-hidden="true"
                        style={{ marginTop: 2, flex: 'none', color: 'var(--c-ink-4)' }}
                      />
                      <div style={{ minWidth: 0 }}>
                        {placeIsCoords ? (
                          <div className="mono tnum" style={{ color: 'var(--c-ink)' }}>
                            {gps}
                          </div>
                        ) : (
                          <>
                            <div style={{ color: 'var(--c-ink)' }}>{place}</div>
                            {gps && (
                              <div className="cell-sub mono tnum" style={{ marginTop: 3 }}>
                                {gps}
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  </td>

                  <td>
                    <PriorityCell score={Number.isFinite(raw) ? raw * factor : NaN} />
                  </td>

                  <td>
                    <StatusBadge status={statusOf(item)} />
                    {statusOf(item) !== 'resolved' && filed && (
                      <div className="cell-sub" style={{ marginTop: 6 }}>
                        open {filed.replace(' ago', '')}
                      </div>
                    )}
                  </td>

                  <td>
                    <div className="tnum" style={{ color: 'var(--c-ink)' }}>
                      {when(item.timestamp || item.created_at)}
                    </div>
                    <div className="cell-sub" style={{ marginTop: 4 }}>
                      {item.department || `${item.category || 'Municipal'} Dept.`}
                    </div>
                  </td>

                  <td>
                    {item.complainant?.fullName ? (
                      <div className="person">
                        <span className="avatar" aria-hidden="true">
                          {initials(item.complainant.fullName)}
                        </span>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ color: 'var(--c-ink)', fontWeight: 550 }}>
                            {item.complainant.fullName}
                          </div>
                          {item.complainant.phone && (
                            <div className="cell-sub tnum">{item.complainant.phone}</div>
                          )}
                        </div>
                      </div>
                    ) : (
                      <span className="cell-sub">Anonymous</span>
                    )}
                  </td>
                </tr>
              );
            })}
        </tbody>
      </table>
    </div>
  );
}
