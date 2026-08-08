import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { MapPin, MessageSquare, RefreshCw, Users } from 'lucide-react';
import EmptyState from '../../components/EmptyState';
import PostComposer from '../../components/PostComposer';
import SeverityBadge from '../../components/SeverityBadge';
import StatusBadge from '../../components/StatusBadge';
import UpvoteButton from '../../components/UpvoteButton';
import { useAuth } from '../../lib/authContext';
import { useComplaints } from '../../lib/complaintsContext';
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

export default function Community() {
  const { user } = useAuth();
  const { complaints, loading, refresh, patchOne, addOne } = useComplaints();
  const [sort, setSort] = useState('top');
  const [mineOnly, setMineOnly] = useState(false);

  const feed = useMemo(() => {
    const list = complaints.filter((c) => !mineOnly || c.author?.id === user?.id);

    const ranked = [...list];
    if (sort === 'top') {
      ranked.sort((a, b) => upvotesOf(b) - upvotesOf(a) || filedAt(b) - filedAt(a));
    } else if (sort === 'severe') {
      ranked.sort((a, b) => severityRank(a) - severityRank(b) || upvotesOf(b) - upvotesOf(a));
    } else {
      ranked.sort((a, b) => filedAt(b) - filedAt(a));
    }
    return ranked;
  }, [complaints, mineOnly, sort, user?.id]);

  const backedByMe = complaints.filter((c) => c.voters?.includes(user?.id)).length;
  const mine = complaints.filter((c) => c.author?.id === user?.id).length;

  return (
    <div className="stack page-enter" style={{ '--gap': '20px', maxWidth: 820, margin: '0 auto' }}>
      <div className="spread" style={{ alignItems: 'flex-start' }}>
        <div>
          <h2 className="page-title">Community feed</h2>
          <p className="page-lede">
            Everything the neighbourhood has raised. Back the ones you have hit yourself — the
            count moves a case up the corporation&rsquo;s queue.
          </p>
        </div>
        <button type="button" className="btn" onClick={() => refresh({ announce: true })} disabled={loading}>
          <RefreshCw size={15} className={loading ? 'spin' : undefined} aria-hidden="true" />
          Refresh
        </button>
      </div>

      <PostComposer onPosted={addOne} />

      <div className="card-head" style={{ padding: 0, border: 0 }}>
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

        <div className="row" style={{ '--gap': '10px' }}>
          <span className="hint">
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
        </div>
      </div>

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
          <EmptyState icon={MessageSquare} title={mineOnly ? 'You have not posted yet' : 'Nothing on the feed'}>
            {mineOnly
              ? 'Anything you raise shows up here, along with how many neighbours backed it.'
              : 'Be the first — raise something above and neighbours can back it.'}
          </EmptyState>
        </div>
      )}

      <div className="stack" style={{ '--gap': '12px' }}>
        {feed.map((c, i) => (
          <article className="card post anim-rise" key={c.id} style={{ '--i': i }}>
            <div className="post-body">
              <div className="post-rail">
                <UpvoteButton item={c} onChanged={(updated) => patchOne(c.id, updated)} />
              </div>

              <div className="stack" style={{ '--gap': '10px', minWidth: 0 }}>
                <div className="row" style={{ '--gap': '8px', flexWrap: 'wrap' }}>
                  <span className="mono hint">#{c.id}</span>
                  <span className="chip">{c.category || 'General'}</span>
                  <SeverityBadge item={c} />
                  <StatusBadge status={statusOf(c)} />
                  {c.verified && <span className="chip">Verified by {c.verified_by || 'the desk'}</span>}
                </div>

                <h3 style={{ fontSize: 16 }}>{c.title || 'Untitled report'}</h3>

                {c.description && (
                  <p className="hint" style={{ lineHeight: 1.6, fontSize: 13.5 }}>
                    {c.description}
                  </p>
                )}

                <div className="post-meta">
                  <span className="row" style={{ '--gap': '7px' }}>
                    <span className="avatar" aria-hidden="true">
                      {initials(c.author?.name || c.complainant?.fullName)}
                    </span>
                    <span>
                      {c.author?.name || c.complainant?.fullName || 'Anonymous'}
                      {c.author?.id === user?.id && <span className="chip" style={{ marginLeft: 7 }}>You</span>}
                    </span>
                  </span>

                  <span className="row" style={{ '--gap': '6px' }}>
                    <MapPin size={13} aria-hidden="true" style={{ color: 'var(--c-ink-4)' }} />
                    {placeName(c)}
                  </span>

                  <span className="hint tnum" title={when(c.timestamp || c.created_at)}>
                    {ago(c.timestamp || c.created_at) || when(c.timestamp || c.created_at)}
                  </span>

                  <Link className="row" style={{ '--gap': '5px', fontSize: 13 }} to={`/complaint/${encodeURIComponent(c.id)}`}>
                    See the history
                  </Link>
                </div>
              </div>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
