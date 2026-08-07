import { useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowRight, MapPin, Search, SearchX, Ticket } from 'lucide-react';
import EmptyState from '../../components/EmptyState';
import StatusBadge from '../../components/StatusBadge';
import { useComplaints } from '../../lib/complaintsContext';
import { ago, placeName, statusOf, when } from '../../lib/format';

/**
 * Citizen-side lookup: "what happened to the thing I reported?"
 *
 * Search terms live in the URL rather than in component state, so a result is
 * a link somebody can bookmark or send to a neighbour who reported the same
 * pothole.
 *
 * Deliberately searches and shows NO complainant details. Someone who knows a
 * reference number shouldn't be able to fish for the reporter's phone number,
 * and typing a name here should never surface a stranger's case. Only the
 * staff dashboard carries that data.
 */
function matches(complaint, query) {
  const q = query.toLowerCase();

  // An exact reference match wins outright — that's the common case, and it
  // shouldn't be diluted by a description that happens to contain the digits.
  if (String(complaint.id ?? '').toLowerCase() === q) return 2;

  const haystack = [
    complaint.id,
    complaint.title,
    complaint.description,
    complaint.category,
    complaint.location,
    complaint.department,
    complaint.status,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  return haystack.includes(q) ? 1 : 0;
}

export default function TrackComplaint() {
  const { complaints, loading } = useComplaints();
  const [params, setParams] = useSearchParams();
  const query = params.get('q') ?? '';

  const results = useMemo(() => {
    const q = query.trim();
    if (!q) return [];
    return complaints
      .map((c) => ({ c, score: matches(c, q) }))
      .filter((r) => r.score > 0)
      .sort((a, b) => b.score - a.score)
      .map((r) => r.c);
  }, [complaints, query]);

  const onChange = (value) => {
    // `replace` so typing doesn't stack one history entry per keystroke.
    setParams(value ? { q: value } : {}, { replace: true });
  };

  return (
    <div className="stack page-enter" style={{ '--gap': '22px', maxWidth: 780, margin: '0 auto' }}>
      <div>
        <h2 className="page-title">Track a report</h2>
        <p className="page-lede">
          Enter the reference number from your confirmation screen — or just describe the problem
          and the street. You&rsquo;ll see which department has it and whether the work is done.
        </p>
      </div>

      <div style={{ position: 'relative' }}>
        <Search
          size={16}
          aria-hidden="true"
          style={{
            position: 'absolute',
            left: 12,
            top: '50%',
            transform: 'translateY(-50%)',
            color: 'var(--c-ink-4)',
            pointerEvents: 'none',
          }}
        />
        <input
          className="input"
          type="search"
          value={query}
          onChange={(e) => onChange(e.target.value)}
          placeholder="e.g. 3, or “pothole Central Market”"
          aria-label="Reference number or keywords"
          autoFocus
          style={{ paddingLeft: 38, width: '100%', height: 46 }}
        />
      </div>

      {loading && (
        <div className="stack" style={{ '--gap': '10px' }}>
          {[0, 1].map((i) => (
            <div className="card" key={i}>
              <div className="card-body stack" style={{ '--gap': '10px' }}>
                <div className="skeleton" style={{ height: 14, width: '55%' }} />
                <div className="skeleton" style={{ height: 12, width: '35%' }} />
              </div>
            </div>
          ))}
        </div>
      )}

      {!loading && !query.trim() && (
        <div className="card">
          <EmptyState icon={Ticket} title="Nothing to look up yet">
            Your reference is the number we showed you right after you submitted — something like{' '}
            <b>#3</b>. Lost it? Search for the street name instead.
          </EmptyState>
        </div>
      )}

      {!loading && query.trim() && results.length === 0 && (
        <div className="card">
          <EmptyState icon={SearchX} title="No case matches that">
            Check the reference number, or try just the street name. Reports filed in the last
            minute can take a moment to appear.
          </EmptyState>
        </div>
      )}

      {!loading && results.length > 0 && (
        <>
          <p className="hint">
            {results.length} {results.length === 1 ? 'case' : 'cases'} matching “{query.trim()}”
          </p>

          <div className="stack" style={{ '--gap': '10px' }}>
            {results.map((c, i) => (
              <article className="card anim-rise" key={c.id ?? i} style={{ '--i': i }}>
                <div className="card-body stack" style={{ '--gap': '10px' }}>
                  <div className="spread" style={{ alignItems: 'flex-start' }}>
                    <div style={{ minWidth: 0 }}>
                      <div className="row" style={{ '--gap': '8px', marginBottom: 5 }}>
                        <span className="mono hint">#{c.id ?? '—'}</span>
                        <span className="chip">{c.category || 'General'}</span>
                      </div>
                      <h3 style={{ fontSize: 15.5 }}>{c.title || 'Untitled report'}</h3>
                    </div>
                    <StatusBadge status={statusOf(c)} />
                  </div>

                  {c.description && (
                    <p className="hint" style={{ lineHeight: 1.55 }}>
                      {c.description}
                    </p>
                  )}

                  <div className="row" style={{ '--gap': '14px', flexWrap: 'wrap', fontSize: 13 }}>
                    <span className="row" style={{ '--gap': '6px' }}>
                      <MapPin size={13} aria-hidden="true" style={{ color: 'var(--c-ink-4)' }} />
                      {placeName(c)}
                    </span>
                    <span className="hint tnum">
                      Filed {when(c.timestamp || c.created_at)}
                      {ago(c.timestamp || c.created_at) ? ` · ${ago(c.timestamp || c.created_at)}` : ''}
                    </span>
                  </div>

                  {c.id != null && (
                    <Link className="btn" to={`/complaint/${encodeURIComponent(c.id)}`}>
                      See the full history
                      <ArrowRight size={15} aria-hidden="true" />
                    </Link>
                  )}
                </div>
              </article>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
