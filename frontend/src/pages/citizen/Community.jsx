import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { History, MapPin, MessageSquare, RefreshCw, SearchX, Users, X } from 'lucide-react';
import EmptyState from '../../components/EmptyState';
import PostComposer from '../../components/PostComposer';
import SeverityBadge from '../../components/SeverityBadge';
import StatusBadge from '../../components/StatusBadge';
import UpvoteButton from '../../components/UpvoteButton';
import { useAuth } from '../../lib/authContext';
import { useComplaints } from '../../lib/complaintsContext';
import { useFlip } from '../../lib/useFlip';
import { ago, initials, placeName, severityRank, statusOf, upvotesOf, when } from '../../lib/format';

/**
 * The resident-facing portal: one shared feed of everything neighbours have
 * raised, and a button to say "this one too".
 *
 * The ordering choice is the whole point of the screen. "Most backed" is the
 * default because a problem twelve people have hit is a different problem from
 * one person's — and because that number is half of what ranks the admin's
 * queue, so a resident can see the effect of their own press.
 */
const SORTS = [
  { key: 'top', label: 'Most backed' },
  { key: 'severe', label: 'Most serious' },
  { key: 'new', label: 'Newest' },
];

function filedAt(c) {
  const d = new Date(c?.timestamp || c?.created_at || 0);
  return Number.isNaN(d.getTime()) ? 0 : d.getTime();
}

/**
 * What the topbar search actually searches.
 *
 * Title, description, category and place — the four fields a resident would
 * describe a report by. Deliberately not the author's name: "find everything
 * my neighbour posted" is not a thing this feed should make easy.
 *
 * A bare number matches the case reference, because that is what people paste
 * in from a confirmation screen.
 */
