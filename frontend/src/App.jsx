import { useEffect, useState } from 'react';
import {
  BrowserRouter,
  Link,
  Navigate,
  NavLink,
  Outlet,
  Route,
  Routes,
  useLocation,
  useNavigate,
  useSearchParams,
} from 'react-router-dom';
import {
  BarChart3,
  Compass,
  Home as HomeIcon,
  Images,
  LayoutDashboard,
  Lock,
  LogIn,
  LogOut,
  Megaphone,
  Moon,
  Search,
  Sun,
  Table2,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import { AuthProvider } from './components/AuthProvider';
import { ComplaintsProvider } from './components/ComplaintsProvider';
import EmptyState from './components/EmptyState';
import Logo from './components/Logo';
import PastWork from './components/PastWork';
import ReportForm from './components/ReportForm';
import { ToastProvider } from './components/Toast';
import { useAuth } from './lib/authContext';
import { useComplaints } from './lib/complaintsContext';
import { initials, statusOf, upvotesOf } from './lib/format';
import { useToast } from './lib/toastContext';
import Login from './pages/Login';
import Signup from './pages/Signup';
import AdminAnalytics from './pages/admin/Analytics';
import AdminComplaintDetails from './pages/admin/ComplaintDetails';
import AdminDashboard from './pages/admin/Dashboard';
import AdminTriage from './pages/admin/Triage';
import Community from './pages/citizen/Community';
import CitizenComplaintDetails from './pages/citizen/ComplaintDetails';
import Home from './pages/citizen/Home';
import TrackComplaint from './pages/citizen/TrackComplaint';

/**
 * The nav is the clearest statement of what each role's portal *is*, so it is
 * built per role rather than shown-and-disabled. An admin has no use for the
 * citizen report form; a resident has no business seeing a link to the triage
 * queue they cannot open.
 *
 * A signed-out visitor gets no nav at all. Every destination behind it needs an
 * account, and a row of links that all bounce back to where you started is
 * worse than no row.
 *
 * Grouped, and the groups are titled. Flat, these are nine links of equal
 * weight; grouped, they say what the app is — a place you read, a thing you
 * file, a record you check. That is worth two lines of chrome.
 */
const NAV = {
  guest: [],
  citizen: [
    {
      label: 'Feeds',
      items: [
        { to: '/', label: 'Home', icon: HomeIcon, end: true },
        { to: '/community', label: 'Community', icon: Users },
      ],
    },
    {
      label: 'Your reports',
      items: [
        { to: '/report', label: 'Report an issue', icon: Megaphone },
        { to: '/track', label: 'Track a case', icon: Search },
      ],
    },
    {
      label: 'The record',
      items: [{ to: '/work', label: 'Past work', icon: Images }],
    },
  ],
  admin: [
    {
      label: 'Feeds',
      items: [
        { to: '/', label: 'Home', icon: HomeIcon, end: true },
        { to: '/community', label: 'Community', icon: Users },
      ],
    },
    {
      label: 'The desk',
      items: [
        { to: '/admin', label: 'Triage queue', icon: LayoutDashboard, end: true },
        { to: '/admin/cases', label: 'All cases', icon: Table2 },
        { to: '/admin/analytics', label: 'Analytics', icon: BarChart3 },
      ],
    },
    {
      label: 'The record',
      items: [{ to: '/work', label: 'Past work', icon: Images }],
    },
  ],
};

/**
 * The landing page and the two auth screens run full-bleed. They are read
 * rather than worked in, and wrapping a marketing hero in a navigation rail
 * that points at pages you cannot open yet is how a front door ends up
 * looking like a settings screen.
 */
const BARE = new Set(['/', '/login', '/signup']);

function useTheme() {
  const [theme, setTheme] = useState(() => {
    const saved = localStorage.getItem('spotit.theme');
    if (saved === 'light' || saved === 'dark') return saved;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem('spotit.theme', theme);
  }, [theme]);

  return [theme, () => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))];
}

/**
 * A router keeps the scroll position across navigations by default, which lands
 * you halfway down a page you have never seen. Reset on every path change —
 * but not on a query-string change, since that's a filter, not a new page.
 */
function useScrollReset() {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [pathname]);
}

