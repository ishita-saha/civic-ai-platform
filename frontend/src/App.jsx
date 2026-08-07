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
  Compass,
  Home as HomeIcon,
  Images,
  LayoutDashboard,
  LogOut,
  Megaphone,
  Moon,
  Search,
  ShieldCheck,
  Sun,
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
import AdminAnalytics from './pages/admin/Analytics';
import AdminComplaintDetails from './pages/admin/ComplaintDetails';
import AdminDashboard from './pages/admin/Dashboard';
import CitizenComplaintDetails from './pages/citizen/ComplaintDetails';
import Home from './pages/citizen/Home';
import Login from './pages/citizen/Login';
import TrackComplaint from './pages/citizen/TrackComplaint';

const NAV = [
  { to: '/', label: 'Home', icon: HomeIcon, end: true },
  { to: '/report', label: 'Report an issue', icon: Megaphone },
  { to: '/track', label: 'Track', icon: Search },
  { to: '/work', label: 'Past work', icon: Images },
  { to: '/admin', label: 'Dashboard', icon: LayoutDashboard },
];

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
 * Gate for the staff routes.
 *
 * This is a CLIENT-SIDE gate, not security — the FastAPI backend still answers
 * unauthenticated requests, so `curl localhost:8000/complaints` returns every
 * reporter's name and phone number whatever this component does. See the note
 * at the top of AuthProvider.jsx.
 *
 * What it does buy: the dashboard isn't the first thing a stranger sees, and
 * there's one seam to replace when real auth arrives.
 */
function RequireAuth() {
  const { user } = useAuth();
  const location = useLocation();

  if (!user) {
    // Carry the intended destination so signing in resumes it rather than
    // dumping everyone on the dashboard root.
    const next = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/login?next=${next}`} replace />;
  }

  return <Outlet />;
}

function Shell() {
  const toast = useToast();
  const { user, signOut } = useAuth();
  const { loading } = useComplaints();
  const [theme, toggleTheme] = useTheme();

  useScrollReset();
  useLegacyHashRedirect();

  return (
    <>
      <header className="topbar">
        <div className="shell topbar-inner">
          <Link to="/" className="brand" aria-label="CivicFix home" style={{ textDecoration: 'none' }}>
            <span className="brand-mark">
              <ShieldCheck size={18} aria-hidden="true" />
            </span>
            <span>
              <span className="brand-name">CivicFix</span>
              <span className="brand-sub" style={{ display: 'block' }}>
                Geo-verified civic reporting
              </span>
            </span>
          </Link>

          <div className="row" style={{ '--gap': '10px' }}>
            <nav className="segmented" aria-label="Sections">
              {NAV.map((item) => (
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

            {user && (
              <div className="whoami">
                <span className="avatar" aria-hidden="true">
                  {initials(user.name)}
                </span>
                <span className="whoami-text" style={{ minWidth: 0, lineHeight: 1.2 }}>
                  <span style={{ display: 'block', fontSize: 13, fontWeight: 560, color: 'var(--c-ink)' }}>
                    {user.name}
                  </span>
                  <span className="hint" style={{ fontSize: 11 }}>
                    {user.department}
                  </span>
                </span>
                <button
                  type="button"
                  className="btn btn-ghost btn-icon"
                  onClick={() => {
                    signOut();
                    toast.info('Signed out', 'The dashboard is locked again.');
                  }}
                  aria-label="Sign out"
                  title="Sign out"
                >
                  <LogOut size={15} />
                </button>
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
          <span>Every report carries a GPS fix and a photo.</span>
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
                <Route index element={<Home />} />
                <Route path="report" element={<ReportRoute />} />
                <Route path="track" element={<TrackComplaint />} />
                <Route path="work" element={<PastWorkRoute />} />
                <Route path="complaint/:id" element={<CitizenComplaintDetails />} />
                <Route path="login" element={<Login />} />

                <Route path="admin" element={<RequireAuth />}>
                  <Route index element={<AdminDashboard />} />
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
