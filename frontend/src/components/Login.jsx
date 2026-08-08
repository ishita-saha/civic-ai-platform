import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  AlertCircle,
  KeyRound,
  Loader2,
  LogIn,
  ShieldCheck,
  UserRound,
  WifiOff,
} from 'lucide-react';
import { readableError } from '../lib/api';
import { useAuth } from '../lib/authContext';
import { initials } from '../lib/format';

/**
 * Sign-in for both roles.
 *
 * One form, one endpoint — the role comes back from the server with the
 * account, and nothing the visitor picks here changes it. The Resident /
 * Administrator switch only changes what the page *says* and which shortcut it
 * offers; typing the admin's email under the "Resident" tab still signs you in
 * as the admin.
 *
 * That switch exists because the admin was previously discoverable only through
 * the quick-account list, which is fetched. If the API was down when the page
 * loaded, the list came back empty and the one administrator account became
 * invisible — the page offered no hint it existed at all.
 */

/**
 * The seeded administrator's address. An identifier, not a credential — it is
 * in the README and on this screen precisely so the account can be found when
 * the roster fetch has failed. The password is never hardcoded here.
 */
const ADMIN_EMAIL = 'ishita@civicfix.gov.in';

const MODES = [
  { key: 'resident', label: 'Resident' },
  { key: 'admin', label: 'Administrator' },
];

