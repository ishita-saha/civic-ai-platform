import { Link, useSearchParams } from 'react-router-dom';
import {
  ArrowRight,
  Camera,
  ChevronUp,
  LayoutDashboard,
  Lock,
  LogIn,
  MapPin,
  ShieldCheck,
  UserPlus,
  Users,
} from 'lucide-react';
import BeforeAfter from './BeforeAfter';
import { useAuth } from '../lib/authContext';
import { demoResolved } from '../lib/demoData';
import { statusOf, upvotesOf } from '../lib/format';

const PIPELINE = [
  {
    n: 1,
    title: 'Posted',
    body: 'A resident puts the problem on the community feed — what it is, where it is, how long it has been like that.',
  },
  {
    n: 2,
    title: 'Backed',
    body: 'Neighbours who have hit the same thing press the arrow. One vote per account, so the number means what it says.',
  },
  {
    n: 3,
    title: 'Ranked',
    body: 'Severity is classified from the report’s own words and combined with the backing count. That ordering is the admin’s queue.',
  },
  {
    n: 4,
    title: 'Verified, then worked',
    body: 'The administrator checks the report is real before anything is dispatched. Only then can it move to "work in progress", and then to closed.',
  },
];

/**
 * The front door, for three different visitors: a resident who has never signed
 * up, one who has, and the administrator.
 *
 * The hero's call to action changes for each — sending a signed-in resident to
 * a "create an account" button is the fastest way to look like nobody tested
 * the page.
 */