/**
 * Before the router, sections were addressed by URL hash — `#admin`, `#report`.
 * Anyone who bookmarked one or pasted it into an email still has that link, and
 * it now lands on the home page with a hash nothing reads. Translate the four
 * that existed, once, on first load.
 */
const LEGACY_HASH = { home: '/', report: '/report', work: '/work', admin: '/admin' };

function useLegacyHashRedirect() {
  const navigate = useNavigate();

  useEffect(() => {
    const target = LEGACY_HASH[window.location.hash.replace('#', '')];
    if (!target) return;

    // Drop the hash first, or it survives the navigation and re-triggers on
    // any later remount.
    window.history.replaceState(null, '', window.location.pathname + window.location.search);
    navigate(target, { replace: true });
  }, [navigate]);
}

/**
 * Gate for every route except the landing page and the two auth screens.
 *
 * A signed-out visitor is sent to the landing page, not to the login form. The
 * landing page is the front door: it explains what this is and carries both
 * calls to action. Dropping a stranger straight onto a password field asks them
 * to authenticate to something they have not been told about yet.
 *
 * The intended destination rides along in the query so the landing page's own
 * sign-in link can resume it — a deep link to `/complaint/42` still ends up at
 * `/complaint/42` once you have an account.
 *
 * A CLIENT-SIDE gate. It decides what gets rendered, not what the API answers —
 * `curl localhost:8000/complaints` still returns the list to anyone. What is
 * genuinely enforced server-side is the admin's write access: verifying a
 * report or moving a case needs the key only an admin login hands back.
 */
function useLandingRedirect() {
  const location = useLocation();
  const next = encodeURIComponent(location.pathname + location.search);
  return `/?next=${next}`;
}

function RequireAuth() {
  const { user } = useAuth();
  const back = useLandingRedirect();

  if (!user) return <Navigate to={back} replace />;

  return <Outlet />;
}

/** Same, for the one account that has the case controls. */
function RequireAdmin() {
  const { user, isAdmin } = useAuth();
  const back = useLandingRedirect();

  if (!user) return <Navigate to={back} replace />;

  if (!isAdmin) {
    // A signed-in resident is not sent to the login form — they are already
    // signed in, and bouncing them there suggests the wrong password is the
    // problem. Say what the rule is instead.
    return (
      <div className="page-enter" style={{ maxWidth: 560, margin: '40px auto 0' }}>
        <div className="card">
          <EmptyState icon={Lock} title="That area is the administrator's">
            Case verification and dispatch sit with the corporation&rsquo;s admin account. Your
            reports and your upvotes are on the community feed.
          </EmptyState>
          <div className="card-body" style={{ paddingTop: 0, textAlign: 'center' }}>
            <Link className="btn btn-primary" to="/community">
              Back to the feed
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return <Outlet />;
}

/**
 * The topbar search. It is a real control, not a decoration: it puts `?q=` on
 * the community feed, which is the only screen with enough rows to be worth
 * searching.
 *
 * Kept uncontrolled-ish on purpose — local state while you type, committed on
 * submit. Filtering the feed on every keystroke means the list reflows under
 * the cursor, and the one thing worse than not finding your post is watching
 * it move while you look for it.
 */
function SearchBox() {
  const navigate = useNavigate();
  const location = useLocation();
  const [params] = useSearchParams();
  const active = params.get('q') || '';
  const [term, setTerm] = useState(active);

  // Someone else can change the query — the clear button on the feed, a back
  // navigation. Follow it, or the box keeps showing a search that has ended.
  useEffect(() => setTerm(active), [active, location.pathname]);

  const submit = (e) => {
    e.preventDefault();
    const q = term.trim();
    navigate(q ? `/community?q=${encodeURIComponent(q)}` : '/community');
  };

  return (
    <form className="searchbar" role="search" onSubmit={submit}>
      <Search size={16} className="search-icon" aria-hidden="true" />
      <input
        type="search"
        value={term}
        onChange={(e) => setTerm(e.target.value)}
        placeholder="Search the feed — a street, a pothole, a case number"
        aria-label="Search reports"
      />
      {term && (
        <button
          type="button"
          className="search-clear"
          onClick={() => {
            setTerm('');
            if (active) navigate('/community');
          }}
          aria-label="Clear search"
        >
          <X size={14} />
        </button>
      )}
    </form>
  );
}

function SideNav({ groups }) {
  return (
    <nav className="sidenav" aria-label="Sections">
      {groups.map((group) => (
        <div className="sidenav-group" key={group.label}>
          <span className="sidenav-label">{group.label}</span>
          {group.items.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.end}>
              <item.icon size={17} aria-hidden="true" />
              {item.label}
            </NavLink>
          ))}
        </div>
      ))}

      <p className="sidenav-note">
        Kolkata Municipal Corporation pilot. Reports are public; the desk&rsquo;s decisions on them
        are too.
      </p>
    </nav>
  );
}

