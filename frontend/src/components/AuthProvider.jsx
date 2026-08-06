import { useCallback, useEffect, useMemo, useState } from 'react';
import { AuthContext } from '../lib/authContext';

const SESSION_KEY = 'civicfix.session';

/**
 * ============================ READ THIS ============================
 * This is a CLIENT-SIDE GATE, NOT SECURITY.
 *
 * The credentials below live in the JS bundle, and the FastAPI backend
 * accepts unauthenticated requests from anyone — `curl localhost:8000/
 * complaints` returns every citizen's name and phone number regardless
 * of whether you are "signed in" here.
 *
 * What this DOES buy you: the dashboard stops being the first thing a
 * stranger sees, and there is now exactly one seam to replace when real
 * auth arrives. Swap the body of `signIn` for a Supabase call (or a
 * POST to a real /auth/login), keep the same return shape, and every
 * consumer of useAuth() keeps working untouched.
 *
 * Do not ship this to production as-is. See ARCHITECTURE.md → "Auth".
 * ==================================================================
 */
const DEMO_STAFF = [
  {
    email: 'inspector@kmc.gov.in',
    password: 'civicfix',
    name: 'Dr. Ananya Sen',
    role: 'Chief Quality & Audit Inspector',
    department: 'Audit & Inspection',
    empId: 'AUD-KMC-9042',
  },
  {
    email: 'pwd@kmc.gov.in',
    password: 'civicfix',
    name: 'Er. Sourav Banerjee',
    role: 'Superintending Civil Engineer',
    department: 'Public Works',
    empId: 'PWD-EXEC-1108',
  },
];

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

  // Keep tabs in sync — signing out in one should sign out the rest.
  useEffect(() => {
    const onStorage = (e) => {
      if (e.key === SESSION_KEY) setUser(readSession());
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const signIn = useCallback(async (email, password) => {
    // Small delay so the pending state is real rather than a flicker.
    await new Promise((r) => setTimeout(r, 450));

    const match = DEMO_STAFF.find(
      (s) => s.email.toLowerCase() === email.trim().toLowerCase() && s.password === password,
    );
    if (!match) throw new Error('That email and password combination is not recognised.');

    const { password: _pw, ...session } = match;
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    setUser(session);
    return session;
  }, []);

  const signOut = useCallback(() => {
    localStorage.removeItem(SESSION_KEY);
    setUser(null);
  }, []);

  const value = useMemo(() => ({ user, signIn, signOut, demoStaff: DEMO_STAFF }), [
    user,
    signIn,
    signOut,
  ]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
