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
  ShieldCheck,
  Sun,
  Table2,
  UserPlus,
  Users,
} from 'lucide-react';
import { AuthProvider } from './components/AuthProvider';
import { ComplaintsProvider } from './components/ComplaintsProvider';
import EmptyState from './components/EmptyState';
import PastWork from './components/PastWork';
import ReportForm from './components/ReportForm';
import { ToastProvider } from './components/Toast';
import { useAuth } from './lib/authContext';
import { useComplaints } from './lib/complaintsContext';
import { initials } from './lib/format';
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
 */
const NAV = {
  guest: [],
  citizen: [
    { to: '/', label: 'Home', icon: HomeIcon, end: true },
    { to: '/community', label: 'Community', icon: Users },
    { to: '/report', label: 'Report an issue', icon: Megaphone },
    { to: '/track', label: 'Track', icon: Search },
    { to: '/work', label: 'Past work', icon: Images },
  ],
  admin: [
    { to: '/', label: 'Home', icon: HomeIcon, end: true },
    { to: '/admin', label: 'Triage', icon: LayoutDashboard, end: true },
    { to: '/admin/cases', label: 'All cases', icon: Table2 },
    { to: '/admin/analytics', label: 'Analytics', icon: BarChart3 },
    { to: '/work', label: 'Past work', icon: Images },
  ],
};

function useTheme() {
  const [theme, setTheme] = useState(() => {
    const saved = localStorage.getItem('civicfix.theme');
    if (saved === 'light' || saved === 'dark') return saved;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem('civicfix.theme', theme);
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

function Shell() {
  const toast = useToast();
  const { user, isAdmin, signOut } = useAuth();
  const { loading } = useComplaints();
  const [theme, toggleTheme] = useTheme();
  const navigate = useNavigate();

  useScrollReset();
  useLegacyHashRedirect();

  const nav = user ? (isAdmin ? NAV.admin : NAV.citizen) : NAV.guest;

  return (
    <>
      <header className="topbar">
        <div className="shell topbar-inner">
          {/* Always the landing page, signed in or not — it is the one screen
              that explains the whole thing, so it stays one click away. */}
          <Link to="/" className="brand" aria-label="CivicFix home" style={{ textDecoration: 'none' }}>
            <span className="brand-mark">
              <ShieldCheck size={18} aria-hidden="true" />
            </span>
            <span>
              <span className="brand-name">CivicFix</span>
              <span className="brand-sub" style={{ display: 'block' }}>
                Report it, back it, watch it get fixed
              </span>
            </span>
          </Link>

          <div className="row" style={{ '--gap': '10px' }}>
            <nav className="segmented" aria-label="Sections">
              {nav.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  // The visible label is hidden on narrow screens, so the name
                  // has to live on the link itself.
                  aria-label={item.label}
                >
                  <item.icon size={15} aria-hidden="true" />
                  <span className="tab-label">{item.label}</span>
                </NavLink>
              ))}
            </nav>

            {user ? (
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

        {loading && <div className="progress" aria-hidden="true" />}
      </header>

      <main className="page">
        <div className="shell">
          <Outlet />
        </div>
      </main>

      <footer className="footer">
        <div className="shell spread">
          <span>CivicFix — municipal issue tracking</span>
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
