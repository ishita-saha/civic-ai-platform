import { useMemo, useState } from 'react';
import { CalendarCheck, Hammer, MapPin, Search, SearchX, ShieldCheck } from 'lucide-react';
import BeforeAfter from './BeforeAfter';
import EmptyState from './EmptyState';
import { demoResolved } from '../lib/demoData';
import { statusOf, when } from '../lib/format';

/**
 * The public record of finished work.
 *
 * Deliberately shows NO complainant name or phone number, unlike the staff
 * dashboard. Who reported a pothole is nobody's business; whether it got fixed
 * is everybody's.
 */
export default function PastWork({ complaints, loading }) {
  const [query, setQuery] = useState('');

  const cases = useMemo(() => {
    const real = complaints.filter((c) => statusOf(c) === 'resolved');
    return real.length ? real : demoResolved;
  }, [complaints]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return cases;
    return cases.filter((c) =>
      [c.title, c.location, c.category, c.department, c.officer_assigned, c.reviewer?.name]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(q),
    );
  }, [cases, query]);

  return (
    <div className="stack page-enter" style={{ '--gap': '22px' }}>
      <div className="spread">
        <div>
          <h2 className="page-title">Before and after</h2>
          <p className="page-lede">
            Every case that&rsquo;s been closed out, with how the place looked when it was reported
            and how it looked when the crew finished. An inspector signs off each one.
          </p>
        </div>

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
            placeholder="Search finished work…"
            aria-label="Search completed work"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            style={{ paddingLeft: 34, width: 250 }}
          />
        </div>
      </div>

      {loading && (
        <div className="work-grid">
          {[0, 1].map((i) => (
            <div className="work-card" key={i}>
              <div className="work-card-media">
                <div className="skeleton" style={{ height: 120, borderRadius: 8 }} />
              </div>
              <div className="work-card-body">
                <div className="skeleton" style={{ height: 14, width: '70%' }} />
                <div className="skeleton" style={{ height: 12, width: '45%' }} />
              </div>
            </div>
          ))}
        </div>
      )}

      {!loading && shown.length === 0 && (
        <div className="card">
          <EmptyState
            icon={query ? SearchX : Hammer}
            title={query ? 'Nothing matches that' : 'No finished work yet'}
          >
            {query
              ? 'Try a shorter search term, or clear it to see everything.'
              : 'Once a crew closes a case and an inspector signs it off, it shows up here.'}
          </EmptyState>
        </div>
      )}

      {!loading && shown.length > 0 && (
        <div className="work-grid">
          {shown.map((c, i) => (
            <article className="work-card anim-rise" key={c.id ?? i} style={{ '--i': i }}>
              <div className="work-card-media">
                <BeforeAfter item={c} />
              </div>

              <div className="work-card-body">
                <div>
                  <div className="row" style={{ '--gap': '8px', marginBottom: 6 }}>
                    <span className="mono hint">#{c.id}</span>
                    <span className="chip">{c.category || 'General'}</span>
                  </div>
                  <h3 style={{ fontSize: 15 }}>{c.title}</h3>
                  {c.description && (
                    <p className="hint" style={{ marginTop: 5, lineHeight: 1.55 }}>
                      {c.description}
                    </p>
                  )}
                </div>

                {(c.before_note || c.after_note) && (
                  <div className="stack" style={{ '--gap': '5px' }}>
                    {c.before_note && (
                      <p className="ba-note" style={{ margin: 0 }}>
                        <b style={{ color: 'var(--c-ink-2)' }}>Reported:</b> {c.before_note}
                      </p>
                    )}
                    {c.after_note && (
                      <p className="ba-note" style={{ margin: 0 }}>
                        <b style={{ color: 'var(--c-ink-2)' }}>Done:</b> {c.after_note}
                      </p>
                    )}
                  </div>
                )}

                <div className="work-meta">
                  <span className="row" style={{ '--gap': '7px' }}>
                    <MapPin size={13} aria-hidden="true" style={{ flex: 'none' }} />
                    {c.location || 'Location not recorded'}
                  </span>
                  <span className="row" style={{ '--gap': '7px' }}>
                    <Hammer size={13} aria-hidden="true" style={{ flex: 'none' }} />
                    {c.department || 'Municipal'}
                    {c.officer_assigned ? ` · ${c.officer_assigned}` : ''}
                  </span>
                  {c.reviewer?.name && (
                    <span className="row" style={{ '--gap': '7px' }}>
                      <ShieldCheck
                        size={13}
                        aria-hidden="true"
                        style={{ flex: 'none', color: 'var(--c-ok)' }}
                      />
                      Signed off by {c.reviewer.name}
                    </span>
                  )}
                  {c.resolved_at && (
                    <span className="row tnum" style={{ '--gap': '7px' }}>
                      <CalendarCheck size={13} aria-hidden="true" style={{ flex: 'none' }} />
                      Closed {when(c.resolved_at)}
                    </span>
                  )}
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
