import { Link, useNavigate } from 'react-router-dom';
import { Search } from 'lucide-react';
import Landing from '../../components/Landing';
import { useAuth } from '../../lib/authContext';
import { useComplaints } from '../../lib/complaintsContext';

/**
 * The public front door, and the only page a signed-out visitor can reach.
 *
 * The marketing content lives in <Landing>; this page's job is to connect its
 * calls to action to real routes and to add the one entry point Landing has no
 * notion of — coming back later to check on a report you already filed.
 *
 * That tracking band only shows to a signed-in visitor. Everything behind it
 * needs an account now, and offering a button that bounces you back to this
 * page is worse than not offering it.
 */
export default function Home() {
  const navigate = useNavigate();
  const { user } = useAuth();
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

      {user && (
        <section className="band landing" style={{ marginInline: 'auto' }}>
          <div className="band-head" style={{ marginBottom: 16 }}>
            <span className="eyebrow">Already reported something?</span>
            <h2>Check where your case got to</h2>
            <p>
              Your reference number came back on the confirmation screen. It&rsquo;s enough to see
              the department, the engineer it went to, and the photo of the finished work.
            </p>
          </div>

          <Link className="btn btn-lg" to="/track">
            <Search size={16} aria-hidden="true" />
            Track a report
          </Link>
        </section>
      )}
    </>
  );
}
