import { Link, useNavigate } from 'react-router-dom';
import { Search } from 'lucide-react';
import Landing from '../../components/Landing';
import { useComplaints } from '../../lib/complaintsContext';

/**
 * The public front door.
 *
 * The marketing content itself lives in <Landing> and is shared with nothing
 * else; this page's job is to connect its two calls to action to real routes
 * and to add the one entry point Landing has no notion of — coming back later
 * to check on a report you already filed.
 */
export default function Home() {
  const navigate = useNavigate();
  const { complaints } = useComplaints();

  return (
    <>
      <Landing
        complaints={complaints}
        onReport={() => navigate('/report')}
        // Citizens get the public before/after gallery here, not the
        // login-gated dashboard — a CTA shouldn't dead-end at a password.
        onSeeWork={() => navigate('/work')}
      />

      <section className="band landing" style={{ marginInline: 'auto' }}>
        <div className="band-head" style={{ marginBottom: 16 }}>
          <span className="eyebrow">Already reported something?</span>
          <h2>Check where your case got to</h2>
          <p>
            Your reference number came back on the confirmation screen. It&rsquo;s enough to see the
            department, the engineer it went to, and the photo of the finished work.
          </p>
        </div>

        <Link className="btn btn-lg" to="/track">
          <Search size={16} aria-hidden="true" />
          Track a report
        </Link>
      </section>
    </>
  );
}
