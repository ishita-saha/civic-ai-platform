import { MapPin, ExternalLink, ImageOff } from 'lucide-react';
import StatusBadge from './StatusBadge';
import { ago, caseId, coords, initials, mapsUrl, placeName, statusOf, when } from '../lib/format';

function SkeletonRows({ cols }) {
  return Array.from({ length: 3 }, (_, r) => (
    <tr key={r}>
      {Array.from({ length: cols }, (_, c) => (
        <td key={c}>
          <div className="skeleton" style={{ height: 12, width: `${45 + ((r + c) % 4) * 14}%` }} />
        </td>
      ))}
    </tr>
  ));
}

export default function ComplaintTable({ items, showResolutionColumns = false, loading = false }) {
  const cols = showResolutionColumns ? 7 : 5;

  return (
    <div className="table-scroll">
      <table className={`data${showResolutionColumns ? ' data-wide' : ''}`}>
        <thead>
          <tr>
            <th scope="col">Case</th>
            <th scope="col">Issue</th>
            <th scope="col">Location</th>
            <th scope="col">Assigned to</th>
            {showResolutionColumns && <th scope="col">Completed work</th>}
            {showResolutionColumns && <th scope="col">Verified by</th>}
            <th scope="col">Reported by</th>
          </tr>
        </thead>

        <tbody>
          {loading && <SkeletonRows cols={cols} />}

          {!loading &&
            items.map((item, i) => {
              const department = item.department || `${item.category || 'Municipal'} Department`;
              const officer = item.officer_assigned || item.assigned_officer;
              const reviewer = item.reviewer || {
                name: item.reviewer_name || 'Inspection team',
                designation: 'Quality review',
                emp_id: '—',
              };
              const gps = coords(item);
              const link = mapsUrl(item);
              // Reports filed from the app store their coordinates as the
              // location string too — don't print the same numbers twice.
              const place = placeName(item);
              const placeIsCoords = !!gps && place.replace(/\s/g, '') === gps.replace(/\s/g, '');
              const filed = ago(item.timestamp || item.created_at);

              return (
                <tr key={caseId(item, i)} style={{ '--i': i }}>
                  <td>
                    <div className="mono" style={{ color: 'var(--c-ink)', fontWeight: 600 }}>
                      #{caseId(item, i)}
                    </div>
                    <div className="cell-sub tnum" style={{ margin: '4px 0 7px' }}>
                      {when(item.timestamp || item.created_at)}
                    </div>
                    <StatusBadge status={statusOf(item)} />
                    {/* Age matters while a case is still open; once it's closed
                        the resolution date is the interesting number. */}
                    {statusOf(item) !== 'resolved' && filed && (
                      <div className="cell-sub" style={{ marginTop: 6 }}>
                        open {filed.replace(' ago', '')}
                      </div>
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
                        {link && (
                          <a
                            href={link}
                            target="_blank"
                            rel="noreferrer"
                            className="cell-sub"
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 4,
                              marginTop: 5,
                              color: 'var(--c-brand)',
                              textDecoration: 'none',
                            }}
                          >
                            Open in Maps <ExternalLink size={11} aria-hidden="true" />
                          </a>
                        )}
                      </div>
                    </div>
                  </td>

                  <td>
                    <div style={{ color: 'var(--c-ink)' }}>{department}</div>
                    <div className="cell-sub" style={{ marginTop: 4 }}>
                      {officer || 'Awaiting assignment'}
                    </div>
                  </td>

                  {showResolutionColumns && (
                    <td>
                      {item.completed_photo ? (
                        <a href={item.completed_photo} target="_blank" rel="noreferrer">
                          <img
                            className="thumb"
                            src={item.completed_photo}
                            alt={`Completed work for ${item.title || 'this case'}`}
                            loading="lazy"
                          />
                        </a>
                      ) : (
                        <span className="row cell-sub" style={{ '--gap': '5px' }}>
                          <ImageOff size={13} aria-hidden="true" /> No photo
                        </span>
                      )}
                    </td>
                  )}

                  {showResolutionColumns && (
                    <td>
                      <div className="person">
                        <span className="avatar" aria-hidden="true">
                          {initials(reviewer.name)}
                        </span>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ color: 'var(--c-ink)', fontWeight: 550 }}>
                            {reviewer.name}
                          </div>
                          <div className="cell-sub">{reviewer.designation}</div>
                          <div className="cell-sub mono" style={{ marginTop: 2 }}>
                            {reviewer.emp_id}
                          </div>
                        </div>
                      </div>
                    </td>
                  )}

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