export default function Login({ onSignedIn }) {
  const { signIn, demoAccounts, rosterState } = useAuth();
  const [params] = useSearchParams();

  const [mode, setMode] = useState(params.get('as') === 'admin' ? 'admin' : 'resident');
  const [email, setEmail] = useState(params.get('as') === 'admin' ? ADMIN_EMAIL : '');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const admins = demoAccounts.filter((a) => a.role === 'admin');
  const citizens = demoAccounts.filter((a) => a.role !== 'admin');
  const adminEmail = admins[0]?.email || ADMIN_EMAIL;

  // Switching to the administrator tab fills the address, because there is
  // exactly one and making somebody guess it serves nobody. Switching back
  // clears it again rather than leaving a stale address in a resident's form.
  useEffect(() => {
    setError('');
    setEmail((current) => {
      if (mode === 'admin') return current && current !== '' ? current : adminEmail;
      return current === adminEmail ? '' : current;
    });
  }, [mode, adminEmail]);

  const attempt = async (withEmail, withPassword) => {
    setError('');
    setBusy(true);
    try {
      onSignedIn?.(await signIn(withEmail, withPassword));
    } catch (err) {
      setError(readableError(err));
      setPassword('');
    } finally {
      setBusy(false);
    }
  };

  const submit = (e) => {
    e.preventDefault();
    attempt(email, password);
  };

  /** One press fills *and* submits — on a demo, filling is just an extra click. */
  const useAccount = (account) => {
    setEmail(account.email);
    setPassword(account.password);
    attempt(account.email, account.password);
  };

  const adminMode = mode === 'admin';
  const listed = adminMode ? admins : citizens;

  return (
    <div className="page-enter" style={{ maxWidth: 440, margin: '32px auto 0' }}>
      <div style={{ textAlign: 'center', marginBottom: 20 }}>
        <span
          className="stat-icon"
          style={{
            '--tone': adminMode ? 'var(--c-ok)' : 'var(--c-brand)',
            '--tone-soft': adminMode ? 'var(--c-ok-soft)' : 'var(--c-brand-soft)',
            width: 44,
            height: 44,
            borderRadius: 'var(--r-md)',
            margin: '0 auto 14px',
          }}
        >
          {adminMode ? <ShieldCheck size={20} aria-hidden="true" /> : <LogIn size={20} aria-hidden="true" />}
        </span>
        <h2 className="page-title">{adminMode ? 'Administrator sign in' : 'Resident sign in'}</h2>
        <p className="page-lede" style={{ margin: '6px auto 0' }}>
          {adminMode
            ? 'The corporation account — the only one that can verify a report or send a crew.'
            : 'Post problems to the community feed and back the ones your neighbours raise.'}
        </p>
      </div>

      <div className="segmented" role="tablist" aria-label="Account type" style={{ display: 'flex', marginBottom: 16 }}>
        {MODES.map((m) => (
          <button
            key={m.key}
            type="button"
            role="tab"
            aria-selected={mode === m.key}
            onClick={() => setMode(m.key)}
            style={{ flex: 1, justifyContent: 'center' }}
          >
            {m.key === 'admin' ? <ShieldCheck size={14} aria-hidden="true" /> : <UserRound size={14} aria-hidden="true" />}
            {m.label}
          </button>
        ))}
      </div>

      <form className="card" onSubmit={submit} noValidate>
        <div className="card-body stack" style={{ '--gap': '16px' }}>
          <div className="field">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              className={`input${error ? ' input-invalid' : ''}`}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={adminMode ? adminEmail : 'you@example.com'}
              autoComplete="username"
              autoFocus
            />
          </div>

          <div className="field">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              className={`input${error ? ' input-invalid' : ''}`}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
            />
          </div>

          {error && (
            <span className="field-error">
              <AlertCircle size={13} aria-hidden="true" /> {error}
            </span>
          )}

          <button type="submit" className="btn btn-primary btn-lg" disabled={busy}>
            {busy ? (
              <>
                <Loader2 size={16} className="spin" aria-hidden="true" />
                Checking…
              </>
            ) : (
              <>
                <KeyRound size={16} aria-hidden="true" />
                Sign in
              </>
            )}
          </button>

          <p className="hint" style={{ textAlign: 'center' }}>
            {adminMode ? (
              <>
                There is one administrator account and it is issued by the corporation — it cannot
                be created here.
              </>
            ) : (
              <>
                No account yet? <Link to="/signup">Sign up as a resident</Link>
              </>
            )}
          </p>
        </div>
      </form>

      {/* A demo build, so the accounts are on the screen rather than in a README
          nobody opens. The API serves this roster — what's listed is what
          exists. */}
      {listed.length > 0 && (
        <div className="card" style={{ marginTop: 16, background: 'var(--c-surface-2)' }}>
          <div className="card-body stack" style={{ '--gap': '10px' }}>
            <div>
              <span className="eyebrow">Quick sign-in</span>
              <p className="hint" style={{ marginTop: 4 }}>
                Test accounts with the passwords in the open. One press signs you straight in.
              </p>
            </div>
            {listed.map((a) => (
              <QuickAccount
                key={a.email}
                account={a}
                onPick={useAccount}
                disabled={busy}
                admin={a.role === 'admin'}
              />
            ))}
          </div>
        </div>
      )}

      {/* The roster is fetched, so it can be missing. Saying why beats silently
          dropping the shortcuts and leaving somebody to guess the address. */}
      {rosterState === 'failed' && (
        <div className="card" style={{ marginTop: 16, background: 'var(--c-surface-2)' }}>
          <div className="card-body row" style={{ '--gap': '10px', alignItems: 'flex-start' }}>
            <WifiOff size={16} aria-hidden="true" style={{ marginTop: 2, flex: 'none', color: 'var(--c-warn)' }} />
            <div className="stack" style={{ '--gap': '4px', minWidth: 0 }}>
              <span style={{ fontWeight: 560, color: 'var(--c-ink)', fontSize: 13.5 }}>
                Can&rsquo;t list the demo accounts
              </span>
              <span className="hint" style={{ lineHeight: 1.5 }}>
                The API isn&rsquo;t answering on port 8000, so sign-in will fail too. Start it with{' '}
                <code className="mono">python main.py</code> in <code className="mono">backend/</code>.
                The administrator is <span className="mono">{ADMIN_EMAIL}</span>; the passwords are
                in the README.
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function QuickAccount({ account, onPick, disabled, admin }) {
  return (
    <button
      type="button"
      className="btn quick-account"
      onClick={() => onPick(account)}
      disabled={disabled}
    >
      <span
        className="avatar"
        aria-hidden="true"
        style={admin ? { background: 'var(--c-ok-soft)', color: 'var(--c-ok)' } : undefined}
      >
        {admin ? <ShieldCheck size={14} /> : initials(account.name)}
      </span>
      <span style={{ minWidth: 0 }}>
        <span className="row" style={{ '--gap': '7px' }}>
          <span style={{ fontWeight: 560 }}>{account.name}</span>
          {admin && <span className="chip">Admin</span>}
        </span>
        <span className="hint mono" style={{ display: 'block', fontWeight: 400 }}>
          {account.email} · {account.password}
        </span>
      </span>
    </button>
  );
}