function matches(c, q) {
  if (/^#?\d+$/.test(q)) return String(c.id) === q.replace('#', '');

  return [c.title, c.description, c.category, placeName(c)]
    .filter(Boolean)
    .some((field) => String(field).toLowerCase().includes(q));
}

export default function Community() {
  const { user } = useAuth();
  const { complaints, loading, refresh, patchOne, addOne } = useComplaints();
  const [sort, setSort] = useState('top');
  const [mineOnly, setMineOnly] = useState(false);
  const [params, setParams] = useSearchParams();

  const query = (params.get('q') || '').trim().toLowerCase();

  // The feed slides cards between ranks instead of cutting to the new order —
  // see useFlip. Attached to the list wrapper below.
  const feedRef = useFlip();

  // A post you just filed lands at the bottom under "Most backed", because it
  // has no backing yet. Ringing it for a moment is how you find it there.
  const [freshId, setFreshId] = useState(null);
  const freshTimer = useRef(0);

  useEffect(() => () => clearTimeout(freshTimer.current), []);

  const markFresh = (record) => {
    addOne(record);
    if (record?.id == null) return;

    setFreshId(record.id);
    clearTimeout(freshTimer.current);
    freshTimer.current = setTimeout(() => setFreshId(null), 2800);
  };

  const feed = useMemo(() => {
    const list = complaints.filter(
      (c) => (!mineOnly || c.author?.id === user?.id) && (!query || matches(c, query)),
    );

    const ranked = [...list];

    if (sort === 'top') {
      ranked.sort((a, b) => upvotesOf(b) - upvotesOf(a) || filedAt(b) - filedAt(a));
    } else if (sort === 'severe') {
      ranked.sort((a, b) => severityRank(a) - severityRank(b) || upvotesOf(b) - upvotesOf(a));
    } else {
      ranked.sort((a, b) => filedAt(b) - filedAt(a));
    }

    return ranked;
  }, [complaints, mineOnly, query, sort, user?.id]);

  const backedByMe = complaints.filter((c) => c.voters?.includes(user?.id)).length;
  const mine = complaints.filter((c) => c.author?.id === user?.id).length;

  return (
    <div className="stack page-enter" style={{ '--gap': '14px' }}>
      <PostComposer onPosted={markFresh} />

      {/* The sort strip stays put as you scroll. On a long feed, having to
          scroll back to the top to change the order is the reason people
          never change the order. */}
      <div className="feedbar">
        <div className="segmented" role="tablist" aria-label="Sort the feed">
          {SORTS.map((s) => (
            <button
              key={s.key}
              type="button"
              role="tab"
              aria-selected={sort === s.key}
              onClick={() => setSort(s.key)}
            >
              {s.label}
            </button>
          ))}
        </div>

        <div className="row" style={{ '--gap': '8px' }}>
          <span className="hint tab-label">
            {mine} posted · {backedByMe} backed by you
          </span>

          <button
            type="button"
            className={`btn${mineOnly ? ' btn-primary' : ''}`}
            aria-pressed={mineOnly}
            onClick={() => setMineOnly((v) => !v)}
          >
            <Users size={15} aria-hidden="true" />
            {mineOnly ? 'Showing yours' : 'Only mine'}
          </button>

          <button
            type="button"
            className="btn btn-ghost btn-icon"
            onClick={() => refresh({ announce: true })}
            disabled={loading}
            aria-label="Refresh the feed"
            title="Refresh the feed"
          >
            <RefreshCw
              size={15}
              className={loading ? 'spin' : undefined}
              aria-hidden="true"
            />
          </button>
        </div>
      </div>

      {/* A search that silently returns four rows out of forty looks like a
          feed that has lost thirty-six posts. Say what is being filtered, and
          put the way out right next to it. */}
      {query && (
        <div className="row" style={{ '--gap': '10px', flexWrap: 'wrap' }}>
          <span className="hint">
            {feed.length} {feed.length === 1 ? 'report' : 'reports'} matching
          </span>

          <button
            type="button"
            className="btn"
            onClick={() => {
              params.delete('q');
              setParams(params, { replace: true });
            }}
          >
            &ldquo;{params.get('q')}&rdquo;
            <X size={14} aria-hidden="true" />
          </button>
        </div>
      )}

      {loading && complaints.length === 0 && (
        <div className="stack" style={{ '--gap': '12px' }}>
          {[0, 1, 2].map((i) => (
            <div className="card" key={i}>
              <div className="card-body stack" style={{ '--gap': '10px' }}>
                <div className="skeleton" style={{ height: 15, width: '60%' }} />
                <div className="skeleton" style={{ height: 12, width: '90%' }} />
                <div className="skeleton" style={{ height: 12, width: '40%' }} />
              </div>
            </div>
          ))}
        </div>
      )}

      {!loading && feed.length === 0 && (
        <div className="card">
          {query ? (
            <EmptyState icon={SearchX} title={`Nothing matching “${params.get('q')}”`}>
              Searches cover the headline, the description, the category and the street. A bare
              number is treated as a case reference.
            </EmptyState>
          ) : (
            <EmptyState
              icon={MessageSquare}
              title={mineOnly ? 'You have not posted yet' : 'Nothing on the feed'}
            >
              {mineOnly
                ? 'Anything you raise shows up here, along with how many neighbours backed it.'
                : 'Be the first — raise something above and neighbours can back it.'}
            </EmptyState>
          )}
        </div>
      )}

      <div className="stack" style={{ '--gap': '12px' }} ref={feedRef}>
        {feed.map((c, i) => (
          <article
            className={`card post anim-rise${c.id === freshId ? ' post-fresh' : ''}`}
            key={c.id}
            data-flip-key={c.id}
            style={{ '--i': i }}
          >
            <div className="post-body">
              <div className="post-rail">
                <UpvoteButton
                  item={c}
                  onChanged={(updated) => patchOne(c.id, updated)}
                />
              </div>

              <div className="stack" style={{ '--gap': '9px', minWidth: 0 }}>
                {/* Who, where and when — before the headline, because on a
                    feed those three are half of how you decide whether the
                    headline is even yours to care about. */}
                <div className="post-meta">
                  <span className="row" style={{ '--gap': '7px' }}>
                    <span className="avatar" aria-hidden="true">
                      {initials(c.author?.name || c.complainant?.fullName)}
                    </span>

                    <span style={{ color: 'var(--c-ink-2)', fontWeight: 550 }}>
                      {c.author?.name || c.complainant?.fullName || 'Anonymous'}
                    </span>

                    {c.author?.id === user?.id && <span className="chip">You</span>}
                  </span>

                  <span className="row" style={{ '--gap': '6px' }}>
                    <MapPin
                      size={13}
                      aria-hidden="true"
                      style={{ color: 'var(--c-ink-4)' }}
                    />
                    {placeName(c)}
                  </span>

                  <span className="dot" aria-hidden="true" />

                  <span
                    className="tnum"
                    title={when(c.timestamp || c.created_at)}
                  >
                    {ago(c.timestamp || c.created_at) ||
                      when(c.timestamp || c.created_at)}
                  </span>
                </div>

                <h3 style={{ fontSize: 16.5 }}>
                  {c.title || 'Untitled report'}
                </h3>

                {/* Persistent evidence photo.
                    New complaints uploaded through the image endpoint contain
                    image_url from Supabase Storage. Older complaints without
                    an image_url simply continue without showing anything. */}
                {c.image_url && (
                  <div
                    style={{
                      marginTop: 4,
                      borderRadius: 12,
                      overflow: 'hidden',
                      border: '1px solid var(--c-border)',
                      background: 'var(--c-surface-2)',
                    }}
                  >
                    <img
                      src={c.image_url}
                      alt={`Evidence for ${c.title || 'civic issue'}`}
                      style={{
                        display: 'block',
                        width: '100%',
                        maxHeight: 360,
                        objectFit: 'cover',
                      }}
                      loading="lazy"
                    />
                  </div>
                )}

                {c.description && (
                  <p
                    className="hint"
                    style={{ lineHeight: 1.6, fontSize: 13.5 }}
                  >
                    {c.description}
                  </p>
                )}

                {/* Classification below the text it was derived from, not
                    above it — these are the desk's reading of the post, and
                    they should not be the first thing you read instead. */}
                <div
                  className="row"
                  style={{ '--gap': '8px', flexWrap: 'wrap' }}
                >
                  <span className="chip">{c.category || 'General'}</span>
                  <SeverityBadge item={c} />
                  <StatusBadge status={statusOf(c)} />

                  {c.verified && (
                    <span className="chip">
                      Verified by {c.verified_by || 'the desk'}
                    </span>
                  )}
                </div>

                <div className="post-actions">
                  <Link
                    className="post-action"
                    to={`/complaint/${encodeURIComponent(c.id)}`}
                  >
                    <History size={15} aria-hidden="true" />
                    See the history
                  </Link>

                  {/* The reference, not an action — so it does not get the pill
                      treatment that would make it look pressable. */}
                  <span
                    className="mono hint"
                    style={{ marginLeft: 6, fontSize: 12 }}
                  >
                    #{c.id}
                  </span>
                </div>
              </div>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}