/**
 * The right column. Everything in it is context you read once and then stop
 * seeing — what this place is, how big it is, what the rules are.
 *
 * Nothing here is a control. If an action lives out at the edge of a 1340px
 * layout, it is an action nobody on a laptop will ever find.
 */
function SideRail() {
  const { complaints } = useComplaints();
  const { isAdmin } = useAuth();

  const resolved = complaints.filter((c) => statusOf(c) === 'resolved').length;

  return (
    <aside className="rail">
      <div
        className="rail-card resolved-counter-card"
        style={{ textAlign: 'center' }}
      >
        <div
          className="resolved-counter"
          aria-live="polite"
          style={{ padding: '28px 20px 24px' }}
        >
          <div
            className="resolved-counter-number"
            style={{
              fontFamily: 'var(--f-mono)',
              fontSize: 'clamp(4rem, 7vw, 6.5rem)',
              fontWeight: 800,
              lineHeight: 0.9,
              letterSpacing: '-0.08em',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {String(resolved).padStart(3, '0')}
          </div>

          <div
            className="resolved-counter-label"
            style={{
              marginTop: '18px',
              fontFamily: 'var(--f-mono)',
              fontSize: '0.78rem',
              fontWeight: 700,
              letterSpacing: '0.18em',
              lineHeight: 1.2,
            }}
          >
            RESOLVED CASES
          </div>
        </div>

        <div className="rail-body">
          <Link className="btn btn-primary" to={isAdmin ? '/admin' : '/report'}>
            {isAdmin ? 'Open the triage queue' : 'Report an issue'}
          </Link>
        </div>
      </div>

      <div className="rail-card">
        <div className="rail-body">
          <h4>How the queue is ordered</h4>
          <ol className="rail-rules">
            <li>Severity is classified from the words in the report, not from who filed it.</li>
            <li>Backing is one press per account. The bonus is capped, so popular never outranks dangerous.</li>
            <li>Nothing is dispatched before the desk has verified it is real.</li>
            <li>A case closes with a photo of the finished work, or it does not close.</li>
          </ol>
        </div>
      </div>
    </aside>
  );
}

function Shell() {
  const toast = useToast();
  const { user, isAdmin, signOut } = useAuth();
  const { loading } = useComplaints();
  const [theme, toggleTheme] = useTheme();
  const navigate = useNavigate();
  const { pathname } = useLocation();

  useScrollReset();
  useLegacyHashRedirect();

  const groups = user ? (isAdmin ? NAV.admin : NAV.citizen) : NAV.guest;

  // Signed out, or on the front door: no columns. The grid only earns its
  // keep once there is a feed to put in the middle of it.
  const bare = !user || BARE.has(pathname);

  return (
    <>
      <header className="topbar">
        <div className="shell topbar-inner">
          {/* Always the landing page, signed in or not — it is the one screen
              that explains the whole thing, so it stays one click away. */}
          <Link to="/" className="brand" aria-label="Spotit home" style={{ textDecoration: 'none' }}>
            <span className="brand-mark">
              <Logo size={30} />
            </span>
            <span>
              <span className="brand-name">Spotit</span>
              <span className="brand-sub" style={{ display: 'block' }}>
                Spot it. Back it. Watch it get fixed.
              </span>
            </span>
          </Link>

          {user && <SearchBox />}

          <div className="topbar-actions">
            {user ? (
              <>
                {!isAdmin && (
                  <Link className="btn btn-primary" to="/report">
                    <Megaphone size={15} aria-hidden="true" />
                    <span className="tab-label">Report</span>
                  </Link>
                )}

                <div className="whoami">
                  <span
                    className="avatar"
                    aria-hidden="true"
                    style={isAdmin ? { background: 'var(--c-ok-soft)', color: 'var(--c-ok)' } : undefined}
                  >
                    {initials(user.name)}
                  </span>
                  <span className="whoami-text" style={{ minWidth: 0, lineHeight: 1.2 }}>
                    <span style={{ display: 'block', fontSize: 13, fontWeight: 560, color: 'var(--c-ink)' }}>
                      {user.name}
                    </span>
                    <span className="hint" style={{ fontSize: 11 }}>
                      {isAdmin ? 'Administrator' : user.title || 'Resident'}
                    </span>
                  </span>
                  <button
                    type="button"
                    className="btn btn-ghost btn-icon"
                    onClick={() => {
                      signOut();
                      navigate('/');
                      toast.info('Signed out', 'The feed is still readable — posting and voting are not.');
                    }}
                    aria-label="Sign out"
                    title="Sign out"
                  >
                    <LogOut size={15} />
                  </button>
                </div>
              </>
            ) : (
              <div className="row" style={{ '--gap': '8px' }}>
                <Link className="btn" to="/login">
                  <LogIn size={15} aria-hidden="true" />
                  <span className="tab-label">Sign in</span>
                </Link>
                <Link className="btn btn-primary" to="/signup">
                  <UserPlus size={15} aria-hidden="true" />
                  <span className="tab-label">Sign up</span>
                </Link>
              </div>
            )}

            <button
              type="button"
              className="btn btn-ghost btn-icon"
              onClick={toggleTheme}
              aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
              title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
            >
              {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
            </button>
          </div>
        </div>

        {/* The flag rule, or — while the feed is loading — a sweep across it.
            Same 2px, so nothing below it moves when loading starts. */}
        {loading ? <div className="progress" aria-hidden="true" /> : <div className="flagline" aria-hidden="true" />}
      </header>

      <main className="page">
        <div className={`shell ${bare ? 'layout-wide' : 'layout'}`}>
          {!bare && <SideNav groups={groups} />}
          <div style={{ minWidth: 0 }}>
            <Outlet />
          </div>
          {!bare && <SideRail />}
        </div>
      </main>

      <footer className="footer">
        <div className="shell spread">
          <span>Spotit — municipal issue tracking for the KMC pilot</span>
          <span>Severity is classified on filing. Priority is severity plus your neighbours.</span>
        </div>
      </footer>
    </>
  );
}

function ReportRoute() {
  const { refresh } = useComplaints();
  return <ReportForm onSubmitted={refresh} />;
}

function PastWorkRoute() {
  const { complaints, loading } = useComplaints();
  return <PastWork complaints={complaints} loading={loading} />;
}

function NotFound() {
  return (
    <div className="page-enter" style={{ maxWidth: 560, margin: '40px auto 0' }}>
      <div className="card">
        <EmptyState icon={Compass} title="That page doesn't exist">
          The link may be out of date. Everything is reachable from the home page.
        </EmptyState>
        <div className="card-body" style={{ paddingTop: 0, textAlign: 'center' }}>
          <Link className="btn btn-primary" to="/">
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          {/* Inside ToastProvider: the loader reports failures as toasts. */}
          <ComplaintsProvider>
            <Routes>
              <Route element={<Shell />}>
                {/* The only three screens a signed-out visitor can reach. */}
                <Route index element={<Home />} />
                <Route path="login" element={<Login />} />
                <Route path="signup" element={<Signup />} />

                <Route element={<RequireAuth />}>
                  <Route path="community" element={<Community />} />
                  <Route path="report" element={<ReportRoute />} />
                  <Route path="track" element={<TrackComplaint />} />
                  <Route path="work" element={<PastWorkRoute />} />
                  <Route path="complaint/:id" element={<CitizenComplaintDetails />} />
                </Route>

                <Route path="admin" element={<RequireAdmin />}>
                  <Route index element={<AdminTriage />} />
                  <Route path="cases" element={<AdminDashboard />} />
                  <Route path="analytics" element={<AdminAnalytics />} />
                  <Route path="case/:id" element={<AdminComplaintDetails />} />
                </Route>

                <Route path="*" element={<NotFound />} />
              </Route>
            </Routes>
          </ComplaintsProvider>
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
