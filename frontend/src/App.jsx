import { useCallback, useEffect, useState } from 'react';
import {
  Home,
  LayoutDashboard,
  LogOut,
  Megaphone,
  Moon,
  ShieldCheck,
  Sun,
} from 'lucide-react';
import AdminDashboard from './components/AdminDashboard';
import { AuthProvider } from './components/AuthProvider';
import Landing from './components/Landing';
import Login from './components/Login';
import ReportForm from './components/ReportForm';
import { ToastProvider } from './components/Toast';
import { listComplaints, readableError } from './lib/api';
import { useAuth } from './lib/authContext';
import { initials } from './lib/format';
import { useToast } from './lib/toastContext';

const TABS = [
  { id: 'home', label: 'Home', icon: Home },
  { id: 'report', label: 'Report an issue', icon: Megaphone },
  { id: 'admin', label: 'Dashboard', icon: LayoutDashboard },
];

/** Tab lives in the URL hash so refresh and the back button both behave. */
function tabFromHash() {
  const id = window.location.hash.replace('#', '');
  return TABS.some((t) => t.id === id) ? id : 'home';
}

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

function AppShell() {
  const toast = useToast();
  const { user, signOut } = useAuth();
  const [theme, toggleTheme] = useTheme();
  const [tab, setTab] = useState(tabFromHash);
  const [complaints, setComplaints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(null);

  useEffect(() => {
    const onHash = () => setTab(tabFromHash());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const go = (id) => {
    window.location.hash = id;
    setTab(id);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const load = useCallback(
    async ({ announce = false } = {}) => {
      setLoading(true);
      try {
        setComplaints(await listComplaints());
        setLastUpdated(new Date());
        if (announce) toast.success('Up to date', 'Latest cases pulled from the server.');
      } catch (err) {
        toast.error('Could not load cases', readableError(err));
      } finally {
        setLoading(false);
      }
    },
    [toast],
  );

  useEffect(() => {
    load();
  }, [load]);

  const handleSignOut = () => {
    signOut();
    toast.info('Signed out', 'The dashboard is locked again.');
    go('home');
  };

  return (
    <>
      <header className="topbar">
        <div className="shell topbar-inner">
          <button
            type="button"
            className="brand"
            onClick={() => go('home')}
            style={{ background: 'none', border: 0, padding: 0, cursor: 'pointer', textAlign: 'left' }}
            aria-label="CivicFix home"
          >
            <span className="brand-mark">
              <ShieldCheck size={18} aria-hidden="true" />
            </span>
            <span>
              <span className="brand-name">CivicFix</span>
              <span className="brand-sub" style={{ display: 'block' }}>
                Geo-verified civic reporting
              </span>
            </span>
          </button>

          <div className="row" style={{ '--gap': '10px' }}>
            <div className="segmented" role="tablist" aria-label="Sections">
              {TABS.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  role="tab"
                  aria-selected={tab === t.id}
                  // The visible label is hidden on narrow screens, so the name
                  // has to live on the button itself.
                  aria-label={t.label}
                  onClick={() => go(t.id)}
                >
                  <t.icon size={15} aria-hidden="true" />
                  <span className="tab-label">{t.label}</span>
                </button>
              ))}
            </div>

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
                  onClick={handleSignOut}
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
          {tab === 'home' && (
            <Landing
              complaints={complaints}
              onReport={() => go('report')}
              onDashboard={() => go('admin')}
            />
          )}

          {tab === 'report' && <ReportForm onSubmitted={load} />}

          {/* The dashboard exposes reporters' names and phone numbers, so it
              only renders for a signed-in staff session. */}
          {tab === 'admin' &&
            (user ? (
              <AdminDashboard
                complaints={complaints}
                loading={loading}
                onRefresh={() => load({ announce: true })}
                lastUpdated={lastUpdated}
              />
            ) : (
              <Login onSignedIn={() => toast.success('Signed in', 'Welcome back.')} />
            ))}
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

export default function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <AppShell />
      </ToastProvider>
    </AuthProvider>
  );
}