export default function Landing({ complaints, onReport, onSeeWork }) {
  const { user, isAdmin } = useAuth();
  const [params] = useSearchParams();

  // Set when a guard bounced somebody here from a page that needs an account.
  // Carrying it through both auth links means a deep link survives the detour.
  const next = params.get('next');
  const withNext = (path) => {
    if (!next) return path;
    // `/login?as=admin` already carries a query — appending a second `?` would
    // fold the whole thing into one unparsed parameter.
    return `${path}${path.includes('?') ? '&' : '?'}next=${encodeURIComponent(next)}`;
  };

  const resolvedCount = complaints.filter((c) => statusOf(c) === 'resolved').length || demoResolved.length;
  const backing = complaints.reduce((sum, c) => sum + upvotesOf(c), 0);

  return (
    <div className="landing page-enter">
      {next && !user && (
        <div className="geo geo-pending" style={{ marginTop: 20 }}>
          <Lock size={15} aria-hidden="true" style={{ flex: 'none' }} />
          <span>
            That page needs an account. Sign in or sign up below and we&rsquo;ll take you
            straight there.
          </span>
        </div>
      )}

      {/* ---- Hero ---- */}
      <section className="hero">
        <span className="eyebrow">Kolkata Municipal Corporation · pilot</span>
        <h1>
          Report it once.
          <br />
          <em>Then watch the street back you up.</em>
        </h1>
        <p className="hero-lede">
          Post the pothole, the streetlight that&rsquo;s been dark a fortnight, the bin nobody has
          emptied. Neighbours who have hit the same thing back it, and the ones with the most
          backing — weighted by how dangerous they are — go to the top of the corporation&rsquo;s
          queue.
        </p>

        <div className="hero-actions">
          {!user && (
            <>
              <Link className="btn btn-primary btn-lg" to={withNext('/signup')}>
                <UserPlus size={17} aria-hidden="true" />
                Create a resident account
              </Link>
              <Link className="btn btn-lg" to={withNext('/login')}>
                <LogIn size={16} aria-hidden="true" />
                Sign in
              </Link>
            </>
          )}

          {user && !isAdmin && (
            <>
              <Link className="btn btn-primary btn-lg" to="/community">
                <Users size={17} aria-hidden="true" />
                Open the community feed
              </Link>
              <button type="button" className="btn btn-lg" onClick={onReport}>
                <Camera size={16} aria-hidden="true" />
                File a formal report
              </button>
            </>
          )}

          {isAdmin && (
            <>
              <Link className="btn btn-primary btn-lg" to="/admin">
                <LayoutDashboard size={17} aria-hidden="true" />
                Open the triage queue
              </Link>
              <button type="button" className="btn btn-lg" onClick={onSeeWork}>
                See what&rsquo;s been fixed
                <ArrowRight size={16} aria-hidden="true" />
              </button>
            </>
          )}
        </div>

        <div className="tally">
          <span>
            <b>{complaints.length}</b> problems raised
          </span>
          <span>
            <b>{backing}</b> times backed by a neighbour
          </span>
          <span>
            <b>{resolvedCount}</b> closed with photo proof
          </span>
        </div>
      </section>

      {/* ---- Two portals ---- */}
      <section className="band">
        <div className="band-head">
          <span className="eyebrow">Two ways in</span>
          <h2>Residents post and vote. One administrator acts.</h2>
          <p>
            Anyone can sign up as a resident. There is a single municipal account —
            Ishita&rsquo;s — and it is the only one that can verify a report or send a crew.
            It is issued by the corporation, not created here.
          </p>
        </div>

        <div className="portal-grid">
          <div className="portal-card">
            <span className="stat-icon" style={{ '--tone': 'var(--c-brand)', '--tone-soft': 'var(--c-brand-soft)' }}>
              <Users size={17} aria-hidden="true" />
            </span>
            <h4>The resident portal</h4>
            <p>
              A shared feed of everything the neighbourhood has raised. Post your own, and press the
              arrow on anyone else&rsquo;s to say it affects you too — one press per account.
            </p>
            <Link className="btn" to={user && !isAdmin ? '/community' : withNext('/signup')}>
              {user && !isAdmin ? 'Open the feed' : 'Sign up to post'}
              <ArrowRight size={15} aria-hidden="true" />
            </Link>
          </div>

          <div className="portal-card">
            <span className="stat-icon" style={{ '--tone': 'var(--c-ok)', '--tone-soft': 'var(--c-ok-soft)' }}>
              <ShieldCheck size={17} aria-hidden="true" />
            </span>
            <h4>The administrator&rsquo;s queue</h4>
            <p>
              The same reports, ranked by classified severity and backing count. Each one has to be
              verified before a crew can be dispatched to it — the server refuses the change
              otherwise, not just the button.
            </p>
            <Link className="btn" to={isAdmin ? '/admin' : withNext('/login?as=admin')}>
              {isAdmin ? 'Open the queue' : 'Administrator sign-in'}
              <ArrowRight size={15} aria-hidden="true" />
            </Link>
          </div>
        </div>
      </section>

      {/* ---- The one rule ---- */}
      <section className="band">
        <div className="band-head">
          <span className="eyebrow">Why the backing count matters</span>
          <h2>A pothole twelve people hit is a different pothole</h2>
        </div>
        <div className="prose">
          <p>
            The old paper form treated every complaint as one voice. A road that half the ward
            drives over daily and a cracked kerb outside one house arrived at the desk looking
            identical, and were worked in the order they were opened.
          </p>
          <p>
            So the queue here reads two numbers. <strong>Severity</strong> is classified from the
            words in the report — &ldquo;open manhole&rdquo; and &ldquo;live wire&rdquo; outrank
            &ldquo;faded paint&rdquo; regardless of who is watching. <strong>Backing</strong> is how
            many residents pressed the arrow. The backing bonus is capped on purpose: popularity
            moves a case up, but it never lets a nuisance outrank a hazard.
          </p>
        </div>
      </section>

      {/* ---- Pipeline ---- */}
      <section className="band">
        <div className="band-head">
          <span className="eyebrow">After you press post</span>
          <h2>Where your problem goes</h2>
          <p>Four states, and every one of them is visible on the feed — including the queue.</p>
        </div>

        <div className="timeline">
          {PIPELINE.map((s, i) => (
            <div className="step anim-rise" key={s.n} style={{ '--i': i }}>
              <span className="step-mark">{s.n === 2 ? <ChevronUp size={15} /> : s.n}</span>
              <div>
                <h4>{s.title}</h4>
                <p>{s.body}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ---- Worked example ---- */}
      <section className="band">
        <div className="band-head">
          <span className="eyebrow">One that closed</span>
          <h2>What a finished case looks like</h2>
        </div>

        <div className="case-study">
          <div style={{ padding: 14 }}>
            <BeforeAfter item={demoResolved[0]} />
          </div>
          <div className="case-study-body stack" style={{ '--gap': '12px' }}>
            <div>
              <span className="mono hint">#{demoResolved[0].id}</span>
              <h4 style={{ fontSize: 16, margin: '4px 0 6px' }}>{demoResolved[0].title}</h4>
              <p className="hint" style={{ lineHeight: 1.6 }}>
                {demoResolved[0].description}
              </p>
            </div>

            <div className="stack" style={{ '--gap': '4px' }}>
              <p className="ba-note" style={{ margin: 0 }}>
                <b style={{ color: 'var(--c-ink-2)' }}>Reported:</b> {demoResolved[0].before_note}
              </p>
              <p className="ba-note" style={{ margin: 0 }}>
                <b style={{ color: 'var(--c-ink-2)' }}>Done:</b> {demoResolved[0].after_note}
              </p>
            </div>

            <div className="stack" style={{ '--gap': '7px', fontSize: 13.5 }}>
              <span className="row" style={{ '--gap': '7px' }}>
                <MapPin size={13} aria-hidden="true" style={{ color: 'var(--c-ink-4)' }} />
                {demoResolved[0].location}
              </span>
              <span className="row" style={{ '--gap': '7px' }}>
                <ShieldCheck size={13} aria-hidden="true" style={{ color: 'var(--c-ok)' }} />
                Signed off by {demoResolved[0].reviewer.name}, {demoResolved[0].reviewer.designation}
              </span>
            </div>

            <p className="hint">
              Handled by {demoResolved[0].department} · {demoResolved[0].officer_assigned}
            </p>
          </div>
        </div>
      </section>

      {/* ---- Close ---- */}
      <section className="band">
        <div className="band-head" style={{ marginBottom: 18 }}>
          <h2>Something broken on your street?</h2>
          <p>
            {user
              ? 'Put it on the feed — it takes about a minute.'
              : 'Sign up as a resident. It takes about twenty seconds, and the feed is waiting.'}
          </p>
        </div>
        {user && !isAdmin ? (
          <Link className="btn btn-primary btn-lg" to="/community">
            <Users size={17} aria-hidden="true" />
            Go to the feed
          </Link>
        ) : (
          <Link className="btn btn-primary btn-lg" to={isAdmin ? '/admin' : withNext('/signup')}>
            {isAdmin ? (
              <>
                <LayoutDashboard size={17} aria-hidden="true" />
                Open the triage queue
              </>
            ) : (
              <>
                <UserPlus size={17} aria-hidden="true" />
                Create an account
              </>
            )}
          </Link>
        )}
      </section>
    </div>
  );
}
