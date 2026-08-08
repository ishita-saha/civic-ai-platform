import { useCallback, useEffect, useMemo, useState } from 'react';
import * as api from '../lib/api';
import { AuthContext } from '../lib/authContext';

const SESSION_KEY = 'civicfix.session';

/**
 * ============================ READ THIS ============================
 * Sign-in now goes to the API (`POST /auth/login`) instead of matching
 * against a list of credentials compiled into this file, so the
 * password for an account is no longer sitting in the JS bundle.
 *
 * It is still NOT security. The session is a plain object in
 * localStorage with nothing signed; edit it in devtools and you are
 * whoever you say you are, as far as this app is concerned. The one
 * thing the server actually checks is the admin key it hands back on
 * an admin login — every write on the admin routes requires that
 * header, so a citizen session cannot verify a report or dispatch a
 * crew no matter what it claims about itself.
 *
 * Citizen reads are still open: `curl localhost:8000/complaints`
 * returns the list to anybody. See ARCHITECTURE.md → "Auth".
 * ==================================================================
 */

function readSession() {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    // Corrupt or unreadable storage shouldn't take the whole app down.
    return null;
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(readSession);
  const [demoAccounts, setDemoAccounts] = useState([]);
  // 'loading' | 'ready' | 'failed' — the login screen explains a failure rather
  // than silently dropping the sign-in shortcuts.
  const [rosterState, setRosterState] = useState('loading');

  // The admin key travels with the session; api.js needs it on every request,
  // including the first one after a page reload restored an existing session.
  useEffect(() => {
    api.setAdminKey(user?.admin_key);
  }, [user]);

  // Keep tabs in sync — signing out in one should sign out the rest.
  useEffect(() => {
    const onStorage = (e) => {
      if (e.key === SESSION_KEY) setUser(readSession());
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  /**
   * The roster behind the one-click sign-in buttons. Fetched rather than
   * hardcoded so the accounts on screen are the accounts that exist.
   *
   * Retried, because the common local sequence is `npm run dev` first and
   * `python main.py` second: one attempt at mount would come back empty, and
   * the administrator account — the only one of its kind — would stay invisible
   * until a manual reload. Three tries over ~6s covers a backend starting a
   * moment behind the browser without polling forever.
   */
  useEffect(() => {
    let live = true;
    let timer;

    const attempt = async (remaining) => {
      const list = await api.fetchDemoAccounts();
      if (!live) return;

      if (list.length) {
        setDemoAccounts(list);
        setRosterState('ready');
      } else if (remaining > 0) {
        timer = setTimeout(() => attempt(remaining - 1), 2000);
      } else {
        setRosterState('failed');
      }
    };

    attempt(2);

    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, []);

  const adopt = useCallback((session) => {
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    api.setAdminKey(session?.admin_key);
    setUser(session);
    return session;
  }, []);

  const signIn = useCallback(
    async (email, password) => adopt(await api.login(email, password)),
    [adopt],
  );

  /** Citizens only — the API decides the role, this just carries the form. */
  const signUp = useCallback(
    async (details) => adopt(await api.signup(details)),
    [adopt],
  );

  const signOut = useCallback(() => {
    localStorage.removeItem(SESSION_KEY);
    api.setAdminKey(null);
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({
      user,
      isAdmin: user?.role === 'admin',
      isCitizen: !!user && user.role !== 'admin',
      signIn,
      signUp,
      signOut,
      demoAccounts,
      rosterState,
    }),
    [user, signIn, signUp, signOut, demoAccounts, rosterState],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
